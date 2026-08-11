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

  it('404s for an unknown target source', async () => {
    const response = await mockConfirm.resetTargetSource('123456', { reason: 'x' });
    expect(response.status).toBe(404);
  });
});
