import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import {
  confirmedResourceBodyProblem,
  confirmedResourceProviderProblem,
  readConfirmedResourceProvider,
} from '@/app/api/_lib/confirmed-resource';
import { problemResponse } from '@/app/api/_lib/problem';

/**
 * 확정 정보 등록 / 삭제.
 *
 * swagger declares FOUR upstream paths — `…/{aws|gcp|azure|idc}-resources` — that
 * differ only in that segment and carry the same operation
 * (`create{Csp}ConfirmedResource` / `delete{Csp}ConfirmedResource`). One route
 * mirrors all four with `?provider=`, rather than four copies of this file: the
 * provider selects a path, not a contract.
 *
 * Neither operation declares a success response schema (the swagger lists only
 * error statuses), so nothing is validated on the way out — the body is passed
 * through as-is. The REQUEST body is declared `type: object` with no properties,
 * i.e. opaque: the route enforces exactly that floor (readable JSON, plain
 * object) and forwards it unreshaped — property validation would invent schema.
 */
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const provider = readConfirmedResourceProvider(request);
  if (!provider) return problemResponse(confirmedResourceProviderProblem(requestId));

  // `applyNLBSecurityGroup` — declared on the AWS path only, default false. Mirrored as a
  // query flag rather than folded into the body: the body is opaque and adding a key to it
  // would invent contract we do not have.
  const applyNlb =
    new URL(request.url).searchParams.get('applyNLBSecurityGroup')?.toLowerCase() === 'true';
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemResponse(confirmedResourceBodyProblem(requestId));
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return problemResponse(confirmedResourceBodyProblem(requestId));
  }
  const raw = await bff.confirm.createConfirmedResources(parsed.value, provider, body, applyNlb);

  return NextResponse.json(raw ?? {}, { status: 201 });
});

export const DELETE = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const provider = readConfirmedResourceProvider(request);
  if (!provider) return problemResponse(confirmedResourceProviderProblem(requestId));

  const raw = await bff.confirm.deleteConfirmedResources(parsed.value, provider);

  return NextResponse.json(raw ?? {});
});
