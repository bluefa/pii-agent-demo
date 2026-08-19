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
  /**
   * 최초로 연동을 마친 시각. 초기화로 1단계까지 되돌아가도, 다시 설치해도 움직이지
   * 않는다 — 현재 단계와 독립인 사실이다. 형제 응답(`TargetSourceInfo`)은 같은 값을
   * camel(`piiAgentFirstInstalledAt`)로 싣는다: 이 DTO 는 snake 쪽 철자다.
   */
  pii_agent_first_installed_at?: string;
  metadata?: RawTargetSourceMetadata;
  /**
   * `TargetSourceDetail` 이 아직 선언하지 않은 필드 — 스키마가 `.passthrough()` 라
   * `parse()` 를 통과해 여기까지 온다. snake 인 이 DTO 안에서 이 키만 camel 인데,
   * 계약이 형제 응답들에 선언한 철자가 camel 이다. 판정은 `readSupportRawData`
   * 하나로만 한다 — #721 이 기록한 `doesSupportRaw` 와의 미해결 충돌까지 lib/types.ts
   * 주석에 있다.
   */
  supportRawData?: boolean;
}

/** Fetch the raw target-source detail (reuses the existing target-sources route). */
export const getRawTargetSourceDetail = (
  targetSourceId: number | string,
): Promise<RawTargetSourceDetail> =>
  fetchInfraJson<RawTargetSourceDetail>(`/target-sources/${encodeURIComponent(String(targetSourceId))}`);
