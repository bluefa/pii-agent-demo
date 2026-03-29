import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  return client.services.permissions.list(serviceCode);
}, { expectedDuration: '80ms ~ 300ms' });

export const POST = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  return client.services.permissions.add(serviceCode, body);
}, { expectedDuration: '100ms ~ 500ms' });
