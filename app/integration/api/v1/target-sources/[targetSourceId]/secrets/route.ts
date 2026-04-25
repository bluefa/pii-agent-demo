import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';

interface RawCredential {
  name: string;
  create_time_str?: string;
  createdAt?: string;
  databaseType?: string;
}

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.projects.credentials(parsed.value);
  const credentials = (Array.isArray(data) ? data : data.credentials ?? []) as RawCredential[];

  const secretKeys = credentials.map((c) => ({
    name: c.name,
    createTimeStr: c.create_time_str || c.createdAt,
    ...(c.databaseType && { labels: { databaseType: c.databaseType } }),
  }));

  return NextResponse.json(secretKeys);
});
