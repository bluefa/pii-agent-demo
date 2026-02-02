import { NextRequest, NextResponse } from 'next/server';
import { verifyScanRole } from '@/lib/mock-service-settings';
import { getStore } from '@/lib/mock-store';

type RouteParams = { params: Promise<{ serviceCode: string }> };

/**
 * POST /api/services/{serviceCode}/settings/aws/verify-scan-role
 * 등록된 Scan Role 재검증
 */
export const POST = async (
  _request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { serviceCode } = await params;

    // 서비스 코드 존재 확인
    const store = getStore();
    const service = store.serviceCodes.find(s => s.code === serviceCode);

    if (!service) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const result = verifyScanRole(serviceCode);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};
