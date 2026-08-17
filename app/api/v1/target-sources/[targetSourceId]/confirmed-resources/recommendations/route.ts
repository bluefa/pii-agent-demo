import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import {
  confirmedResourceProviderProblem,
  readConfirmedResourceProvider,
} from '@/app/api/_lib/confirmed-resource';
import { problemResponse } from '@/app/api/_lib/problem';

/**
 * 승인 기반 추천 확정 정보 — swagger `get{Csp}ApprovedRecommendations`
 * (GET …/{csp}-resources/approved-recommendations).
 *
 * Same four-paths-one-route shape as the sibling `confirmed-resources` route: the
 * provider selects the upstream path, not the operation.
 *
 * The 200 body is declared `type: object` with no properties — opaque — so nothing is
 * parsed or reshaped here. A 404 means there is no recommendation to show, which the
 * editor treats as absence, not failure.
 */
export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const provider = readConfirmedResourceProvider(request);
  if (!provider) return problemResponse(confirmedResourceProviderProblem(requestId));

  const raw = await bff.confirm.getApprovedRecommendations(parsed.value, provider);

  return NextResponse.json(raw ?? {});
});
