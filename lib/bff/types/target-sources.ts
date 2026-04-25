/**
 * Typed shapes for `bff.targetSources` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 *
 * Specs 02-04 extend `BffClient` and import these types. This file declares
 * shapes only — no implementation, no `BffClient` interface change.
 */

import type { TargetSource } from '@/lib/types';

export type { TargetSourceDetailResponse } from '@/lib/target-source-response';

/** GET /target-sources/services/{serviceCode} (camelCase) */
export interface ServicesTargetSourcesItem {
  id?: string;
  targetSourceId: number;
  projectCode?: string;
  serviceCode?: string;
  cloudProvider: string;
  processStatus: number | string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  isRejected?: boolean;
  rejectionReason?: string;
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
