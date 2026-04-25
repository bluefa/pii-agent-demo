/**
 * Typed shapes for `bff.guides` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

import type { GuideDetail } from '@/lib/types/guide';

export type { GuideDetail };

/** GET /admin/guides/{name} (camelCase). */
export type GuideGetResponse = GuideDetail;

/** PUT /admin/guides/{name} (snake_case raw passthrough — matches PUT body shape). */
export interface GuidePutResult {
  name: string;
  contents: { ko: string; en: string };
  updated_at: string;
}
