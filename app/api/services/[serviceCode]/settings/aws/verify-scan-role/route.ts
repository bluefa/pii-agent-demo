import { client } from '@/lib/api-client';

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) => {
  const { serviceCode } = await params;
  return client.services.settings.aws.verifyScanRole(serviceCode);
};
