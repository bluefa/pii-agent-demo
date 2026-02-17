import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async () => {
  return client.dev.getUsers();
}, { expectedDuration: '50ms' });

export const POST = withV1(async (request) => {
  const body = await request.json().catch(() => ({}));
  return client.dev.switchUser(body);
}, { expectedDuration: '100ms' });
