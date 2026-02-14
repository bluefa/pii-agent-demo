import { client } from '@/lib/api-client';

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ serviceCode: string; userId: string }> }
) => {
  const { serviceCode, userId } = await params;
  return client.services.permissions.remove(serviceCode, userId);
};
