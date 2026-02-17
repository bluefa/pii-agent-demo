import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as mockHistory from '@/lib/mock-history';
import { ProcessStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';
import { evaluateAutoApproval } from '@/lib/policies';
import type {
  Resource,
  ProjectStatus,
  ConnectionStatus,
  ConnectionTestResult,
  ConnectionTestHistory,
  VmDatabaseConfig,
  ResourceExclusion,
  Project,
  BffApprovedIntegration,
} from '@/lib/types';

// Mock store: ApprovedIntegration (승인 완료 후 반영 중 스냅샷)
const approvedIntegrationStore = new Map<string, BffApprovedIntegration>();

// Mock store: 승인 시각 (설치 반영 소요시간 시뮬레이션용)
// 실제 환경: 빠르면 1분, 최대 하루 이상 소요
// Mock: MOCK_INSTALLATION_DELAY_MS(기본 10초) 경과 후 설치 완료 처리
const MOCK_INSTALLATION_DELAY_MS = 10_000;
const approvalTimestampStore = new Map<string, number>();

/** @internal 테스트 전용: store 초기화 */
export const _resetApprovedIntegrationStore = () => {
  approvedIntegrationStore.clear();
  approvalTimestampStore.clear();
};

/** @internal 테스트 전용: 지연 시간 우회 (승인 시각을 과거로 설정) */
export const _fastForwardApproval = (projectId: string) => {
  approvalTimestampStore.set(projectId, Date.now() - MOCK_INSTALLATION_DELAY_MS - 1);
};

interface ResourceCredentialInput {
  resourceId: string;
  credentialId?: string;
}

// --- Helpers ---

type BffProcessStatus = 'REQUEST_REQUIRED' | 'WAITING_APPROVAL' | 'APPLYING_APPROVED' | 'TARGET_CONFIRMED';

const computeProcessStatus = (project: Project): BffProcessStatus => {
  // ADR-009 D-004: 3객체 존재 여부 기반 우선순위 계산
  // 1. PENDING 승인 요청 존재?
  if (project.status.approval.status === 'PENDING' && project.status.targets.confirmed) {
    return 'WAITING_APPROVAL';
  }
  // 2. ApprovedIntegration 존재? (반영 중)
  if (approvedIntegrationStore.has(project.id)) {
    return 'APPLYING_APPROVED';
  }
  // 3. ConfirmedIntegration 존재? (설치 완료)
  if (project.processStatus >= ProcessStatus.INSTALLATION_COMPLETE) {
    return 'TARGET_CONFIRMED';
  }
  return 'REQUEST_REQUIRED';
};

type LastApprovalResult = 'NONE' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'SYSTEM_ERROR' | 'COMPLETED';

const computeLastApprovalResult = (project: Project): LastApprovalResult => {
  const approvalStatus = project.status.approval.status;
  if (approvalStatus === 'AUTO_APPROVED' || approvalStatus === 'APPROVED') return 'APPROVED';
  if (approvalStatus === 'REJECTED') return 'REJECTED';
  if (approvalStatus === 'CANCELLED') return 'CANCELLED';
  return 'NONE';
};

function buildMetadata(resource: Resource, project: Project): Record<string, unknown> {
  const base: Record<string, unknown> = { resourceType: resource.type };

  switch (project.cloudProvider) {
    case 'AWS':
      return {
        provider: 'AWS',
        resourceType: resource.awsType ?? resource.type,
        ...(resource.region && { region: resource.region }),
        ...(resource.vpcId && { vpcId: resource.vpcId }),
      };
    case 'Azure':
      return { provider: 'Azure', resourceType: resource.type, region: '' };
    case 'GCP':
      return {
        provider: 'GCP',
        resourceType: resource.type,
        region: '',
        projectId: project.gcpProjectId ?? '',
      };
    default:
      return { provider: project.cloudProvider, ...base };
  }
}

function toResourceSnapshot(r: Resource) {
  let endpoint_config = null;
  if (r.vmDatabaseConfig) {
    endpoint_config = {
      resource_id: r.id,
      db_type: r.vmDatabaseConfig.databaseType,
      port: r.vmDatabaseConfig.port,
      host: r.vmDatabaseConfig.host ?? '',
      ...(r.vmDatabaseConfig.oracleServiceId && {
        oracleServiceId: r.vmDatabaseConfig.oracleServiceId,
      }),
      ...(r.vmDatabaseConfig.selectedNicId && {
        selectedNicId: r.vmDatabaseConfig.selectedNicId,
      }),
    };
  }
  return {
    resource_id: r.id,
    resource_type: r.type,
    endpoint_config,
    credential_id: r.selectedCredentialId ?? null,
  };
}

interface ApprovalRequestCreateBody {
  input_data: {
    resource_inputs: Array<
      | { resource_id: string; selected: true; resource_input?: { credential_id?: string; endpoint_config?: Record<string, unknown> } }
      | { resource_id: string; selected: false; exclusion_reason?: string }
    >;
    exclusion_reason_default?: string;
  };
}

// --- Mock Confirm Module ---

export const mockConfirm = {
  getResources: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const resources = project.resources.map((r) => ({
      id: r.id,
      resourceId: r.resourceId,
      name: r.resourceId,
      resourceType: r.type,
      integrationCategory: r.integrationCategory,
      selectedCredentialId: r.selectedCredentialId ?? null,
      metadata: buildMetadata(r, project),
    }));

    return NextResponse.json({ resources, totalCount: resources.length });
  },

  createApprovalRequest: async (projectId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // 409 conflict checks — APPLYING_APPROVED covers INSTALLING, WAITING_CONNECTION_TEST, CONNECTION_VERIFIED
    if (
      project.processStatus === ProcessStatus.INSTALLING ||
      project.processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
      project.processStatus === ProcessStatus.CONNECTION_VERIFIED
    ) {
      return NextResponse.json(
        { error: 'CONFLICT_APPLYING_IN_PROGRESS', message: '승인된 내용이 반영 중입니다. 완료 후 다시 요청해주세요.' },
        { status: 409 },
      );
    }
    if (project.processStatus === ProcessStatus.WAITING_APPROVAL) {
      return NextResponse.json(
        { error: 'CONFLICT_REQUEST_PENDING', message: '승인 대기 중인 요청이 있습니다.' },
        { status: 409 },
      );
    }

    const { input_data } = body as ApprovalRequestCreateBody;
    const { resource_inputs, exclusion_reason_default } = input_data;

    const selectedInputs = resource_inputs.filter(
      (ri): ri is Extract<typeof ri, { selected: true }> => ri.selected === true,
    );
    const excludedInputs = resource_inputs.filter(
      (ri): ri is Extract<typeof ri, { selected: false }> => ri.selected === false,
    );

    if (selectedInputs.length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: '연동 대상이 1개 이상이어야 합니다.' },
        { status: 400 },
      );
    }

    // Build endpoint config map from selected resources
    const endpointConfigMap = new Map<string, VmDatabaseConfig>();
    const credentialMap = new Map<string, string>();

    for (const si of selectedInputs) {
      if (si.resource_input?.endpoint_config) {
        const ec = si.resource_input.endpoint_config;
        const vmConfig: VmDatabaseConfig = {
          host: (ec.host as string) ?? '',
          databaseType: ec.db_type as VmDatabaseConfig['databaseType'],
          port: ec.port as number,
        };
        if (ec.oracleServiceId) vmConfig.oracleServiceId = ec.oracleServiceId as string;
        if (ec.selectedNicId) vmConfig.selectedNicId = ec.selectedNicId as string;
        endpointConfigMap.set(si.resource_id, vmConfig);
      }
      if (si.resource_input?.credential_id) {
        credentialMap.set(si.resource_id, si.resource_input.credential_id);
      }
    }

    // Build exclusion map
    const excludedMap = new Map<string, string | undefined>();
    for (const ei of excludedInputs) {
      excludedMap.set(ei.resource_id, ei.exclusion_reason ?? exclusion_reason_default);
    }

    const selectedSet = new Set(selectedInputs.map((si) => si.resource_id));
    const now = new Date().toISOString();
    const excludedBy = { id: user.id, name: user.name };

    const updatedResources: Resource[] = project.resources.map((r) => {
      const isSelected = selectedSet.has(r.id);

      let exclusion: ResourceExclusion | undefined = r.exclusion;
      const exclusionReason = excludedMap.get(r.id);
      if (excludedMap.has(r.id) && exclusionReason) {
        exclusion = { reason: exclusionReason, excludedAt: now, excludedBy };
      }

      const vmDatabaseConfig = endpointConfigMap.get(r.id) ?? r.vmDatabaseConfig;
      const selectedCredentialId = credentialMap.get(r.id) ?? r.selectedCredentialId;

      return { ...r, isSelected, exclusion, vmDatabaseConfig, selectedCredentialId };
    });

    const selectedCount = selectedInputs.length;
    const excludedCount = excludedInputs.length;

    const autoApprovalResult = evaluateAutoApproval({
      resources: project.resources,
      selectedResourceIds: selectedInputs.map((si) => si.resource_id),
    });

    const updatedStatus: ProjectStatus = {
      ...project.status,
      scan: { ...project.status.scan, status: 'COMPLETED' },
      targets: { confirmed: true, selectedCount, excludedCount },
      approval: autoApprovalResult.shouldAutoApprove
        ? { status: 'AUTO_APPROVED', approvedAt: now }
        : { status: 'PENDING' },
      installation: autoApprovalResult.shouldAutoApprove
        ? { status: 'IN_PROGRESS' }
        : { status: 'PENDING' },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);
    const actor = { id: user.id, name: user.name };

    await mockData.updateProject(projectId, {
      resources: updatedResources,
      status: updatedStatus,
      processStatus: calculatedProcessStatus,
    });

    // Store input_data snapshot for approval-history (P2: 요청 시점 스냅샷 보존)
    const inputDataSnapshot = (body as ApprovalRequestCreateBody).input_data;
    await mockHistory.addTargetConfirmedHistory(projectId, actor, selectedCount, excludedCount, inputDataSnapshot);
    const requestId = `req-${Date.now()}`;

    // ADR-006: 자동 승인 시에도 ApprovedIntegration 스냅샷 생성
    if (autoApprovalResult.shouldAutoApprove) {
      const selectedResources = updatedResources.filter((r) => r.isSelected);
      const excludedResources = updatedResources.filter((r) => r.exclusion);
      approvedIntegrationStore.set(projectId, {
        id: `ai-${projectId}-${Date.now()}`,
        request_id: requestId,
        approved_at: now,
        resource_infos: selectedResources.map(toResourceSnapshot),
        excluded_resource_ids: excludedResources.map((r) => r.id),
        exclusion_reason: excludedResources[0]?.exclusion?.reason,
      });
      // 설치 반영 소요시간 시뮬레이션: 승인 시각 기록
      approvalTimestampStore.set(projectId, Date.now());
      await mockHistory.addAutoApprovedHistory(projectId);
    }
    return NextResponse.json(
      {
        success: true,
        approval_request: {
          id: requestId,
          requested_at: now,
          requested_by: user.name,
          input_data: inputDataSnapshot,
        },
      },
      { status: 201 },
    );
  },

  getConfirmedIntegration: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const activeResources = project.resources.filter((r) => r.isSelected && r.connectionStatus === 'CONNECTED');
    if (activeResources.length === 0 || project.processStatus < ProcessStatus.INSTALLATION_COMPLETE) {
      return NextResponse.json({ confirmed_integration: null });
    }

    return NextResponse.json({
      confirmed_integration: {
        resource_infos: activeResources.map(toResourceSnapshot),
      },
    });
  },

  getApprovedIntegration: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // ADR-006: store에서 ApprovedIntegration 조회
    const approved = approvedIntegrationStore.get(project.id);
    if (!approved) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '승인된 연동 정보가 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ approved_integration: approved });
  },

  getApprovalHistory: async (projectId: string, page: number, size: number) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const { history, total } = mockHistory.getProjectHistory({
      projectId,
      type: 'approval',
      limit: size,
      offset: page * size,
    });

    // Helper: build resource_inputs from current project state (fallback for entries without stored snapshot)
    const buildCurrentResourceInputs = () => project.resources.map((r) => {
      if (r.isSelected) {
        const input: Record<string, unknown> = {};
        if (r.vmDatabaseConfig) {
          input.endpoint_config = {
            db_type: r.vmDatabaseConfig.databaseType,
            port: r.vmDatabaseConfig.port,
            host: r.vmDatabaseConfig.host ?? '',
            ...(r.vmDatabaseConfig.oracleServiceId && { oracleServiceId: r.vmDatabaseConfig.oracleServiceId }),
            ...(r.vmDatabaseConfig.selectedNicId && { selectedNicId: r.vmDatabaseConfig.selectedNicId }),
          };
        }
        if (r.selectedCredentialId) {
          input.credential_id = r.selectedCredentialId;
        }
        return {
          resource_id: r.id,
          selected: true as const,
          ...(Object.keys(input).length > 0 && { resource_input: input }),
        };
      }
      return {
        resource_id: r.id,
        selected: false as const,
        ...(r.exclusion?.reason && { exclusion_reason: r.exclusion.reason }),
      };
    });

    // If WAITING_APPROVAL but no approval history yet, synthesize a PENDING request entry
    if (history.length === 0 && project.processStatus === ProcessStatus.WAITING_APPROVAL) {
      const pendingRequest = {
        id: `req-pending-${project.id}`,
        requested_at: project.updatedAt,
        requested_by: user.name,
        input_data: { resource_inputs: buildCurrentResourceInputs() },
      };
      return NextResponse.json({
        content: [{ request: pendingRequest }],
        page: { totalElements: 1, totalPages: 1, number: page, size },
      });
    }

    const content = history.map((h) => {
      // Use stored snapshot if available, otherwise fall back to current state
      const inputData = h.details.inputData ?? { resource_inputs: buildCurrentResourceInputs() };
      const request = {
        id: h.id,
        requested_at: h.timestamp,
        requested_by: h.actor.name,
        input_data: inputData,
      };

      let result;
      if (h.type === 'APPROVAL') {
        result = {
          id: `result-${h.id}`,
          request_id: h.id,
          result: 'APPROVED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: h.actor.id, reason: null },
        };
      } else if (h.type === 'AUTO_APPROVED') {
        result = {
          id: `result-${h.id}`,
          request_id: h.id,
          result: 'AUTO_APPROVED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: null, reason: null },
        };
      } else if (h.type === 'REJECTION') {
        result = {
          id: `result-${h.id}`,
          request_id: h.id,
          result: 'REJECTED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: h.actor.id, reason: h.details.reason ?? null },
        };
      } else if (h.type === 'APPROVAL_CANCELLED') {
        result = {
          id: `result-${h.id}`,
          request_id: h.id,
          result: 'CANCELLED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: h.actor.id, reason: null },
        };
      }

      return { request, ...(result && { result }) };
    });

    return NextResponse.json({
      content,
      page: {
        totalElements: total,
        totalPages: Math.ceil(total / size) || 1,
        number: page,
        size,
      },
    });
  },

  getProcessStatus: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      target_source_id: project.targetSourceId,
      process_status: computeProcessStatus(project),
      status_inputs: {
        has_confirmed_integration: project.processStatus >= ProcessStatus.INSTALLATION_COMPLETE && !approvedIntegrationStore.has(project.id),
        has_pending_approval_request: project.processStatus === ProcessStatus.WAITING_APPROVAL,
        has_approved_integration: approvedIntegrationStore.has(project.id),
        last_approval_result: computeLastApprovalResult(project),
        last_rejection_reason: project.status.approval.rejectionReason ?? null,
      },
      evaluated_at: new Date().toISOString(),
    });
  },

  approveApprovalRequest: async (projectId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 승인할 수 있습니다.' },
        { status: 403 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (project.processStatus !== ProcessStatus.WAITING_APPROVAL) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: '승인 대기 상태가 아닙니다.' } },
        { status: 400 },
      );
    }

    const { comment } = (body ?? {}) as { comment?: string };
    const now = new Date().toISOString();

    const updatedResources = project.resources.map((r) => {
      if (!r.isSelected || r.connectionStatus === 'CONNECTED') return r;
      return { ...r };
    });

    const terraformState = project.cloudProvider === 'AWS'
      ? { serviceTf: 'PENDING' as const, bdcTf: 'PENDING' as const }
      : { bdcTf: 'PENDING' as const };

    const updatedStatus: ProjectStatus = {
      ...project.status,
      approval: { status: 'APPROVED', approvedAt: now },
      installation: { status: 'IN_PROGRESS' },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
      terraformState,
      isRejected: false,
      rejectionReason: undefined,
      rejectedAt: undefined,
      approvalComment: comment,
      approvedAt: now,
    });

    // ADR-006 D-008: ApprovedIntegration 스냅샷 생성
    const selectedResources = updatedResources.filter((r) => r.isSelected);
    const excludedResources = updatedResources.filter((r) => r.exclusion);
    const requestId = `req-${project.id}-${Date.now()}`;
    approvedIntegrationStore.set(project.id, {
      id: `ai-${project.id}-${Date.now()}`,
      request_id: requestId,
      approved_at: now,
      resource_infos: selectedResources.map(toResourceSnapshot),
      excluded_resource_ids: excludedResources.map((r) => r.id),
      exclusion_reason: excludedResources[0]?.exclusion?.reason,
    });

    // 설치 반영 소요시간 시뮬레이션: 승인 시각 기록
    approvalTimestampStore.set(project.id, Date.now());

    mockHistory.addApprovalHistory(projectId, { id: user.id, name: user.name });

    return NextResponse.json({
      success: true,
      result: 'APPROVED',
      processed_at: now,
    });
  },

  rejectApprovalRequest: async (projectId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 반려할 수 있습니다.' },
        { status: 403 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (project.processStatus !== ProcessStatus.WAITING_APPROVAL) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: '승인 대기 상태가 아닙니다.' } },
        { status: 400 },
      );
    }

    const { reason } = (body ?? {}) as { reason?: string };

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: '반려 사유를 입력해주세요.' } },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const updatedResources = project.resources.map((r) => {
      if (!r.isSelected) return r;
      return {
        ...r,
        isSelected: false,
        exclusion: undefined,
        note: `반려: ${reason}`,
      };
    });

    const updatedStatus: ProjectStatus = {
      ...project.status,
      targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
      approval: { status: 'REJECTED', rejectedAt: now, rejectionReason: reason },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
      isRejected: true,
      rejectionReason: reason,
      rejectedAt: now,
    });

    mockHistory.addRejectionHistory(projectId, { id: user.id, name: user.name }, reason || '');

    return NextResponse.json({
      success: true,
      result: 'REJECTED',
      processed_at: now,
      reason,
    });
  },

  cancelApprovalRequest: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // ADR-006 D-010: APPLYING_APPROVED(반영 중)에서는 취소 불가
    if (approvedIntegrationStore.has(project.id)) {
      return NextResponse.json(
        { error: { code: 'CONFLICT_APPLYING_IN_PROGRESS', message: '승인된 내용이 반영 중입니다. 반영 완료 후까지 취소할 수 없습니다.' } },
        { status: 409 },
      );
    }

    // PENDING 상태가 아니면 취소할 요청 없음
    if (project.processStatus !== ProcessStatus.WAITING_APPROVAL) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: '취소할 수 있는 승인 요청이 없습니다.' } },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    // 리소스 선택 해제 + 이번 요청에서 설정된 exclusion 초기화
    const updatedResources = project.resources.map((r) => ({
      ...r,
      isSelected: false,
      exclusion: undefined,
    }));

    const updatedStatus: ProjectStatus = {
      ...project.status,
      targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
      approval: { status: 'CANCELLED' },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
    });

    mockHistory.addApprovalCancelledHistory(projectId, { id: user.id, name: user.name });

    return NextResponse.json({
      success: true,
      result: 'CANCELLED',
      processed_at: now,
    });
  },

  confirmInstallation: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 설치 완료를 확정할 수 있습니다.' },
        { status: 403 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (project.processStatus !== ProcessStatus.CONNECTION_VERIFIED) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: '설치 확정 가능한 상태가 아닙니다.' } },
        { status: 400 },
      );
    }

    // 설치 반영 소요시간 시뮬레이션: 승인 후 MOCK_INSTALLATION_DELAY_MS 경과 전 확정 불가
    const approvedAt = approvalTimestampStore.get(project.id);
    if (approvedAt && Date.now() - approvedAt < MOCK_INSTALLATION_DELAY_MS) {
      const remainingSec = Math.ceil((MOCK_INSTALLATION_DELAY_MS - (Date.now() - approvedAt)) / 1000);
      return NextResponse.json(
        {
          error: { code: 'INSTALLATION_IN_PROGRESS', message: `설치 반영 중입니다. 약 ${remainingSec}초 후 다시 시도해주세요.` },
          estimated_remaining_seconds: remainingSec,
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();

    const updatedStatus: ProjectStatus = {
      ...project.status,
      connectionTest: {
        ...project.status.connectionTest,
        status: 'PASSED',
        passedAt: project.status.connectionTest.passedAt || now,
      },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      completionConfirmedAt: now,
      piiAgentInstalled: true,
      piiAgentConnectedAt: project.piiAgentConnectedAt || now,
    });

    // 설치 확정 시 store 정리 (반영 완료)
    approvedIntegrationStore.delete(project.id);
    approvalTimestampStore.delete(project.id);

    return NextResponse.json({ success: true, confirmedAt: now });
  },

  updateResourceCredential: async (projectId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
        { status: 403 },
      );
    }

    if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST &&
        project.processStatus !== ProcessStatus.CONNECTION_VERIFIED &&
        project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Credential 변경 가능한 상태가 아닙니다.' } },
        { status: 400 },
      );
    }

    const { resourceId, credentialId } = body as { resourceId?: string; credentialId?: string };

    if (!resourceId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'resourceId가 필요합니다.' } },
        { status: 400 },
      );
    }

    const updatedResources = project.resources.map((r) => {
      if (r.id !== resourceId) return r;
      return {
        ...r,
        selectedCredentialId: credentialId || undefined,
      };
    });

    mockData.updateProject(projectId, { resources: updatedResources });

    return NextResponse.json({ success: true });
  },

  testConnection: async (projectId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
        { status: 403 },
      );
    }

    if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST &&
        project.processStatus !== ProcessStatus.CONNECTION_VERIFIED &&
        project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: '연결 테스트가 필요한 상태가 아닙니다.' } },
        { status: 400 },
      );
    }

    const { resourceCredentials = [] } = (body ?? {}) as { resourceCredentials?: ResourceCredentialInput[] };

    const selectedResources = project.resources.filter((r) => r.isSelected);

    const credentialMap = new Map<string, string | undefined>();
    resourceCredentials.forEach((rc) => {
      credentialMap.set(rc.resourceId, rc.credentialId);
    });

    const results: ConnectionTestResult[] = await Promise.all(selectedResources.map(async (r) => {
      const credentialId = credentialMap.get(r.id);
      const credential = credentialId ? await mockData.getCredentialById(credentialId) : undefined;
      return mockData.simulateConnectionTest(
        r.resourceId,
        r.type,
        r.databaseType,
        credentialId,
        credential?.name,
      );
    }));

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const allSuccess = failCount === 0;

    const historyEntry: ConnectionTestHistory = {
      id: await mockData.generateId('history'),
      executedAt: new Date().toISOString(),
      status: allSuccess ? 'SUCCESS' : 'FAIL',
      successCount,
      failCount,
      results,
    };

    const updatedResources = project.resources.map((r) => {
      if (!r.isSelected) return r;

      const credentialId = credentialMap.get(r.id);
      const result = results.find((res) => res.resourceId === r.resourceId);

      if (!result) {
        return { ...r, selectedCredentialId: credentialId };
      }

      if (result.success) {
        return {
          ...r,
          connectionStatus: 'CONNECTED' as ConnectionStatus,
          note: r.note === 'NEW' ? undefined : r.note,
          selectedCredentialId: credentialId,
        };
      } else {
        return {
          ...r,
          connectionStatus: 'DISCONNECTED' as ConnectionStatus,
          selectedCredentialId: credentialId,
        };
      }
    });

    const existingHistory = project.connectionTestHistory || [];
    const updatedHistory = [historyEntry, ...existingHistory];

    const shouldUpdateConnectionTest = allSuccess && project.status.connectionTest.status !== 'PASSED';
    const isFirstSuccess = allSuccess && !project.piiAgentConnectedAt;
    const now = new Date().toISOString();

    const updatedStatus: ProjectStatus = shouldUpdateConnectionTest
      ? {
          ...project.status,
          connectionTest: {
            status: 'PASSED',
            lastTestedAt: now,
            passedAt: now,
          },
        }
      : {
          ...project.status,
          connectionTest: {
            ...project.status.connectionTest,
            status: allSuccess ? 'PASSED' : 'FAILED',
            lastTestedAt: now,
          },
        };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    mockData.updateProject(projectId, {
      resources: updatedResources,
      connectionTestHistory: updatedHistory,
      status: updatedStatus,
      processStatus: calculatedProcessStatus,
      ...(isFirstSuccess ? { piiAgentConnectedAt: now } : {}),
    });

    return NextResponse.json({
      success: allSuccess,
      results,
      history: historyEntry,
    });
  },
};
