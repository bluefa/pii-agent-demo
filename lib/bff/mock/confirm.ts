import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as mockHistory from '@/lib/mock-history';
import * as tcFns from '@/lib/mock-test-connection';
import * as mockInstallation from '@/lib/mock-installation';
import { getStore } from '@/lib/mock-store';
import { ProcessStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';
import { addQueueItem, updateQueueItemStatus } from '@/lib/bff/mock/queue-board';
import { createEmptyConfirmedIntegration } from '@/lib/confirmed-integration-response';
import {
  extractResourceCatalog,
  type ResourceCatalogResponsePayload,
} from '@/lib/resource-catalog-response';
import { normalizeApprovalRequestBody } from '@/lib/approval-bff';
import type {
  MockResource,
  Project,
  ProjectStatus,
  ConnectionStatus,
  ConnectionTestResult,
  ConnectionTestHistory,
  VmDatabaseConfig,
  ResourceExclusion,
  BffApprovedIntegration,
  BffConfirmedIntegration,
  BffExcludedResourceInfo,
  EndpointConfigInputData,
  ResourceIntegrationStatus,
  ResourceScanStatus,
  ResourceSnapshot,
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

// --- Helpers ---

type BffProcessStatus = 'REQUEST_REQUIRED' | 'WAITING_APPROVAL' | 'APPLYING_APPROVED' | 'TARGET_CONFIRMED';

const computeProcessStatus = (project: Project): BffProcessStatus => {
  // ADR-009 D-004: priority based on the existence of the 3 objects (targets / approval / installation).
  // PENDING / REJECTED / UNAVAILABLE all keep the project at Step 2 (WAITING_APPROVAL);
  // only an explicit system-reset transitions back to Step 1 by clearing targets.confirmed
  // AND approval.status. Mirror the fallback from getCurrentStep so legacy snapshots that
  // carry confirmed=false + REJECTED/UNAVAILABLE stay on Step 2 until system-reset is invoked.
  if (project.status.approval.status === 'REJECTED' || project.status.approval.status === 'UNAVAILABLE') {
    return 'WAITING_APPROVAL';
  }
  if (project.status.targets.confirmed && project.status.approval.status === 'PENDING') {
    return 'WAITING_APPROVAL';
  }
  // ApprovedIntegration present → applying.
  if (approvedIntegrationStore.has(project.id)) {
    return 'APPLYING_APPROVED';
  }
  // installation COMPLETED → confirmed.
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

// ===== Deterministic demo enrichment =====
// v15 expects every confirmed/approved/approval row to carry a real Region,
// Resource Name and DB Credential. The mock seed only stores resourceId
// (and an AwsRegion for AWS), so derive stable demo values here — the single
// central derive point shared by buildMetadata / toResourceSnapshot /
// toExcludedResourceInfo / toConfirmedIntegrationResourceInfo. Values are keyed
// off resourceId so they stay stable across re-renders and match the v15 sheet.

// Region per provider (v15: AWS/Azure ap-northeast-1, GCP asia-northeast3).
const demoRegion = (provider: Project['cloudProvider'], resource: MockResource): string => {
  if (provider === 'AWS') return resource.region ?? 'ap-northeast-1';
  if (provider === 'GCP') return 'asia-northeast3';
  return 'ap-northeast-1';
};

// Friendly DB names from the v15 sheet. Assigned round-robin by a stable hash of
// resourceId so each row gets a distinct, repeatable name (sea-live-space-prod, …).
const DEMO_RESOURCE_NAMES = [
  'sea-live-space-prod',
  'sea-live-space-stg',
  'sea-live-space-dev',
  'sea-analytics-prod',
  'sea-payments-prod',
] as const;

const GCP_RESOURCE_NAMES = ['live · default', 'live · analytics', 'prd · main'] as const;

const stableIndex = (key: string, length: number): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
};

const demoResourceName = (provider: Project['cloudProvider'], resource: MockResource): string => {
  if (provider === 'GCP') {
    return GCP_RESOURCE_NAMES[stableIndex(resource.id, GCP_RESOURCE_NAMES.length)];
  }
  return DEMO_RESOURCE_NAMES[stableIndex(resource.id, DEMO_RESOURCE_NAMES.length)];
};

// v15 shows DB Credential as Key1 / Key2 links. Preserve an explicit selection
// when present, otherwise alternate Key1/Key2 by a stable hash.
const demoCredential = (resource: MockResource): string =>
  resource.selectedCredentialId ?? (stableIndex(resource.id, 2) === 0 ? 'Key1' : 'Key2');

// Default DB port by database type (demo). Confirmed-integration must surface a
// non-null host/port; cloud seeds carry neither on the resource (only VM configs
// do), so derive deterministic demo values when absent.
const DEMO_PORT_BY_DB: Record<string, number> = {
  MYSQL: 3306,
  MARIADB: 3306,
  POSTGRESQL: 5432,
  ORACLE: 1521,
  MSSQL: 1433,
  MONGODB: 27017,
  REDIS: 6379,
  COSMOSDB: 443,
  DYNAMODB: 443,
  REDSHIFT: 5439,
  BIGQUERY: 443,
  ATHENA: 443,
};

const demoPort = (resource: MockResource): number => {
  const db = resource.vmDatabaseConfig?.databaseType ?? resource.databaseType ?? '';
  return DEMO_PORT_BY_DB[db] ?? 3306;
};

// Demo host: resource_name as an FQDN under a provider-ish suffix (deterministic).
const demoHost = (provider: Project['cloudProvider'], resource: MockResource): string => {
  const name = demoResourceName(provider, resource).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const suffix =
    provider === 'AWS' ? 'rds.amazonaws.com'
      : provider === 'Azure' ? 'database.azure.com'
        : provider === 'GCP' ? 'cloudsql.gcp.internal'
          : 'db.internal';
  return `${name}.${suffix}`;
};

// Swagger TargetSourceResourceMetadataDto (snake wire). host/port/
// oracle_service_id/network_interface_id live HERE, not on the item — the real
// BFF authors them under metadata, so the mock must too (else extractResourceCatalog
// reading metadata.* would silently see nothing against the real wire).
function buildMetadata(resource: MockResource, project: Project): Record<string, unknown> {
  const region = demoRegion(project.cloudProvider, resource);
  const vm = resource.vmDatabaseConfig;
  const vmFields = {
    ...(vm?.host !== undefined ? { host: vm.host } : {}),
    ...(vm?.port !== undefined ? { port: vm.port } : {}),
    ...(vm?.oracleServiceId ? { oracle_service_id: vm.oracleServiceId } : {}),
    ...(vm?.selectedNicId ? { network_interface_id: vm.selectedNicId } : {}),
  };

  switch (project.cloudProvider) {
    case 'AWS':
      return {
        provider: 'AWS',
        resource_type: resource.awsType ?? resource.type,
        region,
        ...(resource.vpcId && { vpc_id: resource.vpcId }),
        ...vmFields,
      };
    case 'Azure':
      return { provider: 'AZURE', resource_type: resource.type, region, ...vmFields };
    case 'GCP':
      return {
        provider: 'GCP',
        resource_type: resource.type,
        region,
        project_id: project.gcpProjectId ?? '',
        ...vmFields,
      };
    default:
      return { provider: project.cloudProvider, resource_type: resource.type, region, ...vmFields };
  }
}

// Step-1 scan-status tag (신규/변경). No upstream signal exists in the mock seed,
// so derive a stable value from connectionStatus: previously-connected resources
// read as UNCHANGED (re-scanned), everything else as NEW_SCAN. Mirrors the
// sibling `deriveScanStatus` derivation so candidate scan_status stays on-contract.
const deriveCandidateScanStatus = (resource: MockResource): ResourceScanStatus => {
  if (resource.connectionStatus === 'CONNECTED') return 'UNCHANGED';
  // v15 step-1 shows a mix of 신규(NEW_SCAN)/변경(UNCHANGED). No upstream re-scan
  // signal exists in the seed, so derive a deterministic mix from resourceId:
  // ~1 in 3 reads 변경 so the column is never uniformly 신규.
  return stableIndex(resource.resourceId, 3) === 0 ? 'UNCHANGED' : 'NEW_SCAN';
};

// Swagger TargetSourceResourceItemDto (snake wire). The item carries no
// host/port/oracle_service_id/network_interface_id — those are on metadata.* —
// so `getResources` routes this through `extractResourceCatalog`, the same
// normalizer httpBff uses, to land the domain shape.
function toResourceCatalogItem(
  resource: MockResource,
  project: Project,
): ResourceCatalogResponsePayload['resources'][number] {
  return {
    resource_id: resource.resourceId,
    name: demoResourceName(project.cloudProvider, resource),
    resource_type: resource.type,
    database_type: resource.vmDatabaseConfig?.databaseType ?? resource.databaseType,
    integration_category: resource.integrationCategory,
    scan_status: deriveCandidateScanStatus(resource),
    metadata: buildMetadata(resource, project),
  };
}

// Connected resources count as UNCHANGED + INTEGRATED relative to the prior scan;
// everything else is NEW_SCAN + NOT_INTEGRATED. Resources whose `note` opts into the
// `—` UI branch (no scan / no integration info) return null so the table can render the
// missing-data state.
const deriveScanStatus = (r: MockResource): ResourceScanStatus | null => {
  if (r.note?.includes('새 스캔')) return null;
  return r.connectionStatus === 'CONNECTED' ? 'UNCHANGED' : 'NEW_SCAN';
};

const deriveIntegrationStatus = (r: MockResource): ResourceIntegrationStatus | null => {
  if (r.note?.includes('정보 없음')) return null;
  return r.connectionStatus === 'CONNECTED' && r.isSelected ? 'INTEGRATED' : 'NOT_INTEGRATED';
};

function toResourceSnapshot(r: MockResource, project: Project): ResourceSnapshot {
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
  const idc = r.idcConfig;
  return {
    resource_id: r.resourceId,
    resource_type: r.type,
    endpoint_config,
    credential_id: demoCredential(r),
    database_region: demoRegion(project.cloudProvider, r),
    resource_name: demoResourceName(project.cloudProvider, r),
    scan_status: deriveScanStatus(r),
    integration_status: deriveIntegrationStatus(r),
    // Emit IDC fields only when present (IDC resources only).
    ...(idc ? { idc_host_format: idc.inputFormat } : {}),
    ...(idc?.inputFormat === 'IP' && idc.ips.length > 0 ? { idc_ips: idc.ips } : {}),
    ...(idc?.inputFormat === 'HOST' && idc.domain ? { idc_host: idc.domain } : {}),
    ...(idc?.sourceIps && idc.sourceIps.length > 0 ? { idc_source_ips: idc.sourceIps } : {}),
  };
}

function toExcludedResourceInfo(r: MockResource, project: Project): BffExcludedResourceInfo {
  return {
    resource_id: r.resourceId,
    exclusion_reason: r.exclusion?.reason ?? '',
    resource_name: demoResourceName(project.cloudProvider, r),
    database_type: r.databaseType ?? null,
    database_region: demoRegion(project.cloudProvider, r),
    scan_status: deriveScanStatus(r),
    integration_status: deriveIntegrationStatus(r),
  };
}

function toConfirmedIntegrationResourceInfo(r: MockResource, project: Project): BffConfirmedIntegration['resource_infos'][number] {
  const idc = r.idcConfig;
  // host/port: VM config if present, else IDC endpoint (domain or first ip), else a
  // deterministic demo value so confirmed-integration never surfaces null host/port.
  const idcHost = idc ? (idc.inputFormat === 'HOST' ? idc.domain : idc.ips[0]) : undefined;
  const host = r.vmDatabaseConfig?.host ?? idcHost ?? demoHost(project.cloudProvider, r);
  const port = r.vmDatabaseConfig?.port ?? demoPort(r);
  return {
    resource_id: r.resourceId,
    resource_type: r.type,
    database_type: r.vmDatabaseConfig?.databaseType ?? r.databaseType,
    database_region: demoRegion(project.cloudProvider, r),
    resource_name: demoResourceName(project.cloudProvider, r),
    port,
    host,
    oracle_service_id: r.vmDatabaseConfig?.oracleServiceId ?? idc?.oracleSid ?? null,
    network_interface_id: r.vmDatabaseConfig?.selectedNicId ?? null,
    ip_configuration_name: null,
    credential_id: demoCredential(r),
    // Emit IDC fields only when present (IDC resources only).
    ...(idc ? { idc_host_format: idc.inputFormat } : {}),
    ...(idc?.inputFormat === 'IP' && idc.ips.length > 0 ? { idc_ips: idc.ips } : {}),
    ...(idc?.inputFormat === 'HOST' && idc.domain ? { idc_host: idc.domain } : {}),
    ...(idc?.sourceIps && idc.sourceIps.length > 0 ? { idc_source_ips: idc.sourceIps } : {}),
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
  project: Project,
): BffConfirmedIntegration['resource_infos'] | null {
  const approvedResourceIds = new Set(
    approvedIntegration.resource_infos
      .map((resourceInfo) => resourceInfo.resource_id)
      .filter((resourceId): resourceId is string => typeof resourceId === 'string' && resourceId.length > 0),
  );
  const matched = project.resources.filter(
    (r) => approvedResourceIds.has(r.id) || approvedResourceIds.has(r.resourceId),
  );
  if (matched.length === 0) return null;
  return matched.map((r) => toConfirmedIntegrationResourceInfo(r, project));
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

    // Author the swagger wire (snake, metadata.* host/port/…) then run the same
    // normalizer httpBff uses so the mock exercises the real boundary.
    return NextResponse.json(extractResourceCatalog({ resources, total_count: resources.length }));
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
          resource_infos: connectedResources.map((r) => toConfirmedIntegrationResourceInfo(r, project)),
        });
      }
    }

    const { resource_inputs, exclusion_reason_default } = normalizeApprovalRequestBody(body);

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

    const updatedResources: MockResource[] = project.resources.map((r) => {
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

    // 데모 정책: cloud(aws/azure/gcp)도 IDC와 동일하게 연동 대상 제출 직후 항상
    // '승인 대기'(WAITING_APPROVAL, 관리자 수동 승인) 단계로 진입한다. 자동 승인은
    // 데모 플로우에서 비활성화한다 (자동 승인 정책 함수 자체는 보존).
    const autoApprovalResult: { shouldAutoApprove: boolean } = { shouldAutoApprove: false };

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

    const calculatedProcessStatus = getCurrentStep(updatedStatus);
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
        resource_infos: selectedResources.map((r) => toResourceSnapshot(r, project)),
        excluded_resource_ids: excludedResources.map((r) => r.resourceId),
        excluded_resource_infos: excludedResources.map((r) => toExcludedResourceInfo(r, project)),
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

    // ADR-019: swagger ApprovalRequestSummaryDto (snake wire); 200, not 201.
    return NextResponse.json(
      {
        id: project.targetSourceId,
        target_source_id: project.targetSourceId,
        status: autoApprovalResult.shouldAutoApprove ? 'AUTO_APPROVED' : 'PENDING',
        requested_by: { user_id: user.name },
        requested_at: now,
        resource_total_count: selectedCount + excludedCount,
        resource_selected_count: selectedCount,
      },
      { status: 200 },
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
      const derived = deriveConfirmedResourceInfos(approvedIntegration, project);
      if (derived) {
        return NextResponse.json({ resource_infos: derived } satisfies BffConfirmedIntegration);
      }
    }

    // 4. 최종 폴백: project.resources 의 selected 리소스.
    // The confirmed integration is the selected resource set. Earlier this filtered
    // step-6/7 to per-resource connectionStatus==='CONNECTED', but the live
    // test-connection sim advances processStatus to CONNECTION_VERIFIED via
    // status.connectionTest WITHOUT flipping per-resource connectionStatus — so that
    // guard yielded 0 rows (→ 404) for any project that reached step 6/7 dynamically
    // (and after a later FAILED retest). Reaching step 6/7 already means the
    // integration was confirmed, so selection is the only filter here.
    const eligibleResources = project.resources.filter((r) => r.isSelected);
    if (eligibleResources.length === 0) {
      return NextResponse.json(createEmptyConfirmedIntegration());
    }

    return NextResponse.json({
      resource_infos: eligibleResources.map((r) => toConfirmedIntegrationResourceInfo(r, project)),
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

    // Demo fallback: seeded WAITING_APPROVAL / APPLYING_APPROVED fixtures never
    // populate the store (no live approve call), so synthesize the approved view
    // directly from the project's selected/excluded resources. Without this the
    // step-2 (승인 대기) and step-3 (반영 중) tables render empty.
    if (!approved) {
      const showsApprovalView =
        project.processStatus === ProcessStatus.WAITING_APPROVAL ||
        project.processStatus === ProcessStatus.APPLYING_APPROVED;
      const selectedResources = project.resources.filter((r) => r.isSelected);
      if (!showsApprovalView || selectedResources.length === 0) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: '승인된 연동 정보가 없습니다.' },
          { status: 404 },
        );
      }
      const excludedResources = project.resources.filter((r) => !r.isSelected);
      const approvedAt = project.status.approval.approvedAt ?? project.updatedAt;
      return NextResponse.json({
        approved_integration: {
          id: `ai-demo-${project.id}`,
          request_id: `req-demo-${project.id}`,
          approved_at: approvedAt,
          approved_by: { user_id: '김보안 (kim.security)' },
          resource_infos: selectedResources.map((r) => toResourceSnapshot(r, project)),
          excluded_resource_ids: excludedResources.map((r) => r.resourceId),
          excluded_resource_infos: excludedResources.map((r) => toExcludedResourceInfo(r, project)),
          exclusion_reason: excludedResources[0]?.exclusion?.reason,
        },
      });
    }

    // PR #420: enrich excluded_resource_infos so Step 3 table can render full rows.
    // Stored shape only carries IDs; resolve each against project.resources here.
    const excludedResourceInfos: BffExcludedResourceInfo[] = approved.excluded_resource_ids.map((id) => {
      const projectResource = project.resources.find((r) => r.resourceId === id);
      return projectResource
        ? toExcludedResourceInfo(projectResource, project)
        : { resource_id: id, exclusion_reason: approved.exclusion_reason ?? '' };
    });

    return NextResponse.json({
      approved_integration: { ...approved, excluded_resource_infos: excludedResourceInfos },
    });
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

    // ADR-019: swagger Page.content items are { request: ApprovalRequestSummaryDto,
    // result?: ApprovalActionResponseDto } (snake wire). `input_data` is no longer
    // carried by the contract; counts derive from the stored snapshot/current state.
    type ApprovalSummaryWire = {
      id: number;
      target_source_id: number;
      status: string;
      requested_by: { user_id: string };
      requested_at: string;
      resource_total_count: number;
      resource_selected_count: number;
    };
    type ApprovalActionWire = {
      request_id: number;
      status: string;
      processed_by: { user_id: string };
      processed_at: string;
      reason?: string | null;
    };

    const countsFor = (historyItem: typeof allHistory[number]) => {
      const inputs = Array.isArray(historyItem.details.inputData?.resource_inputs)
        ? historyItem.details.inputData.resource_inputs
        : buildCurrentResourceInputs();
      const selected = inputs.filter((ri) => ri.selected === true).length;
      return { total: inputs.length, selected };
    };

    const numericId = (rawId: string): number =>
      parseInt(String(rawId).replace(/\D/g, '') || '0', 10) || project.targetSourceId;

    const toRequestEntry = (historyItem: typeof allHistory[number]): ApprovalSummaryWire => {
      const counts = countsFor(historyItem);
      return {
        id: numericId(historyItem.id),
        target_source_id: project.targetSourceId,
        status: 'PENDING',
        requested_by: { user_id: historyItem.actor.name },
        requested_at: historyItem.timestamp,
        resource_total_count: counts.total,
        resource_selected_count: counts.selected,
      };
    };

    const toResultEntry = (
      historyItem: typeof allHistory[number],
    ): ApprovalActionWire | undefined => {
      const base = {
        request_id: numericId(historyItem.id),
        processed_by: { user_id: historyItem.actor.name },
        processed_at: historyItem.timestamp,
      };
      if (historyItem.type === 'APPROVAL') return { ...base, status: 'APPROVED' };
      if (historyItem.type === 'AUTO_APPROVED') return { ...base, status: 'AUTO_APPROVED' };
      if (historyItem.type === 'REJECTION') {
        return { ...base, status: 'REJECTED', reason: historyItem.details.reason ?? null };
      }
      if (historyItem.type === 'APPROVAL_CANCELLED') return { ...base, status: 'CANCELLED' };
      return undefined;
    };

    const emptyPage = (content: Array<{ request: ApprovalSummaryWire; result?: ApprovalActionWire }>, total: number) => ({
      totalPages: Math.ceil(total / size) || 1,
      totalElements: total,
      pageable: { paged: true, pageNumber: page, pageSize: size, unpaged: false, offset: page * size, sort: [] },
      first: page === 0,
      last: page >= Math.max((Math.ceil(total / size) || 1) - 1, 0),
      size,
      content,
      number: page,
      sort: [],
      numberOfElements: content.length,
      empty: content.length === 0,
    });

    // If WAITING_APPROVAL but no approval history yet, synthesize a PENDING request entry
    if (allHistory.length === 0 && project.processStatus === ProcessStatus.WAITING_APPROVAL) {
      const selected = project.resources.filter((r) => r.isSelected).length;
      const pendingRequest: ApprovalSummaryWire = {
        id: project.targetSourceId,
        target_source_id: project.targetSourceId,
        status: 'PENDING',
        requested_by: { user_id: user.name },
        requested_at: project.updatedAt,
        resource_total_count: project.resources.length,
        resource_selected_count: selected,
      };
      return NextResponse.json(emptyPage([{ request: pendingRequest }], 1));
    }

    const groupedContent = [...allHistory]
      .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
      .reduce<Array<{ request: ApprovalSummaryWire; result?: ApprovalActionWire }>>(
        (acc, historyItem) => {
          const result = toResultEntry(historyItem);

          if (!result) {
            acc.push({ request: toRequestEntry(historyItem) });
            return acc;
          }

          const openRequest = [...acc].reverse().find((entry) => !entry.result);
          if (openRequest) {
            openRequest.result = result;
            openRequest.request.status = result.status;
            return acc;
          }

          acc.push({ request: { ...toRequestEntry(historyItem), status: result.status }, result });
          return acc;
        },
        [],
      );

    const total = groupedContent.length;
    const content = groupedContent
      .slice()
      .reverse()
      .slice(page * size, page * size + size);

    return NextResponse.json(emptyPage(content, total));
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

    // swagger ApprovalRequestLatestDto.resources: TargetSourceResourceItemDto[] —
    // carry idc_* fields under metadata so the IDC mapper (toIdcResourceViewFromItem)
    // can surface Source IPs in the Step-2 table.
    const resources = project.resources.map((r) => {
      const idc = r.idcConfig;
      const metadata: Record<string, unknown> = {
        provider: project.cloudProvider,
        ...(idc ? { idc_host_format: idc.inputFormat } : {}),
        ...(idc?.inputFormat === 'IP' && idc.ips.length > 0 ? { idc_ips: idc.ips } : {}),
        ...(idc?.inputFormat === 'HOST' && idc.domain ? { idc_host: idc.domain } : {}),
        ...(idc?.sourceIps && idc.sourceIps.length > 0 ? { idc_source_ips: idc.sourceIps } : {}),
      };
      return {
        resource_id: r.resourceId,
        resource_type: r.type,
        database_type: r.databaseType,
        selected: r.isSelected,
        integration_category: r.integrationCategory,
        ...(r.exclusion?.reason ? { exclusion_reason: r.exclusion.reason } : {}),
        metadata,
      };
    });

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
      resources,
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
        const calcStatus = getCurrentStep(progressedStatus);
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
          const derived = deriveConfirmedResourceInfos(approvedIntegration, updated);
          if (derived) {
            confirmedIntegrationSnapshotStore.set(updated.id, { resource_infos: derived });
          }
        }

        return NextResponse.json({
          target_source_id: updated.targetSourceId,
          process_status: computeProcessStatus(updated),
          // ADR-019 E2/D-1: swagger ProcessStatusResponseDto carries `healthy`.
          healthy: 'HEALTHY',
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
        // ADR-019 E2/D-1: swagger ProcessStatusResponseDto carries `healthy`.
        healthy: 'HEALTHY',
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
      // ADR-019 E2/D-1: swagger ProcessStatusResponseDto carries `healthy`.
      healthy: 'HEALTHY',
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

    const calculatedProcessStatus = getCurrentStep(updatedStatus);

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
      resource_infos: selectedResources.map((r) => toResourceSnapshot(r, project)),
      excluded_resource_ids: excludedResources.map((r) => r.resourceId),
      excluded_resource_infos: excludedResources.map((r) => toExcludedResourceInfo(r, project)),
      exclusion_reason: excludedResources[0]?.exclusion?.reason,
    });

    // 설치 반영 소요시간 시뮬레이션: 승인 시각 기록
    approvalTimestampStore.set(project.id, Date.now());

    mockHistory.addApprovalHistory(Number(targetSourceId), { id: user.id, name: user.name });

    // Queue Board 연동: 승인 → IN_PROGRESS
    updateQueueItemStatus(project.targetSourceId, 'IN_PROGRESS', user.name);

    // ADR-019: swagger ApprovalActionResponseDto (snake wire).
    return NextResponse.json({
      request_id: project.targetSourceId,
      status: 'APPROVED',
      processed_by: { user_id: user.name },
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

    const updatedStatus: ProjectStatus = {
      ...project.status,
      approval: { status: 'REJECTED', rejectedAt: now, rejectionReason: reason },
    };

    const calculatedProcessStatus = getCurrentStep(updatedStatus);

    mockData.updateProject(project.id, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      isRejected: true,
      rejectionReason: reason,
      rejectedAt: now,
    });

    mockHistory.addRejectionHistory(Number(targetSourceId), { id: user.id, name: user.name }, reason || '');

    // Queue Board 연동: 반려 → REJECTED
    updateQueueItemStatus(project.targetSourceId, 'REJECTED', user.name, reason);

    // ADR-019: swagger ApprovalActionResponseDto (snake wire).
    return NextResponse.json({
      request_id: project.targetSourceId,
      status: 'REJECTED',
      processed_by: { user_id: user.name },
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

    const calculatedProcessStatus = getCurrentStep(updatedStatus);

    mockData.updateProject(project.id, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
    });

    mockHistory.addApprovalCancelledHistory(Number(targetSourceId), { id: user.id, name: user.name });

    // ADR-019: swagger ApprovalActionResponseDto (snake wire).
    return NextResponse.json({
      request_id: project.targetSourceId,
      status: 'CANCELLED',
      processed_by: { user_id: user.name },
      processed_at: now,
    });
  },

  // ADR-019 #7: 연동 불가 판정 → ApprovalUnavailableResponseDto (snake wire).
  markApprovalRequestUnavailable: async (targetSourceId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 연동 불가 처리할 수 있습니다.' },
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

    const { reason } = (body ?? {}) as { reason?: string };
    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: '연동 불가 사유를 입력해주세요.' } },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updatedStatus: ProjectStatus = {
      ...project.status,
      approval: { status: 'UNAVAILABLE', rejectedAt: now, rejectionReason: reason },
    };

    mockData.updateProject(project.id, {
      processStatus: getCurrentStep(updatedStatus),
      status: updatedStatus,
      isRejected: true,
      rejectionReason: reason,
      rejectedAt: now,
    });

    return NextResponse.json({
      request_id: project.targetSourceId,
      status: 'UNAVAILABLE',
      processed_by: { user_id: user.name },
      processed_at: now,
      reason,
    });
  },

  // ADR-019 #8: 연동 불가 담당자 확인 → ApprovalUnavailableConfirmResponseDto (snake).
  // Resets the target source to its initial state (mirrors the system-reset reset).
  confirmApprovalUnavailable: async (targetSourceId: string) => {
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

    if (project.status.approval.status !== 'UNAVAILABLE') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: '연동 불가 상태가 아닙니다.' } },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const updatedStatus: ProjectStatus = {
      ...project.status,
      targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
      approval: { status: 'CANCELLED' },
    };

    mockData.updateProject(project.id, {
      processStatus: getCurrentStep(updatedStatus),
      status: updatedStatus,
      resources: project.resources.map((r) => ({ ...r, isSelected: false, exclusion: undefined })),
      isRejected: false,
      rejectionReason: undefined,
      rejectedAt: undefined,
    });

    return NextResponse.json({
      target_source_id: project.targetSourceId,
      confirm_status: 'IDLE',
      processed_at: now,
      confirmed_by: user.name,
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

    const currentStep = getCurrentStep(project.status);
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

    const calculatedProcessStatus = getCurrentStep(updatedStatus);

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
        resource_infos: selectedResources.map((r) => toResourceSnapshot(r, project)),
        excluded_resource_ids: excludedResources.map((resource) => resource.resourceId),
        excluded_resource_infos: excludedResources.map((r) => toExcludedResourceInfo(r, project)),
      });
    }

    mockData.updateProject(project.id, { resources: updatedResources });

    return NextResponse.json({ success: true });
  },

  testConnection: async (targetSourceId: string, _collectorImageTag?: string) => {
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

    tcFns.createTestConnectionJob(project, numericTargetSourceId, user.id);

    return NextResponse.json({ success: true }, { status: 202 });
  },

  getLatestTestConnectionResultSummaries: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: { code: 'TARGET_SOURCE_NOT_FOUND', message: '해당 ID의 Target Source가 존재하지 않습니다.' } },
        { status: 404 },
      );
    }

    return NextResponse.json(tcFns.toLatestResultSummaries(Number(targetSourceId)));
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

    return NextResponse.json(tcFns.toVersionResultResponse(job));
  },

  getTestConnectionCompletionStatus: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: { code: 'TARGET_SOURCE_NOT_FOUND', message: '해당 ID의 Target Source가 존재하지 않습니다.' } },
        { status: 404 },
      );
    }

    return NextResponse.json(tcFns.getCompletionStatus(Number(targetSourceId)));
  },

  updateTestConnectionConfirmation: async (
    targetSourceId: string,
    body: { confirmed: boolean },
  ) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) {
      return NextResponse.json(
        { error: { code: 'TARGET_SOURCE_NOT_FOUND', message: '해당 ID의 Target Source가 존재하지 않습니다.' } },
        { status: 404 },
      );
    }

    return NextResponse.json(tcFns.setConfirmation(Number(targetSourceId), body.confirmed === true));
  },

};
