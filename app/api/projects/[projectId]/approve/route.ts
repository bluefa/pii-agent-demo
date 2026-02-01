import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus, ResourceLifecycleStatus } from '@/lib/types';
import { addApprovalHistory } from '@/lib/mock-history';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = getCurrentUser();
  const { projectId } = await params;

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 승인할 수 있습니다.' },
      { status: 403 }
    );
  }

  const project = getProjectById(projectId);

  if (!project) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (project.processStatus !== ProcessStatus.WAITING_APPROVAL) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '승인 대기 상태가 아닙니다.' },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { comment } = body as { comment?: string };

  const updatedResources = project.resources.map((r) => {
    // PENDING_APPROVAL 상태인 리소스만 INSTALLING으로 변경
    // (이미 ACTIVE인 리소스는 유지)
    if (r.lifecycleStatus !== 'PENDING_APPROVAL') return r;

    return {
      ...r,
      lifecycleStatus: 'INSTALLING' as ResourceLifecycleStatus,
      isNew: false, // 승인 시 신규 플래그 리셋
    };
  });

  const terraformState = project.cloudProvider === 'AWS'
    ? { serviceTf: 'PENDING' as const, bdcTf: 'PENDING' as const }
    : { bdcTf: 'PENDING' as const };

  const updatedProject = updateProject(projectId, {
    processStatus: ProcessStatus.INSTALLING,
    resources: updatedResources,
    terraformState,
    isRejected: false,
    rejectionReason: undefined,
    rejectedAt: undefined,
    approvalComment: comment,
    approvedAt: new Date().toISOString(),
  });

  // History 기록
  addApprovalHistory(projectId, { id: user.id, name: user.name });

  return NextResponse.json({ success: true, project: updatedProject });
}
