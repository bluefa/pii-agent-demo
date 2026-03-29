import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  return client.services.settings.idc.get(serviceCode);
}, { expectedDuration: '300ms' });

export const PUT = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  return client.services.settings.idc.update(serviceCode, body);
}, { expectedDuration: '500ms' });
