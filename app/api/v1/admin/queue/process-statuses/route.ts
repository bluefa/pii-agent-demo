import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import {
  filterByDelay,
  isDelayFilter,
  toProcessStatusPage,
  type Paged,
  type ProcessStatusRow,
} from '@/lib/types/task-queue';

// The upstream contract has NO delay query param (api-spec gap G1), so THIS
// route owns the delay filter: it aggregates upstream pages (contract max size
// 100, capped at 10 pages), filters by threshold, then re-paginates locally.
const DELAY_AGG_PAGE_SIZE = 100;
const DELAY_AGG_MAX_PAGES = 10;

// GET /admin/queue/process-statuses?processStatus=&targetSourceId=&delay=&page=&size=
// Process Status monitor. `processStatus`/`targetSourceId` pass through to the
// upstream; `delay` (d1|d2|d3) is applied here. Contract default size = 20.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const processStatus = params.get('processStatus') ?? undefined;
  const targetSourceIdRaw = params.get('targetSourceId');
  const targetSourceId = targetSourceIdRaw ? Number(targetSourceIdRaw) : undefined;
  const delayRaw = params.get('delay') ?? 'all';
  const delay = isDelayFilter(delayRaw) ? delayRaw : 'all';
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);

  if (delay === 'all') {
    const raw = schemas.PageProcessStatusCurrentResponse.parse(
      await bff.taskQueue.getProcessStatuses({ processStatus, targetSourceId, page, size }),
    );
    return NextResponse.json(toProcessStatusPage(raw));
  }

  // Aggregate every upstream page (up to the cap), filter, re-paginate.
  const all: ProcessStatusRow[] = [];
  let upstreamPage = 0;
  let upstreamTotalPages = 1;
  do {
    const raw = schemas.PageProcessStatusCurrentResponse.parse(
      await bff.taskQueue.getProcessStatuses({
        processStatus,
        targetSourceId,
        page: upstreamPage,
        size: DELAY_AGG_PAGE_SIZE,
      }),
    );
    const chunk = toProcessStatusPage(raw);
    all.push(...chunk.content);
    upstreamTotalPages = chunk.totalPages;
    upstreamPage += 1;
  } while (upstreamPage < upstreamTotalPages && upstreamPage < DELAY_AGG_MAX_PAGES);

  const filtered = filterByDelay(all, delay);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const content = filtered.slice(page * size, (page + 1) * size);
  const body: Paged<ProcessStatusRow> = {
    content,
    totalElements: filtered.length,
    totalPages,
    number: page,
    size,
    first: page === 0,
    last: page >= totalPages - 1,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
  return NextResponse.json(body);
});
