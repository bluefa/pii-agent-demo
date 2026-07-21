/**
 * P1 운영 대시보드 — the 지연 (delay) filter rule now lives in
 * `lib/types/task-queue.ts` because the process-statuses ROUTE applies it
 * server-side (over aggregated upstream pages — contract gap G1). This module
 * re-exports it for the page and its tests.
 */
export { DELAY_THRESHOLDS, filterByDelay } from '@/lib/types/task-queue';
export type { DelayFilter } from '@/lib/types/task-queue';
