import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const DELETE = withV1(async (_request, { params }) => {
  const { serviceCode, userId } = params;
  return client.services.permissions.remove(serviceCode, userId);
}, { expectedDuration: '100ms ~ 400ms' });
