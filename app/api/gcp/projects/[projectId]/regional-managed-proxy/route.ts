import type { NextRequest } from 'next/server';
import { client } from '@/lib/api-client';

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get('resourceId') || '';
  return client.gcp.getRegionalManagedProxy(projectId, resourceId);
};

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  const { resourceId } = await request.json().catch(() => ({ resourceId: '' }));
  return client.gcp.createProxySubnet(projectId, resourceId);
};
