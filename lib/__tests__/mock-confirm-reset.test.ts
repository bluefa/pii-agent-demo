/**
 * POST …/reset — 연동 상태 초기화 (Step 7 "인프라 변경").
 *
 * 되돌리기가 "1단계로 돌아간다"고 말하는 이상, 그 뒤의 화면은 이번 인프라에 대해 아직
 * 아무것도 하지 않은 상태여야 한다. 프로젝트 상태만 비우고 다른 저장소를 남기면 옛 연동의
 * 사실이 새 진행에 섞여 들어온다 — 이 파일은 그 누수만 본다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockConfirm } from '@/lib/bff/mock/confirm';
import { getStore } from '@/lib/mock-store';
import { setCurrentUser } from '@/lib/mock-data';
import { getCompletionStatus } from '@/lib/mock-test-connection';
import { ProcessStatus } from '@/lib/types';
import type { Project, MockResource } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

const PROJECT_ID = 'test-reset-proj';
const TARGET_SOURCE_ID = 9998;

const resource = (id: string): MockResource => ({
  id,
  type: 'RDS',
  resourceId: `rds-${id}`,
  databaseType: 'MYSQL',
  connectionStatus: 'CONNECTED',
  isSelected: true,
  integrationCategory: 'TARGET',
});

/** 7단계까지 간 과제 — 설치도 연결 확인도 끝나 있다. */
const completedProject = (): Project => ({
  id: PROJECT_ID,
  targetSourceId: TARGET_SOURCE_ID,
  projectCode: 'RESET-001',
  name: 'Reset Test',
  description: '',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.INSTALLATION_COMPLETE,
  status: {
    ...createInitialProjectStatus(),
    scan: { status: 'COMPLETED' },
    targets: { confirmed: true, selectedCount: 1, excludedCount: 0 },
    approval: { status: 'APPROVED' },
    installation: { status: 'COMPLETED' },
    connectionTest: { status: 'PASSED', passedAt: '2026-01-02T00:00:00Z', operationConfirmed: true },
  },
  resources: [resource('res-1')],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  isRejected: false,
  piiAgentInstalled: true,
  completionConfirmedAt: '2026-01-03T00:00:00Z',
  piiAgentFirstInstalledAt: '2026-01-02T09:00:00Z',
});

const findProject = () => getStore().projects.find((p) => p.id === PROJECT_ID);

beforeEach(() => {
  const store = getStore();
  store.projects = store.projects.filter((p) => p.id !== PROJECT_ID);
  store.testConnectionJobs = store.testConnectionJobs.filter(
    (j) => j.target_source_id !== TARGET_SOURCE_ID,
  );
  store.currentUserId = 'admin-1';
  setCurrentUser('admin-1');
  store.projects.push(completedProject());
});

describe('mockConfirm.resetTargetSource', () => {
  it('returns the source to step 1 and drops the finished installation', async () => {
    const response = await mockConfirm.resetTargetSource(String(TARGET_SOURCE_ID), {
      reason: '운영 DB를 신규 VPC로 이전합니다.',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('RESET');
    expect(body.reason).toBe('운영 DB를 신규 VPC로 이전합니다.');

    const project = findProject();
    expect(project?.processStatus).toBe(ProcessStatus.WAITING_TARGET_CONFIRMATION);
    expect(project?.status.targets.confirmed).toBe(false);
    expect(project?.status.installation.status).toBe('PENDING');
    expect(project?.status.connectionTest.passedAt).toBeUndefined();
    expect(project?.piiAgentInstalled).toBe(false);
    expect(project?.completionConfirmedAt).toBeUndefined();
    // 선택과 제외는 이번 연동에서 내린 판단이다 — 초기화가 되돌리는 대상.
    expect(project?.resources.every((r) => !r.isSelected)).toBe(true);
  });

  /**
   * 최초 연동 시각은 **이번** 연동의 산물이 아니라 이 대상에 한 번 일어난 일이다.
   * 초기화가 이 값을 같이 지우면 도장은 현재 단계를 따라다니는 표식이 되고, 그러면
   * 단계 알약과 같은 말을 두 번 하게 된다 — 도장이 존재할 이유가 사라진다.
   */
  it('keeps the first-integration instant — reset rewinds the process, not the history', async () => {
    await mockConfirm.resetTargetSource(String(TARGET_SOURCE_ID), { reason: 'x' });
    const project = findProject();
    expect(project?.processStatus).toBe(ProcessStatus.WAITING_TARGET_CONFIRMATION);
    expect(project?.piiAgentFirstInstalledAt).toBe('2026-01-02T09:00:00Z');
  });

  // 스캔 결과는 승인 상태가 아니라 인프라의 사실이고, 1단계가 고를 목록이 바로 그것이다.
  // 같이 지우면 초기화 직후 아무것도 고를 수 없는 화면이 뜬다.
  it('keeps the scan result — step 1 needs a list to choose from', async () => {
    await mockConfirm.resetTargetSource(String(TARGET_SOURCE_ID), { reason: 'x' });
    expect(findProject()?.status.scan.status).toBe('COMPLETED');
    expect(findProject()?.resources).toHaveLength(1);
  });

  /**
   * completion-status 의 성공 여부는 프로젝트 상태가 아니라 testConnectionJobs 의 최근 job 에서
   * 읽는다. 초기화가 그 이력을 남기면, 다시 5단계에 올라온 과제가 이번 인프라에서 한 번도
   * 테스트하지 않았는데도 옛 실행을 근거로 완료 승인 버튼을 열어 준다.
   */
  it('clears the test-connection history so a re-run is required again', async () => {
    getStore().testConnectionJobs.push({
      id: 'tc-reset-1',
      target_source_id: TARGET_SOURCE_ID,
      status: 'SUCCESS',
      requested_at: '2026-01-02T00:00:00Z',
      completed_at: '2026-01-02T00:01:00Z',
      requested_by: 'admin-1',
      resource_results: [],
    });
    expect(getCompletionStatus(TARGET_SOURCE_ID).latest_test_connection_success).toBe(true);

    await mockConfirm.resetTargetSource(String(TARGET_SOURCE_ID), { reason: 'x' });

    const completion = getCompletionStatus(TARGET_SOURCE_ID);
    expect(completion.latest_test_connection_success).toBe(false);
    expect(completion.test_connection_status).toBe('TEST_CONNECTION_REQUIRED');
  });

  /**
   * 설치 상태 조회(mock/aws.ts)는 project.status 가 아니라 terraformState 를 읽는다. 여기를
   * 남겨 두면 1단계로 내려간 과제가 4단계 조회에서는 여전히 "설치 완료"라고 답한다.
   */
  it('rewinds the terraform progress too, keeping the provider shape', async () => {
    await mockConfirm.resetTargetSource(String(TARGET_SOURCE_ID), { reason: 'x' });
    expect(findProject()?.terraformState).toEqual({ serviceTf: 'PENDING', bdcTf: 'PENDING' });
  });

  // roleVerify 는 없는 것과 PENDING 인 것의 뜻이 다르다 — 없으면 serviceTf 를 따른다.
  // 초기화가 없던 키를 만들어 내면 4단계가 없던 단계를 하나 더 그린다.
  it('does not invent terraform keys the project never had', async () => {
    const project = findProject();
    project!.terraformState = { bdcTf: 'COMPLETED' };
    await mockConfirm.resetTargetSource(String(TARGET_SOURCE_ID), { reason: 'x' });
    expect(findProject()?.terraformState).toEqual({ bdcTf: 'PENDING' });
  });

  /**
   * 프로바이더 설치 상태 조회는 캐시가 있으면 리소스를 다시 보지 않는다(mock-azure/mock-gcp 의
   * 첫 분기). 초기화가 캐시를 남기면 다시 구성한 대상이 4단계에서 초기화 전 화면을 그대로
   * 보여준다.
   */
  it('drops the provider installation cache so step 4 re-derives from the new resources', async () => {
    const { getAzureInstallationStatus, resetAzureStore } = await import('@/lib/mock-azure');
    resetAzureStore();

    // Azure 대상이어야 조회가 실제로 캐시를 채운다.
    const project = findProject()!;
    project.cloudProvider = 'Azure';
    project.tenantId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
    project.subscriptionId = '34567890-cdef-0123-4567-89abcdef0123';

    const before = getAzureInstallationStatus(TARGET_SOURCE_ID);
    expect(before.data).toBeDefined();
    // 같은 호출이 두 번째부터는 캐시를 그대로 돌려준다 — 이것이 초기화가 무력화하려는 성질이다.
    expect(getAzureInstallationStatus(TARGET_SOURCE_ID).data).toBe(before.data);

    await mockConfirm.resetTargetSource(String(TARGET_SOURCE_ID), { reason: 'x' });

    // 초기화 뒤에는 옛 객체가 아니라 지금 리소스에서 새로 만든 값이 나와야 한다.
    expect(getAzureInstallationStatus(TARGET_SOURCE_ID).data).not.toBe(before.data);
  });

  it('404s for an unknown target source', async () => {
    const response = await mockConfirm.resetTargetSource('123456', { reason: 'x' });
    expect(response.status).toBe(404);
  });
});

/**
 * 도장을 **찍는** 쪽. 초기화가 값을 남기는 것만 검사하면 목은 절반만 참이다 — 값을
 * 만들어 내는 경로가 없으면 도장은 시드된 대상에만 나타나고, 데모에서 설치 확정을
 * 끝까지 걸어도 영영 안 찍힌다.
 */
describe('mockConfirm.confirmInstallation — 최초 연동 시각', () => {
  /**
   * 6단계(연결 확인 완료, 아직 확정 전)로 올려 둔다. `confirmInstallation` 은
   * `processStatus` 가 아니라 `status` 에서 단계를 다시 계산하므로, 초기화가 되돌린
   * 뒤에는 그 status 를 다시 채워야 실제로 6단계가 된다 — 재연동이 하는 일 그대로다.
   */
  const atStepSix = () => {
    const project = findProject()!;
    project.status = {
      ...completedProject().status,
      connectionTest: {
        status: 'PASSED',
        passedAt: '2026-01-02T00:00:00Z',
        operationConfirmed: false,
      },
    };
    project.processStatus = ProcessStatus.CONNECTION_VERIFIED;
    return project;
  };

  it('설치 확정이 처음 도장을 찍는다', async () => {
    const project = atStepSix();
    delete project.piiAgentFirstInstalledAt;

    const response = await mockConfirm.confirmInstallation(String(TARGET_SOURCE_ID));
    expect(response.status).toBe(200);

    const after = findProject();
    expect(after?.processStatus).toBe(ProcessStatus.INSTALLATION_COMPLETE);
    expect(after?.piiAgentFirstInstalledAt).toBeTruthy();
  });

  /**
   * 이 한 줄이 "최초 1회" 라는 문구를 지탱한다. 재확정 때마다 값이 갱신되면 도장은
   * 마지막 완료 시각이 되고, 그러면 초기화 뒤 다시 완료한 대상에서 날짜가 움직인다.
   */
  it('초기화 뒤 다시 확정해도 날짜가 움직이지 않는다', async () => {
    const first = findProject()?.piiAgentFirstInstalledAt;
    expect(first).toBe('2026-01-02T09:00:00Z');

    await mockConfirm.resetTargetSource(String(TARGET_SOURCE_ID), { reason: 'x' });
    atStepSix();
    const response = await mockConfirm.confirmInstallation(String(TARGET_SOURCE_ID));
    expect(response.status).toBe(200);

    const after = findProject();
    expect(after?.processStatus).toBe(ProcessStatus.INSTALLATION_COMPLETE);
    expect(after?.piiAgentFirstInstalledAt).toBe(first);
  });
});
