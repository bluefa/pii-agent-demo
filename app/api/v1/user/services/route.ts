import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async () => {
  const response = await client.users.getServices();
  if (!response.ok) return response;

  const data = await response.json() as { services: Array<{ code: string; name: string }> };
  return NextResponse.json({
    services: data.services.map((s) => ({
      serviceCode: s.code,
      serviceName: s.name,
    })),
  });
}, { errorFormat: 'flat' });
