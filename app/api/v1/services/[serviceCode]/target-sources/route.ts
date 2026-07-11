import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { z } from 'zod';

// GET (37) → TargetSourceDetail[]. Route validates raw BFF response against the
// swagger schema; no casing transform (zod-codegen, snake).
export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  const data = await bff.targetSources.list(serviceCode);
  return NextResponse.json(z.array(schemas.TargetSourceDetail).parse(data));
}, { expectedDuration: '100ms ~ 500ms' });

// POST createTargetSource (36): the selected creation candidate is posted back
// verbatim (request authored snake by the caller, D3) → 201 TargetSourceInfo.
export const POST = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  const data = await bff.targetSources.create(serviceCode, body);
  return NextResponse.json(schemas.TargetSourceInfo.parse(data), { status: 201 });
}, { expectedDuration: '300ms ~ 1s' });
