import type { NextRequest } from 'next/server';
import { client } from '@/lib/api-client';

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const limit = searchParams.get('limit') || '20';
  const offset = searchParams.get('offset') || '0';
  return client.projects.history(projectId, { type, limit, offset });
};
