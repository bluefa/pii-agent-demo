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

/**
 * `size` 에 계약 상한은 없다 — `/target-sources/page` 의 size 는 int32, default 10,
 * `maximum` 선언 없음. 100 은 우리가 고른 값이지 계약 한계가 아니다. 업스트림이 이보다
 * 작게 클램프하면 실질 상한은 MAX_PAGES × 클램프값이 된다.
 *
 * 페이지 상한은 비정상적으로 큰 계정만 막는 안전장치다. 걸리면 로그를 남기고, 진짜 총계는
 * `total_count` 로 따로 실어 보낸다 — 잘린 목록의 길이를 총계로 그리면 화면이
 * "이 서비스는 1000건이 전부"라고 사실처럼 말하게 된다.
 */
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
    // Azure 의 두 번째 식별자. 계약에 선언돼 있는데 여기서 추리며 빠져 있었다.
    tenant_id: meta?.tenant_id ?? null,
    gcp_project_id: meta?.gcp_project_id ?? null,
    // 계약 값을 그대로. `aws_region_type` 처럼 `aws_account_id` 유무로 가르지 않는다 —
    // SDU 대상은 계정 식별자 없이 오면서도 중국일 수 있고, 그 경우 중국이라는 사실이
    // 파생 단계에서 조용히 사라졌다.
    is_china_region: meta?.is_china_region === true,
  };
}

export const GET = withV1(async (_request, { params }) => {
  const serviceCode = String(params.serviceCode);

  const targets: TargetSourceInfoWire[] = [];
  let page = 0;
  let totalPages = 1;
  let totalElements: number | null = null;
  do {
    const wire = schemas.PageTargetSourceInfo.parse(
      await bff.taskQueue.getTargetSourcesPage({ serviceCode, page, size: PAGE_SIZE }),
    );
    targets.push(...(wire.content ?? []).filter((row): row is TargetSourceInfoWire => row != null));
    totalPages = wire.totalPages ?? 1;
    if (totalElements === null) totalElements = wire.totalElements ?? null;
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
    // 업스트림이 말하는 총계. 상한에 걸려 목록이 잘려도 이 값은 줄지 않는다.
    total_count: totalElements ?? targetSources.length,
    target_sources: targetSources,
  };
  return NextResponse.json(detail);
});
