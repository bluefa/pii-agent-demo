/**
 * Typed shapes for `bff.dashboard` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *
 * Dashboard responses retain snake_case fields (the wire shape consumed
 * directly by `app/lib/api/dashboard.ts`). `proxyGet`'s `camelCaseKeys`
 * is bypassed for these payloads in the legacy implementation; preserving
 * that asymmetry is part of I-3.
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
