/**
 * Typed shapes for `bff.guides` methods.
 *
 * Casing (ADR-019 D1/D2): all JSON responses (GET and PUT) are `camelCaseKeys`-d
 * at the route-handler boundary → camel domain. The PUT response is the same
 * `GuideDetail` (camel `updatedAt`) as GET — there is no snake raw passthrough.
 *
 * Source of truth: `docs/swagger/install-v1.yaml` (operationIds getGuide /
 * updateGuide → `GuideDetail`). Spec F §7-B.
 */

import type { GuideDetail } from '@/lib/types/guide';

export type { GuideDetail };

/** GET /admin/guides/{name} → `GuideDetail` (51). */
export type GuideGetResponse = GuideDetail;

/** PUT /admin/guides/{name} → `GuideDetail` (51). */
export type GuidePutResult = GuideDetail;
