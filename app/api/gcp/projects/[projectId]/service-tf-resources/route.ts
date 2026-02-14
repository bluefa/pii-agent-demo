import type { NextRequest } from 'next/server';
import { client } from '@/lib/api-client';

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const connectionType = searchParams.get('connectionType');
  return client.gcp.getServiceTfResources(projectId, connectionType);
};
