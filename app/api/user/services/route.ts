import { client } from '@/lib/api-client';

export const GET = async () => {
  return client.users.getServices();
};
