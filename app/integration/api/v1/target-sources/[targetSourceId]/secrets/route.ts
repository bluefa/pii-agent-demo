import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.projects.credentials(String(parsed.value));
  if (!response.ok) return response;

  const data = await response.json();

  // Handle both mock data structure { credentials: [...] } and BFF structure [...]
  const credentials = Array.isArray(data) ? data : (data.credentials || []);

  interface RawCredential { name: string; create_time_str?: string; createdAt?: string; databaseType?: string }
  const secretKeys = (credentials as RawCredential[]).map((c) => ({
    name: c.name,
    createTimeStr: c.create_time_str || c.createdAt,
    ...(c.databaseType && { labels: { databaseType: c.databaseType } }),
  }));

  return NextResponse.json(secretKeys);
});
