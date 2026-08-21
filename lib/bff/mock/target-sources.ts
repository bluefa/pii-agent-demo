import { NextResponse } from 'next/server';
import {
  addProject,
  generateId,
  generateTargetSourceId,
  getCurrentUser,
  getProjectByTargetSourceId,
  getProjectsByServiceCode,
  mockServiceCodes,
  updateProject,
} from '@/lib/mock-data';
import { mockProjects } from '@/lib/bff/mock/projects';
import { opsInstallModeOverride, opsRoleArnOverride } from '@/lib/bff/mock/ops';
import { createInitialProjectStatus } from '@/lib/process';
import { ProcessStatus } from '@/lib/types';
import type { CloudProvider, Project } from '@/lib/types';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
type TargetSourceCreationCandidateMetadataWire = z.infer<typeof schemas.TargetSourceCreationCandidateMetadata>;
type TargetSourceCreationCandidateRequest = z.infer<typeof schemas.TargetSourceCreationCandidateRequest>;
type TargetSourceCreationCandidateResponseWire = z.infer<typeof schemas.TargetSourceCreationCandidateResponse>;
type TargetSourceMetadataWire = z.infer<typeof schemas.TargetSourceMetadata>;

type BffCloudProvider = 'AWS' | 'GCP' | 'AZURE' | 'IDC' | 'UNKNOWN';
type BffApprovalProcessStatus =
  | 'IDLE'
  | 'PENDING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'INSTALLED'
  | 'CONNECTED'
  | 'COMPLETED';

type CanonicalProvider = 'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU' | 'Others';

// The registration wizard's two slow calls answer instantly in mock mode, which hides
// the step-4 skeleton and the step-5 spinner entirely. 3s is the demo stand-in for the
// real recommendation/provisioning round trip. Mock module only.
// Skipped under vitest: it is a demo affordance, and paying it per case put the
// round-trip test (create + re-preview = 6s) over the 5s default timeout.
const REGISTRATION_LATENCY_MS = 3000;
const registrationLatency = () =>
  process.env.VITEST
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, REGISTRATION_LATENCY_MS));

const toBffCloudProvider = (cloudProvider: CloudProvider): BffCloudProvider => {
  switch (cloudProvider) {
    case 'Azure':
      return 'AZURE';
    case 'IDC':
      return 'IDC';
    default:
      return cloudProvider;
  }
};

const toInternalCloudProvider = (cloudProvider?: string): CloudProvider | null => {
  switch (cloudProvider?.toUpperCase()) {
    case 'AWS':
      return 'AWS';
    case 'GCP':
      return 'GCP';
    case 'AZURE':
      return 'Azure';
    case 'IDC':
      return 'IDC';
    case 'UNKNOWN':
      return 'AWS';
    default:
      return null;
  }
};

const toCanonicalProvider = (cloudProvider?: string): CanonicalProvider | null => {
  switch (cloudProvider?.toUpperCase()) {
    case 'AWS':
      return 'AWS';
    case 'AZURE':
      return 'Azure';
    case 'GCP':
      return 'GCP';
    case 'IDC':
      return 'IDC';
    case 'SDU':
      return 'SDU';
    default:
      return null;
  }
};

export const toBffApprovalProcessStatus = (processStatus: ProcessStatus): BffApprovalProcessStatus => {
  switch (processStatus) {
    case ProcessStatus.WAITING_APPROVAL:
      return 'PENDING';
    case ProcessStatus.APPLYING_APPROVED:
      return 'CONFIRMING';
    case ProcessStatus.INSTALLING:
      return 'CONFIRMED';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return 'INSTALLED';
    case ProcessStatus.CONNECTION_VERIFIED:
      return 'CONNECTED';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return 'COMPLETED';
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
    default:
      return 'IDLE';
  }
};

const getBffMetadata = (project: Project) => {
  // Assumed ops PUT …/installation-mode overrides the seeded grant flag so the
  // detail GET stays coherent after a mode change (docs/api/ops-assumed-contracts.md §2).
  const grantOverride = opsInstallModeOverride(project.targetSourceId);
  const grant = grantOverride ?? project.isTerraformExecutionGranted;
  return {
    ...(project.tenantId ? { tenant_id: project.tenantId } : {}),
    ...(project.subscriptionId ? { subscription_id: project.subscriptionId } : {}),
    ...(project.gcpProjectId ? { gcp_project_id: project.gcpProjectId } : {}),
    ...(project.awsAccountId ? { aws_account_id: project.awsAccountId } : {}),
    ...(project.isChinaRegion !== undefined || project.awsRegionType !== undefined
      ? { is_china_region: project.isChinaRegion ?? project.awsRegionType === 'china' }
      : {}),
    ...(project.isSduType !== undefined ? { is_sdu_type: project.isSduType } : {}),
    ...(grant !== undefined
      ? { grant_service_terraform_execution_permission: grant }
      : {}),
    // v5 — provider 별 scan/terraform 주체. AWS 는 ops PUT 으로 갱신되므로 store 의
    // 저장값이 시드를 덮는다 (그래야 수정 직후 detail 과 화면이 어긋나지 않는다).
    ...(project.awsAccountId
      ? {
          aws_scan_role_arn:
            opsRoleArnOverride(project.targetSourceId, 'scan')
            ?? `arn:aws:iam::${project.awsAccountId}:role/BDCPIIInfraScanRole`,
          aws_terraform_execution_role_arn:
            opsRoleArnOverride(project.targetSourceId, 'execution')
            ?? `arn:aws:iam::${project.awsAccountId}:role/bdc-infra-terraform-worker-service-role`,
        }
      : {}),
    ...(project.gcpProjectId
      ? {
          // 프로젝트 id 는 AWS 의 계정 id 와 같은 자리의 사실이다. 이걸 싣지 않으면 화면이
          // 그것을 SA 주소에서 되짚어야 하고, 주소를 줄일 근거도 사라진다.
          gcp_project_id: project.gcpProjectId,
          gcp_scan_service_account: `pii-agent-scan@${project.gcpProjectId}.iam.gserviceaccount.com`,
          gcp_terraform_service_account: `pii-agent-terraform@${project.gcpProjectId}.iam.gserviceaccount.com`,
        }
      : {}),
    ...(project.subscriptionId
      ? {
          azure_scan_app_id: `1b6e0e0c-9f21-4c7e-8a4d-${String(project.targetSourceId).padStart(12, '0')}`,
        }
      : {}),
  };
};

// swagger `TargetSourceDetail` (snake wire) — flat, used by 37 (`list`) and the
// detail `get`. `service_code`/`service_name` are part of the swagger DTO.
const toBffTargetSourceDetail = (project: Project) => ({
  description: project.description,
  target_source_id: project.targetSourceId,
  service_code: project.serviceCode,
  service_name:
    mockServiceCodes.find((s) => s.code === project.serviceCode)?.name ?? project.serviceCode,
  process_status: toBffApprovalProcessStatus(project.processStatus),
  cloud_provider: toBffCloudProvider(project.cloudProvider),
  created_at: project.createdAt,
  // 계약이 이 DTO 에 선언한 필드(snake). 시드가 안 주면 키를 안 싣는다 — null 로
  // 채우면 "한 번도 연동을 마친 적 없다"를 목이 단정하게 된다.
  ...(project.piiAgentFirstInstalledAt
    ? { pii_agent_first_installed_at: project.piiAgentFirstInstalledAt }
    : {}),
  // 이 응답 스키마에는 아직 없지만 BFF 가 싣는 필드 — 철자는 계약이 형제 응답에
  // 선언한 `supportRawData` 다. 근거가 있는 대상에만 싣던 것을 전 대상으로 바꾼 이유:
  // 값을 끄는 쓰기 API 가 생겼고, 방금 끈 대상이 키 없이 돌아오면 화면은 "미포함" 이
  // 아니라 "미확인" 을 그린다. 세 번째 상태는 계약 반영 전 실서버의 상태이지 목이
  // 흉내 낼 상태가 아니다.
  supportRawData: project.supportRawData === true,
  ...(Object.keys(getBffMetadata(project)).length > 0
    ? { metadata: getBffMetadata(project) }
    : {}),
});

// swagger `TargetSourceInfo` (36, 201): camelCase top-level + snake `metadata`.
// The create response carries only the contract fields.
const toBffTargetSourceCreatedInfo = (project: Project) => {
  const metadata: TargetSourceMetadataWire = {
    ...(project.tenantId ? { tenant_id: project.tenantId } : {}),
    ...(project.subscriptionId ? { subscription_id: project.subscriptionId } : {}),
    ...(project.gcpProjectId ? { gcp_project_id: project.gcpProjectId } : {}),
    ...(project.awsAccountId ? { aws_account_id: project.awsAccountId } : {}),
    ...(project.isChinaRegion !== undefined ? { is_china_region: project.isChinaRegion } : {}),
    ...(project.isTerraformExecutionGranted !== undefined
      ? { grant_service_terraform_execution_permission: project.isTerraformExecutionGranted }
      : {}),
  };
  return {
    targetSourceId: project.targetSourceId,
    description: project.description,
    cloudProvider: toBffCloudProvider(project.cloudProvider),
    createdAt: project.createdAt,
    serviceCode: project.serviceCode,
    serviceName:
      mockServiceCodes.find((s) => s.code === project.serviceCode)?.name ?? project.serviceCode,
    updatedAt: project.updatedAt,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
};

const trim = (value?: string): string => (value ?? '').trim();

interface DuplicateKeyInput {
  awsAccountId?: string;
  isChinaRegion?: boolean;
  subscriptionId?: string;
  gcpProjectId?: string;
  description?: string;
}

// Duplicate identity is the ACCOUNT, not the account×database pair: one request
// registers one account (the selected databases only steer the recommendation),
// so a second request naming the same account is the duplicate. Returns null when
// the identity is incomplete.
const duplicateIdentity = (
  provider: CanonicalProvider,
  fields: DuplicateKeyInput,
): string | null => {
  switch (provider) {
    case 'AWS': {
      const accountId = trim(fields.awsAccountId);
      if (!accountId) return null;
      return `AWS|${accountId}|${fields.isChinaRegion === true}`;
    }
    case 'Azure': {
      const subscriptionId = trim(fields.subscriptionId);
      if (!subscriptionId) return null;
      return `Azure|${subscriptionId}`;
    }
    case 'GCP': {
      const projectId = trim(fields.gcpProjectId);
      if (!projectId) return null;
      return `GCP|${projectId}`;
    }
    case 'IDC':
    case 'Others': {
      const description = trim(fields.description);
      if (!description) return null;
      return `${provider}|${description}`;
    }
    case 'SDU':
      return null;
  }
};

const projectIdentity = (project: Project): string | null => {
  const provider = toCanonicalProvider(project.cloudProvider);
  if (!provider) return null;

  const isChinaRegion = project.isChinaRegion ?? project.awsRegionType === 'china';
  return duplicateIdentity(provider, {
    awsAccountId: project.awsAccountId,
    isChinaRegion,
    subscriptionId: project.subscriptionId,
    gcpProjectId: project.gcpProjectId,
    description: project.description,
  });
};

// Error code per app/api/_lib/problem.ts LEGACY_CODE_MAP — VALIDATION_FAILED is
// the only 400 code that round-trips through withV1 without falling back to
// INTERNAL_ERROR.
const validationError = (message: string): NextResponse =>
  NextResponse.json({ error: 'VALIDATION_FAILED', message }, { status: 400 });

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

// Maps the lowercase request `cloud_type` (aws|azure|gcp|idc|others) to the
// canonical internal provider used for duplicate matching.
const cloudTypeToCanonical = (cloudType?: string): CanonicalProvider | null => {
  switch (cloudType?.toLowerCase()) {
    case 'aws':
      return 'AWS';
    case 'azure':
      return 'Azure';
    case 'gcp':
      return 'GCP';
    case 'idc':
      return 'IDC';
    case 'others':
      return 'Others';
    default:
      return null;
  }
};

// Maps canonical provider → UPPERCASE response `cloud_type` (35 response enum:
// AWS|GCP|AZURE|IDC|SDU|UNKNOWN). The request enum's `others` has no counterpart
// there, so a 기타 request comes back as UNKNOWN — the enum's catch-all.
const canonicalToResponseCloudType = (provider: CanonicalProvider): BffCloudProvider => {
  switch (provider) {
    case 'Azure':
      return 'AZURE';
    case 'AWS':
      return 'AWS';
    case 'GCP':
      return 'GCP';
    case 'IDC':
      return 'IDC';
    case 'SDU':
    case 'Others':
      return 'UNKNOWN';
  }
};

const isCspProvider = (provider: CanonicalProvider): boolean =>
  provider === 'AWS' || provider === 'Azure' || provider === 'GCP';

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const validatePreviewRequest = (
  body: unknown,
):
  | {
      ok: true;
      request: TargetSourceCreationCandidateRequest;
      provider: CanonicalProvider;
    }
  | { ok: false; response: NextResponse } => {
  if (!body || typeof body !== 'object') {
    return { ok: false, response: validationError('요청 본문이 올바르지 않습니다.') };
  }
  const raw = body as Record<string, unknown>;
  const metadata = asRecord(raw.metadata);

  if (!isNonEmptyString(raw.cloud_type)) {
    return { ok: false, response: validationError('cloud_type 는 필수입니다.') };
  }
  const provider = cloudTypeToCanonical(raw.cloud_type);
  if (!provider) {
    return { ok: false, response: validationError('지원하지 않는 cloud_type 입니다.') };
  }
  if (
    !Array.isArray(raw.database_types)
    || raw.database_types.length === 0
    || !raw.database_types.every((item) => isNonEmptyString(item))
  ) {
    return {
      ok: false,
      response: validationError('database_types 는 1개 이상의 문자열이어야 합니다.'),
    };
  }
  if (typeof raw.is_china_region !== 'boolean') {
    return {
      ok: false,
      response: validationError('is_china_region (boolean) 은 필수입니다.'),
    };
  }

  switch (provider) {
    case 'AWS':
      if (!isNonEmptyString(metadata.aws_account_id) || !/^\d{12}$/.test(metadata.aws_account_id)) {
        return { ok: false, response: validationError('AWS Account ID 는 12자리 숫자여야 합니다.') };
      }
      break;
    case 'Azure':
      if (!isNonEmptyString(metadata.tenant_id) || !isNonEmptyString(metadata.subscription_id)) {
        return {
          ok: false,
          response: validationError('Azure 는 tenant_id, subscription_id 가 필수입니다.'),
        };
      }
      break;
    case 'GCP':
      if (!isNonEmptyString(metadata.project_id)) {
        return { ok: false, response: validationError('GCP 는 metadata.project_id 가 필수입니다.') };
      }
      break;
    case 'IDC':
    case 'Others':
      if (!isNonEmptyString(metadata.description) || !trim(metadata.description)) {
        return {
          ok: false,
          response: validationError(`${provider} 는 metadata.description 이 필수입니다.`),
        };
      }
      break;
    case 'SDU':
      return {
        ok: false,
        response: validationError('SDU 는 미리보기 직접 입력을 지원하지 않습니다.'),
      };
  }

  return { ok: true, request: raw as unknown as TargetSourceCreationCandidateRequest, provider };
};

const buildCandidateMetadata = (
  request: TargetSourceCreationCandidateRequest,
  provider: CanonicalProvider,
): TargetSourceCreationCandidateMetadataWire => {
  const m = request.metadata ?? {};
  const accountId = trim(m.aws_account_id ?? undefined);
  const tenantId = trim(m.tenant_id ?? undefined);
  const subscriptionId = trim(m.subscription_id ?? undefined);
  const projectId = trim(m.project_id ?? undefined);
  const description = trim(m.description ?? undefined);

  return {
    ...(provider === 'AWS' && accountId ? { aws_account_id: accountId } : {}),
    ...(provider === 'Azure' && tenantId ? { tenant_id: tenantId } : {}),
    ...(provider === 'Azure' && subscriptionId ? { subscription_id: subscriptionId } : {}),
    ...(provider === 'GCP' && projectId ? { project_id: projectId } : {}),
    ...(description ? { description } : {}),
  };
};

/** Demo seeds with NO mapped Jira ticket — the collab-channel card shows 미연결. */
const NO_JIRA_TICKET_SEEDS = new Set([1003]);

export const mockTargetSources = {
  list: async (serviceCode: string) => {
    const user = getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    if (!mockServiceCodes.some((service) => service.code === serviceCode)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '해당 서비스에 대한 권한이 없습니다.' },
        { status: 403 },
      );
    }

    return NextResponse.json(
      getProjectsByServiceCode(serviceCode).map(toBffTargetSourceDetail),
    );
  },

  get: async (targetSourceId: string) => {
    const response = await mockProjects.get(targetSourceId);
    if (!response.ok) return response;
    const { project } = (await response.json()) as { project: Project };
    // swagger is a FLAT TargetSourceDetail (snake). Author the wire DTO and return
    // it raw — the route validates with schemas.TargetSourceDetail.parse(raw).
    return NextResponse.json(toBffTargetSourceDetail(project));
  },

  // GET /target-sources/{id}/jira-ticket — JiraTicketResponse (CAMEL wire, unlike
  // the snake TargetSourceDetail above). 404 = no ticket mapped to the target; a
  // few seeds stay unmapped so the 미연결 card state is demoable.
  getJiraTicket: async (targetSourceId: string) => {
    const response = await mockProjects.get(targetSourceId);
    if (!response.ok) return response;
    const { project } = (await response.json()) as { project: Project };
    if (NO_JIRA_TICKET_SEEDS.has(project.targetSourceId)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '타겟 소스에 연결된 Jira 티켓이 없습니다.' },
        { status: 404 },
      );
    }
    return NextResponse.json({
      id: project.targetSourceId,
      targetSourceId: project.targetSourceId,
      serviceCode: project.serviceCode,
      // v5 계약 — issueKey 는 티켓 키, 열 주소는 browseUrl 이 싣는다 (파싱 금지).
      issueKey: `BDCDIP-${project.targetSourceId}`,
      cloudProvider: project.cloudProvider.toUpperCase(),
      browseUrl: `https://jira.example.com/browse/BDCDIP-${project.targetSourceId}`,
    });
  },

  // PUT …/description (assumed §8). Writes to the store, not to the seed array, so
  // every screen that reads the catalogue — /pass/services, 서비스 운영, 대상 운영 —
  // sees the edit without a reload. 응답 본문은 계약에 없어 204 로 끝낸다.
  putDescription: async (targetSourceId: number, description: string) => {
    const project = getProjectByTargetSourceId(targetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '타겟 소스를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }
    updateProject(project.id, { description });
    return new NextResponse(null, { status: 204 });
  },

  // PUT …/support-raw-data/{enabled|disabled} — 본문 없는 두 경로가 한 값을 뒤집는다.
  // 응답 본문은 계약에 없다: 호출부가 상세를 다시 읽으므로 204 로 끝낸다.
  setDoesSupportRaw: async (targetSourceId: number, enabled: boolean) => {
    const project = getProjectByTargetSourceId(targetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '타겟 소스를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }
    updateProject(project.id, { supportRawData: enabled });
    return new NextResponse(null, { status: 204 });
  },

  // createTargetSource (36): body is the selected TargetSourceCreationCandidateResponse
  // (snake) posted back verbatim; serviceCode is the path param. Returns 201
  // TargetSourceInfo (camel top + snake metadata).
  create: async (serviceCode: string, body: unknown) => {
    await registrationLatency();
    const user = getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 타겟 소스를 등록할 수 있습니다.' },
        { status: 403 },
      );
    }

    const candidate = (body ?? {}) as TargetSourceCreationCandidateResponseWire;
    const normalizedProvider = toInternalCloudProvider(candidate.cloud_type ?? undefined);

    if (!serviceCode || !normalizedProvider) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '필수 필드가 누락되었습니다.' },
        { status: 400 },
      );
    }

    if (!mockServiceCodes.some((service) => service.code === serviceCode)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const metadata = candidate.metadata ?? {};
    const awsAccountId = trim(metadata.aws_account_id ?? undefined) || undefined;
    const tenantId = trim(metadata.tenant_id ?? undefined) || undefined;
    const subscriptionId = trim(metadata.subscription_id ?? undefined) || undefined;
    // Candidate metadata uses `project_id` for the GCP project (request casing);
    // the internal Project field is `gcpProjectId`.
    const gcpProjectId = trim(metadata.project_id ?? undefined) || undefined;
    const description = trim(metadata.description ?? undefined);
    const isChinaRegion = candidate.is_china_region === true;
    // Tri-state: explicit false means manual install, so keep it (don't collapse to absent).
    const grantTf = typeof candidate.grant_service_terraform_execution_permission === 'boolean'
      ? candidate.grant_service_terraform_execution_permission
      : undefined;
    const isSduType = candidate.is_sdu_type === true;

    if (awsAccountId && !/^\d{12}$/.test(awsAccountId)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'AWS Account ID는 12자리 숫자여야 합니다.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const targetSourceId = generateTargetSourceId();
    const internalProjectCode = `TS-${targetSourceId}`;
    const project: Project = {
      id: generateId('target-source'),
      targetSourceId,
      projectCode: internalProjectCode,
      name: internalProjectCode,
      description,
      serviceCode,
      cloudProvider: normalizedProvider,
      processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
      status: createInitialProjectStatus(),
      resources: [],
      terraformState: normalizedProvider === 'AWS'
        ? { serviceTf: 'PENDING', bdcTf: 'PENDING' }
        : { bdcTf: 'PENDING' },
      createdAt: now,
      updatedAt: now,
      isRejected: false,
      ...(awsAccountId ? { awsAccountId } : {}),
      ...(normalizedProvider === 'AWS' ? { awsRegionType: isChinaRegion ? 'china' : 'global' } : {}),
      ...(normalizedProvider === 'AWS' ? { isChinaRegion } : {}),
      ...(grantTf !== undefined ? { isTerraformExecutionGranted: grantTf } : {}),
      ...(isSduType ? { isSduType } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(gcpProjectId ? { gcpProjectId } : {}),
    };

    addProject(project);

    return NextResponse.json(toBffTargetSourceCreatedInfo(project), { status: 201 });
  },

  previewRegistration: async (serviceCode: string, body: unknown) => {
    await registrationLatency();
    const user = getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 등록 미리보기를 사용할 수 있습니다.' },
        { status: 403 },
      );
    }
    if (!mockServiceCodes.some((service) => service.code === serviceCode)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const validation = validatePreviewRequest(body);
    if (!validation.ok) return validation.response;
    const { request, provider } = validation;

    const existing = getProjectsByServiceCode(serviceCode);
    const metadata = buildCandidateMetadata(request, provider);
    const cloudType = canonicalToResponseCloudType(provider);
    const isChinaRegion = isCspProvider(provider) && request.is_china_region === true;
    const grantTf = request.grant_service_terraform_execution_permission === true;
    const databaseTypes = request.database_types ?? [];

    const requestedKey = duplicateIdentity(provider, {
      awsAccountId: request.metadata?.aws_account_id ?? undefined,
      isChinaRegion: request.is_china_region ?? undefined,
      subscriptionId: request.metadata?.subscription_id ?? undefined,
      gcpProjectId: request.metadata?.project_id ?? undefined,
      description: request.metadata?.description ?? undefined,
    });
    const match =
      requestedKey === null
        ? undefined
        : existing.find((project) => projectIdentity(project) === requestedKey);

    // 35 response: a BARE ARRAY of TargetSourceCreationCandidateResponse (snake).
    // One request describes ONE account, so the CSP candidate is one element —
    // the selected database_types steer the recommendation, they do not multiply it.
    const cspCandidate: TargetSourceCreationCandidateResponseWire = {
      status: match ? 'DUPLICATE' : 'ADD',
      cloud_type: cloudType,
      is_sdu_type: false,
      is_china_region: isChinaRegion,
      metadata,
      ...(grantTf ? { grant_service_terraform_execution_permission: true } : {}),
    };
    if (match) {
      cspCandidate.existing_target_source_id = match.targetSourceId;
    }

    // Demo-only stand-in for the recommendation verdict: the real BFF decides
    // whether an account needs a Self Data Upload sibling. Here a China region or
    // an unlisted database ("others") is what makes the agent install unsupported.
    const needsSduSibling =
      isChinaRegion || databaseTypes.some((dbType) => trim(dbType ?? undefined).toLowerCase() === 'others');
    const sduCandidate: TargetSourceCreationCandidateResponseWire = {
      status: 'ADD',
      cloud_type: cloudType,
      is_sdu_type: true,
      is_china_region: isChinaRegion,
      metadata,
    };

    return NextResponse.json(
      needsSduSibling ? [cspCandidate, sduCandidate] : [cspCandidate],
    );
  },
};
