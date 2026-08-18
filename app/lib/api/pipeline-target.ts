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
 * This reuses the EXISTING BFF route `GET /pass/api/v1/target-sources/{id}`
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
  /** Provider 별 scan/terraform 주체 식별자 (v5 계약) — 없으면 미등록. */
  aws_scan_role_arn?: string | null;
  aws_terraform_execution_role_arn?: string | null;
  azure_scan_app_id?: string | null;
  gcp_scan_service_account?: string | null;
  gcp_terraform_service_account?: string | null;
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
  /**
   * 계약에 아직 없는 필드 — 스키마가 `.passthrough()` 라 `parse()` 를 통과해 여기까지
   * 온다. snake 인 이 DTO 안에서 이 키만 camel 이다 (BE 확인). 판정은
   * `readDoesSupportRaw` 하나로만 한다 (lib/types.ts 주석 참조).
   */
  doesSupportRaw?: boolean;
}

/** Fetch the raw target-source detail (reuses the existing target-sources route). */
export const getRawTargetSourceDetail = (
  targetSourceId: number | string,
): Promise<RawTargetSourceDetail> =>
  fetchInfraJson<RawTargetSourceDetail>(`/target-sources/${encodeURIComponent(String(targetSourceId))}`);
