import { client } from '@/lib/api-client';

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  const body = await request.json().catch(() => ({}));
  return client.projects.testConnection(projectId, body);
};
