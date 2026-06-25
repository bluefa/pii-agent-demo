/**
 * Wire (snake) shapes for `bff.targetSources` methods — Spec F (ADR-019).
 *
 * Source of truth: `docs/swagger/install-v1.yaml`. Responses are snake on the
 * wire → `camelCaseKeys` + normalizer at the route handler (the single casing
 * boundary, ADR-019 D1/D6). The camel DOMAIN shapes live in
 * `@/lib/target-source-creation`; this file declares the wire + request shapes
 * (mocks author these; `getSnakeRaw`/raw passthrough forward them verbatim).
 */

import type { TargetSource } from '@/lib/types';

type BffCloudTypeUpper = 'AWS' | 'GCP' | 'AZURE' | 'IDC' | 'UNKNOWN';
type BffProcessStatus =
  | 'IDLE'
  | 'PENDING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'INSTALLED'
  | 'CONNECTED'
  | 'COMPLETED';

/**
 * swagger `TargetSourceCreationCandidateRequest` (35) — request body, snake.
 * `cloud_type` is LOWERCASE on the request (uppercase on the response).
 */
export interface TargetSourceCreationCandidateMetadataWire {
  aws_account_id?: string;
  tenant_id?: string;
  subscription_id?: string;
  project_id?: string;
  description?: string;
}

export interface TargetSourceCreationCandidateRequest {
  cloud_type: 'aws' | 'azure' | 'gcp' | 'idc' | 'others';
  is_china_region: boolean;
  database_types: string[];
  grant_service_terraform_execution_permission?: boolean;
  metadata: TargetSourceCreationCandidateMetadataWire;
}

/**
 * swagger `TargetSourceCreationCandidateResponse` (35 item / 36 request body),
 * snake. The 200 of (35) is a BARE ARRAY of these; the selected element is
 * posted back verbatim to (36). `cloud_type` is UPPERCASE here.
 */
export interface TargetSourceCreationCandidateResponseWire {
  status: 'ADD' | 'DUPLICATE';
  cloud_type: BffCloudTypeUpper;
  is_sdu_type: boolean;
  is_china_region: boolean;
  metadata: TargetSourceCreationCandidateMetadataWire;
  existing_target_source_id?: number | null;
  grant_service_terraform_execution_permission?: boolean | null;
}

/** swagger `TargetSourceMetadata` (snake nested metadata of Info/Detail). */
export interface TargetSourceMetadataWire {
  tenant_id?: string;
  subscription_id?: string;
  gcp_project_id?: string;
  aws_account_id?: string;
  is_sdu_type?: boolean;
  is_china_region?: boolean;
  grant_service_terraform_execution_permission?: boolean;
}

/**
 * swagger `TargetSourceInfo` (36, 201). Top-level keys are camelCase on the
 * wire; only the nested `metadata` is snake. `camelCaseKeys` at the route makes
 * the whole thing uniform camel.
 */
export interface TargetSourceInfoWire {
  targetSourceId?: number;
  description?: string;
  cloudProvider?: BffCloudTypeUpper;
  createdAt?: string;
  serviceCode?: string;
  serviceName?: string;
  updatedAt?: string;
  metadata?: TargetSourceMetadataWire;
}

/** swagger `TargetSourceDetail` (37 item), snake. 200 is a BARE ARRAY. */
export interface TargetSourceDetailWire {
  description?: string;
  target_source_id?: number;
  service_code?: string;
  service_name?: string;
  process_status?: BffProcessStatus;
  cloud_provider?: BffCloudTypeUpper;
  created_at?: string;
  metadata?: TargetSourceMetadataWire;
}

export type TargetSourcesByServiceResponseWire = TargetSourceDetailWire[];

/** Domain model produced by `extractTargetSource` — re-exported for callers. */
export type { TargetSource };
