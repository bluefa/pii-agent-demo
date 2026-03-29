import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  return client.services.settings.azure.get(serviceCode);
}, { expectedDuration: '300ms' });
