import { client } from '@/lib/api-client';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) => {
  const { serviceCode } = await params;
  return client.services.settings.idc.get(serviceCode);
};

export const PUT = async (
  request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) => {
  const { serviceCode } = await params;
  const body = await request.json().catch(() => ({}));
  return client.services.settings.idc.update(serviceCode, body);
};
