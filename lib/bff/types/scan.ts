/**
 * Typed shapes for `bff.scan` methods.
 *
 * Responses are snake_case at the BFF boundary (see ADR-014). Route handlers
 * map snake → camelCase when emitting v1 public responses.
 */

import type { V1ScanJob, ScanStatus } from '@/lib/types';
import type { ScanHistoryResponse, ScanJob } from '@/app/api/_lib/v1-types';

export type { V1ScanJob, ScanHistoryResponse, ScanJob };

/**
 * BFF wire shape for a scan job (snake_case). The v1 camelCase
 * `V1ScanJob` is built from this in route handlers.
 */
export interface BffScanJob {
  id: number;
  scan_status: ScanStatus;
  target_source_id: number;
  created_at: string;
  updated_at: string;
  scan_version: number | null;
  scan_progress: number | null;
  duration_seconds: number;
  resource_count_by_resource_type: Record<string, number> | null;
  scan_error: string | null;
}

/** GET /target-sources/{id}/scans/{scanId}. */
export type ScanGetResponse = BffScanJob;

/**
 * GET /target-sources/{id}/scan/history (upstream wire shape).
 * The route handler wraps `total_elements` into a v1 `page` envelope.
 */
export interface ScanHistoryPageResponse {
  content: ScanJob[];
  total_elements: number;
}

/** POST /target-sources/{id}/scan. */
export type ScanCreateResult = BffScanJob;

/** GET /target-sources/{id}/scanJob/latest. */
export type ScanLatestStatusResponse = BffScanJob;
