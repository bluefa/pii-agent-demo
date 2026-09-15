import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withV1 } from '@/app/api/_lib/handler';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { bff } from '@/lib/bff/client';
import {
  TIMELINE_AXES,
  TIMELINE_INSTALLED_FILTERS,
  TIMELINE_SORT_PROPS,
  toIntegrationTimelinePage,
  type IntegrationTimelineCsvQuery,
  type IntegrationTimelineQuery,
} from '@/lib/types/task-queue';

/**
 * GET /admin/queue/integration-timeline — P6 연동 시점 (api-spec §P6).
 *
 * CONTRACT GAP G8: the upstream endpoint is not in install-v1.yaml yet, so there is no
 * generated schema and the query schema below is declared HERE — the same shape the
 * api-spec table declares, in one place, checked before anything reaches the upstream.
 * The response wire type lives in `lib/types/task-queue.ts` (`IntegrationTimelineWire`),
 * which the adapter turns into the camel domain the screen consumes.
 *
 * `Accept: text/csv` asks the same path for the same rows as a download: same filters,
 * same sort, no pager. The body is passed through as text — the client never stitches
 * pages together into a file.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const CONFIRM_STATUSES = [
  'NO_REQUEST',
  'PENDING',
  'CONFIRM_INFO_UPDATE_REQUIRED',
  'CONFIRMED',
  'REJECTED',
] as const;

const querySchema = z.object({
  axis: z.enum(TIMELINE_AXES).default('CREATED'),
  from: z.string().regex(DATE_ONLY),
  to: z.string().regex(DATE_ONLY),
  installed: z.enum(TIMELINE_INSTALLED_FILTERS).default('ALL'),
  serviceCode: z.string().min(1).optional(),
  confirmStatus: z.enum(CONFIRM_STATUSES).optional(),
  // `prop,dir` — only the four sortable props the contract names.
  sort: z
    .string()
    .refine((value) => {
      const [prop, dir = 'desc'] = value.split(',');
      return (TIMELINE_SORT_PROPS as readonly string[]).includes(prop)
        && (dir === 'asc' || dir === 'desc');
    })
    .default('createdAt,desc'),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

const optional = (value: string | null): string | undefined => value ?? undefined;

export const GET = withV1(async (request, { requestId }) => {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    axis: optional(params.get('axis')),
    from: optional(params.get('from')),
    to: optional(params.get('to')),
    installed: optional(params.get('installed')),
    serviceCode: optional(params.get('serviceCode')),
    confirmStatus: optional(params.get('confirmStatus')),
    sort: optional(params.get('sort')),
    page: optional(params.get('page')),
    size: optional(params.get('size')),
  });
  if (!parsed.success) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', '조회 조건이 올바르지 않습니다.', requestId),
    );
  }
  // An empty period is not a filter the server can answer — it is a mistake on the way in.
  if (parsed.data.from > parsed.data.to) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', '기간의 시작일이 종료일보다 늦습니다.', requestId),
    );
  }

  // The pager is the ONLY thing the two accepts differ by — the filters are one object,
  // so the file can never describe a different row set than the table above it.
  const { page, size, ...filters }: IntegrationTimelineQuery = parsed.data;
  if (wantsCsv(request)) {
    return csvResponse(await bff.taskQueue.getIntegrationTimelineCsv(filters), filters);
  }

  return NextResponse.json(
    toIntegrationTimelinePage(
      await bff.taskQueue.getIntegrationTimeline({ ...filters, page, size }),
    ),
  );
});

const wantsCsv = (request: Request): boolean =>
  (request.headers.get('accept') ?? '').toLowerCase().includes('text/csv');

const csvResponse = (body: string, query: IntegrationTimelineCsvQuery): NextResponse =>
  new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="integration-timeline_${query.from}_${query.to}.csv"`,
    },
  });
