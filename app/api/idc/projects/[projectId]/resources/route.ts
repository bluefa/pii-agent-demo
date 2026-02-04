import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById } from '@/lib/mock-data';
import { getIdcResources, updateIdcResources } from '@/lib/mock-idc';
import { IDC_ERROR_CODES } from '@/lib/constants/idc';
import { IdcResourceInput } from '@/lib/types/idc';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
      { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = getProjectById(projectId);
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

  // 4. IDC 리소스 목록 조회
  const result = getIdcResources(projectId);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json({ resources: result.data });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
      { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = getProjectById(projectId);
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
  let body: { resources: IdcResourceInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: '요청 본문을 파싱할 수 없습니다.' },
      { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  if (!body.resources || !Array.isArray(body.resources)) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: 'resources 필드가 필요합니다.' },
      { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  // 5. IDC 리소스 저장
  const result = updateIdcResources(projectId, body.resources);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json({ resources: result.data });
}
