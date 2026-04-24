/**
 * Phase 1 회귀 테스트:
 * APPLYING_APPROVED → INSTALLING 자동 전이 직후
 * getConfirmedIntegration 가 비어있지 않은 응답을 반환하는지 검증.
 *
 * 신규 정책: step 4 (INSTALLING) 이후의 "연동 대상 정보" 표시는 confirmed-integration
 * 단독 소스로 결정되어야 한다.
 *
 * 대상: lib/api-client/mock/confirm.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockConfirm,
  _resetApprovedIntegrationStore,
  _fastForwardApproval,
  _setApprovedIntegration,
} from '@/lib/api-client/mock/confirm';
import { getStore } from '@/lib/mock-store';
import { setCurrentUser } from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type { Project, MockResource } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

const TEST_PROJECT_ID = 'test-confirm-step4-proj';
const TEST_TARGET_SOURCE_ID = 9998;
const TEST_TARGET_SOURCE_ID_STR = String(TEST_TARGET_SOURCE_ID);

const buildResource = (id: string, overrides?: Partial<MockResource>): MockResource => ({
  id,
  type: 'RDS',
  resourceId: `rds-${id}`,
  databaseType: 'MYSQL',
  connectionStatus: 'PENDING',
  isSelected: true,
  integrationCategory: 'TARGET',
  ...overrides,
});

const buildProject = (overrides?: Partial<Project>): Project => ({
  id: TEST_PROJECT_ID,
  targetSourceId: TEST_TARGET_SOURCE_ID,
  projectCode: 'TEST-STEP4-001',
  name: 'Test Step4',
  description: 'Step 4 confirmed-integration test',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.APPLYING_APPROVED,
  status: {
    ...createInitialProjectStatus(),
    targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
    approval: {
      status: 'APPROVED',
      approvedAt: '2026-04-23T00:00:00Z',
    },
    installation: { status: 'PENDING' },
  },
  resources: [
    buildResource('res-1'),
    buildResource('res-2'),
  ],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2026-04-23T00:00:00Z',
  updatedAt: '2026-04-23T00:00:00Z',
  isRejected: false,
  ...overrides,
});

const resetState = () => {
  const store = getStore();
  store.projects = store.projects.filter((p) => p.id !== TEST_PROJECT_ID);
  store.projectHistory = [];
  store.currentUserId = 'admin-1';
  setCurrentUser('admin-1');
  _resetApprovedIntegrationStore();
};

const seedProject = (overrides?: Partial<Project>) => {
  const store = getStore();
  const project = buildProject(overrides);
  store.projects.push(project);
  return project;
};

describe('mock confirmed-integration: step 4 (INSTALLING) 진입 직후', () => {
  beforeEach(() => {
    resetState();
  });

  it('APPLYING_APPROVED → INSTALLING 자동 전이 후 confirmed-integration 가 채워진다', async () => {
    seedProject();
    _setApprovedIntegration(TEST_TARGET_SOURCE_ID_STR);
    _fastForwardApproval(TEST_TARGET_SOURCE_ID_STR);

    const store = getStore();
    const before = store.projects.find((p) => p.id === TEST_PROJECT_ID)!;
    expect(before.status.installation.status).toBe('PENDING');

    // 자동 전이 트리거 — getProcessStatus 안의 elapsedMs >= MOCK_APPLYING_DELAY_MS 분기에서
    // installation.status: 'IN_PROGRESS' 로 업데이트 + ApprovedIntegration → ConfirmedIntegrationSnapshot 마이그레이션
    await mockConfirm.getProcessStatus(TEST_TARGET_SOURCE_ID_STR);

    const after = store.projects.find((p) => p.id === TEST_PROJECT_ID)!;
    expect(after.status.installation.status).toBe('IN_PROGRESS');

    // 핵심 검증: step 4 (INSTALLING) 진입 후 confirmed-integration 가 비어있지 않음
    const confirmedRes = await mockConfirm.getConfirmedIntegration(TEST_TARGET_SOURCE_ID_STR);
    const confirmedBody = await confirmedRes.json();
    expect(Array.isArray(confirmedBody.resource_infos)).toBe(true);
    expect(confirmedBody.resource_infos.length).toBeGreaterThan(0);
  });

  it('INSTALLING 단계에서 connectionStatus 가 PENDING 이어도 ApprovedIntegration 으로부터 derive 된다', async () => {
    seedProject({
      processStatus: ProcessStatus.INSTALLING,
      status: {
        ...createInitialProjectStatus(),
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: {
          status: 'APPROVED',
          approvedAt: '2026-04-23T00:00:00Z',
        },
        installation: { status: 'IN_PROGRESS' },
      },
      resources: [
        buildResource('res-1', { connectionStatus: 'PENDING', isSelected: true }),
        buildResource('res-2', { connectionStatus: 'PENDING', isSelected: true }),
      ],
    });

    // ApprovedIntegration store 에 res-1 / res-2 가 들어있다고 시뮬레이션
    _setApprovedIntegration(TEST_TARGET_SOURCE_ID_STR);

    const res = await mockConfirm.getConfirmedIntegration(TEST_TARGET_SOURCE_ID_STR);
    const body = await res.json();
    // installation.status !== 'PENDING' && project.resources.isSelected → derive 가 빈 배열을 반환하지 않는다
    expect(Array.isArray(body.resource_infos)).toBe(true);
    // ApprovedIntegration store 가 빈 배열로 set 되었으므로 fallback 이 #4 (project.resources selected) 로 떨어짐
    expect(body.resource_infos.length).toBeGreaterThan(0);
  });

  it('installation 이 PENDING 상태면 confirmed-integration 은 빈 배열', async () => {
    seedProject({
      processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
      status: {
        ...createInitialProjectStatus(),
        installation: { status: 'PENDING' },
      },
    });
    const res = await mockConfirm.getConfirmedIntegration(TEST_TARGET_SOURCE_ID_STR);
    const body = await res.json();
    expect(body.resource_infos).toEqual([]);
  });

  it('ApprovedIntegration 미설정 + installation IN_PROGRESS → path 4 (project.resources selected) 로 derive', async () => {
    // _setApprovedIntegration 을 호출하지 않아 approvedIntegrationStore 미설정.
    // installation.status 가 IN_PROGRESS 이므로 path 2 (PENDING 가드) 통과,
    // path 3 (ApprovedIntegration) 미존재 → path 4 fallback 로 떨어진다.
    seedProject({
      processStatus: ProcessStatus.INSTALLING,
      status: {
        ...createInitialProjectStatus(),
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: {
          status: 'APPROVED',
          approvedAt: '2026-04-23T00:00:00Z',
        },
        installation: { status: 'IN_PROGRESS' },
      },
      resources: [
        buildResource('res-1', { connectionStatus: 'PENDING', isSelected: true }),
        buildResource('res-2', { connectionStatus: 'PENDING', isSelected: false }),
      ],
    });

    const res = await mockConfirm.getConfirmedIntegration(TEST_TARGET_SOURCE_ID_STR);
    const body = await res.json();
    expect(Array.isArray(body.resource_infos)).toBe(true);
    // isSelected=true 인 res-1 만 포함되고 res-2 는 제외
    expect(body.resource_infos.length).toBe(1);
    expect(body.resource_infos[0].resource_id).toBe('rds-res-1');
  });
});
