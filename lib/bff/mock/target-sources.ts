import { NextResponse } from 'next/server';
import {
  addProject,
  generateId,
  generateTargetSourceId,
  getCurrentUser,
  getProjectsByServiceCode,
  mockServiceCodes,
} from '@/lib/mock-data';
import { mockProjects } from '@/lib/bff/mock/projects';
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

type CanonicalProvider = 'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU';

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

const toBffApprovalProcessStatus = (processStatus: ProcessStatus): BffApprovalProcessStatus => {
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

const getBffMetadata = (project: Project) => ({
  ...(project.tenantId ? { tenant_id: project.tenantId } : {}),
  ...(project.subscriptionId ? { subscription_id: project.subscriptionId } : {}),
});

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
const normalizeDbType = (value?: string): string => trim(value).toUpperCase();

interface DuplicateKeyInput {
  awsAccountId?: string;
  isChinaRegion?: boolean;
  subscriptionId?: string;
  gcpProjectId?: string;
  description?: string;
  dbType?: string;
}

// Duplicate identity tuple per spec §I-3. Returns null when the identity is
// incomplete — including when an existing project lacks dbType (the field is
// new in SIT v7, so legacy seed projects never participate in duplicate
// matching until they are recreated).
const duplicateIdentity = (
  provider: CanonicalProvider,
  fields: DuplicateKeyInput,
): string | null => {
  const dbType = normalizeDbType(fields.dbType);
  if (!dbType) return null;

  switch (provider) {
    case 'AWS': {
      const accountId = trim(fields.awsAccountId);
      if (!accountId) return null;
      return `AWS|${accountId}|${fields.isChinaRegion === true}|${dbType}`;
    }
    case 'Azure': {
      const subscriptionId = trim(fields.subscriptionId);
      if (!subscriptionId) return null;
      return `Azure|${subscriptionId}|${dbType}`;
    }
    case 'GCP': {
      const projectId = trim(fields.gcpProjectId);
      if (!projectId) return null;
      return `GCP|${projectId}|${dbType}`;
    }
    case 'IDC': {
      const description = trim(fields.description);
      if (!description) return null;
      return `IDC|${description}|${dbType}`;
    }
    case 'SDU':
      return null;
  }
};

const projectIdentity = (project: Project, dbType: string): string | null => {
  const provider = toCanonicalProvider(project.cloudProvider);
  if (!provider) return null;
  if (normalizeDbType(project.dbType) !== normalizeDbType(dbType)) return null;

  const isChinaRegion = project.isChinaRegion ?? project.awsRegionType === 'china';
  return duplicateIdentity(provider, {
    awsAccountId: project.awsAccountId,
    isChinaRegion,
    subscriptionId: project.subscriptionId,
    gcpProjectId: project.gcpProjectId,
    description: project.description,
    dbType: project.dbType,
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
    default:
      return null;
  }
};

// Maps canonical provider → UPPERCASE response `cloud_type` (35 response enum).
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
      return 'UNKNOWN';
  }
};

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
      if (!isNonEmptyString(metadata.description) || !trim(metadata.description)) {
        return { ok: false, response: validationError('IDC 는 metadata.description 이 필수입니다.') };
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

  // createTargetSource (36): body is the selected TargetSourceCreationCandidateResponse
  // (snake) posted back verbatim; serviceCode is the path param. Returns 201
  // TargetSourceInfo (camel top + snake metadata).
  create: async (serviceCode: string, body: unknown) => {
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
    const grantTf = candidate.grant_service_terraform_execution_permission === true;

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
      ...(grantTf ? { isTerraformExecutionGranted: true } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(gcpProjectId ? { gcpProjectId } : {}),
    };

    addProject(project);

    return NextResponse.json(toBffTargetSourceCreatedInfo(project), { status: 201 });
  },

  previewRegistration: async (serviceCode: string, body: unknown) => {
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
    const isChinaRegion = provider === 'AWS' && request.is_china_region === true;
    const grantTf = request.grant_service_terraform_execution_permission === true;

    // 35 response: a BARE ARRAY of TargetSourceCreationCandidateResponse (snake),
    // one element per database_types[i] (index-matched to the request).
    const candidates: TargetSourceCreationCandidateResponseWire[] = (request.database_types ?? []).map(
      (dbType) => {
        const requestedKey = duplicateIdentity(provider, {
          awsAccountId: request.metadata?.aws_account_id ?? undefined,
          isChinaRegion: request.is_china_region ?? undefined,
          subscriptionId: request.metadata?.subscription_id ?? undefined,
          gcpProjectId: request.metadata?.project_id ?? undefined,
          description: request.metadata?.description ?? undefined,
          dbType: dbType ?? undefined,
        });

        const match =
          requestedKey === null
            ? undefined
            : existing.find((project) => projectIdentity(project, dbType ?? '') === requestedKey);

        const base: TargetSourceCreationCandidateResponseWire = {
          status: match ? 'DUPLICATE' : 'ADD',
          cloud_type: cloudType,
          is_sdu_type: false,
          is_china_region: isChinaRegion,
          metadata,
          ...(grantTf ? { grant_service_terraform_execution_permission: true } : {}),
        };
        if (match) {
          base.existing_target_source_id = match.targetSourceId;
        }
        return base;
      },
    );

    return NextResponse.json(candidates);
  },
};
