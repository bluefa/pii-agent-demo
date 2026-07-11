import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';

// GET …/aws/installation-status — validates BFF raw wire against swagger schema.
// Reshape (snake wire → UI domain) is done by the CSR adapter in app/lib/api/aws.ts.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const raw = await bff.aws.getInstallationStatus(parsed.value);
  return NextResponse.json(schemas.AwsInstallationStatusResponse.parse(raw));
}, { expectedDuration: '5000ms' });
