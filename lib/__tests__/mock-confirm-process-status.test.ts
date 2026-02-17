/**
 * 연동 승인/확정 프로세스 상태 전이 테스트
 *
 * computeProcessStatus (ADR-009 D-004) + 전체 상태 전이 시나리오 검증
 * 테스트 대상: lib/api-client/mock/confirm.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore } from '@/lib/api-client/mock/confirm';
import { getStore } from '@/lib/mock-store';
import { ProcessStatus } from '@/lib/types';
import type { Project, ProjectStatus, Resource } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

// --- Helpers ---

const parseResponse = async (response: Response) => {
  return response.json();
};

const TEST_PROJECT_ID = 'test-confirm-proj';

const createTestResource = (id: string, overrides?: Partial<Resource>): Resource => ({
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
  targetSourceId: 9999,
  projectCode: 'TEST-001',
  name: 'Test Project',
  description: 'Test',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  status: createInitialProjectStatus(),
  resources: [
    createTestResource('res-1'),
    createTestResource('res-2'),
  ],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  isRejected: false,
  ...overrides,
});

const resetTestState = () => {
  const store = getStore();
  // 테스트 프로젝트 제거
  store.projects = store.projects.filter((p) => p.id !== TEST_PROJECT_ID);
  store.projectHistory = [];
  // 현재 사용자를 admin으로 설정
  store.currentUserId = 'admin-1';
  _resetApprovedIntegrationStore();
};

const addTestProject = (overrides?: Partial<Project>) => {
  const store = getStore();
  const project = createTestProject(overrides);
  store.projects.push(project);
  return project;
};

const getProcessStatus = async () => {
  const res = await mockConfirm.getProcessStatus(TEST_PROJECT_ID);
  return parseResponse(res);
};

const createApprovalRequestBody = (selectedIds: string[], excludedIds: string[] = []) => ({
  input_data: {
    resource_inputs: [
      ...selectedIds.map((id) => ({
        resource_id: id,
        selected: true as const,
      })),
      ...excludedIds.map((id) => ({
        resource_id: id,
        selected: false as const,
        exclusion_reason: '연동 불필요',
      })),
    ],
  },
});

// --- Tests ---

describe('연동 승인/확정 프로세스 상태 전이', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('computeProcessStatus (ADR-009 D-004)', () => {
    it('초기 상태: REQUEST_REQUIRED', async () => {
      addTestProject();
      const result = await getProcessStatus();

      expect(result.process_status).toBe('REQUEST_REQUIRED');
      expect(result.status_inputs.has_pending_approval_request).toBe(false);
      expect(result.status_inputs.has_approved_integration).toBe(false);
      expect(result.status_inputs.has_confirmed_integration).toBe(false);
    });

    it('승인 대기: WAITING_APPROVAL', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'PENDING' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_APPROVAL,
        status,
      });

      const result = await getProcessStatus();
      expect(result.process_status).toBe('WAITING_APPROVAL');
      expect(result.status_inputs.has_pending_approval_request).toBe(true);
    });

    it('반려 후: REQUEST_REQUIRED (last_approval_result=REJECTED)', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
        approval: { status: 'REJECTED', rejectedAt: '2026-01-15T00:00:00Z', rejectionReason: '리소스 재확인 필요' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
        status,
      });

      const result = await getProcessStatus();
      expect(result.process_status).toBe('REQUEST_REQUIRED');
      expect(result.status_inputs.last_approval_result).toBe('REJECTED');
      expect(result.status_inputs.last_rejection_reason).toBe('리소스 재확인 필요');
    });

    it('설치 완료 (확정): TARGET_CONFIRMED', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'APPROVED', approvedAt: '2026-01-10T00:00:00Z' },
        installation: { status: 'COMPLETED', completedAt: '2026-01-12T00:00:00Z' },
        connectionTest: { status: 'PASSED', passedAt: '2026-01-13T00:00:00Z' },
      };
      addTestProject({
        processStatus: ProcessStatus.INSTALLATION_COMPLETE,
        status,
      });

      const result = await getProcessStatus();
      expect(result.process_status).toBe('TARGET_CONFIRMED');
      expect(result.status_inputs.has_confirmed_integration).toBe(true);
    });
  });

  describe('시나리오 1: 수동 승인 Happy Path', () => {
    // REQUEST_REQUIRED → WAITING_APPROVAL → APPLYING_APPROVED → TARGET_CONFIRMED

    it('연동 요청 → 승인 → 설치 확정 전체 흐름', async () => {
      // 1개 선택, 1개 제외 → 수동 승인 필요 (NON_EXCLUDED_NOT_SELECTED 아닌 경우)
      // 모든 TARGET 리소스를 선택하지 않으면 수동 승인
      addTestProject({
        resources: [
          createTestResource('res-1'),
          createTestResource('res-2'),
          createTestResource('res-3', { integrationCategory: 'TARGET' }),
        ],
      });

      // Step 1: 초기 상태 확인
      let status = await getProcessStatus();
      expect(status.process_status).toBe('REQUEST_REQUIRED');

      // Step 2: 연동 요청 (2개 선택, 1개 제외 → 수동 승인)
      const reqBody = createApprovalRequestBody(['res-1', 'res-2'], ['res-3']);
      const reqRes = await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);
      expect(reqRes.status).toBe(201);

      status = await getProcessStatus();
      expect(status.process_status).toBe('WAITING_APPROVAL');

      // Step 3: 승인
      const approveRes = await mockConfirm.approveApprovalRequest(TEST_PROJECT_ID, {});
      expect(approveRes.status).toBe(200);

      status = await getProcessStatus();
      expect(status.process_status).toBe('APPLYING_APPROVED');
      expect(status.status_inputs.has_approved_integration).toBe(true);

      // Step 4: ApprovedIntegration 스냅샷 확인
      const approvedRes = await mockConfirm.getApprovedIntegration(TEST_PROJECT_ID);
      const approvedData = await parseResponse(approvedRes);
      expect(approvedData.approved_integration).not.toBeNull();
      expect(approvedData.approved_integration.resource_infos).toHaveLength(2);
      expect(approvedData.approved_integration.excluded_resource_ids).toContain('res-3');
    });
  });

  describe('시나리오 2: 자동 승인 (리뷰 P1 버그 수정)', () => {
    it('모든 리소스 선택 시 자동 승인 → APPLYING_APPROVED', async () => {
      addTestProject({
        resources: [
          createTestResource('res-1'),
          createTestResource('res-2'),
        ],
      });

      // 모든 리소스 선택 → 자동 승인
      const reqBody = createApprovalRequestBody(['res-1', 'res-2']);
      const reqRes = await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);
      expect(reqRes.status).toBe(201);

      // 자동 승인 시에도 APPLYING_APPROVED여야 함 (P1 버그 수정)
      const status = await getProcessStatus();
      expect(status.process_status).toBe('APPLYING_APPROVED');
      expect(status.status_inputs.has_approved_integration).toBe(true);
      expect(status.status_inputs.last_approval_result).toBe('APPROVED');
    });

    it('자동 승인 시 ApprovedIntegration 스냅샷 생성 확인', async () => {
      addTestProject({
        resources: [
          createTestResource('res-1'),
          createTestResource('res-2'),
        ],
      });

      const reqBody = createApprovalRequestBody(['res-1', 'res-2']);
      await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);

      const approvedRes = await mockConfirm.getApprovedIntegration(TEST_PROJECT_ID);
      const approvedData = await parseResponse(approvedRes);

      expect(approvedData.approved_integration).not.toBeNull();
      expect(approvedData.approved_integration.resource_infos).toHaveLength(2);
      expect(approvedData.approved_integration.approved_at).toBeDefined();
      expect(approvedData.approved_integration.request_id).toMatch(/^req-/);
    });
  });

  describe('시나리오 3: 반려', () => {
    it('승인 대기 → 반려 → REQUEST_REQUIRED', async () => {
      // 수동 승인 상태로 셋업
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'PENDING' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_APPROVAL,
        status,
        resources: [
          createTestResource('res-1', { isSelected: true }),
          createTestResource('res-2', { isSelected: true }),
        ],
      });

      // 반려
      const rejectRes = await mockConfirm.rejectApprovalRequest(TEST_PROJECT_ID, {
        reason: '리소스 구성 재검토 필요',
      });
      expect(rejectRes.status).toBe(200);
      const rejectData = await parseResponse(rejectRes);
      expect(rejectData.result).toBe('REJECTED');

      // 상태 확인
      const processStatus = await getProcessStatus();
      expect(processStatus.process_status).toBe('REQUEST_REQUIRED');
      expect(processStatus.status_inputs.last_approval_result).toBe('REJECTED');
      expect(processStatus.status_inputs.last_rejection_reason).toBe('리소스 구성 재검토 필요');
    });

    it('반려 사유 없으면 400 에러', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 1, excludedCount: 0 },
        approval: { status: 'PENDING' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_APPROVAL,
        status,
      });

      const rejectRes = await mockConfirm.rejectApprovalRequest(TEST_PROJECT_ID, {});
      expect(rejectRes.status).toBe(400);
    });
  });

  describe('시나리오 4: 반려 후 재요청', () => {
    it('반려 → 재요청 → WAITING_APPROVAL', async () => {
      // 반려 상태로 셋업
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
        approval: { status: 'REJECTED', rejectedAt: '2026-01-15T00:00:00Z', rejectionReason: '재검토' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
        status,
        resources: [
          createTestResource('res-1'),
          createTestResource('res-2'),
          createTestResource('res-3', { integrationCategory: 'TARGET' }),
        ],
      });

      // 재요청 (2개 선택, 1개 제외)
      const reqBody = createApprovalRequestBody(['res-1', 'res-2'], ['res-3']);
      const reqRes = await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);
      expect(reqRes.status).toBe(201);

      const processStatus = await getProcessStatus();
      expect(processStatus.process_status).toBe('WAITING_APPROVAL');
    });

    it('반려 → 재요청 → 승인 → APPLYING_APPROVED', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
        approval: { status: 'REJECTED' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
        status,
        resources: [
          createTestResource('res-1'),
          createTestResource('res-2'),
          createTestResource('res-3', { integrationCategory: 'TARGET' }),
        ],
      });

      // 재요청
      const reqBody = createApprovalRequestBody(['res-1', 'res-2'], ['res-3']);
      await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);

      // 승인
      const approveRes = await mockConfirm.approveApprovalRequest(TEST_PROJECT_ID, {});
      expect(approveRes.status).toBe(200);

      const processStatus = await getProcessStatus();
      expect(processStatus.process_status).toBe('APPLYING_APPROVED');
      expect(processStatus.status_inputs.has_approved_integration).toBe(true);
    });
  });

  describe('시나리오 5: 409 Conflict', () => {
    it('반영 중(INSTALLING) 재요청 → 409 CONFLICT_APPLYING_IN_PROGRESS', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'APPROVED', approvedAt: '2026-01-10T00:00:00Z' },
        installation: { status: 'IN_PROGRESS' },
      };
      addTestProject({
        processStatus: ProcessStatus.INSTALLING,
        status,
        resources: [
          createTestResource('res-1', { isSelected: true }),
          createTestResource('res-2', { isSelected: true }),
        ],
      });

      const reqBody = createApprovalRequestBody(['res-1', 'res-2']);
      const reqRes = await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);
      expect(reqRes.status).toBe(409);

      const data = await parseResponse(reqRes);
      expect(data.error).toBe('CONFLICT_APPLYING_IN_PROGRESS');
    });

    it('승인 대기 중(WAITING_APPROVAL) 재요청 → 409 CONFLICT_REQUEST_PENDING', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'PENDING' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_APPROVAL,
        status,
        resources: [
          createTestResource('res-1', { isSelected: true }),
          createTestResource('res-2', { isSelected: true }),
        ],
      });

      const reqBody = createApprovalRequestBody(['res-1', 'res-2']);
      const reqRes = await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);
      expect(reqRes.status).toBe(409);

      const data = await parseResponse(reqRes);
      expect(data.error).toBe('CONFLICT_REQUEST_PENDING');
    });

    it('연결 테스트 대기 중(WAITING_CONNECTION_TEST) 재요청 → 409', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 1, excludedCount: 0 },
        approval: { status: 'APPROVED' },
        installation: { status: 'COMPLETED' },
        connectionTest: { status: 'NOT_TESTED' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
        status,
        resources: [createTestResource('res-1', { isSelected: true })],
      });

      const reqBody = createApprovalRequestBody(['res-1']);
      const reqRes = await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);
      expect(reqRes.status).toBe(409);
    });
  });

  describe('시나리오 6: 설치 확정 (confirmInstallation)', () => {
    it('CONNECTION_VERIFIED → 확정 → TARGET_CONFIRMED + 스냅샷 삭제', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'APPROVED', approvedAt: '2026-01-10T00:00:00Z' },
        installation: { status: 'COMPLETED', completedAt: '2026-01-12T00:00:00Z' },
        connectionTest: { status: 'PASSED', passedAt: '2026-01-13T00:00:00Z' },
      };
      addTestProject({
        processStatus: ProcessStatus.CONNECTION_VERIFIED,
        status,
        resources: [
          createTestResource('res-1', { isSelected: true, connectionStatus: 'CONNECTED' }),
          createTestResource('res-2', { isSelected: true, connectionStatus: 'CONNECTED' }),
        ],
      });

      // 확정
      const confirmRes = await mockConfirm.confirmInstallation(TEST_PROJECT_ID);
      expect(confirmRes.status).toBe(200);

      // 확정 후 상태 확인
      const processStatus = await getProcessStatus();
      expect(processStatus.process_status).toBe('TARGET_CONFIRMED');
      expect(processStatus.status_inputs.has_confirmed_integration).toBe(true);
      expect(processStatus.status_inputs.has_approved_integration).toBe(false);

      // ApprovedIntegration 삭제 확인
      const approvedRes = await mockConfirm.getApprovedIntegration(TEST_PROJECT_ID);
      const approvedData = await parseResponse(approvedRes);
      expect(approvedData.approved_integration).toBeNull();
    });

    it('CONNECTION_VERIFIED가 아닌 상태에서 확정 시도 → 400', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 1, excludedCount: 0 },
        approval: { status: 'APPROVED' },
        installation: { status: 'IN_PROGRESS' },
      };
      addTestProject({
        processStatus: ProcessStatus.INSTALLING,
        status,
      });

      const confirmRes = await mockConfirm.confirmInstallation(TEST_PROJECT_ID);
      expect(confirmRes.status).toBe(400);
    });
  });

  describe('시나리오 7: 승인 상태가 아닌데 승인/반려 시도', () => {
    it('REQUEST_REQUIRED 상태에서 승인 시도 → 400', async () => {
      addTestProject();

      const approveRes = await mockConfirm.approveApprovalRequest(TEST_PROJECT_ID, {});
      expect(approveRes.status).toBe(400);
    });

    it('INSTALLING 상태에서 반려 시도 → 400', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'APPROVED' },
        installation: { status: 'IN_PROGRESS' },
      };
      addTestProject({
        processStatus: ProcessStatus.INSTALLING,
        status,
      });

      const rejectRes = await mockConfirm.rejectApprovalRequest(TEST_PROJECT_ID, { reason: '사유' });
      expect(rejectRes.status).toBe(400);
    });
  });

  describe('시나리오 8: 확정 후 변경 요청 (재연동)', () => {
    it('TARGET_CONFIRMED → 재요청 → WAITING_APPROVAL', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'APPROVED', approvedAt: '2026-01-10T00:00:00Z' },
        installation: { status: 'COMPLETED', completedAt: '2026-01-12T00:00:00Z' },
        connectionTest: { status: 'PASSED', passedAt: '2026-01-13T00:00:00Z' },
      };
      addTestProject({
        processStatus: ProcessStatus.INSTALLATION_COMPLETE,
        status,
        resources: [
          createTestResource('res-1', { isSelected: true, connectionStatus: 'CONNECTED' }),
          createTestResource('res-2', { isSelected: true, connectionStatus: 'CONNECTED' }),
          createTestResource('res-3', { integrationCategory: 'TARGET' }),
        ],
      });

      // 초기 상태: TARGET_CONFIRMED
      let processStatus = await getProcessStatus();
      expect(processStatus.process_status).toBe('TARGET_CONFIRMED');

      // 재요청 (리소스 변경: res-1, res-3 선택, res-2 제외)
      const reqBody = createApprovalRequestBody(['res-1', 'res-3'], ['res-2']);
      const reqRes = await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);
      expect(reqRes.status).toBe(201);

      processStatus = await getProcessStatus();
      expect(processStatus.process_status).toBe('WAITING_APPROVAL');
    });
  });

  describe('시나리오 9: Validation 에러', () => {
    it('선택된 리소스 없이 요청 → 400', async () => {
      addTestProject();

      const reqBody = createApprovalRequestBody([], ['res-1', 'res-2']);
      const reqRes = await mockConfirm.createApprovalRequest(TEST_PROJECT_ID, reqBody);
      expect(reqRes.status).toBe(400);

      const data = await parseResponse(reqRes);
      expect(data.error).toBe('VALIDATION_FAILED');
    });
  });

  describe('시나리오 10: ApprovedIntegration 조회 (R347)', () => {
    it('승인 전 상태 → approved_integration null', async () => {
      addTestProject();

      const res = await mockConfirm.getApprovedIntegration(TEST_PROJECT_ID);
      const data = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(data.approved_integration).toBeNull();
    });

    it('수동 승인 후 → approved_integration 존재', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 1 },
        approval: { status: 'PENDING' },
      };
      addTestProject({
        processStatus: ProcessStatus.WAITING_APPROVAL,
        status,
        resources: [
          createTestResource('res-1', { isSelected: true }),
          createTestResource('res-2', { isSelected: true }),
          createTestResource('res-3', {
            isSelected: false,
            exclusion: { reason: '제외', excludedAt: '2026-01-01T00:00:00Z', excludedBy: { id: 'u1', name: 'User' } },
          }),
        ],
      });

      await mockConfirm.approveApprovalRequest(TEST_PROJECT_ID, {});

      const res = await mockConfirm.getApprovedIntegration(TEST_PROJECT_ID);
      const data = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(data.approved_integration).not.toBeNull();
      expect(data.approved_integration.resource_infos).toHaveLength(2);
      expect(data.approved_integration.excluded_resource_ids).toContain('res-3');
      expect(data.approved_integration.exclusion_reason).toBe('제외');
    });

    it('존재하지 않는 프로젝트 → 404', async () => {
      const res = await mockConfirm.getApprovedIntegration('non-existent');
      expect(res.status).toBe(404);
    });
  });

  describe('시나리오 11: ConfirmedIntegration 조회', () => {
    it('설치 완료 + 연결됨 → confirmed_integration 반환', async () => {
      const status: ProjectStatus = {
        ...createInitialProjectStatus(),
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
        approval: { status: 'APPROVED', approvedAt: '2026-01-10T00:00:00Z' },
        installation: { status: 'COMPLETED' },
        connectionTest: { status: 'PASSED', passedAt: '2026-01-13T00:00:00Z' },
      };
      addTestProject({
        processStatus: ProcessStatus.INSTALLATION_COMPLETE,
        status,
        resources: [
          createTestResource('res-1', { isSelected: true, connectionStatus: 'CONNECTED' }),
          createTestResource('res-2', { isSelected: true, connectionStatus: 'CONNECTED' }),
        ],
      });

      const res = await mockConfirm.getConfirmedIntegration(TEST_PROJECT_ID);
      const data = await parseResponse(res);
      expect(data.confirmed_integration).not.toBeNull();
      expect(data.confirmed_integration.resource_infos).toHaveLength(2);
    });

    it('설치 미완료 → confirmed_integration null', async () => {
      addTestProject();

      const res = await mockConfirm.getConfirmedIntegration(TEST_PROJECT_ID);
      const data = await parseResponse(res);
      expect(data.confirmed_integration).toBeNull();
    });
  });
});
