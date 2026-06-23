import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';

// swagger SecretResponse = { name, create_time, create_time_str }. httpBff `get`
// camelCaseKeys it to `createTimeStr`; the mock path is un-camelized snake. Read
// camel first (ADR-019 D-5: the old snake-only read returned undefined against the
// real BFF), then snake, then the legacy `createdAt`.
interface RawCredential {
  name: string;
  createTimeStr?: string;
  create_time_str?: string;
  createdAt?: string;
  databaseType?: string;
}

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.targetSources.getSecrets(parsed.value);
  const credentials = (
    Array.isArray(data) ? data : (data as { credentials?: RawCredential[] })?.credentials ?? []
  ) as RawCredential[];

  const secretKeys = credentials.map((c) => ({
    name: c.name,
    createTimeStr: c.createTimeStr || c.create_time_str || c.createdAt,
    ...(c.databaseType && { labels: { databaseType: c.databaseType } }),
  }));

  return NextResponse.json(secretKeys);
});
