import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeTargetSourceCreationCandidates } from '@/lib/target-source-creation';

// POST /target-sources/services/{serviceCode}/creation-candidates (35) →
// bare array of TargetSourceCreationCandidateResponse. Request body is authored
// snake (TargetSourceCreationCandidateRequest, D3) and passed through as-is;
// the response is the single casing boundary: camelCaseKeys + normalizer (D1/D6).
export const POST = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  const data = await bff.targetSources.getCreationCandidates(serviceCode, body);
  return NextResponse.json(normalizeTargetSourceCreationCandidates(camelCaseKeys(data)));
}, { expectedDuration: '100ms ~ 400ms' });
