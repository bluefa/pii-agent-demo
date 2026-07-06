/**
 * CSR helper for the RAW (snake_case) target-source detail (LIN-25 Phase C2).
 *
 * The admin pipeline target page needs the un-transformed target-source detail:
 * for its CSP connection metadata (`aws_account_id`, `is_china_region`,
 * `grant_service_terraform_execution_permission`, `tenant_id`, `subscription_id`,
 * `gcp_project_id`). `getProject` (index.ts) drops the
 * numeric ProcessStatus enum and drops the china/permission/sdu flags, so it is
 * unusable here (docs/api/pipeline-orchestrator-bff.md §2.3).
 *
 * This reuses the EXISTING BFF route `GET /integration/api/v1/target-sources/{id}`
 * — its handler returns `schemas.TargetSourceDetail.parse(data)` (a `.passthrough()`
 * schema), i.e. the raw snake wire verbatim. No new route is added.
 */
import { fetchInfraJson } from '@/app/lib/api/infra';

/** Nested CSP connection metadata (all fields optional — schema is `.partial()`). */
export interface RawTargetSourceMetadata {
  tenant_id?: string;
  subscription_id?: string;
  gcp_project_id?: string;
  aws_account_id?: string;
  is_sdu_type?: boolean;
  is_china_region?: boolean;
  grant_service_terraform_execution_permission?: boolean;
}

/**
 * Raw snake_case `TargetSourceDetail` (upstream install-v1). Mirrors
 * `schemas.TargetSourceDetail` (all fields optional; extras pass through).
 */
export interface RawTargetSourceDetail {
  description?: string;
  target_source_id?: number;
  service_code?: string;
  service_name?: string;
  cloud_provider?: string;
  created_at?: string;
  metadata?: RawTargetSourceMetadata;
}

/** Fetch the raw target-source detail (reuses the existing target-sources route). */
export const getRawTargetSourceDetail = (
  targetSourceId: number | string,
): Promise<RawTargetSourceDetail> =>
  fetchInfraJson<RawTargetSourceDetail>(`/target-sources/${encodeURIComponent(String(targetSourceId))}`);
