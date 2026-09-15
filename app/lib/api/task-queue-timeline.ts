/**
 * Admin Task Queue — P6 연동 시점 client adapter.
 *
 * The route (`/admin/queue/integration-timeline`) owns the wire→camel boundary, so this
 * layer only spells the query and hands the camel domain back verbatim. CSR MUST NOT
 * import `@/lib/bff/*` (docs/api/boundaries.md).
 *
 * Kept in its own file beside `task-queue-requests.ts` / `task-queue-tc.ts`: one page per
 * adapter file, so page work never collides in `task-queue.ts`.
 */
import { fetchInfra, fetchInfraJson } from '@/app/lib/api/infra';
import { AppError } from '@/lib/errors';
import type {
  IntegrationTimelineCsvQuery,
  IntegrationTimelineQuery,
  IntegrationTimelineRow,
  Paged,
} from '@/lib/types/task-queue';

const PATH = '/admin/queue/integration-timeline';

/** Every filter goes on the wire — the table never narrows rows on the client. */
const search = (query: IntegrationTimelineCsvQuery): URLSearchParams => {
  const params = new URLSearchParams({
    axis: query.axis,
    from: query.from,
    to: query.to,
    sort: query.sort,
  });
  if (query.installed) params.set('installed', query.installed);
  if (query.serviceCode) params.set('serviceCode', query.serviceCode);
  if (query.confirmStatus) params.set('confirmStatus', query.confirmStatus);
  return params;
};

/** GET /admin/queue/integration-timeline — one page of rows (camel domain). */
export const getIntegrationTimeline = (
  query: IntegrationTimelineQuery,
  options?: { signal?: AbortSignal },
): Promise<Paged<IntegrationTimelineRow>> => {
  const params = search(query);
  params.set('page', String(query.page));
  params.set('size', String(query.size));
  return fetchInfraJson<Paged<IntegrationTimelineRow>>(
    `${PATH}?${params.toString()}`,
    options?.signal ? { signal: options.signal } : undefined,
  );
};

/**
 * The same query as text/csv. The file is whatever the server sends for those filters —
 * the client asks once and never assembles pages into a download.
 */
export async function downloadIntegrationTimelineCsv(
  query: IntegrationTimelineCsvQuery,
): Promise<Blob> {
  const response = await fetchInfra(`${PATH}?${search(query).toString()}`, {
    headers: { Accept: 'text/csv' },
  });
  if (!response.ok) {
    throw new AppError({
      status: response.status,
      code: 'UNKNOWN',
      retriable: true,
      message: 'CSV를 내려받지 못했습니다.',
    });
  }
  return await response.blob();
}
