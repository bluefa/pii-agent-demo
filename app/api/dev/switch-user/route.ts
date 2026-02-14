import { client } from '@/lib/api-client';

export const GET = async () => {
  return client.dev.getUsers();
};

export const POST = async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  return client.dev.switchUser(body);
};
