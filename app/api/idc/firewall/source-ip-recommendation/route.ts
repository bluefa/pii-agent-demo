import type { NextRequest } from 'next/server';
import { client } from '@/lib/api-client';

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const ipType = searchParams.get('ipType');
  return client.idc.getSourceIpRecommendation(ipType);
};
