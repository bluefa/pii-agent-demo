/**
 * Target-source creation flow — wire→domain normalizers (ADR-019 D2/D6).
 *
 * The single casing boundary lives in the route handlers: each handler does
 * `normalizeX(camelCaseKeys(raw))`. These functions take the already-camelCased
 * payload as `unknown` and build a strictly-typed domain object field-by-field —
 * the "loud" alternative to a silent `as T` (no zod dependency in this repo;
 * mirrors `lib/test-connection-response.ts` / `lib/confirmed-integration-response.ts`).
 *
 * Covers Spec F endpoints 35 (creation-candidates), 36 (createTargetSource →
 * TargetSourceInfo), 37 (getTargetSourcesByServiceCode → TargetSourceDetail[]).
 *
 * Enum values pass through verbatim from the swagger; unknown values degrade to
 * the contract's UNKNOWN/idle defaults rather than throwing.
 */

// ===== Domain types (camelCase) =====

export type TargetSourceCloudType = 'AWS' | 'GCP' | 'AZURE' | 'IDC' | 'UNKNOWN';
export type TargetSourceCandidateStatus = 'ADD' | 'DUPLICATE';

export type TargetSourceProcessStatus =
  | 'IDLE'
  | 'PENDING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'INSTALLED'
  | 'CONNECTED'
  | 'COMPLETED';

/** Candidate metadata — swagger `TargetSourceCreationCandidateMetadata` (camel). */
export interface TargetSourceCandidateMetadata {
  awsAccountId?: string;
  tenantId?: string;
  subscriptionId?: string;
  projectId?: string;
  description?: string;
}

/** swagger `TargetSourceCreationCandidateResponse` (camel domain). */
export interface TargetSourceCreationCandidate {
  status: TargetSourceCandidateStatus;
  cloudType: TargetSourceCloudType;
  isSduType: boolean;
  isChinaRegion: boolean;
  metadata: TargetSourceCandidateMetadata;
  existingTargetSourceId?: number | null;
  grantServiceTerraformExecutionPermission?: boolean | null;
}

/** Nested metadata of `TargetSourceInfo`/`TargetSourceDetail` (camel domain). */
export interface TargetSourceMetadata {
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
  awsAccountId?: string;
  isSduType?: boolean;
  isChinaRegion?: boolean;
  grantServiceTerraformExecutionPermission?: boolean;
}

/** 201 of createTargetSource — swagger `TargetSourceInfo` (camel domain). */
export interface TargetSourceInfo {
  targetSourceId?: number;
  description?: string;
  cloudProvider?: TargetSourceCloudType;
  createdAt?: string;
  serviceCode?: string;
  serviceName?: string;
  updatedAt?: string;
  metadata?: TargetSourceMetadata;
}

/** 200 of getTargetSourcesByServiceCode item — swagger `TargetSourceDetail`. */
export interface TargetSourceDetail {
  description?: string;
  targetSourceId?: number;
  serviceCode?: string;
  serviceName?: string;
  processStatus?: TargetSourceProcessStatus;
  cloudProvider?: TargetSourceCloudType;
  createdAt?: string;
  metadata?: TargetSourceMetadata;
}

// ===== Helpers =====

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : {};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : 0);

const asOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const asBoolean = (value: unknown): boolean => value === true;

const asOptionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const CLOUD_TYPES: readonly TargetSourceCloudType[] = ['AWS', 'GCP', 'AZURE', 'IDC', 'UNKNOWN'];

const asCloudType = (value: unknown): TargetSourceCloudType =>
  CLOUD_TYPES.includes(value as TargetSourceCloudType)
    ? (value as TargetSourceCloudType)
    : 'UNKNOWN';

const asCandidateStatus = (value: unknown): TargetSourceCandidateStatus =>
  value === 'DUPLICATE' ? 'DUPLICATE' : 'ADD';

const PROCESS_STATUSES: readonly TargetSourceProcessStatus[] = [
  'IDLE',
  'PENDING',
  'CONFIRMING',
  'CONFIRMED',
  'INSTALLED',
  'CONNECTED',
  'COMPLETED',
];

const asProcessStatus = (value: unknown): TargetSourceProcessStatus | undefined =>
  PROCESS_STATUSES.includes(value as TargetSourceProcessStatus)
    ? (value as TargetSourceProcessStatus)
    : undefined;

const omitUndefined = <T extends JsonRecord>(record: T): T =>
  Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as T;

const normalizeCandidateMetadata = (raw: unknown): TargetSourceCandidateMetadata => {
  const r = asRecord(raw);
  return omitUndefined({
    awsAccountId: asOptionalString(r.awsAccountId),
    tenantId: asOptionalString(r.tenantId),
    subscriptionId: asOptionalString(r.subscriptionId),
    projectId: asOptionalString(r.projectId),
    description: asOptionalString(r.description),
  });
};

const normalizeTargetSourceMetadata = (raw: unknown): TargetSourceMetadata | undefined => {
  if (raw === undefined || raw === null) return undefined;
  const r = asRecord(raw);
  return omitUndefined({
    tenantId: asOptionalString(r.tenantId),
    subscriptionId: asOptionalString(r.subscriptionId),
    gcpProjectId: asOptionalString(r.gcpProjectId),
    awsAccountId: asOptionalString(r.awsAccountId),
    isSduType: asOptionalBoolean(r.isSduType),
    isChinaRegion: asOptionalBoolean(r.isChinaRegion),
    grantServiceTerraformExecutionPermission: asOptionalBoolean(
      r.grantServiceTerraformExecutionPermission,
    ),
  });
};

// ===== Normalizers (input = camelCased payload) =====

const normalizeCreationCandidate = (raw: unknown): TargetSourceCreationCandidate => {
  const r = asRecord(raw);
  const base: TargetSourceCreationCandidate = {
    status: asCandidateStatus(r.status),
    cloudType: asCloudType(r.cloudType),
    isSduType: asBoolean(r.isSduType),
    isChinaRegion: asBoolean(r.isChinaRegion),
    metadata: normalizeCandidateMetadata(r.metadata),
  };
  // Optional/nullable fields: only attach when present so the round-trip body
  // (Spec §2) carries exactly what the BFF sent for DUPLICATE candidates.
  if (r.existingTargetSourceId !== undefined) {
    base.existingTargetSourceId =
      r.existingTargetSourceId === null ? null : asOptionalNumber(r.existingTargetSourceId) ?? null;
  }
  if (r.grantServiceTerraformExecutionPermission !== undefined) {
    base.grantServiceTerraformExecutionPermission =
      r.grantServiceTerraformExecutionPermission === null
        ? null
        : asOptionalBoolean(r.grantServiceTerraformExecutionPermission) ?? null;
  }
  return base;
};

export const normalizeTargetSourceCreationCandidates = (
  raw: unknown,
): TargetSourceCreationCandidate[] =>
  Array.isArray(raw) ? raw.map(normalizeCreationCandidate) : [];

export const normalizeTargetSourceInfo = (raw: unknown): TargetSourceInfo => {
  const r = asRecord(raw);
  return omitUndefined({
    targetSourceId: asOptionalNumber(r.targetSourceId),
    description: asOptionalString(r.description),
    cloudProvider: r.cloudProvider === undefined ? undefined : asCloudType(r.cloudProvider),
    createdAt: asOptionalString(r.createdAt),
    serviceCode: asOptionalString(r.serviceCode),
    serviceName: asOptionalString(r.serviceName),
    updatedAt: asOptionalString(r.updatedAt),
    metadata: normalizeTargetSourceMetadata(r.metadata),
  });
};

const normalizeTargetSourceDetail = (raw: unknown): TargetSourceDetail => {
  const r = asRecord(raw);
  return omitUndefined({
    description: asOptionalString(r.description),
    targetSourceId: asOptionalNumber(r.targetSourceId),
    serviceCode: asOptionalString(r.serviceCode),
    serviceName: asOptionalString(r.serviceName),
    processStatus: asProcessStatus(r.processStatus),
    cloudProvider: r.cloudProvider === undefined ? undefined : asCloudType(r.cloudProvider),
    createdAt: asOptionalString(r.createdAt),
    metadata: normalizeTargetSourceMetadata(r.metadata),
  });
};

export const normalizeTargetSourceDetails = (raw: unknown): TargetSourceDetail[] =>
  Array.isArray(raw) ? raw.map(normalizeTargetSourceDetail) : [];
