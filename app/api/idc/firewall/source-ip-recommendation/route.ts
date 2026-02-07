import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { IDC_ERROR_CODES } from '@/lib/constants/idc';
import { IpType } from '@/lib/types/idc';

export async function GET(request: Request) {
  // 1. 인증 확인
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
      { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  // 2. Query Parameter 파싱
  const { searchParams } = new URL(request.url);
  const ipType = searchParams.get('ipType') as IpType | null;

  if (!ipType || !['public', 'private', 'vpc'].includes(ipType)) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.INVALID_IP_TYPE.code, message: IDC_ERROR_CODES.INVALID_IP_TYPE.message },
      { status: IDC_ERROR_CODES.INVALID_IP_TYPE.status }
    );
  }

  // 3. Source IP 추천 조회
  const result = await dataAdapter.getSourceIpRecommendation(ipType);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
