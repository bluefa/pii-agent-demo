/**
 * P1 운영 대시보드 — the 지연 (delay) filter rule now lives in
 * `lib/types/task-queue.ts` because the process-statuses ROUTE applies it
 * server-side (over aggregated upstream pages — contract gap G1). This module
 * re-exports it for the page and its tests.
 */
export { DELAY_THRESHOLDS, filterByDelay } from '@/lib/types/task-queue';
export type { DelayFilter } from '@/lib/types/task-queue';

/**
 * [first, last] ordinals behind the `21–40 / 전체 …` range label.
 *
 * `pageIndex` is 0-based, as the contract sends it. Feeding it the 1-based
 * value the pager takes shifts every page by one `size`, and on the last page
 * the end is clamped to `totalElements` while the start keeps climbing — a
 * reversed range like `41–23`.
 */
export function pageRange(
  pageIndex: number,
  size: number,
  totalElements: number,
): [first: number, last: number] {
  return [pageIndex * size + 1, Math.min(totalElements, (pageIndex + 1) * size)];
}
