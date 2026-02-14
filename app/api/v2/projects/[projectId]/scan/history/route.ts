import type { NextRequest } from 'next/server';
import { client } from '@/lib/api-client';

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') || '10');
  const offset = Number(searchParams.get('offset') || '0');
  return client.scan.getHistory(projectId, { limit, offset });
};
