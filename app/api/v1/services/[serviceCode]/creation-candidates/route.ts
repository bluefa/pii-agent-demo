import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { z } from 'zod';

// POST /target-sources/services/{serviceCode}/creation-candidates (35) →
// bare array of TargetSourceCreationCandidateResponse. Request body is authored
// snake (TargetSourceCreationCandidateRequest, D3) and passed through as-is;
// the route validates the response with the generated schema (zod-codegen).
export const POST = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  const data = await bff.targetSources.getCreationCandidates(serviceCode, body);
  return NextResponse.json(z.array(schemas.TargetSourceCreationCandidateResponse).parse(data));
}, { expectedDuration: '100ms ~ 400ms' });
