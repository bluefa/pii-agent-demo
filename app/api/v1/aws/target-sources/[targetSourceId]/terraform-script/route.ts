import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';

// swagger: GET …/aws/terraform-script/download → application/octet-stream (zip).
// bff.aws.getTerraformScript returns the raw upstream Response (getRaw); stream
// its body through with the content-type / disposition headers — never
// NextResponse.json a Response (that serializes the object to garbage).
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const upstream = await bff.aws.getTerraformScript(parsed.value);

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  headers.set('content-type', contentType);
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) headers.set('content-disposition', disposition);

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}, { expectedDuration: '500ms' });
