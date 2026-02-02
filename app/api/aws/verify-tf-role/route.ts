import { NextRequest, NextResponse } from 'next/server';
import { verifyTfRole } from '@/lib/mock-installation';
import type { VerifyTfRoleRequest } from '@/lib/types';

/**
 * POST /api/aws/verify-tf-role
 * TerraformExecutionRole 검증
 */
export const POST = async (request: NextRequest) => {
  try {
    const body = await request.json() as VerifyTfRoleRequest;

    if (!body.accountId) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'accountId는 필수입니다.' },
        { status: 400 }
      );
    }

    const result = verifyTfRole(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};
