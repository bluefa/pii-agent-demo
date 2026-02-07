import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { AZURE_ERROR_CODES } from '@/lib/constants/azure';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) {
  // 1. 인증 확인
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: AZURE_ERROR_CODES.UNAUTHORIZED.code, message: AZURE_ERROR_CODES.UNAUTHORIZED.message },
      { status: AZURE_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { serviceCode } = await params;

  // 2. 서비스 존재 확인
  const service = await dataAdapter.getServiceCodeByCode(serviceCode);
  if (!service) {
    return NextResponse.json(
      { error: AZURE_ERROR_CODES.SERVICE_NOT_FOUND.code, message: AZURE_ERROR_CODES.SERVICE_NOT_FOUND.message },
      { status: AZURE_ERROR_CODES.SERVICE_NOT_FOUND.status }
    );
  }

  // 3. 권한 확인
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
    return NextResponse.json(
      { error: AZURE_ERROR_CODES.FORBIDDEN.code, message: AZURE_ERROR_CODES.FORBIDDEN.message },
      { status: AZURE_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. Azure 서비스 설정 조회
  const result = await dataAdapter.getAzureServiceSettings(serviceCode);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
