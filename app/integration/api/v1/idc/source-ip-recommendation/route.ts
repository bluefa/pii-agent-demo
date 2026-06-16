import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

const VALID_IP_TYPES = ['public', 'private', 'vpc'];

export const GET = withV1(async (request) => {
  const ipType = new URL(request.url).searchParams.get('ipType') ?? '';
  if (!VALID_IP_TYPES.includes(ipType)) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'ipType must be one of public|private|vpc' } },
      { status: 400 },
    );
  }

  return NextResponse.json(await bff.idc.getSourceIpRecommendation(ipType));
});
