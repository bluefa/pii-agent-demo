import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  const ipType = searchParams.get('ipType');
  return client.idc.getSourceIpRecommendation(ipType);
}, { expectedDuration: '50ms' });
