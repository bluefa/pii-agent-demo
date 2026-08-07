import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import type {
  OpsServiceDetail,
  OpsServiceTargetRow,
  OpsTargetSourceAccount,
} from '@/app/lib/api/ops';

/**
 * GET /admin/ops/services/{serviceCode} → OpsServiceDetail.
 *
 * ONE declared endpoint:
 *
 *   GET /target-sources/page?serviceCode=&page=&size=  → PageTargetSourceInfo
 *
 * The upstream `/admin/ops/services/{code}` this route used to proxy is absent
 * from install-v1.yaml, so every call 404'd against the real BFF and the screen
 * never loaded. `serviceCode` is a declared query param on `/target-sources/page`,
 * which carries everything the 서비스 운영 detail draws: 대상 번호, provider,
 * 설명, and the CSP account identifiers in `metadata`.
 *
 * Deliberately NOT joined here:
 *   - 설치 진행 단계 (process_status). Owner's call — the detail no longer shows a
 *     step pill or a 단계 filter, so the `/process-statuses` aggregate that fed
 *     them is gone. That endpoint has no serviceCode filter, so serving one
 *     service meant paging the whole table on every detail view. Per-target step
 *     lives on the Target Source 운영 screen, one click away from each card.
 *   - EOS. The flag (`is_eos_service`) rides only on a target's `service_info`,
 *     reachable via `/process-statuses` or `GET /target-sources?serviceCode=`;
 *     it is not worth a second round trip for a header badge. Re-adding it means
 *     wiring `GET /target-sources?serviceCode=` (declared, service-scoped).
 *   - `owner`. No field anywhere in install-v1.yaml.
 */

// Contract max page size is 100. A service's targets are bounded in practice; the
// page cap only guards a pathological account, and it logs rather than silently
// truncating — a cut list would read as "이 서비스엔 대상이 없다", a different claim.
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

type TargetSourceInfoWire = ReturnType<typeof schemas.TargetSourceInfo.parse>;

/**
 * TargetSourceMetadata → the account identifiers the card reads. Only the owning
 * provider's field is populated; IDC and SDU targets have none at all.
 * `aws_region_type` is derived from `is_china_region` — the contract carries the
 * boolean, the view wants the discriminator.
 */
function toAccount(meta: TargetSourceInfoWire['metadata']): OpsTargetSourceAccount {
  const awsAccountId = meta?.aws_account_id ?? null;
  return {
    aws_account_id: awsAccountId,
    aws_region_type: awsAccountId ? (meta?.is_china_region ? 'china' : 'global') : null,
    subscription_id: meta?.subscription_id ?? null,
    gcp_project_id: meta?.gcp_project_id ?? null,
  };
}

export const GET = withV1(async (_request, { params }) => {
  const serviceCode = String(params.serviceCode);

  const targets: TargetSourceInfoWire[] = [];
  let page = 0;
  let totalPages = 1;
  do {
    const wire = schemas.PageTargetSourceInfo.parse(
      await bff.taskQueue.getTargetSourcesPage({ serviceCode, page, size: PAGE_SIZE }),
    );
    targets.push(...(wire.content ?? []).filter((row): row is TargetSourceInfoWire => row != null));
    totalPages = wire.totalPages ?? 1;
    page += 1;
  } while (page < totalPages && page < MAX_PAGES);

  if (page < totalPages) {
    console.warn(
      `[ops/services] ${serviceCode}: ${totalPages}페이지 중 ${page}페이지에서 집계를 멈췄습니다.`,
    );
  }

  const targetSources: OpsServiceTargetRow[] = targets
    .filter((row) => row.targetSourceId != null)
    .map((row) => ({
      target_source_id: row.targetSourceId as number,
      description: row.description ?? null,
      cloud_provider: row.cloudProvider ?? 'UNKNOWN',
      is_sdu_type: row.metadata?.is_sdu_type === true,
      last_changed_at: row.updatedAt ?? row.createdAt ?? '',
      metadata: toAccount(row.metadata),
    }))
    .sort((a, b) => b.last_changed_at.localeCompare(a.last_changed_at));

  const detail: OpsServiceDetail = {
    service_code: serviceCode,
    // 서비스 이름은 대상 행에만 실린다 (ServiceItem 은 레일이 따로 받는다).
    service_name: targets.find((row) => row.serviceName)?.serviceName ?? serviceCode,
    target_sources: targetSources,
  };
  return NextResponse.json(detail);
});
