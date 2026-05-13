/**
 * Typed shapes for `bff.targetSources` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 *
 * Specs 02-04 extend `BffClient` and import these types. This file declares
 * shapes only — no implementation, no `BffClient` interface change.
 */

import type { TargetSource } from '@/lib/types';

export type { TargetSourceDetailResponse } from '@/lib/target-source-response';

/** GET /target-sources/services/{serviceCode} (camelCase) */
export interface ServicesTargetSourcesItem {
  id?: string;
  targetSourceId: number;
  projectCode?: string;
  serviceCode?: string;
  cloudProvider: string;
  processStatus: number | string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  isRejected?: boolean;
  rejectionReason?: string;
}

export type ServicesTargetSourcesResponse =
  | ServicesTargetSourcesItem[]
  | { targetSources: ServicesTargetSourcesItem[] };

/**
 * POST /services/{serviceCode}/target-sources request body (camelCase).
 * Mirrors swagger `CreateTargetSourceRequest`. `dbType` is singular here;
 * `dbTypes[]` is preview-only.
 */
export interface CreateTargetSourceBody {
  serviceCode?: string;
  description?: string;
  cloudProvider: string;
  awsAccountId?: string;
  awsLinkedAccountId?: string;
  isChinaRegion?: boolean;
  isTerraformExecutionGranted?: boolean;
  awsRegionType?: 'global' | 'china';
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
  dbType?: string;
}

/** POST /target-sources (snake_case raw passthrough) */
export interface CreateTargetSourceResult {
  target_source_id: number;
  project_code?: string;
  service_code?: string;
  cloud_provider?: string;
  process_status?: string;
  created_at?: string;
  aws_account_id?: string;
  aws_linked_account_id?: string;
  is_china_region?: boolean;
  is_terraform_execution_granted?: boolean;
  tenant_id?: string;
  subscription_id?: string;
  gcp_project_id?: string;
  db_type?: string;
}

/**
 * POST /services/{serviceCode}/target-sources/registration-preview request
 * body (camelCase).
 *
 * `dbTypes` is 1+ items; BFF expands the input into `dbTypes.length` rows.
 * Index matching: response `items[i]` ↔ request `dbTypes[i]`.
 *
 * Conditional required (BFF validates with 400):
 *   - AWS → awsAccountId, isChinaRegion
 *   - Azure → tenantId, subscriptionId
 *   - GCP → gcpProjectId
 *   - IDC → description (trim non-empty)
 */
export interface RegistrationPreviewRequest {
  cloudProvider: string;
  awsAccountId?: string;
  awsLinkedAccountId?: string;
  isChinaRegion?: boolean;
  isTerraformExecutionGranted?: boolean;
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
  description?: string;
  dbTypes: string[];
}

export interface RegistrationPreviewItemCommon {
  cloud_provider: string;
  aws_account_id?: string;
  aws_linked_account_id?: string;
  is_china_region: boolean;
  is_sdu_type: boolean;
  is_terraform_execution_granted: boolean;
  tenant_id?: string;
  subscription_id?: string;
  gcp_project_id?: string;
  description?: string;
}

export interface RegistrationPreviewItemAdd extends RegistrationPreviewItemCommon {
  type: 'ADD';
}

export interface RegistrationPreviewItemDuplicate extends RegistrationPreviewItemCommon {
  type: 'DUPLICATE';
  existing_target_source_id: number;
}

export type RegistrationPreviewItem =
  | RegistrationPreviewItemAdd
  | RegistrationPreviewItemDuplicate;

export interface RegistrationPreviewResponse {
  items: RegistrationPreviewItem[];
}

/** Domain model produced by `extractTargetSource` — re-exported for callers. */
export type { TargetSource };
