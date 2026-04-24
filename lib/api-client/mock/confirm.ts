import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as mockHistory from '@/lib/mock-history';
import * as tcFns from '@/lib/mock-test-connection';
import * as mockInstallation from '@/lib/mock-installation';
import { getStore } from '@/lib/mock-store';
import { ProcessStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';
import { evaluateAutoApproval } from '@/lib/policies';
import { addQueueItem, updateQueueItemStatus } from '@/lib/api-client/mock/queue-board';
import { createEmptyConfirmedIntegration } from '@/lib/confirmed-integration-response';
import { normalizeIssue222ApprovalRequestBody } from '@/lib/issue-222-approval';
import type {
  Resource,
  Project,
  ProjectStatus,
  ConnectionStatus,
  ConnectionTestResult,
  ConnectionTestHistory,
  DatabaseType,
  IntegrationCategory,
  VmDatabaseConfig,
  ResourceExclusion,
  BffApprovedIntegration,
  BffConfirmedIntegration,
  ConfirmResourceMetadata,
  EndpointConfigInputData,
} from '@/lib/types';

// Mock store: ApprovedIntegration (승인 완료 후 반영 중 스냅샷)
const approvedIntegrationStore = new Map<string, BffApprovedIntegration>();

// Mock store: ConfirmedIntegration 스냅샷 (변경 요청 시 이전 확정 보존)
// 변경 요청 승인 → installation.status=PENDING 리셋 → 기존 확정 데이터 유실 방지
const confirmedIntegrationSnapshotStore = new Map<string, BffConfirmedIntegration>();

// Mock store: 승인 시각 (설치 반영 소요시간 시뮬레이션용)
// 실제 환경: 빠르면 1분, 최대 하루 이상 소요
// Mock: APPLYING 상태를 일정 시간 유지 후 INSTALLING으로 전이
const MOCK_APPLYING_DELAY_MS = 20_000;
const MOCK_INSTALLATION_DELAY_MS = 15_000;
const ENABLE_PROCESS_AUTO_TRANSITION = true;
const approvalTimestampStore = new Map<string, number>();

/** @internal 테스트 전용: store 초기화 */
export const _resetApprovedIntegrationStore = () => {
  approvedIntegrationStore.clear();
  confirmedIntegrationSnapshotStore.clear();
  approvalTimestampStore.clear();
};

/** @internal 테스트 전용: 지연 시간 우회 (승인 시각을 과거로 설정) */
export const _fastForwardApproval = (targetSourceId: string) => {
  const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
  if (!project) return;
  const fastForwardMs = Math.max(MOCK_INSTALLATION_DELAY_MS, MOCK_APPLYING_DELAY_MS) + 1;
  approvalTimestampStore.set(project.id, Date.now() - fastForwardMs);
};

/** @internal 테스트 전용: ApprovedIntegration 직접 설정 (실시간 상태 계산 테스트용) */
export const _setApprovedIntegration = (targetSourceId: string) => {
  const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
  if (!project) return;
  approvedIntegrationStore.set(project.id, {
    id: `ai-test-${project.id}`,
    request_id: `req-test-${project.id}`,
    approved_at: new Date().toISOString(),
    resource_infos: [],
    excluded_resource_ids: [],
  });
  approvalTimestampStore.set(project.id, Date.now());
};

interface ResourceCredentialInput {
  resourceId: string;
  credentialId?: string;
}

interface ResourceCatalogItem {
  id: string;
  resource_id: string;
  name: string;
  resource_type: string;
  database_type: DatabaseType;
  integration_category: IntegrationCategory;
  host: string | null;
  port: number | null;
  oracle_service_id: string | null;
  network_interface_id: string | null;
  ip_configuration_name: string | null;
  metadata: ConfirmResourceMetadata;
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
  // 3. ConfirmedIntegration 존재? (설치 완료 = installation COMPLETED)
  if (project.status.installation.status === 'COMPLETED') {
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

function buildMetadata(resource: Resource, project: Project): ConfirmResourceMetadata {
  const base: ConfirmResourceMetadata = {
    provider: project.cloudProvider,
    resourceType: resource.type,
  };

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
      return base;
  }
}

function toResourceCatalogItem(resource: Resource, project: Project): ResourceCatalogItem {
  return {
    id: resource.resourceId,
    resource_id: resource.resourceId,
    name: resource.resourceId,
    resource_type: resource.type,
    database_type: resource.vmDatabaseConfig?.databaseType ?? resource.databaseType,
    integration_category: resource.integrationCategory,
    host: resource.vmDatabaseConfig?.host ?? null,
    port: resource.vmDatabaseConfig?.port ?? null,
    oracle_service_id: resource.vmDatabaseConfig?.oracleServiceId ?? null,
    network_interface_id: resource.vmDatabaseConfig?.selectedNicId ?? null,
    ip_configuration_name: null,
    metadata: buildMetadata(resource, project),
  };
}

function toResourceSnapshot(r: Resource) {
  let endpoint_config = null;
  if (r.vmDatabaseConfig) {
    endpoint_config = {
      resource_id: r.resourceId,
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
    resource_id: r.resourceId,
    resource_type: r.type,
    endpoint_config,
    credential_id: r.selectedCredentialId ?? null,
  };
}

function toConfirmedIntegrationResourceInfo(r: Resource): BffConfirmedIntegration['resource_infos'][number] {
  return {
    resource_id: r.resourceId,
    resource_type: r.type,
    database_type: r.vmDatabaseConfig?.databaseType ?? r.databaseType,
    port: r.vmDatabaseConfig?.port ?? null,
    host: r.vmDatabaseConfig?.host ?? null,
    oracle_service_id: r.vmDatabaseConfig?.oracleServiceId ?? null,
    network_interface_id: r.vmDatabaseConfig?.selectedNicId ?? null,
    ip_configuration_name: null,
    credential_id: r.selectedCredentialId ?? null,
  };
}

/**
 * ApprovedIntegration 의 resource_id 목록과 project.resources 를 조인해
 * ConfirmedIntegration.resource_infos 를 만든다. 매칭이 하나도 없으면 null.
 *
 * getConfirmedIntegration 의 path-3 fallback 과 getProcessStatus 의
 * APPLYING → INSTALLING 마이그레이션 훅에서 공통 사용.
 */
function deriveConfirmedResourceInfos(
  approvedIntegration: BffApprovedIntegration,
  resources: Resource[],
): BffConfirmedIntegration['resource_infos'] | null {
  const approvedResourceIds = new Set(
    approvedIntegration.resource_infos
      .map((resourceInfo) => resourceInfo.resource_id)
      .filter((resourceId): resourceId is string => typeof resourceId === 'string' && resourceId.length > 0),
  );
  const matched = resources.filter((r) => approvedResourceIds.has(r.id));
  if (matched.length === 0) return null;
  return matched.map(toConfirmedIntegrationResourceInfo);
}

// --- Queue Board Integration Helpers ---

const getCloudInfo = (project: Project): string => {
  switch (project.cloudProvider) {
    case 'AWS':
      return project.awsAccountId ?? '';
    case 'Azure':
      return [project.tenantId, project.subscriptionId].filter(Boolean).join(' / ');
    case 'GCP':
      return project.gcpProjectId ?? '';
    default:
      return project.cloudProvider;
  }
};

const getServiceName = (serviceCode: string): string =>
  mockData.mockServiceCodes.find((s) => s.code === serviceCode)?.name ?? serviceCode;

// --- Mock Confirm Module ---

export const mockConfirm = {
  getResources: async (targetSourceId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const resources = project.resources.map((resource) => toResourceCatalogItem(resource, project));

    return NextResponse.json({ resources, total_count: resources.length });
  },

  createApprovalRequest: async (targetSourceId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // 409 conflict checks — 실시간 상태 계산으로 판단
    const currentBffStatus = computeProcessStatus(project);
    if (currentBffStatus === 'APPLYING_APPROVED') {
      return NextResponse.json(
        { error: 'CONFLICT_APPLYING_IN_PROGRESS', message: '승인된 내용이 반영 중입니다. 완료 후 다시 요청해주세요.' },
        { status: 409 },
      );
    }
    if (currentBffStatus === 'WAITING_APPROVAL') {
      return NextResponse.json(
        { error: 'CONFLICT_REQUEST_PENDING', message: '승인 대기 중인 요청이 있습니다.' },
        { status: 409 },
      );
    }

    // 기존 확정 정보가 있으면 스냅샷 보존 (변경 요청 시 이전 상태 비교용)
    if (project.status.installation.status === 'COMPLETED') {
      const connectedResources = project.resources.filter(
        (r) => r.isSelected && r.connectionStatus === 'CONNECTED',
      );
      if (connectedResources.length > 0) {
        confirmedIntegrationSnapshotStore.set(project.id, {
          resource_infos: connectedResources.map(toConfirmedIntegrationResourceInfo),
        });
      }
    }

    const { resource_inputs, exclusion_reason_default } = normalizeIssue222ApprovalRequestBody(body);

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
    const resolveInternalResourceId = (resourceId: string): string => (
      project.resources.find((resource) => (
        resource.resourceId === resourceId || resource.id === resourceId
      ))?.id ?? resourceId
    );

    for (const si of selectedInputs) {
      const internalResourceId = resolveInternalResourceId(si.resource_id);
      const endpointConfig = si.resource_input?.endpoint_config;
      const databaseType = si.resource_input?.database_type ?? endpointConfig?.db_type;
      const port = si.resource_input?.port ?? endpointConfig?.port;
      const host = si.resource_input?.host ?? endpointConfig?.host;

      if (databaseType && port !== undefined && host) {
        const vmConfig: VmDatabaseConfig = {
          host,
          databaseType: databaseType as VmDatabaseConfig['databaseType'],
          port,
        };
        const oracleServiceId = si.resource_input?.oracle_service_id ?? endpointConfig?.oracleServiceId;
        const networkInterfaceId = si.resource_input?.network_interface_id ?? endpointConfig?.selectedNicId;

        if (oracleServiceId) vmConfig.oracleServiceId = oracleServiceId;
        if (networkInterfaceId) vmConfig.selectedNicId = networkInterfaceId;
        endpointConfigMap.set(internalResourceId, vmConfig);
      }
      if (si.resource_input?.credential_id) {
        credentialMap.set(internalResourceId, si.resource_input.credential_id);
      }
    }

    // Build exclusion map
    const excludedMap = new Map<string, string | undefined>();
    for (const ei of excludedInputs) {
      excludedMap.set(
        resolveInternalResourceId(ei.resource_id),
        ei.exclusion_reason ?? exclusion_reason_default,
      );
    }

    const selectedResourceIds = selectedInputs.map((si) => resolveInternalResourceId(si.resource_id));
    const selectedSet = new Set(selectedResourceIds);
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
      selectedResourceIds,
    });

    const updatedStatus: ProjectStatus = {
      ...project.status,
      scan: { ...project.status.scan, status: 'COMPLETED' },
      targets: { confirmed: true, selectedCount, excludedCount },
      approval: autoApprovalResult.shouldAutoApprove
        ? { status: 'AUTO_APPROVED', approvedAt: now }
        : { status: 'PENDING' },
      installation: { status: 'PENDING' },
      // 프로세스 재시작 시 연결 테스트 상태 초기화
      connectionTest: { status: 'NOT_TESTED' },
    };

    // 기존 연결 테스트 내역 삭제
    tcFns.clearJobHistory(Number(targetSourceId));

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);
    const actor = { id: user.id, name: user.name };
    const terraformState = project.cloudProvider === 'AWS'
      ? { serviceTf: 'PENDING' as const, bdcTf: 'PENDING' as const }
      : { bdcTf: 'PENDING' as const };

    await mockData.updateProject(project.id, {
      resources: updatedResources,
      status: updatedStatus,
      processStatus: calculatedProcessStatus,
      terraformState: {
        ...project.terraformState,
        ...terraformState,
      },
    });

    // AWS 변경 요청 시 설치 진행 상태를 항상 초기화한다.
    if (project.cloudProvider === 'AWS') {
      const awsTargetSourceId = Number(targetSourceId);
      const previousAwsInstallation = getStore().awsInstallations.get(awsTargetSourceId);
      const hasTfPermission = previousAwsInstallation?.hasTfPermission
        ?? (project.terraformState.serviceTf === 'COMPLETED');
      mockInstallation.initializeInstallation(awsTargetSourceId, hasTfPermission);
    }

    // Store input_data snapshot for approval-history (P2: 요청 시점 스냅샷 보존)
    const inputDataSnapshot = {
      resource_inputs: resource_inputs.map((resourceInput) => (
        resourceInput.selected
          ? {
              resource_id: resourceInput.resource_id,
              selected: true as const,
              ...(resourceInput.resource_input
                ? {
                    resource_input: {
                      ...(resourceInput.resource_input.credential_id
                        ? { credential_id: resourceInput.resource_input.credential_id }
                        : {}),
                      ...(resourceInput.resource_input.database_type
                        && resourceInput.resource_input.port !== undefined
                        && resourceInput.resource_input.host
                        ? {
                            endpoint_config: {
                              db_type: resourceInput.resource_input.database_type as EndpointConfigInputData['db_type'],
                              port: resourceInput.resource_input.port,
                              host: resourceInput.resource_input.host,
                              ...(resourceInput.resource_input.oracle_service_id
                                ? { oracleServiceId: resourceInput.resource_input.oracle_service_id }
                                : {}),
                              ...(resourceInput.resource_input.network_interface_id
                                ? { selectedNicId: resourceInput.resource_input.network_interface_id }
                                : {}),
                            },
                          }
                        : {}),
                    },
                  }
                : {}),
            }
          : {
              resource_id: resourceInput.resource_id,
              selected: false as const,
              ...(resourceInput.exclusion_reason ? { exclusion_reason: resourceInput.exclusion_reason } : {}),
            }
      )),
      ...(exclusion_reason_default ? { exclusion_reason_default } : {}),
    };
    await mockHistory.addTargetConfirmedHistory(Number(targetSourceId), actor, selectedCount, excludedCount, inputDataSnapshot);
    const requestId = `req-${Date.now()}`;

    // ADR-006: 자동 승인 시에도 ApprovedIntegration 스냅샷 생성
    if (autoApprovalResult.shouldAutoApprove) {
      const selectedResources = updatedResources.filter((r) => r.isSelected);
      const excludedResources = updatedResources.filter((r) => r.exclusion);
      approvedIntegrationStore.set(project.id, {
        id: `ai-${project.id}-${Date.now()}`,
        request_id: requestId,
        approved_at: now,
        resource_infos: selectedResources.map(toResourceSnapshot),
        excluded_resource_ids: excludedResources.map((r) => r.resourceId),
        exclusion_reason: excludedResources[0]?.exclusion?.reason,
      });
      // 설치 반영 소요시간 시뮬레이션: 승인 시각 기록
      approvalTimestampStore.set(project.id, Date.now());
      await mockHistory.addAutoApprovedHistory(Number(targetSourceId));
    }

    // Queue Board 연동: 승인 요청 생성 시 Admin Tasks에 항목 추가
    addQueueItem({
      targetSourceId: project.targetSourceId,
      requestType: 'TARGET_CONFIRMATION',
      serviceCode: project.serviceCode,
      serviceName: getServiceName(project.serviceCode),
      provider: project.cloudProvider,
      cloudInfo: getCloudInfo(project),
      requestedBy: user.name,
    });

    // 자동 승인인 경우 즉시 IN_PROGRESS로 전환
    if (autoApprovalResult.shouldAutoApprove) {
      updateQueueItemStatus(project.targetSourceId, 'IN_PROGRESS', '시스템(자동승인)');
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

  getConfirmedIntegration: async (targetSourceId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // 1. snapshot store 확인 (변경요청 이전-보존 또는 APPLYING→INSTALLING 자동 전이 채움)
    const snapshot = confirmedIntegrationSnapshotStore.get(project.id);
    if (snapshot) {
      return NextResponse.json(snapshot);
    }

    // 2. installation 미진행 상태(PENDING) 면 확정 정보 없음
    if (project.status.installation.status === 'PENDING') {
      return NextResponse.json(createEmptyConfirmedIntegration());
    }

    // 3. installation 진행 중 / 완료 상태에서 ApprovedIntegration 으로부터 derive
    //    (snapshot 가 set 되기 전 polling 타이밍 등 fallback 경로)
    const approvedIntegration = approvedIntegrationStore.get(project.id);
    if (approvedIntegration) {
      const derived = deriveConfirmedResourceInfos(approvedIntegration, project.resources);
      if (derived) {
        return NextResponse.json({ resource_infos: derived } satisfies BffConfirmedIntegration);
      }
    }

    // 4. 최종 폴백: project.resources 의 selected 리소스 (connection-test 통과 후만)
    const requiresConnection =
      project.processStatus === ProcessStatus.CONNECTION_VERIFIED ||
      project.processStatus === ProcessStatus.INSTALLATION_COMPLETE;
    const eligibleResources = project.resources.filter(
      (r) => r.isSelected && (!requiresConnection || r.connectionStatus === 'CONNECTED'),
    );
    if (eligibleResources.length === 0) {
      return NextResponse.json(createEmptyConfirmedIntegration());
    }

    return NextResponse.json({
      resource_infos: eligibleResources.map(toConfirmedIntegrationResourceInfo),
    } satisfies BffConfirmedIntegration);
  },

  getApprovedIntegration: async (targetSourceId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
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

  getApprovalHistory: async (targetSourceId: string, page: number, size: number) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const { history: allHistory } = mockHistory.getProjectHistory({
      targetSourceId: Number(targetSourceId),
      type: 'approval',
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
          resource_id: r.resourceId,
          selected: true as const,
          ...(Object.keys(input).length > 0 && { resource_input: input }),
        };
      }
      return {
        resource_id: r.resourceId,
        selected: false as const,
        ...(r.exclusion?.reason && { exclusion_reason: r.exclusion.reason }),
      };
    });

    const toRequestEntry = (historyItem: typeof allHistory[number]) => {
      const inputData = historyItem.details.inputData ?? { resource_inputs: buildCurrentResourceInputs() };

      return {
        id: historyItem.id,
        requested_at: historyItem.timestamp,
        requested_by: historyItem.actor.name,
        input_data: inputData,
      };
    };

    const toResultEntry = (historyItem: typeof allHistory[number]) => {
      if (historyItem.type === 'APPROVAL') {
        return {
          id: `result-${historyItem.id}`,
          request_id: historyItem.id,
          result: 'APPROVED' as const,
          processed_at: historyItem.timestamp,
          process_info: { user_id: historyItem.actor.id, reason: null },
        };
      }
      if (historyItem.type === 'AUTO_APPROVED') {
        return {
          id: `result-${historyItem.id}`,
          request_id: historyItem.id,
          result: 'AUTO_APPROVED' as const,
          processed_at: historyItem.timestamp,
          process_info: { user_id: null, reason: null },
        };
      }
      if (historyItem.type === 'REJECTION') {
        return {
          id: `result-${historyItem.id}`,
          request_id: historyItem.id,
          result: 'REJECTED' as const,
          processed_at: historyItem.timestamp,
          process_info: { user_id: historyItem.actor.id, reason: historyItem.details.reason ?? null },
        };
      }
      if (historyItem.type === 'APPROVAL_CANCELLED') {
        return {
          id: `result-${historyItem.id}`,
          request_id: historyItem.id,
          result: 'CANCELLED' as const,
          processed_at: historyItem.timestamp,
          process_info: { user_id: historyItem.actor.id, reason: null },
        };
      }

      return undefined;
    };

    // If WAITING_APPROVAL but no approval history yet, synthesize a PENDING request entry
    if (allHistory.length === 0 && project.processStatus === ProcessStatus.WAITING_APPROVAL) {
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

    const groupedContent = [...allHistory]
      .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
      .reduce<Array<{
        request: ReturnType<typeof toRequestEntry>;
        result?: ReturnType<typeof toResultEntry>;
      }>>((acc, historyItem) => {
        const result = toResultEntry(historyItem);

        if (!result) {
          acc.push({ request: toRequestEntry(historyItem) });
          return acc;
        }

        const openRequest = [...acc].reverse().find((entry) => !entry.result);
        if (openRequest) {
          openRequest.result = result;
          return acc;
        }

        acc.push({
          request: toRequestEntry(historyItem),
          result,
        });
        return acc;
      }, []);

    const total = groupedContent.length;
    const content = groupedContent
      .slice()
      .reverse()
      .slice(page * size, page * size + size);

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

  getApprovalRequestLatest: async (targetSourceId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const { history: allHistory } = mockHistory.getProjectHistory({
      targetSourceId: Number(targetSourceId),
      type: 'approval',
    });

    // 최신 요청 이력 찾기
    const sortedHistory = [...allHistory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // 요청(TARGET_CONFIRMED) 이력 찾기
    const latestRequest = sortedHistory.find((h) =>
      h.type === 'TARGET_CONFIRMED' || h.type === 'APPROVAL' || h.type === 'AUTO_APPROVED' || h.type === 'REJECTION' || h.type === 'APPROVAL_CANCELLED',
    );

    // 이력이 없고 WAITING_APPROVAL 상태이면 현재 상태로 합성
    if (!latestRequest && project.processStatus !== ProcessStatus.WAITING_APPROVAL) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '승인 요청 이력이 없습니다.' },
        { status: 404 },
      );
    }

    const selectedCount = project.resources.filter((r) => r.isSelected).length;
    const totalCount = project.resources.length;
    const approvalStatus = project.status.approval.status;

    // BFF 실제 응답 형식으로 반환
    const requestTimestamp = latestRequest?.timestamp ?? project.updatedAt;
    const requestActor = latestRequest?.actor ?? { id: user.id, name: user.name };

    const toBffStatus = (status: string): string => {
      switch (status) {
        case 'PENDING': return 'PENDING';
        case 'APPROVED': return 'APPROVED';
        case 'AUTO_APPROVED': return 'AUTO_APPROVED';
        case 'REJECTED': return 'REJECTED';
        case 'CANCELLED': return 'CANCELLED';
        default: return 'PENDING';
      }
    };

    const bffStatus = toBffStatus(approvalStatus);
    const requestId = latestRequest ? parseInt(String(latestRequest.id).replace(/\D/g, '') || '0', 10) : 0;
    const processedAt = latestRequest?.timestamp ?? new Date().toISOString();

    return NextResponse.json({
      request: {
        id: requestId,
        target_source_id: project.targetSourceId,
        status: bffStatus,
        requested_by: { user_id: requestActor.name ?? requestActor.id },
        requested_at: requestTimestamp,
        resource_total_count: totalCount,
        resource_selected_count: selectedCount,
      },
      result: {
        request_id: latestRequest ? requestId : null,
        status: bffStatus,
        processed_by: { user_id: requestActor.name ?? requestActor.id },
        processed_at: processedAt,
        reason: project.status.approval.rejectionReason ?? null,
      },
    });
  },

  getProcessStatus: async (targetSourceId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // Mock 자동 전환:
    // 승인 후 일정 시간 경과 시 APPLYING_APPROVED -> INSTALLING
    // (자동 완료 전이는 수행하지 않음)
    const isApprovedStatus =
      project.status.approval.status === 'APPROVED' ||
      project.status.approval.status === 'AUTO_APPROVED';
    const approvedAtFromStore = approvalTimestampStore.get(project.id);
    const approvedAtFromStatus = project.status.approval.approvedAt
      ? Date.parse(project.status.approval.approvedAt)
      : Number.NaN;
    const approvedAt = approvedAtFromStore ?? (Number.isFinite(approvedAtFromStatus) ? approvedAtFromStatus : undefined);
    if (
      ENABLE_PROCESS_AUTO_TRANSITION &&
      isApprovedStatus &&
      project.status.installation.status === 'PENDING' &&
      approvedAt !== undefined
    ) {
      const elapsedMs = Date.now() - approvedAt;
      const now = new Date().toISOString();

      if (elapsedMs >= MOCK_APPLYING_DELAY_MS) {
        const progressedStatus: ProjectStatus = {
          ...project.status,
          installation: { status: 'IN_PROGRESS' },
        };
        const calcStatus = getCurrentStep(project.cloudProvider, progressedStatus);
        mockData.updateProject(project.id, {
          processStatus: calcStatus,
          status: progressedStatus,
        });

        const updated = mockData.getProjectByTargetSourceId(Number(targetSourceId))!;

        // ConfirmedIntegration 마이그레이션: APPLYING → INSTALLING 전이 시
        // ApprovedIntegration 의 selected 리소스를 ConfirmedIntegration snapshot 으로 보존.
        // 변경요청 이전-스냅샷 보존 (createApprovalRequest 경로) 과 충돌하지 않도록 has 가드.
        const approvedIntegration = approvedIntegrationStore.get(updated.id);
        if (approvedIntegration && !confirmedIntegrationSnapshotStore.has(updated.id)) {
          const derived = deriveConfirmedResourceInfos(approvedIntegration, updated.resources);
          if (derived) {
            confirmedIntegrationSnapshotStore.set(updated.id, { resource_infos: derived });
          }
        }

        return NextResponse.json({
          target_source_id: updated.targetSourceId,
          process_status: computeProcessStatus(updated),
          status_inputs: {
            has_confirmed_integration: updated.status.installation.status === 'COMPLETED' && !approvedIntegrationStore.has(updated.id),
            has_pending_approval_request: updated.processStatus === ProcessStatus.WAITING_APPROVAL,
            has_approved_integration: approvedIntegrationStore.has(updated.id),
            last_approval_result: computeLastApprovalResult(updated),
            last_rejection_reason: updated.status.approval.rejectionReason ?? null,
          },
          evaluated_at: now,
        });
      }

      return NextResponse.json({
        target_source_id: project.targetSourceId,
        process_status: computeProcessStatus(project),
        status_inputs: {
          has_confirmed_integration: false,
          has_pending_approval_request: project.processStatus === ProcessStatus.WAITING_APPROVAL,
          has_approved_integration: approvedIntegrationStore.has(project.id),
          last_approval_result: computeLastApprovalResult(project),
          last_rejection_reason: project.status.approval.rejectionReason ?? null,
        },
        evaluated_at: now,
      });
    }

    return NextResponse.json({
      target_source_id: project.targetSourceId,
      process_status: computeProcessStatus(project),
      status_inputs: {
        has_confirmed_integration: project.status.installation.status === 'COMPLETED' && !approvedIntegrationStore.has(project.id),
        has_pending_approval_request: project.processStatus === ProcessStatus.WAITING_APPROVAL,
        has_approved_integration: approvedIntegrationStore.has(project.id),
        last_approval_result: computeLastApprovalResult(project),
        last_rejection_reason: project.status.approval.rejectionReason ?? null,
      },
      evaluated_at: new Date().toISOString(),
    });
  },

  approveApprovalRequest: async (targetSourceId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 승인할 수 있습니다.' },
        { status: 403 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
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
      installation: { status: 'PENDING' },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    mockData.updateProject(project.id, {
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
      excluded_resource_ids: excludedResources.map((r) => r.resourceId),
      exclusion_reason: excludedResources[0]?.exclusion?.reason,
    });

    // 설치 반영 소요시간 시뮬레이션: 승인 시각 기록
    approvalTimestampStore.set(project.id, Date.now());

    mockHistory.addApprovalHistory(Number(targetSourceId), { id: user.id, name: user.name });

    // Queue Board 연동: 승인 → IN_PROGRESS
    updateQueueItemStatus(project.targetSourceId, 'IN_PROGRESS', user.name);

    return NextResponse.json({
      success: true,
      result: 'APPROVED',
      processed_at: now,
    });
  },

  rejectApprovalRequest: async (targetSourceId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 반려할 수 있습니다.' },
        { status: 403 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
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

    mockData.updateProject(project.id, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
      isRejected: true,
      rejectionReason: reason,
      rejectedAt: now,
    });

    mockHistory.addRejectionHistory(Number(targetSourceId), { id: user.id, name: user.name }, reason || '');

    // Queue Board 연동: 반려 → REJECTED
    updateQueueItemStatus(project.targetSourceId, 'REJECTED', user.name, reason);

    return NextResponse.json({
      success: true,
      result: 'REJECTED',
      processed_at: now,
      reason,
    });
  },

  cancelApprovalRequest: async (targetSourceId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // P2: 권한 검사 — 서비스 코드 권한이 있는 사용자만 취소 가능
    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
        { status: 403 },
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

    // P1: 기존 연동 완료(O/O/X) 여부 판단 — ConfirmedIntegration이 존재하면 복원
    const hasExistingConfirmed = project.piiAgentInstalled === true ||
      project.completionConfirmedAt !== undefined;

    // 리소스 선택 해제 + 이번 요청에서 설정된 exclusion 초기화
    const updatedResources = hasExistingConfirmed
      ? project.resources.map((r) => ({
          ...r,
          // 기존 연동 상태에서는 이전 선택/연결 상태를 유지하되 PENDING 요청 관련만 초기화
          isSelected: r.connectionStatus === 'CONNECTED',
          exclusion: undefined,
        }))
      : project.resources.map((r) => ({
          ...r,
          isSelected: false,
          exclusion: undefined,
        }));

    const restoredSelectedCount = updatedResources.filter((r) => r.isSelected).length;

    const updatedStatus: ProjectStatus = hasExistingConfirmed
      ? {
          ...project.status,
          targets: { confirmed: true, selectedCount: restoredSelectedCount, excludedCount: 0 },
          approval: { status: 'CANCELLED' },
          // 기존 설치 완료 상태 복원
          installation: { status: 'COMPLETED', completedAt: project.completionConfirmedAt },
          connectionTest: { status: 'PASSED', passedAt: project.status.connectionTest.passedAt },
        }
      : {
          ...project.status,
          targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
          approval: { status: 'CANCELLED' },
        };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    mockData.updateProject(project.id, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
    });

    mockHistory.addApprovalCancelledHistory(Number(targetSourceId), { id: user.id, name: user.name });

    return NextResponse.json({
      success: true,
      result: 'CANCELLED',
      processed_at: now,
    });
  },

  confirmInstallation: async (targetSourceId: string) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 설치 완료를 확정할 수 있습니다.' },
        { status: 403 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const currentStep = getCurrentStep(project.cloudProvider, project.status);
    if (currentStep !== ProcessStatus.CONNECTION_VERIFIED) {
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
        operationConfirmed: true,
      },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    mockData.updateProject(project.id, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      completionConfirmedAt: now,
      piiAgentInstalled: true,
      piiAgentConnectedAt: project.piiAgentConnectedAt || now,
    });

    // 설치 확정 시 store 정리 (반영 완료)
    approvedIntegrationStore.delete(project.id);
    confirmedIntegrationSnapshotStore.delete(project.id);
    approvalTimestampStore.delete(project.id);

    return NextResponse.json({ success: true, confirmedAt: now });
  },

  updateResourceCredential: async (targetSourceId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
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
      if (r.id !== resourceId && r.resourceId !== resourceId) return r;
      return {
        ...r,
        selectedCredentialId: credentialId || undefined,
      };
    });

    const approvedIntegration = approvedIntegrationStore.get(project.id);
    if (approvedIntegration) {
      const selectedResources = updatedResources.filter((resource) => resource.isSelected);
      const excludedResources = updatedResources.filter((resource) => resource.exclusion);

      approvedIntegrationStore.set(project.id, {
        ...approvedIntegration,
        resource_infos: selectedResources.map(toResourceSnapshot),
        excluded_resource_ids: excludedResources.map((resource) => resource.resourceId),
      });
    }

    mockData.updateProject(project.id, { resources: updatedResources });

    return NextResponse.json({ success: true });
  },

  testConnection: async (targetSourceId: string, _body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
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

    const numericTargetSourceId = project.targetSourceId ?? (Number(targetSourceId.replace(/\D/g, '')) || 0);

    if (tcFns.hasPendingJob(numericTargetSourceId)) {
      return NextResponse.json(
        { error: { code: 'CONFLICT_IN_PROGRESS', message: '현재 연결 테스트가 진행 중입니다.' } },
        { status: 409 },
      );
    }

    const job = tcFns.createTestConnectionJob(project, numericTargetSourceId, user.id);

    return NextResponse.json({ id: job.id }, { status: 202 });
  },

  getTestConnectionResults: async (targetSourceId: string, page: number, size: number) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: { code: 'TARGET_SOURCE_NOT_FOUND', message: '해당 ID의 Target Source가 존재하지 않습니다.' } },
        { status: 404 },
      );
    }

    const { content, total } = tcFns.getJobHistory(Number(targetSourceId), page, size);
    const totalPages = Math.ceil(total / size);

    return NextResponse.json({
      content: content.map(tcFns.toJobResponse),
      page: { totalElements: total, totalPages, number: page, size },
    });
  },

  getTestConnectionLatest: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: { code: 'TARGET_SOURCE_NOT_FOUND', message: '해당 ID의 Target Source가 존재하지 않습니다.' } },
        { status: 404 },
      );
    }

    const job = tcFns.getLatestJob(Number(targetSourceId));
    if (!job) {
      return NextResponse.json(
        { error: { code: 'TEST_CONNECTION_NOT_FOUND', message: '연결 테스트 이력이 없습니다.' } },
        { status: 404 },
      );
    }

    return NextResponse.json(tcFns.toJobResponse(job));
  },

};
