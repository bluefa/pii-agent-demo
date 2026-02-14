import { client } from '@/lib/api-client';

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  return client.idc.checkInstallation(projectId);
};
