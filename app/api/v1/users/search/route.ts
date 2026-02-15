import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const excludeIds = searchParams.getAll('excludeIds');
  return client.users.search(q, excludeIds);
}, { errorFormat: 'flat' });
