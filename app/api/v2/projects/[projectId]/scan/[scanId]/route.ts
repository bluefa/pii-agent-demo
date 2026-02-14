import { client } from '@/lib/api-client';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ projectId: string; scanId: string }> }
) => {
  const { projectId, scanId } = await params;
  return client.scan.get(projectId, scanId);
};
