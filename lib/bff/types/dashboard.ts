/**
 * Typed shapes for `bff.dashboard` methods.
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 */

import type {
  DashboardSummary,
  SystemDetailListResponse,
} from '@/lib/types/dashboard';

export type { DashboardSummary, SystemDetailListResponse };

/** GET /admin/dashboard/summary. */
export type DashboardSummaryResponse = DashboardSummary;

/** GET /admin/dashboard/systems. */
export type DashboardSystemsResponse = SystemDetailListResponse;

/** GET /admin/dashboard/systems/export — CSV body (text/csv). */
export type DashboardSystemsExportResponse = string;
