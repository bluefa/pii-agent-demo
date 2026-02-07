import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { IDC_ERROR_CODES } from '@/lib/constants/idc';
import { IdcResourceInput } from '@/lib/types/idc';

// IDC confirm-targets는 전체 리소스 데이터를 받아서 처리
interface IdcConfirmTargetsBody {
  resources: IdcResourceInput[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
      { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = await dataAdapter.getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.NOT_FOUND.code, message: IDC_ERROR_CODES.NOT_FOUND.message },
      { status: IDC_ERROR_CODES.NOT_FOUND.status }
    );
  }

  // 3. 권한 확인
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.FORBIDDEN.code, message: IDC_ERROR_CODES.FORBIDDEN.message },
      { status: IDC_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. Request body 파싱
  let body: IdcConfirmTargetsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: '요청 본문을 파싱할 수 없습니다.' },
      { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  if (!body.resources || !Array.isArray(body.resources) || body.resources.length === 0) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: '최소 1개 이상의 리소스를 선택해야 합니다.' },
      { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  // 5. IDC 연동 대상 확정 (resources 전체 데이터)
  const result = await dataAdapter.confirmIdcTargets(projectId, body.resources);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
