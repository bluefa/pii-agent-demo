import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const POST = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  return client.services.settings.aws.verifyScanRole(serviceCode);
}, { expectedDuration: '5000ms' });
