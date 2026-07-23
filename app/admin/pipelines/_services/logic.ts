/**
 * Services·targets pure logic (LIN-25 Phase C1-b).
 *
 * (R20.5: the service search/pagination moved SERVER-side — getServicesPage
 * `query`/`page` params — so the old client-side filter is gone.) The
 * latest-cell state machine models the per-target `GET .../pipelines/latest`
 * (#8) result: undefined while the capped-concurrency fetch is in flight, null
 * on 204 (no runs / not active), and an object only when the latest run is
 * RUNNING|PENDING (design `activeRun`).
 */
import type { PipelineSummary } from '@/lib/pipeline/types';

/** One row of the services page (getServicesPage content item; zod-nullable). */
export interface ServiceItem {
  service_code?: string | null;
  service_name?: string | null;
}

/** Structural shape of a `getServicesPage` response (content is nullable). */
export interface ServicesPageLike {
  content?: readonly ServiceItem[] | null;
}

/**
 * The "작업" cell state for one target:
 *  - `loading`: the latest lookup has not resolved yet (map value undefined).
 *  - `active`:  latest run is RUNNING or PENDING → pill + `#{id}`.
 *  - `idle`:    204 (no runs) or a terminal latest → muted "—".
 */
export type LatestCellState =
  | { kind: 'loading' }
  | { kind: 'active'; status: 'RUNNING' | 'PENDING'; pipelineId: number }
  | { kind: 'idle' };

export function latestCellState(entry: PipelineSummary | null | undefined): LatestCellState {
  if (entry === undefined) return { kind: 'loading' };
  if (entry === null) return { kind: 'idle' };
  if (entry.status === 'RUNNING' || entry.status === 'PENDING') {
    return { kind: 'active', status: entry.status, pipelineId: entry.pipeline_id };
  }
  return { kind: 'idle' };
}

/** Non-null service items from a `getServicesPage` response (`content` nullable). */
export function serviceItemsFrom(page: ServicesPageLike | null | undefined): ServiceItem[] {
  const content = page?.content;
  return Array.isArray(content) ? [...(content as ServiceItem[])] : [];
}

/**
 * Run `task` over `items` with at most `limit` in flight at once (concurrency
 * cap for the per-target latest lookups — BFF §2.2 caps at ≤6). Resolves when
 * every task settles; individual rejections are the caller's responsibility.
 *
 * `shouldContinue` is checked before STARTING each item: when it returns false
 * (e.g. the owning effect was cleaned up), no further requests are launched —
 * otherwise a stale batch would keep scheduling and the cap could be exceeded
 * across overlapping old+new batches. In-flight tasks are not interrupted.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < queue.length) {
      if (!shouldContinue()) return;
      const next = queue[cursor];
      cursor += 1;
      await task(next.item, next.index);
    }
  };
  const workers = Array.from({ length: Math.min(limit, queue.length) }, () => worker());
  await Promise.all(workers);
}
