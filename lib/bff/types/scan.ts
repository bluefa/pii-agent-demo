/**
 * Typed shapes for `bff.scan` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

import type { V1ScanJob } from '@/lib/types';
import type { ScanHistoryResponse, ScanJob } from '@/app/api/_lib/v1-types';

export type { V1ScanJob, ScanHistoryResponse, ScanJob };

/** GET /target-sources/{id}/scans/{scanId} (camelCase). */
export type ScanGetResponse = V1ScanJob;

/** GET /target-sources/{id}/scan/history (camelCase). */
export type ScanHistoryPageResponse = ScanHistoryResponse;

/** POST /target-sources/{id}/scan (snake_case raw passthrough). */
export interface ScanCreateResult {
  id: number;
  scan_status: string;
  target_source_id: number;
  created_at: string;
}

/** GET /target-sources/{id}/scanJob/latest (camelCase). */
export type ScanLatestStatusResponse = V1ScanJob;
