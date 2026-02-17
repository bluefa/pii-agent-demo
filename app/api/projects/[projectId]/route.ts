import { client } from '@/lib/api-client';

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  return client.projects.delete(projectId);
};
