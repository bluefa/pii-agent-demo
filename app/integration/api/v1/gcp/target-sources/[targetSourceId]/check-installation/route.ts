import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';
import { transformInstallationStatus } from '../_lib/transform';

export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const legacy = await bff.gcp.checkInstallation(parsed.value);
  return NextResponse.json(transformInstallationStatus(legacy));
}, { expectedDuration: '5000ms' });
