import { NextRequest, NextResponse } from 'next/server';
import { getAwsServiceSettings, updateAwsServiceSettings } from '@/lib/mock-service-settings';
import { getServiceCodeByCode } from '@/lib/mock-data';
import type { UpdateAwsSettingsRequest } from '@/lib/types';

type RouteParams = { params: Promise<{ serviceCode: string }> };

/**
 * GET /api/services/{serviceCode}/settings/aws
 * AWS 서비스 설정 조회
 */
export const GET = async (
  _request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { serviceCode } = await params;

    // 서비스 코드 존재 확인
    if (!getServiceCodeByCode(serviceCode)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const settings = getAwsServiceSettings(serviceCode);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/services/{serviceCode}/settings/aws
 * AWS 서비스 설정 수정
 */
export const PUT = async (
  request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { serviceCode } = await params;

    // 서비스 코드 존재 확인
    if (!getServiceCodeByCode(serviceCode)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json() as UpdateAwsSettingsRequest;

    if (!body.accountId || !body.scanRoleArn) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'accountId와 scanRoleArn은 필수입니다.' },
        { status: 400 }
      );
    }

    const result = updateAwsServiceSettings(serviceCode, body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};
