import { client } from '@/lib/api-client';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  return client.idc.getResources(projectId);
};

export const PUT = async (
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  const body = await request.json().catch(() => ({}));
  return client.idc.updateResources(projectId, body);
};
