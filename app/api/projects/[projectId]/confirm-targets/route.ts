import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { ResourceLifecycleStatus, Resource, ResourceExclusion, ProjectStatus } from '@/lib/types';
import type { VmDatabaseConfig } from '@/lib/types';
import { evaluateAutoApproval } from '@/lib/policies';
import { getCurrentStep } from '@/lib/process';

interface ConfirmTargetsRequest {
  resourceIds: string[];
  vmConfigs?: Array<{
    resourceId: string;
    config: VmDatabaseConfig;
  }>;
  exclusions?: Array<{
    resourceId: string;
    reason: string;
  }>;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await dataAdapter.getCurrentUser();
  const { projectId } = await params;

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const project = await dataAdapter.getProjectById(projectId);

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
  const { resourceIds, vmConfigs = [], exclusions = [] } = body;

  // 선택한 리소스가 1개 이상이어야 함
  if (!resourceIds || resourceIds.length === 0) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: '연동 대상으로 선택한 리소스가 1개 이상이어야 합니다.' },
      { status: 400 }
    );
  }

  const selectedSet = new Set(resourceIds);

  // 제외 사유 맵 생성
  const exclusionMap = new Map(exclusions.map(e => [e.resourceId, e.reason]));

  // 선택되지 않은 리소스 중 제외 사유가 없는 것 검증
  // (이미 exclusion이 있는 리소스는 제외 - 기존 제외 유지)
  // EC2 리소스는 제외 사유 없이 미선택 가능
  const unselectedWithoutReason = project.resources.filter(r =>
    !selectedSet.has(r.id) &&
    r.lifecycleStatus !== 'ACTIVE' &&
    !exclusionMap.has(r.id) &&
    !r.exclusion &&
    r.awsType !== 'EC2'
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

  // VM 설정 맵 생성 (resourceId → VmDatabaseConfig)
  const vmConfigMap = new Map(vmConfigs.map(vc => [vc.resourceId, vc.config]));

  const updatedResources: Resource[] = project.resources.map((r) => {
    const isSelected = selectedSet.has(r.id);

    // 이미 ACTIVE인 리소스는 lifecycleStatus 유지
    let lifecycleStatus: ResourceLifecycleStatus;
    if (r.lifecycleStatus === 'ACTIVE') {
      lifecycleStatus = 'ACTIVE';
    } else {
      lifecycleStatus = isSelected ? 'PENDING_APPROVAL' : 'DISCOVERED';
    }

    // 제외 정보 설정 (기존 exclusion 보존)
    let exclusion: ResourceExclusion | undefined = r.exclusion;
    if (!isSelected && exclusionMap.has(r.id)) {
      exclusion = {
        reason: exclusionMap.get(r.id)!,
        excludedAt: now,
        excludedBy,
      };
    }

    // VM 설정 적용 (selectedNicId 포함)
    const vmDatabaseConfig = vmConfigMap.get(r.id) ?? r.vmDatabaseConfig;

    return {
      ...r,
      isSelected,
      lifecycleStatus,
      exclusion,
      vmDatabaseConfig,
    };
  });

  // History 기록: 연동 대상 확정
  const actor = { id: user.id, name: user.name };
  const selectedCount = resourceIds.length;
  const excludedCount = exclusions.length;

  // 자동 승인 정책 평가
  const autoApprovalResult = evaluateAutoApproval({
    resources: project.resources,
    selectedResourceIds: resourceIds,
  });

  // status 필드 업데이트 (ADR-004)
  const updatedStatus: ProjectStatus = {
    ...project.status,
    scan: { ...project.status.scan, status: 'COMPLETED' },
    targets: {
      confirmed: true,
      selectedCount,
      excludedCount,
    },
    approval: autoApprovalResult.shouldAutoApprove
      ? { status: 'AUTO_APPROVED', approvedAt: now }
      : { status: 'PENDING' },
    installation: autoApprovalResult.shouldAutoApprove
      ? { status: 'IN_PROGRESS' }
      : { status: 'PENDING' },
  };

  // 계산된 processStatus
  const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

  const updatedProject = await dataAdapter.updateProject(projectId, {
    resources: updatedResources,
    status: updatedStatus,
    processStatus: calculatedProcessStatus,  // 계산된 값으로 업데이트 (하위 호환성)
  });

  // 연동 확정 히스토리 추가
  await dataAdapter.addTargetConfirmedHistory(projectId, actor, selectedCount, excludedCount);

  if (autoApprovalResult.shouldAutoApprove) {
    await dataAdapter.addAutoApprovedHistory(projectId);
  }

  return NextResponse.json({
    success: true,
    project: updatedProject,
    autoApproval: autoApprovalResult,
  });
}
