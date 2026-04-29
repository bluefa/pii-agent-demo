import { describe, it, expect, beforeEach } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore } from '@/lib/bff/mock/confirm';
import { getStore } from '@/lib/mock-store';
import { setCurrentUser } from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type { Project, ProjectStatus, MockResource } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

const TEST_PROJECT_ID = 'test-system-reset-proj';
const TEST_TARGET_SOURCE_ID = 9001;
const TEST_TARGET_SOURCE_ID_STR = String(TEST_TARGET_SOURCE_ID);

const createTestResource = (id: string, overrides?: Partial<MockResource>): MockResource => ({
  id,
  type: 'RDS',
  resourceId: `rds-${id}`,
  databaseType: 'MYSQL',
  connectionStatus: 'PENDING',
  isSelected: false,
  integrationCategory: 'TARGET',
  ...overrides,
});

const createTestProject = (overrides?: Partial<Project>): Project => ({
  id: TEST_PROJECT_ID,
  targetSourceId: TEST_TARGET_SOURCE_ID,
  projectCode: 'TEST-RESET-001',
  name: 'Test Project (system-reset)',
  description: 'Test',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.WAITING_APPROVAL,
  status: createInitialProjectStatus(),
  resources: [createTestResource('res-1', { isSelected: true })],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  isRejected: false,
  ...overrides,
});

const resetTestState = () => {
  const store = getStore();
  store.projects = store.projects.filter((p) => p.id !== TEST_PROJECT_ID);
  store.projectHistory = [];
  store.currentUserId = 'admin-1';
  setCurrentUser('admin-1');
  _resetApprovedIntegrationStore();
};

const addRejectedProject = () => {
  const status: ProjectStatus = {
    ...createInitialProjectStatus(),
    scan: { status: 'COMPLETED' },
    targets: { confirmed: true, selectedCount: 1, excludedCount: 0 },
    approval: { status: 'REJECTED', rejectedAt: '2026-01-15T00:00:00Z', rejectionReason: '재검토' },
  };
  const project = createTestProject({
    processStatus: ProcessStatus.WAITING_APPROVAL,
    status,
    isRejected: true,
    rejectionReason: '재검토',
    rejectedAt: '2026-01-15T00:00:00Z',
  });
  getStore().projects.push(project);
  return project;
};

const parseResponse = (response: Response) => response.json();

describe('mockConfirm.systemResetApprovalRequest', () => {
  beforeEach(resetTestState);

  it('REJECTED 상태에서 호출 → 200, processStatus=WAITING_TARGET_CONFIRMATION, isRejected=false', async () => {
    addRejectedProject();

    const res = await mockConfirm.systemResetApprovalRequest(TEST_TARGET_SOURCE_ID_STR);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.result).toBe('CANCELLED');

    const project = getStore().projects.find((p) => p.id === TEST_PROJECT_ID);
    expect(project?.processStatus).toBe(ProcessStatus.WAITING_TARGET_CONFIRMATION);
    expect(project?.isRejected).toBe(false);
    expect(project?.rejectionReason).toBeUndefined();
    expect(project?.status.targets.confirmed).toBe(false);
  });

  it('REJECTED 가 아닌 상태에서 호출 → 409 APPROVAL_REQUEST_NOT_RESETTABLE', async () => {
    const status: ProjectStatus = {
      ...createInitialProjectStatus(),
      scan: { status: 'COMPLETED' },
      targets: { confirmed: true, selectedCount: 1, excludedCount: 0 },
      approval: { status: 'PENDING' },
    };
    const project = createTestProject({
      processStatus: ProcessStatus.WAITING_APPROVAL,
      status,
      isRejected: false,
    });
    getStore().projects.push(project);

    const res = await mockConfirm.systemResetApprovalRequest(TEST_TARGET_SOURCE_ID_STR);
    expect(res.status).toBe(409);

    const data = await parseResponse(res);
    expect(data.error.code).toBe('APPROVAL_REQUEST_NOT_RESETTABLE');
  });

  it('Target Source 없음 → 404', async () => {
    const res = await mockConfirm.systemResetApprovalRequest('999999');
    expect(res.status).toBe(404);
  });

  it('비로그인 → 401', async () => {
    addRejectedProject();
    setCurrentUser('non-existent-user-id');

    const res = await mockConfirm.systemResetApprovalRequest(TEST_TARGET_SOURCE_ID_STR);
    expect(res.status).toBe(401);
  });

  it('권한 없는 사용자 → 403', async () => {
    addRejectedProject();
    const store = getStore();
    const nonMember = {
      id: 'non-member-user',
      name: 'Non Member',
      email: 'non-member@example.com',
      role: 'SERVICE_MANAGER' as const,
      serviceCodePermissions: ['SERVICE-OTHER'],
    };
    store.users.push(nonMember);
    setCurrentUser(nonMember.id);

    const res = await mockConfirm.systemResetApprovalRequest(TEST_TARGET_SOURCE_ID_STR);
    expect(res.status).toBe(403);
  });
});
