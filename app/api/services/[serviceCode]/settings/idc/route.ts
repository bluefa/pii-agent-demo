import { NextResponse } from 'next/server';
import { getCurrentUser, mockServiceCodes } from '@/lib/mock-data';
import { getIdcServiceSettings, updateIdcServiceSettings } from '@/lib/mock-idc';
import { IDC_ERROR_CODES } from '@/lib/constants/idc';
import { UpdateIdcSettingsRequest } from '@/lib/types/idc';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) {
  // 1. 인증 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
      { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { serviceCode } = await params;

  // 2. 서비스 존재 확인
  const service = mockServiceCodes.find((s) => s.code === serviceCode);
  if (!service) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.SERVICE_NOT_FOUND.code, message: IDC_ERROR_CODES.SERVICE_NOT_FOUND.message },
      { status: IDC_ERROR_CODES.SERVICE_NOT_FOUND.status }
    );
  }

  // 3. 권한 확인
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.FORBIDDEN.code, message: IDC_ERROR_CODES.FORBIDDEN.message },
      { status: IDC_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. IDC 서비스 설정 조회
  const result = getIdcServiceSettings(serviceCode);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) {
  // 1. 인증 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
      { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { serviceCode } = await params;

  // 2. 서비스 존재 확인
  const service = mockServiceCodes.find((s) => s.code === serviceCode);
  if (!service) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.SERVICE_NOT_FOUND.code, message: IDC_ERROR_CODES.SERVICE_NOT_FOUND.message },
      { status: IDC_ERROR_CODES.SERVICE_NOT_FOUND.status }
    );
  }

  // 3. 권한 확인
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.FORBIDDEN.code, message: IDC_ERROR_CODES.FORBIDDEN.message },
      { status: IDC_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. Request Body 파싱
  let body: UpdateIdcSettingsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: '유효하지 않은 요청 본문입니다.' },
      { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  if (typeof body.firewallPrepared !== 'boolean') {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: 'firewallPrepared는 boolean 타입이어야 합니다.' },
      { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  // 5. IDC 서비스 설정 수정
  const result = updateIdcServiceSettings(serviceCode, body.firewallPrepared);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
