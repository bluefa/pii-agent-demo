import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import type {
  OpsServiceDetail,
  OpsTargetSourceAccount,
  OpsTargetSourceListItem,
} from '@/app/lib/api/ops';
import type { BffProcessStatus } from '@/app/lib/api';

/**
 * GET /admin/ops/services/{serviceCode} → OpsServiceDetail.
 *
 * REAL CONTRACTS ONLY. The upstream `/admin/ops/services/{code}` this route used
 * to proxy is absent from install-v1.yaml, so every call 404'd against the real
 * BFF and the screen never loaded. The detail is now composed from two declared
 * endpoints:
 *
 *   GET /target-sources/page?serviceCode=&page=&size=  → PageTargetSourceInfo
 *       rows + CSP account metadata. `serviceCode` is a declared query param.
 *   GET /process-statuses?page=&size=                  → PageProcessStatusCurrentResponse
 *       the 7-step process_status, and service_info.is_eos_service.
 *
 * The join exists because neither endpoint carries the other's fields:
 * `TargetSourceInfo.confirmStatus` is the confirm sub-state enum, NOT the 7-step
 * lifecycle the UI's StepPill reads, and `/process-statuses` has no serviceCode
 * filter (only processStatus / targetSourceId), so its pages are aggregated and
 * indexed by target_source_id — the same pattern the delay filter already uses in
 * app/api/v1/admin/queue/process-statuses/route.ts.
 *
 * Dropped with the assumed contract, because no declared endpoint carries them:
 * `owner` (no field anywhere in install-v1.yaml) and EOS *processing* (read-only
 * `is_eos_service` exists; there is no writer).
 */

// Contract max page size is 100; the cap bounds a pathological aggregate. Both
// loops log when they stop early — a silently truncated join would render as
// "이 서비스엔 대상이 없음", which is a different (and wrong) statement.
const AGG_PAGE_SIZE = 100;
const AGG_MAX_PAGES = 10;

type TargetSourceInfoWire = ReturnType<typeof schemas.TargetSourceInfo.parse>;
type ProcessStatusWire = ReturnType<typeof schemas.ProcessStatusCurrentResponse.parse>;

/** 7-step lifecycle enum. A target with no process-status row has not started. */
const DEFAULT_PROCESS_STATUS: BffProcessStatus = 'IDLE';

const PROCESS_STATUSES: readonly BffProcessStatus[] = [
  'IDLE', 'PENDING', 'CONFIRMING', 'CONFIRMED', 'INSTALLED', 'CONNECTED', 'COMPLETED',
];

const toProcessStatus = (value: string | null | undefined): BffProcessStatus =>
  PROCESS_STATUSES.find((status) => status === value) ?? DEFAULT_PROCESS_STATUS;

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

/** Aggregate every page of a Spring `Page` endpoint, up to the cap. */
async function collect<T>(
  label: string,
  fetchPage: (page: number) => Promise<{ content?: (T | null)[] | null; totalPages?: number | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let page = 0;
  let totalPages = 1;
  do {
    const wire = await fetchPage(page);
    rows.push(...((wire.content ?? []).filter((row): row is T => row != null)));
    totalPages = wire.totalPages ?? 1;
    page += 1;
  } while (page < totalPages && page < AGG_MAX_PAGES);

  if (page < totalPages) {
    console.warn(`[ops/services] ${label}: ${totalPages}페이지 중 ${page}페이지에서 집계를 멈췄습니다.`);
  }
  return rows;
}

export const GET = withV1(async (_request, { params }) => {
  const serviceCode = String(params.serviceCode);

  const [targets, statuses] = await Promise.all([
    collect<TargetSourceInfoWire>('target-sources', async (page) =>
      schemas.PageTargetSourceInfo.parse(
        await bff.taskQueue.getTargetSourcesPage({ serviceCode, page, size: AGG_PAGE_SIZE }),
      ),
    ),
    collect<ProcessStatusWire>('process-statuses', async (page) =>
      schemas.PageProcessStatusCurrentResponse.parse(
        await bff.taskQueue.getProcessStatuses({ page, size: AGG_PAGE_SIZE }),
      ),
    ),
  ]);

  const statusById = new Map(
    statuses
      .filter((row) => row.target_source_id != null)
      .map((row) => [row.target_source_id as number, row]),
  );

  // EOS 는 서비스 단위 플래그지만 계약상 대상의 service_info 에만 실린다 — 이 서비스의
  // 행 아무 곳에서나 읽으면 된다. 대상이 하나도 없으면 알 길이 없어 운영중으로 둔다.
  const isEos = statuses.some(
    (row) =>
      row.target_source?.service_info?.code === serviceCode
      && row.target_source.service_info.is_eos_service === true,
  );

  const targetSources: OpsTargetSourceListItem[] = targets
    .filter((row) => row.targetSourceId != null)
    .map((row) => {
      const targetSourceId = row.targetSourceId as number;
      const status = statusById.get(targetSourceId);
      return {
        target_source_id: targetSourceId,
        service_code: row.serviceCode ?? serviceCode,
        service_name: row.serviceName ?? serviceCode,
        description: row.description ?? null,
        cloud_provider: row.cloudProvider ?? 'UNKNOWN',
        is_sdu_type: row.metadata?.is_sdu_type === true,
        // 계약 어디에도 대상별 DB 종류가 없다 — 카드도 읽지 않으므로 비워 둔다.
        database_type: null,
        process_status: toProcessStatus(status?.process_status),
        last_changed_at: status?.status_changed_at ?? row.updatedAt ?? row.createdAt ?? '',
        metadata: toAccount(row.metadata),
      };
    })
    .sort((a, b) => b.last_changed_at.localeCompare(a.last_changed_at));

  const detail: OpsServiceDetail = {
    service_code: serviceCode,
    // ServiceItem/TargetSourceInfo 어느 쪽이든 이름은 대상 행에만 실린다.
    service_name: targets.find((row) => row.serviceName)?.serviceName ?? serviceCode,
    status: isEos ? 'EOS' : 'OPERATING',
    target_sources: targetSources,
  };
  return NextResponse.json(detail);
});
