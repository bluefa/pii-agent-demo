import { client } from '@/lib/api-client';

export const POST = async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  return client.aws.verifyTfRole(body);
};
