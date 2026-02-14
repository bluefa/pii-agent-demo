import { client } from '@/lib/api-client';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) => {
  const { serviceCode } = await params;
  return client.services.projects.list(serviceCode);
};
