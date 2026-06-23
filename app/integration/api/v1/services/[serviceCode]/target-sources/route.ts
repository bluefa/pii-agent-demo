import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { camelCaseKeys } from '@/lib/object-case';
import {
  normalizeTargetSourceDetails,
  normalizeTargetSourceInfo,
} from '@/lib/target-source-creation';

// GET (37) → TargetSourceDetail[]. Single casing boundary: camelCaseKeys +
// normalizer (D1/D6). Upstream path is /target-sources/services/{serviceCode}.
export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  const data = await bff.targetSources.list(serviceCode);
  return NextResponse.json(normalizeTargetSourceDetails(camelCaseKeys(data)));
}, { expectedDuration: '100ms ~ 500ms' });

// POST createTargetSource (36): the selected creation candidate is posted back
// verbatim (request authored snake by the caller, D3) → 201 TargetSourceInfo.
// camelCaseKeys + normalizer makes the camel-top/snake-metadata wire uniform.
export const POST = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  const data = await bff.targetSources.create(serviceCode, body);
  return NextResponse.json(normalizeTargetSourceInfo(camelCaseKeys(data)), { status: 201 });
}, { expectedDuration: '300ms ~ 1s' });
