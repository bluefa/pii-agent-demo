/**
 * Typed shapes for `bff.scan` methods (ADR-011 setup spec adr011-01).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 */

import type { V1ScanJob } from '@/lib/types';
import type { ScanHistoryResponse, ScanJob } from '@/app/api/_lib/v1-types';

export type { V1ScanJob, ScanHistoryResponse, ScanJob };

/** GET /target-sources/{id}/scans/{scanId}. */
export type ScanGetResponse = V1ScanJob;

/**
 * GET /target-sources/{id}/scan/history (upstream wire shape).
 * The route handler wraps `total_elements` into a v1 `page` envelope.
 */
export interface ScanHistoryPageResponse {
  content: ScanJob[];
  total_elements: number;
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
  resource_count_by_resource_type: Record<string, number> | null;
  scan_error: string | null;
}

/** GET /target-sources/{id}/scanJob/latest. */
export type ScanLatestStatusResponse = V1ScanJob;
