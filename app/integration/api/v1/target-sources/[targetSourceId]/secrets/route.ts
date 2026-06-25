import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { schemas } from '@/lib/generated/install-v1';
import { z } from 'zod';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.targetSources.getSecrets(parsed.value);
  const secrets = z.array(schemas.SecretResponse).parse(Array.isArray(data) ? data : []);
  return NextResponse.json(secrets);
});
