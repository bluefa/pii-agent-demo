import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  return client.dashboard.systemsExport(searchParams);
}, { expectedDuration: '500ms ~ 2s' });
