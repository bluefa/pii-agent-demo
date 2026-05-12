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
import type {
  CreateTargetSourceBody,
  RegistrationPreviewItemCommon,
  RegistrationPreviewRequest,
} from '@/lib/bff/types/target-sources';

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

const toBffTargetSourceDetail = (project: Project) => ({
  description: project.description,
  target_source_id: project.targetSourceId,
  process_status: toBffApprovalProcessStatus(project.processStatus),
  cloud_provider: toBffCloudProvider(project.cloudProvider),
  created_at: project.createdAt,
  ...(Object.keys(getBffMetadata(project)).length > 0
    ? { metadata: getBffMetadata(project) }
    : {}),
});

const toTargetSourceInfoCloudProvider = (cloudProvider: CloudProvider): string =>
  toBffCloudProvider(cloudProvider);

const toBffTargetSourceInfo = (project: Project) => ({
  id: project.id,
  targetSourceId: project.targetSourceId,
  projectCode: project.projectCode,
  serviceCode: project.serviceCode,
  cloudProvider: toTargetSourceInfoCloudProvider(project.cloudProvider),
  processStatus: project.processStatus,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  name: project.name,
  description: project.description,
  isRejected: project.isRejected,
  ...(project.rejectionReason ? { rejectionReason: project.rejectionReason } : {}),
  ...(project.rejectedAt ? { rejectedAt: project.rejectedAt } : {}),
  ...(project.approvalComment ? { approvalComment: project.approvalComment } : {}),
  ...(project.approvedAt ? { approvedAt: project.approvedAt } : {}),
  ...(project.piiAgentInstalled !== undefined ? { piiAgentInstalled: project.piiAgentInstalled } : {}),
  ...(project.piiAgentConnectedAt ? { piiAgentConnectedAt: project.piiAgentConnectedAt } : {}),
  ...(project.completionConfirmedAt ? { completionConfirmedAt: project.completionConfirmedAt } : {}),
  ...(project.connectionTestHistory ? { connectionTestHistory: project.connectionTestHistory } : {}),
  ...(project.awsInstallationMode ? { awsInstallationMode: project.awsInstallationMode } : {}),
  ...(project.awsAccountId ? { awsAccountId: project.awsAccountId } : {}),
  ...(project.awsLinkedAccountId ? { awsLinkedAccountId: project.awsLinkedAccountId } : {}),
  ...(project.awsRegionType ? { awsRegionType: project.awsRegionType } : {}),
  ...(project.isChinaRegion !== undefined ? { isChinaRegion: project.isChinaRegion } : {}),
  ...(project.isTerraformExecutionGranted !== undefined
    ? { isTerraformExecutionGranted: project.isTerraformExecutionGranted }
    : {}),
  ...(project.tenantId ? { tenantId: project.tenantId } : {}),
  ...(project.subscriptionId ? { subscriptionId: project.subscriptionId } : {}),
  ...(project.gcpProjectId ? { gcpProjectId: project.gcpProjectId } : {}),
  ...(project.dbType ? { dbType: project.dbType } : {}),
  ...(Object.keys(getBffMetadata(project)).length > 0
    ? { metadata: getBffMetadata(project) }
    : {}),
});

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

const validatePreviewRequest = (
  body: unknown,
):
  | { ok: true; request: RegistrationPreviewRequest; provider: CanonicalProvider }
  | { ok: false; response: NextResponse } => {
  if (!body || typeof body !== 'object') {
    return { ok: false, response: validationError('요청 본문이 올바르지 않습니다.') };
  }
  const raw = body as Record<string, unknown>;

  if (!isNonEmptyString(raw.cloudProvider)) {
    return { ok: false, response: validationError('cloudProvider 는 필수입니다.') };
  }
  const provider = toCanonicalProvider(raw.cloudProvider);
  if (!provider) {
    return { ok: false, response: validationError('지원하지 않는 cloudProvider 입니다.') };
  }
  if (provider === 'SDU') {
    return {
      ok: false,
      response: validationError('SDU 는 미리보기 직접 입력을 지원하지 않습니다.'),
    };
  }
  if (
    !Array.isArray(raw.dbTypes)
    || raw.dbTypes.length === 0
    || !raw.dbTypes.every((item) => isNonEmptyString(item))
  ) {
    return {
      ok: false,
      response: validationError('dbTypes 는 1개 이상의 문자열이어야 합니다.'),
    };
  }

  switch (provider) {
    case 'AWS':
      if (!isNonEmptyString(raw.awsAccountId) || !/^\d{12}$/.test(raw.awsAccountId)) {
        return { ok: false, response: validationError('AWS Account ID 는 12자리 숫자여야 합니다.') };
      }
      if (typeof raw.isChinaRegion !== 'boolean') {
        return {
          ok: false,
          response: validationError('AWS 는 isChinaRegion (boolean) 이 필수입니다.'),
        };
      }
      if (raw.awsLinkedAccountId !== undefined) {
        if (!isNonEmptyString(raw.awsLinkedAccountId) || !/^\d{12}$/.test(raw.awsLinkedAccountId)) {
          return {
            ok: false,
            response: validationError('AWS Linked Account ID 는 12자리 숫자여야 합니다.'),
          };
        }
      }
      if (raw.isTerraformExecutionGranted !== undefined && typeof raw.isTerraformExecutionGranted !== 'boolean') {
        return {
          ok: false,
          response: validationError('isTerraformExecutionGranted 는 boolean 이어야 합니다.'),
        };
      }
      break;
    case 'Azure':
      if (!isNonEmptyString(raw.tenantId) || !isNonEmptyString(raw.subscriptionId)) {
        return {
          ok: false,
          response: validationError('Azure 는 tenantId, subscriptionId 가 필수입니다.'),
        };
      }
      break;
    case 'GCP':
      if (!isNonEmptyString(raw.gcpProjectId)) {
        return { ok: false, response: validationError('GCP 는 gcpProjectId 가 필수입니다.') };
      }
      break;
    case 'IDC':
      if (!isNonEmptyString(raw.description) || !trim(raw.description)) {
        return { ok: false, response: validationError('IDC 는 description 이 필수입니다.') };
      }
      break;
  }

  if (raw.description !== undefined && typeof raw.description !== 'string') {
    return {
      ok: false,
      response: validationError('description 은 문자열이어야 합니다.'),
    };
  }

  return { ok: true, request: raw as unknown as RegistrationPreviewRequest, provider };
};

const buildPreviewCommon = (
  request: RegistrationPreviewRequest,
  provider: CanonicalProvider,
): RegistrationPreviewItemCommon => {
  const accountId = trim(request.awsAccountId);
  // Spec §I-1: when awsLinkedAccountId is omitted, Payer = Linked.
  const linkedAccountId = trim(request.awsLinkedAccountId) || accountId;
  const tenantId = trim(request.tenantId);
  const subscriptionId = trim(request.subscriptionId);
  const gcpProjectId = trim(request.gcpProjectId);
  const description = trim(request.description);

  return {
    cloud_provider: provider,
    ...(provider === 'AWS' && accountId ? { aws_account_id: accountId } : {}),
    ...(provider === 'AWS' && linkedAccountId
      ? { aws_linked_account_id: linkedAccountId }
      : {}),
    is_china_region: provider === 'AWS' && request.isChinaRegion === true,
    is_sdu_type: false,
    is_terraform_execution_granted:
      provider === 'AWS' && request.isTerraformExecutionGranted === true,
    ...(provider === 'Azure' && tenantId ? { tenant_id: tenantId } : {}),
    ...(provider === 'Azure' && subscriptionId ? { subscription_id: subscriptionId } : {}),
    ...(provider === 'GCP' && gcpProjectId ? { gcp_project_id: gcpProjectId } : {}),
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
    return NextResponse.json({ targetSource: toBffTargetSourceInfo(project) });
  },

  create: async (body: unknown) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 타겟 소스를 등록할 수 있습니다.' },
        { status: 403 },
      );
    }

    const {
      serviceCode,
      description,
      cloudProvider,
      awsAccountId,
      awsLinkedAccountId,
      isChinaRegion,
      isTerraformExecutionGranted,
      awsRegionType,
      tenantId,
      subscriptionId,
      gcpProjectId,
      dbType,
    } = (body ?? {}) as CreateTargetSourceBody;

    const normalizedProvider = toInternalCloudProvider(cloudProvider);

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

    if (awsAccountId && !/^\d{12}$/.test(awsAccountId)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'AWS Account ID는 12자리 숫자여야 합니다.' },
        { status: 400 },
      );
    }

    if (awsLinkedAccountId && !/^\d{12}$/.test(awsLinkedAccountId)) {
      return validationError('AWS Linked Account ID는 12자리 숫자여야 합니다.');
    }

    if (awsRegionType && !['global', 'china'].includes(awsRegionType)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'AWS 리전 타입은 global 또는 china만 허용됩니다.' },
        { status: 400 },
      );
    }

    // Boolean isChinaRegion is authoritative when present; awsRegionType is the
    // deprecated fallback path, retained so older clients still write a value.
    const resolvedIsChinaRegion =
      typeof isChinaRegion === 'boolean' ? isChinaRegion : awsRegionType === 'china';
    const resolvedAwsRegionType =
      awsRegionType
      ?? (typeof isChinaRegion === 'boolean'
        ? (isChinaRegion ? 'china' : 'global')
        : undefined);

    const now = new Date().toISOString();
    const targetSourceId = generateTargetSourceId();
    const internalProjectCode = `TS-${targetSourceId}`;
    const project: Project = {
      id: generateId('target-source'),
      targetSourceId,
      projectCode: internalProjectCode,
      name: internalProjectCode,
      description: description ?? '',
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
      ...(awsLinkedAccountId ? { awsLinkedAccountId } : {}),
      ...(resolvedAwsRegionType ? { awsRegionType: resolvedAwsRegionType } : {}),
      ...(normalizedProvider === 'AWS' ? { isChinaRegion: resolvedIsChinaRegion } : {}),
      ...(typeof isTerraformExecutionGranted === 'boolean'
        ? { isTerraformExecutionGranted }
        : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(gcpProjectId ? { gcpProjectId } : {}),
      ...(dbType ? { dbType } : {}),
    };

    addProject(project);

    return NextResponse.json(toBffTargetSourceInfo(project), { status: 201 });
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
    const common = buildPreviewCommon(request, provider);

    const items = request.dbTypes.map((dbType) => {
      const requestedKey = duplicateIdentity(provider, {
        awsAccountId: request.awsAccountId,
        isChinaRegion: request.isChinaRegion,
        subscriptionId: request.subscriptionId,
        gcpProjectId: request.gcpProjectId,
        description: request.description,
        dbType,
      });

      const match =
        requestedKey === null
          ? undefined
          : existing.find((project) => projectIdentity(project, dbType) === requestedKey);

      if (match) {
        return {
          type: 'DUPLICATE' as const,
          ...common,
          existing_target_source_id: match.targetSourceId,
        };
      }
      return { type: 'ADD' as const, ...common };
    });

    return NextResponse.json({ items });
  },
};
