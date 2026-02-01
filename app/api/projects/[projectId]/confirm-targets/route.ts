import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus, ResourceLifecycleStatus, Resource, ResourceExclusion } from '@/lib/types';
import { addResourceExcludeHistory, addResourceAddHistory } from '@/lib/mock-history';

interface ConfirmTargetsRequest {
  resourceIds: string[];
  exclusions?: Array<{
    resourceId: string;
    reason: string;
  }>;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = getCurrentUser();
  const { projectId } = await params;

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const project = getProjectById(projectId);

  if (!project) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
      { status: 403 }
    );
  }

  const body = await request.json() as ConfirmTargetsRequest;
  const { resourceIds, exclusions = [] } = body;
  const selectedSet = new Set(resourceIds);

  // 제외 사유 맵 생성
  const exclusionMap = new Map(exclusions.map(e => [e.resourceId, e.reason]));

  // 선택되지 않은 리소스 중 제외 사유가 없는 것 검증
  const unselectedWithoutReason = project.resources.filter(r =>
    !selectedSet.has(r.id) &&
    r.lifecycleStatus !== 'ACTIVE' &&
    !exclusionMap.has(r.id)
  );

  if (unselectedWithoutReason.length > 0) {
    return NextResponse.json(
      {
        error: 'MISSING_EXCLUSION_REASON',
        message: '제외되는 리소스에 대해 제외 사유를 입력해주세요.',
        missingResourceIds: unselectedWithoutReason.map(r => r.id)
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const excludedBy = { id: user.id, name: user.name };

  const updatedResources: Resource[] = project.resources.map((r) => {
    const isSelected = selectedSet.has(r.id);

    // 이미 ACTIVE인 리소스는 lifecycleStatus 유지
    let lifecycleStatus: ResourceLifecycleStatus;
    if (r.lifecycleStatus === 'ACTIVE') {
      lifecycleStatus = 'ACTIVE';
    } else {
      lifecycleStatus = isSelected ? 'PENDING_APPROVAL' : 'DISCOVERED';
    }

    // 제외 정보 설정
    let exclusion: ResourceExclusion | undefined;
    if (!isSelected && exclusionMap.has(r.id)) {
      exclusion = {
        reason: exclusionMap.get(r.id)!,
        excludedAt: now,
        excludedBy,
      };
    }

    return {
      ...r,
      isSelected,
      lifecycleStatus,
      exclusion,
    };
  });

  const updatedProject = updateProject(projectId, {
    resources: updatedResources,
    processStatus: ProcessStatus.WAITING_APPROVAL,
  });

  // History 기록: 리소스 변경 사항
  const actor = { id: user.id, name: user.name };

  // 제외된 리소스 기록 (이전에 제외되지 않았던 리소스만)
  for (const r of project.resources) {
    const isNowSelected = selectedSet.has(r.id);
    const wasExcluded = !!r.exclusion;

    if (!isNowSelected && !wasExcluded && exclusionMap.has(r.id)) {
      // 새로 제외됨
      addResourceExcludeHistory(
        projectId,
        actor,
        r.id,
        r.resourceId,
        exclusionMap.get(r.id)!
      );
    } else if (isNowSelected && wasExcluded) {
      // 제외 → 재선택
      addResourceAddHistory(projectId, actor, r.id, r.resourceId);
    }
  }

  return NextResponse.json({ success: true, project: updatedProject });
}
