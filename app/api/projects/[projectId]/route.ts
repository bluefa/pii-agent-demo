import { client } from '@/lib/api-client';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  return client.projects.get(projectId);
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  return client.projects.delete(projectId);
};
