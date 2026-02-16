import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  return client.targetSources.list(serviceCode);
}, { expectedDuration: '100ms ~ 500ms' });

export const POST = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  return client.targetSources.create({ ...body, serviceCode });
}, { expectedDuration: '300ms ~ 1s' });
