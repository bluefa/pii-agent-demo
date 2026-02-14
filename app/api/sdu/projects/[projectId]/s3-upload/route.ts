import { client } from '@/lib/api-client';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  return client.sdu.getS3Upload(projectId);
};
