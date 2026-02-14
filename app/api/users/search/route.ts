import type { NextRequest } from 'next/server';
import { client } from '@/lib/api-client';

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const excludeIds = searchParams.get('exclude')?.split(',').filter(Boolean) || [];
  return client.users.search(query, excludeIds);
};
