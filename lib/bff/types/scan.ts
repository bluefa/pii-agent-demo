/**
 * Typed shapes for `bff.scan` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

import type { OpaqueKeys } from '@/lib/object-case';
import type { V1ScanJob } from '@/lib/types';
import type { ScanHistoryResponse, ScanJob } from '@/app/api/_lib/v1-types';

export type { V1ScanJob, ScanHistoryResponse, ScanJob };

/** GET /target-sources/{id}/scans/{scanId} (camelCase). */
export type ScanGetResponse = V1ScanJob;

/**
 * Spring `SortObject` (camelCase on the wire — Spring serializes Page meta camel).
 */
export interface ScanPageSort {
  direction?: string;
  nullHandling?: string;
  ascending?: boolean;
  property?: string;
  ignoreCase?: boolean;
}

/**
 * Spring `PageableObject` (camelCase on the wire).
 */
export interface ScanPageable {
  paged?: boolean;
  pageNumber?: number;
  pageSize?: number;
  unpaged?: boolean;
  offset?: number;
  sort?: ScanPageSort[];
}

/**
 * GET /target-sources/{id}/scan/history → swagger `PageScanJobResponse`.
 * Top-level page fields are camelCase on the wire (Spring Page); `content[]`
 * items are snake `ScanJobResponse` camelized to `ScanJob` by the GET boundary.
 * The route reads the flat `totalElements`/`totalPages`/`number`/`size` directly
 * (no recompute) and preserves the route→CSR `{content, page}` 2-hop envelope.
 */
export interface ScanHistoryPageResponse {
  content: ScanJob[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  pageable?: ScanPageable;
  sort?: ScanPageSort[];
  first?: boolean;
  last?: boolean;
  numberOfElements?: number;
  empty?: boolean;
}

/** POST /target-sources/{id}/scan (snake_case raw passthrough). */
export interface ScanCreateResult {
  id: number;
  scan_status: string;
  target_source_id: number;
  created_at: string;
  updated_at: string;
  scan_version: number | null;
  scan_progress: number | null;
  duration_seconds: number;
  // Data-keyed map (keys are resource-type names) — must survive camelCaseKeys verbatim.
  resource_count_by_resource_type: OpaqueKeys<Record<string, number>> | null;
  scan_error: string | null;
}

/** GET /target-sources/{id}/scanJob/latest (camelCase). */
export type ScanLatestStatusResponse = V1ScanJob;
