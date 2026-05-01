/**
 * Typed shapes for `bff.targetSources` methods (ADR-011 setup spec adr011-01).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 *
 * Specs 02-04 extend `BffClient` and import these types. This file declares
 * shapes only — no implementation, no `BffClient` interface change.
 */

import type { TargetSource } from '@/lib/types';

export type { TargetSourceDetailResponse } from '@/lib/target-source-response';

/** GET /target-sources/services/{serviceCode} */
export interface ServicesTargetSourcesItem {
  id?: string;
  target_source_id: number;
  project_code?: string;
  service_code?: string;
  cloud_provider: string;
  process_status: number | string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  is_rejected?: boolean;
  rejection_reason?: string;
}

export type ServicesTargetSourcesResponse =
  | ServicesTargetSourcesItem[]
  | { targetSources: ServicesTargetSourcesItem[] };

/** POST /target-sources (snake_case raw passthrough) */
export interface CreateTargetSourceResult {
  target_source_id: number;
  project_code?: string;
  service_code?: string;
  cloud_provider?: string;
  process_status?: string;
  created_at?: string;
}

/** Domain model produced by `extractTargetSource` — re-exported for callers. */
export type { TargetSource };
