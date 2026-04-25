import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';

export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProject(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const data = await bff.services.settings.aws.verifyScanRole(resolved.project.serviceCode);
  return NextResponse.json(data);
}, { expectedDuration: '30000ms' });
