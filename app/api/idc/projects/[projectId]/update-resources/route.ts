import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject, generateId } from '@/lib/mock-data';
import { IDC_ERROR_CODES } from '@/lib/constants/idc';
import { IdcResourceInput } from '@/lib/types/idc';
import { Resource, DatabaseType } from '@/lib/types';

interface UpdateResourcesBody {
  keepResourceIds: string[];
  newResources: IdcResourceInput[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
      { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  const project = getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.NOT_FOUND.code, message: IDC_ERROR_CODES.NOT_FOUND.message },
      { status: IDC_ERROR_CODES.NOT_FOUND.status }
    );
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.FORBIDDEN.code, message: IDC_ERROR_CODES.FORBIDDEN.message },
      { status: IDC_ERROR_CODES.FORBIDDEN.status }
    );
  }

  let body: UpdateResourcesBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: '요청 본문을 파싱할 수 없습니다.' },
      { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  const { keepResourceIds = [], newResources = [] } = body;

  // 기존 리소스 중 유지할 것만 필터링
  const keepResourceIdSet = new Set(keepResourceIds);
  const remainingResources = project.resources.filter((r) => keepResourceIdSet.has(r.id));

  // 새 리소스 변환
  const convertedNewResources: Resource[] = newResources.map((input) => {
    const hostInfo = input.inputFormat === 'IP'
      ? (input.ips?.join(', ') || '')
      : (input.host || '');

    return {
      id: generateId('idc-res'),
      type: 'IDC',
      resourceId: `${input.name} (${hostInfo}:${input.port})`,
      connectionStatus: 'PENDING' as const,
      isSelected: true,
      databaseType: input.databaseType as DatabaseType,
      lifecycleStatus: 'TARGET' as const,
    };
  });

  // 리소스 업데이트
  const allResources = [...remainingResources, ...convertedNewResources];

  if (allResources.length === 0) {
    return NextResponse.json(
      { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: '최소 1개 이상의 리소스가 필요합니다.' },
      { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  const updatedProject = updateProject(projectId, {
    resources: allResources,
  });

  return NextResponse.json({ project: updatedProject });
}
