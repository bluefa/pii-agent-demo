import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { SDU_ERROR_CODES, SDU_VALIDATION } from '@/lib/constants/sdu';

interface ConfirmSourceIpBody {
  cidr: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.UNAUTHORIZED.code, message: SDU_ERROR_CODES.UNAUTHORIZED.message },
      { status: SDU_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = await dataAdapter.getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.NOT_FOUND.code, message: SDU_ERROR_CODES.NOT_FOUND.message },
      { status: SDU_ERROR_CODES.NOT_FOUND.status }
    );
  }

  // 3. 권한 확인 (관리자만)
  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.FORBIDDEN.code, message: SDU_ERROR_CODES.FORBIDDEN.message },
      { status: SDU_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. SDU 프로젝트 확인
  if (project.cloudProvider !== 'SDU') {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.NOT_SDU_PROJECT.code, message: SDU_ERROR_CODES.NOT_SDU_PROJECT.message },
      { status: SDU_ERROR_CODES.NOT_SDU_PROJECT.status }
    );
  }

  // 5. Request body 파싱
  let body: ConfirmSourceIpBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.VALIDATION_FAILED.code, message: '요청 본문을 파싱할 수 없습니다.' },
      { status: SDU_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  if (!body.cidr) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.VALIDATION_FAILED.code, message: 'CIDR 필드는 필수입니다.' },
      { status: SDU_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  // 6. CIDR 유효성 검증
  if (!SDU_VALIDATION.CIDR_REGEX.test(body.cidr)) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.INVALID_CIDR.code, message: SDU_ERROR_CODES.INVALID_CIDR.message },
      { status: SDU_ERROR_CODES.INVALID_CIDR.status }
    );
  }

  // 7. Source IP 확정
  const result = await dataAdapter.confirmSourceIp(projectId, body.cidr, user.name);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
