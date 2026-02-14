import { client } from '@/lib/api-client';

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  const body = await request.json().catch(() => ({}));
  return client.projects.resourceCredential(projectId, body);
};
