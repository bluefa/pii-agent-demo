import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as mockHistory from '@/lib/mock-history';
import * as tcFns from '@/lib/mock-test-connection';
import { getStore } from '@/lib/mock-store';
import { ProcessStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';
import { evaluateAutoApproval } from '@/lib/policies';
import { addQueueItem, updateQueueItemStatus } from '@/lib/api-client/mock/queue-board';
import {
  buildAthenaDatabaseNodes,
  buildAthenaRegionSummaries,
  buildAthenaTableNodes,
  extractAthenaTables,
  isAthenaResource,
  paginate,
  parseAthenaResourceId,
  resolveAthenaSelection,
  type AthenaResolvedSnapshot,
  type AthenaTableRecord,
} from '@/lib/api-client/mock/athena';
import type {
  ApprovalRequestInputSnapshot,
  AthenaRegionResourceSummary,
  BffConfirmedIntegration,
  Resource,
  Project,
  ProjectStatus,
  VmDatabaseConfig,
  ResourceExclusion,
  BffApprovedIntegration,
} from '@/lib/types';

// Mock store: ApprovedIntegration (승인 완료 후 반영 중 스냅샷)
const approvedIntegrationStore = new Map<string, BffApprovedIntegration>();
const approvedAthenaSnapshotStore = new Map<string, AthenaResolvedSnapshot>();

// Mock store: ConfirmedIntegration 스냅샷 (변경 요청 시 이전 확정 보존)
// 변경 요청 승인 → installation.status=PENDING 리셋 → 기존 확정 데이터 유실 방지
const confirmedIntegrationSnapshotStore = new Map<string, BffConfirmedIntegration>();
const confirmedAthenaSnapshotStore = new Map<string, AthenaResolvedSnapshot>();

interface StoredApprovalRequestSnapshot {
  projectId: string;
  requestId: string;
  requestedAt: string;
  requestedBy: string;
  inputData: ApprovalRequestInputSnapshot;
  athenaResolved: AthenaResolvedSnapshot;
}

const approvalRequestSnapshotStore = new Map<string, StoredApprovalRequestSnapshot>();
const latestApprovalRequestByProjectStore = new Map<string, string>();

// Mock store: 승인 시각 (설치 반영 소요시간 시뮬레이션용)
// 실제 환경: 빠르면 1분, 최대 하루 이상 소요
// Mock: MOCK_INSTALLATION_DELAY_MS(기본 15초) 경과 후 설치 완료 처리
const MOCK_INSTALLATION_DELAY_MS = 15_000;
const approvalTimestampStore = new Map<string, number>();

/** @internal 테스트 전용: store 초기화 */
export const _resetApprovedIntegrationStore = () => {
  approvedIntegrationStore.clear();
  approvedAthenaSnapshotStore.clear();
  confirmedIntegrationSnapshotStore.clear();
  confirmedAthenaSnapshotStore.clear();
  approvalRequestSnapshotStore.clear();
  latestApprovalRequestByProjectStore.clear();
  approvalTimestampStore.clear();
};

/** @internal 테스트 전용: 지연 시간 우회 (승인 시각을 과거로 설정) */
export const _fastForwardApproval = (projectId: string) => {
  approvalTimestampStore.set(projectId, Date.now() - MOCK_INSTALLATION_DELAY_MS - 1);
};

/** @internal 테스트 전용: ApprovedIntegration 직접 설정 (실시간 상태 계산 테스트용) */
export const _setApprovedIntegration = (projectId: string) => {
  approvedIntegrationStore.set(projectId, {
    id: `ai-test-${projectId}`,
    request_id: `req-test-${projectId}`,
    approved_at: new Date().toISOString(),
    resource_infos: [],
    excluded_resource_ids: [],
  });
  approvalTimestampStore.set(projectId, Date.now());
};

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

const ATHENA_TABLE_RULE_LIMIT = 10_000;

const withPageParams = (page: number, size: number) => ({
  page: Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0,
  size: Number.isFinite(size) && size > 0 ? Math.floor(size) : 20,
});

const VM_DATABASE_TYPES: VmDatabaseConfig['databaseType'][] = [
  'MYSQL',
  'POSTGRESQL',
  'MSSQL',
  'MONGODB',
  'ORACLE',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isVmDatabaseType = (value: unknown): value is VmDatabaseConfig['databaseType'] =>
  typeof value === 'string' && VM_DATABASE_TYPES.includes(value as VmDatabaseConfig['databaseType']);

const getAllAthenaTables = (project: Project): AthenaTableRecord[] =>
  extractAthenaTables(project.resources, project.awsAccountId);

const getSelectedAthenaTablesFromProject = (project: Project): AthenaTableRecord[] => {
  const selectedAthenaResources = project.resources.filter(
    (resource) => isAthenaResource(resource) && resource.isSelected,
  );
  return extractAthenaTables(selectedAthenaResources, project.awsAccountId);
};

const getActiveAthenaTablesFromProject = (project: Project): AthenaTableRecord[] => {
  const activeAthenaResources = project.resources.filter(
    (resource) =>
      isAthenaResource(resource) &&
      resource.isSelected &&
      (resource.connectionStatus === 'CONNECTED' || project.status.installation.status === 'COMPLETED'),
  );
  return extractAthenaTables(activeAthenaResources, project.awsAccountId);
};

const getAthenaRegionSummariesFromProject = (project: Project): AthenaRegionResourceSummary[] =>
  buildAthenaRegionSummaries(getAllAthenaTables(project));

const getAthenaRegionIntegrationCategory = (
  project: Project,
  region: string,
): Resource['integrationCategory'] => {
  const regionResources = project.resources.filter(
    (resource) =>
      isAthenaResource(resource) &&
      ((parseAthenaResourceId(resource.resourceId)?.region ?? resource.region) === region),
  );
  if (regionResources.some((resource) => resource.integrationCategory === 'TARGET')) return 'TARGET';
  if (regionResources.some((resource) => resource.integrationCategory === 'NO_INSTALL_NEEDED')) {
    return 'NO_INSTALL_NEEDED';
  }
  return 'INSTALL_INELIGIBLE';
};

const getStoredApprovalRequest = (
  projectId: string,
  requestId: string,
): StoredApprovalRequestSnapshot | null => {
  const stored = approvalRequestSnapshotStore.get(requestId);
  if (!stored || stored.projectId !== projectId) return null;
  return stored;
};

const getHistoryById = (projectId: string, historyId: string) => {
  const store = getStore();
  return store.projectHistory.find(
    (history) => history.projectId === projectId && history.id === historyId,
  );
};

const resolveAthenaSnapshotFromInput = (
  project: Project,
  inputData: ApprovalRequestInputSnapshot | undefined,
): AthenaResolvedSnapshot => {
  const rules = inputData?.athena_input?.rules ?? [];
  if (rules.length === 0) return { tables: [] };
  return resolveAthenaSelection(getAllAthenaTables(project), rules);
};

const getApprovalRequestAthenaSnapshot = (
  project: Project,
  requestId: string,
): AthenaResolvedSnapshot | null => {
  const stored = getStoredApprovalRequest(project.id, requestId);
  if (stored) return stored.athenaResolved;
  return null;
};

const getApprovalHistoryAthenaSnapshot = (
  project: Project,
  historyId: string,
): AthenaResolvedSnapshot | null => {
  const history = getHistoryById(project.id, historyId);
  if (!history) return null;

  const requestId = history.details.requestId ?? history.id;
  const stored = getStoredApprovalRequest(project.id, requestId);
  if (stored) return stored.athenaResolved;

  return resolveAthenaSnapshotFromInput(project, history.details.inputData);
};

const getPendingApprovalRequestForProject = (
  project: Project,
): StoredApprovalRequestSnapshot | null => {
  const latestRequestId = latestApprovalRequestByProjectStore.get(project.id);
  if (!latestRequestId) return null;
  return getStoredApprovalRequest(project.id, latestRequestId);
};

const getConfirmedAthenaSnapshot = (project: Project): AthenaResolvedSnapshot | null => {
  const snapshot = confirmedAthenaSnapshotStore.get(project.id);
  if (snapshot) return snapshot;

  if (project.status.installation.status !== 'COMPLETED') {
    return null;
  }

  return { tables: getActiveAthenaTablesFromProject(project) };
};

const getApprovedAthenaSnapshot = (projectId: string): AthenaResolvedSnapshot | null => {
  if (!approvedIntegrationStore.has(projectId)) {
    return null;
  }
  return approvedAthenaSnapshotStore.get(projectId) ?? { tables: [] };
};

const paginateAthenaDatabases = (
  tables: AthenaTableRecord[],
  region: string,
  page: number,
  size: number,
) => {
  const paging = withPageParams(page, size);
  return paginate(buildAthenaDatabaseNodes(tables, region), paging.page, paging.size);
};

const paginateAthenaTables = (
  tables: AthenaTableRecord[],
  region: string,
  database: string,
  page: number,
  size: number,
) => {
  const paging = withPageParams(page, size);
  return paginate(buildAthenaTableNodes(tables, region, database), paging.page, paging.size);
};

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
  input_data: ApprovalRequestInputSnapshot;
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

    const nonAthenaResources = project.resources
      .filter((resource) => !isAthenaResource(resource))
      .map((resource) => ({
        id: resource.id,
        resourceId: resource.resourceId,
        name: resource.resourceId,
        resourceType: resource.type,
        integrationCategory: resource.integrationCategory,
        selectedCredentialId: resource.selectedCredentialId ?? null,
        metadata: buildMetadata(resource, project),
      }));

    const athenaRegionResources = getAthenaRegionSummariesFromProject(project).map((summary) => ({
      id: summary.resource_id,
      resourceId: summary.resource_id,
      name: summary.resource_id,
      resourceType: 'ATHENA_REGION',
      integrationCategory: getAthenaRegionIntegrationCategory(project, summary.athena_region),
      selectedCredentialId: null,
      metadata: {
        provider: 'AWS',
        resourceType: 'ATHENA_REGION',
        athena_region: summary.athena_region,
      },
    }));

    const resources = [...nonAthenaResources, ...athenaRegionResources];
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
        (resource) =>
          !isAthenaResource(resource) &&
          resource.isSelected &&
          resource.connectionStatus === 'CONNECTED',
      );
      const confirmedAthenaTables = getActiveAthenaTablesFromProject(project);
      if (connectedResources.length > 0 || confirmedAthenaTables.length > 0) {
        confirmedIntegrationSnapshotStore.set(projectId, {
          resource_infos: connectedResources.map(toResourceSnapshot),
          athena_region_resources: buildAthenaRegionSummaries(confirmedAthenaTables),
        });
        confirmedAthenaSnapshotStore.set(projectId, { tables: confirmedAthenaTables });
      } else {
        confirmedIntegrationSnapshotStore.delete(projectId);
        confirmedAthenaSnapshotStore.delete(projectId);
      }
    }

    const input_data = (body as ApprovalRequestCreateBody)?.input_data;
    if (!input_data || !Array.isArray(input_data.resource_inputs)) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'input_data.resource_inputs가 필요합니다.' },
        { status: 400 },
      );
    }

    const { resource_inputs, exclusion_reason_default } = input_data;
    const athenaRules = input_data.athena_input?.rules ?? [];

    const selectedAthenaTableRuleCount = athenaRules.filter(
      (rule) => rule.scope === 'TABLE' && rule.selected,
    ).length;
    if (selectedAthenaTableRuleCount > ATHENA_TABLE_RULE_LIMIT) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Athena TABLE 개별 선택 한도를 초과했습니다. REGION/DATABASE 단위로 요청해주세요.',
        },
        { status: 400 },
      );
    }

    const athenaResolved = resolveAthenaSelection(getAllAthenaTables(project), athenaRules);
    const selectedAthenaSourceIds = new Set(
      athenaResolved.tables.map((table) => table.sourceResourceId),
    );

    const selectedInputs = resource_inputs.filter(
      (ri): ri is Extract<typeof ri, { selected: true }> => ri.selected === true,
    );
    const excludedInputs = resource_inputs.filter(
      (ri): ri is Extract<typeof ri, { selected: false }> => ri.selected === false,
    );

    if (selectedInputs.length === 0 && athenaResolved.tables.length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: '연동 대상이 1개 이상이어야 합니다.' },
        { status: 400 },
      );
    }

    // Build endpoint config map from selected resources
    const endpointConfigMap = new Map<string, VmDatabaseConfig>();
    const credentialMap = new Map<string, string>();

    for (const si of selectedInputs) {
      if (isRecord(si.resource_input)) {
        const endpointConfig = isRecord(si.resource_input.endpoint_config)
          ? si.resource_input.endpoint_config
          : null;
        if (endpointConfig) {
          const dbType = endpointConfig.db_type;
          const port = endpointConfig.port;
          const host = typeof endpointConfig.host === 'string' ? endpointConfig.host : '';

          if (isVmDatabaseType(dbType) && typeof port === 'number') {
            const vmConfig: VmDatabaseConfig = {
              host,
              databaseType: dbType,
              port,
            };
            if (typeof endpointConfig.oracleServiceId === 'string') {
              vmConfig.oracleServiceId = endpointConfig.oracleServiceId;
            }
            if (typeof endpointConfig.selectedNicId === 'string') {
              vmConfig.selectedNicId = endpointConfig.selectedNicId;
            }
            endpointConfigMap.set(si.resource_id, vmConfig);
          }
        }

        if (typeof si.resource_input.credential_id === 'string') {
          credentialMap.set(si.resource_id, si.resource_input.credential_id);
        }
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

    const updatedResources: Resource[] = project.resources.map((resource) => {
      const athenaResource = isAthenaResource(resource);
      const isSelected = athenaResource
        ? selectedAthenaSourceIds.has(resource.id)
        : selectedSet.has(resource.id);

      let exclusion: ResourceExclusion | undefined = resource.exclusion;
      if (athenaResource) {
        exclusion = undefined;
      } else {
        const exclusionReason = excludedMap.get(resource.id);
        if (excludedMap.has(resource.id) && exclusionReason) {
          exclusion = { reason: exclusionReason, excludedAt: now, excludedBy };
        }
      }

      const vmDatabaseConfig = endpointConfigMap.get(resource.id) ?? resource.vmDatabaseConfig;
      const selectedCredentialId = credentialMap.get(resource.id) ?? resource.selectedCredentialId;

      return { ...resource, isSelected, exclusion, vmDatabaseConfig, selectedCredentialId };
    });

    const selectedResourceIds = updatedResources
      .filter((resource) => resource.isSelected)
      .map((resource) => resource.id);
    const selectedCount = selectedResourceIds.length;
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
      installation: autoApprovalResult.shouldAutoApprove
        ? { status: 'IN_PROGRESS' }
        : { status: 'PENDING' },
      // 프로세스 재시작 시 연결 테스트 상태 초기화
      connectionTest: { status: 'NOT_TESTED' },
    };

    // 기존 연결 테스트 내역 삭제
    tcFns.clearJobHistory(projectId);

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);
    const actor = { id: user.id, name: user.name };

    await mockData.updateProject(projectId, {
      resources: updatedResources,
      status: updatedStatus,
      processStatus: calculatedProcessStatus,
    });

    const requestId = `req-${Date.now()}`;
    const inputDataSnapshot = input_data;
    approvalRequestSnapshotStore.set(requestId, {
      projectId,
      requestId,
      requestedAt: now,
      requestedBy: user.name,
      inputData: inputDataSnapshot,
      athenaResolved,
    });
    latestApprovalRequestByProjectStore.set(projectId, requestId);
    await mockHistory.addTargetConfirmedHistory(
      projectId,
      actor,
      selectedCount,
      excludedCount,
      inputDataSnapshot,
      requestId,
    );

    // ADR-006: 자동 승인 시에도 ApprovedIntegration 스냅샷 생성
    if (autoApprovalResult.shouldAutoApprove) {
      const selectedResources = updatedResources.filter(
        (resource) => resource.isSelected && !isAthenaResource(resource),
      );
      const excludedResources = updatedResources.filter((r) => r.exclusion);
      approvedAthenaSnapshotStore.set(projectId, athenaResolved);
      approvedIntegrationStore.set(projectId, {
        id: `ai-${projectId}-${Date.now()}`,
        request_id: requestId,
        approved_at: now,
        resource_infos: selectedResources.map(toResourceSnapshot),
        athena_region_resources: buildAthenaRegionSummaries(athenaResolved.tables),
        excluded_resource_ids: excludedResources.map((r) => r.id),
        exclusion_reason: excludedResources[0]?.exclusion?.reason,
      });
      // 설치 반영 소요시간 시뮬레이션: 승인 시각 기록
      approvalTimestampStore.set(projectId, Date.now());
      await mockHistory.addAutoApprovedHistory(projectId);
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
          athena_region_resources: buildAthenaRegionSummaries(athenaResolved.tables),
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

    // 1. 변경 요청 중 보존된 이전 확정 스냅샷 확인
    const snapshot = confirmedIntegrationSnapshotStore.get(project.id);
    if (snapshot) {
      const confirmedAthena = confirmedAthenaSnapshotStore.get(project.id) ?? { tables: [] };
      return NextResponse.json({
        confirmed_integration: {
          ...snapshot,
          athena_region_resources: buildAthenaRegionSummaries(confirmedAthena.tables),
        },
      });
    }

    // 2. 현재 프로젝트 상태에서 확정 정보 도출
    const activeResources = project.resources.filter(
      (resource) =>
        !isAthenaResource(resource) &&
        resource.isSelected &&
        resource.connectionStatus === 'CONNECTED',
    );
    const activeAthenaTables = getActiveAthenaTablesFromProject(project);
    if (
      project.status.installation.status !== 'COMPLETED' ||
      (activeResources.length === 0 && activeAthenaTables.length === 0)
    ) {
      return NextResponse.json({ confirmed_integration: null });
    }

    return NextResponse.json({
      confirmed_integration: {
        resource_infos: activeResources.map(toResourceSnapshot),
        athena_region_resources: buildAthenaRegionSummaries(activeAthenaTables),
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

    const approvedAthena = approvedAthenaSnapshotStore.get(project.id) ?? { tables: [] };
    return NextResponse.json({
      approved_integration: {
        ...approved,
        athena_region_resources: buildAthenaRegionSummaries(approvedAthena.tables),
      },
    });
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
      const pendingSnapshot = getPendingApprovalRequestForProject(project);
      if (pendingSnapshot) {
        return NextResponse.json({
          content: [{
            request: {
              id: pendingSnapshot.requestId,
              requested_at: pendingSnapshot.requestedAt,
              requested_by: pendingSnapshot.requestedBy,
              input_data: pendingSnapshot.inputData,
              athena_region_resources: buildAthenaRegionSummaries(pendingSnapshot.athenaResolved.tables),
            },
          }],
          page: { totalElements: 1, totalPages: 1, number: page, size },
        });
      }

      const pendingRequest = {
        id: `req-pending-${project.id}`,
        requested_at: project.updatedAt,
        requested_by: user.name,
        input_data: { resource_inputs: buildCurrentResourceInputs() },
        athena_region_resources: buildAthenaRegionSummaries(getSelectedAthenaTablesFromProject(project)),
      };
      return NextResponse.json({
        content: [{ request: pendingRequest }],
        page: { totalElements: 1, totalPages: 1, number: page, size },
      });
    }

    const content = history.map((h) => {
      const requestId = h.details.requestId ?? h.id;
      const storedRequest = getStoredApprovalRequest(project.id, requestId);
      // Use stored snapshot if available, otherwise fall back to history/current state
      const inputData = storedRequest?.inputData ??
        h.details.inputData ??
        { resource_inputs: buildCurrentResourceInputs() };
      const athenaResolved = storedRequest?.athenaResolved ??
        resolveAthenaSnapshotFromInput(project, inputData);
      const request = {
        id: requestId,
        requested_at: h.timestamp,
        requested_by: h.actor.name,
        input_data: inputData,
        athena_region_resources: buildAthenaRegionSummaries(athenaResolved.tables),
      };

      let result;
      if (h.type === 'APPROVAL') {
        result = {
          id: `result-${h.id}`,
          request_id: requestId,
          result: 'APPROVED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: h.actor.id, reason: null },
        };
      } else if (h.type === 'AUTO_APPROVED') {
        result = {
          id: `result-${h.id}`,
          request_id: requestId,
          result: 'AUTO_APPROVED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: null, reason: null },
        };
      } else if (h.type === 'REJECTION') {
        result = {
          id: `result-${h.id}`,
          request_id: requestId,
          result: 'REJECTED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: h.actor.id, reason: h.details.reason ?? null },
        };
      } else if (h.type === 'APPROVAL_CANCELLED') {
        result = {
          id: `result-${h.id}`,
          request_id: requestId,
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

  getAthenaRegionDatabases: async (projectId: string, region: string, page: number, size: number) => {
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

    return NextResponse.json(
      paginateAthenaDatabases(getAllAthenaTables(project), region, page, size),
    );
  },

  getAthenaDatabaseTables: async (
    projectId: string,
    region: string,
    database: string,
    page: number,
    size: number,
  ) => {
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

    return NextResponse.json(
      paginateAthenaTables(
        getAllAthenaTables(project),
        region,
        database,
        page,
        size,
      ),
    );
  },

  getApprovalRequestAthenaDatabases: async (
    projectId: string,
    requestId: string,
    region: string,
    page: number,
    size: number,
  ) => {
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

    const snapshot = getApprovalRequestAthenaSnapshot(project, requestId);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '승인 요청을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      paginateAthenaDatabases(snapshot.tables, region, page, size),
    );
  },

  getApprovalRequestAthenaTables: async (
    projectId: string,
    requestId: string,
    region: string,
    database: string,
    page: number,
    size: number,
  ) => {
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

    const snapshot = getApprovalRequestAthenaSnapshot(project, requestId);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '승인 요청을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      paginateAthenaTables(
        snapshot.tables,
        region,
        database,
        page,
        size,
      ),
    );
  },

  getApprovalHistoryAthenaDatabases: async (
    projectId: string,
    historyId: string,
    region: string,
    page: number,
    size: number,
  ) => {
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

    const snapshot = getApprovalHistoryAthenaSnapshot(project, historyId);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '승인 이력을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      paginateAthenaDatabases(snapshot.tables, region, page, size),
    );
  },

  getApprovalHistoryAthenaTables: async (
    projectId: string,
    historyId: string,
    region: string,
    database: string,
    page: number,
    size: number,
  ) => {
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

    const snapshot = getApprovalHistoryAthenaSnapshot(project, historyId);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '승인 이력을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      paginateAthenaTables(
        snapshot.tables,
        region,
        database,
        page,
        size,
      ),
    );
  },

  getConfirmedIntegrationAthenaDatabases: async (
    projectId: string,
    region: string,
    page: number,
    size: number,
  ) => {
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

    const snapshot = getConfirmedAthenaSnapshot(project);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '확정된 연동 정보가 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      paginateAthenaDatabases(snapshot.tables, region, page, size),
    );
  },

  getConfirmedIntegrationAthenaTables: async (
    projectId: string,
    region: string,
    database: string,
    page: number,
    size: number,
  ) => {
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

    const snapshot = getConfirmedAthenaSnapshot(project);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '확정된 연동 정보가 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      paginateAthenaTables(
        snapshot.tables,
        region,
        database,
        page,
        size,
      ),
    );
  },

  getApprovedIntegrationAthenaDatabases: async (
    projectId: string,
    region: string,
    page: number,
    size: number,
  ) => {
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

    const snapshot = getApprovedAthenaSnapshot(project.id);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '승인된 연동 정보가 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      paginateAthenaDatabases(snapshot.tables, region, page, size),
    );
  },

  getApprovedIntegrationAthenaTables: async (
    projectId: string,
    region: string,
    database: string,
    page: number,
    size: number,
  ) => {
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

    const snapshot = getApprovedAthenaSnapshot(project.id);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '승인된 연동 정보가 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      paginateAthenaTables(
        snapshot.tables,
        region,
        database,
        page,
        size,
      ),
    );
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

    // Mock 자동 전환: APPLYING_APPROVED 10초 경과 → 설치 완료 처리
    const approvedAt = approvalTimestampStore.get(project.id);
    if (
      approvedIntegrationStore.has(project.id) &&
      approvedAt &&
      Date.now() - approvedAt >= MOCK_INSTALLATION_DELAY_MS
    ) {
      const now = new Date().toISOString();
      const updatedStatus: ProjectStatus = {
        ...project.status,
        installation: { status: 'COMPLETED', completedAt: now },
      };
      const calcStatus = getCurrentStep(project.cloudProvider, updatedStatus);
      mockData.updateProject(project.id, {
        processStatus: calcStatus,
        status: updatedStatus,
        terraformState: {
          ...project.terraformState,
          bdcTf: 'COMPLETED' as const,
          ...(project.cloudProvider === 'AWS' ? { serviceTf: 'COMPLETED' as const } : {}),
        },
      });
      approvedIntegrationStore.delete(project.id);
      approvedAthenaSnapshotStore.delete(project.id);
      confirmedIntegrationSnapshotStore.delete(project.id);
      confirmedAthenaSnapshotStore.delete(project.id);

      const updated = mockData.getProjectById(projectId)!;
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
        has_confirmed_integration: project.status.installation.status === 'COMPLETED' && !approvedIntegrationStore.has(project.id),
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
      installation: { status: 'PENDING' },
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
    const selectedResources = updatedResources.filter(
      (resource) => resource.isSelected && !isAthenaResource(resource),
    );
    const excludedResources = updatedResources.filter((r) => r.exclusion);
    const pendingRequest = getPendingApprovalRequestForProject(project);
    const requestId = pendingRequest?.requestId ?? `req-${project.id}-${Date.now()}`;
    const approvedAthena = pendingRequest?.athenaResolved ?? { tables: [] };
    approvedAthenaSnapshotStore.set(project.id, approvedAthena);
    approvedIntegrationStore.set(project.id, {
      id: `ai-${project.id}-${Date.now()}`,
      request_id: requestId,
      approved_at: now,
      resource_infos: selectedResources.map(toResourceSnapshot),
      athena_region_resources: buildAthenaRegionSummaries(approvedAthena.tables),
      excluded_resource_ids: excludedResources.map((r) => r.id),
      exclusion_reason: excludedResources[0]?.exclusion?.reason,
    });

    // 설치 반영 소요시간 시뮬레이션: 승인 시각 기록
    approvalTimestampStore.set(project.id, Date.now());

    mockHistory.addApprovalHistory(projectId, { id: user.id, name: user.name });

    // Queue Board 연동: 승인 → IN_PROGRESS
    updateQueueItemStatus(project.targetSourceId, 'IN_PROGRESS', user.name);

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

    // Queue Board 연동: 반려 → REJECTED
    updateQueueItemStatus(project.targetSourceId, 'REJECTED', user.name, reason);

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

    mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      completionConfirmedAt: now,
      piiAgentInstalled: true,
      piiAgentConnectedAt: project.piiAgentConnectedAt || now,
    });

    // 설치 확정 시 store 정리 (반영 완료)
    approvedIntegrationStore.delete(project.id);
    approvedAthenaSnapshotStore.delete(project.id);
    confirmedIntegrationSnapshotStore.delete(project.id);
    confirmedAthenaSnapshotStore.delete(project.id);
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
    void body;
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

    if (tcFns.hasPendingJob(projectId)) {
      return NextResponse.json(
        { error: { code: 'CONFLICT_IN_PROGRESS', message: '현재 연결 테스트가 진행 중입니다.' } },
        { status: 409 },
      );
    }

    const targetSourceId = project.targetSourceId ?? (Number(projectId.replace(/\D/g, '')) || 0);
    const job = tcFns.createTestConnectionJob(project, targetSourceId, user.id);

    return NextResponse.json({ id: job.id }, { status: 202 });
  },

  getTestConnectionResults: async (projectId: string, page: number, size: number) => {
    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: { code: 'TARGET_SOURCE_NOT_FOUND', message: '해당 ID의 Target Source가 존재하지 않습니다.' } },
        { status: 404 },
      );
    }

    const { content, total } = tcFns.getJobHistory(projectId, page, size);
    const totalPages = Math.ceil(total / size);

    return NextResponse.json({
      content: content.map(tcFns.toJobResponse),
      page: { totalElements: total, totalPages, number: page, size },
    });
  },

  getTestConnectionLatest: async (projectId: string) => {
    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: { code: 'TARGET_SOURCE_NOT_FOUND', message: '해당 ID의 Target Source가 존재하지 않습니다.' } },
        { status: 404 },
      );
    }

    const job = tcFns.getLatestJob(projectId);
    if (!job) {
      return NextResponse.json(
        { error: { code: 'TEST_CONNECTION_NOT_FOUND', message: '연결 테스트 이력이 없습니다.' } },
        { status: 404 },
      );
    }

    return NextResponse.json(tcFns.toJobResponse(job));
  },

  getConnectionStatus: async (projectId: string) => {
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

    // Confirmed Integration이 없으면 404 (설치 완료 기준)
    if (project.status.installation.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'CONFIRMED_INTEGRATION_NOT_FOUND', message: '확정된 연동 정보가 없습니다.' },
        { status: 404 },
      );
    }

    const selectedResources = project.resources.filter((r) => r.isSelected);

    const resources = selectedResources.map((r) => {
      const counts = generateDbCounts(r.resourceId, r.databaseType);
      return {
        resource_id: r.resourceId,
        ...counts,
      };
    });

    return NextResponse.json({
      resources,
      checked_at: new Date().toISOString(),
      query_period_days: 7,
      agent_running: true,
    });
  },
};

// --- Mock DB Count Generator ---

/** databaseType별 논리 DB 개수 */
const DB_COUNT_MAP: Record<string, number> = {
  MYSQL: 5, POSTGRESQL: 4, MSSQL: 3, ORACLE: 3,
  MONGODB: 3, DYNAMODB: 1, ATHENA: 1, REDSHIFT: 3,
  COSMOSDB: 2, BIGQUERY: 2,
};

/** 결정론적 해시: resourceId 기반으로 일관된 mock 데이터 생성 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateDbCounts(resourceId: string, databaseType: string) {
  const total = DB_COUNT_MAP[databaseType] ?? 2;
  const h = simpleHash(resourceId) % 100;

  // 약 60% 전부 성공, 25% 일부 실패, 15% pending 포함
  let fail: number;
  let pending: number;

  if (h >= 85) {
    fail = Math.min(1, total);
    pending = Math.min(1, total - fail);
  } else if (h >= 60) {
    fail = Math.min(Math.max(1, (h % 3) + 1), total);
    pending = 0;
  } else {
    fail = 0;
    pending = 0;
  }

  const success = total - fail - pending;

  return {
    total_database_count: total,
    success_database_count: success,
    fail_count: fail,
    pending_count: pending,
  };
}
