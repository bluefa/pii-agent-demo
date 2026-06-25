/**
 * Target-source creation/detail — domain types (camelCase).
 *
 * ADR-019 zod-codegen: the wire→domain casing normalizers that used to live here were
 * removed (routes validate with `schemas.X.parse()` and consumers use the generated
 * types). These camel domain types remain because UI/CSR view-models still reference them.
 */

export type TargetSourceCloudType = 'AWS' | 'GCP' | 'AZURE' | 'IDC' | 'UNKNOWN';

export type TargetSourceProcessStatus =
  | 'IDLE'
  | 'PENDING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'INSTALLED'
  | 'CONNECTED'
  | 'COMPLETED';

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

/** createTargetSource domain — `TargetSourceInfo` (camel). */
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

/** getTargetSourcesByServiceCode item — `TargetSourceDetail` (camel). */
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
