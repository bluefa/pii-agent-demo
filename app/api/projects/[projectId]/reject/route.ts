import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus, ResourceLifecycleStatus, ProjectStatus } from '@/lib/types';
import { addRejectionHistory } from '@/lib/mock-history';
import { getCurrentStep } from '@/lib/process';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = getCurrentUser();
  const { projectId } = await params;

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 반려할 수 있습니다.' },
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
  const { reason } = body as { reason?: string };

  const updatedResources = project.resources.map((r) => {
    const lifecycleStatus: ResourceLifecycleStatus = 'DISCOVERED';

    return {
      ...r,
      isSelected: false,
      lifecycleStatus,
      note: reason ? `반려: ${reason}` : r.note,
    };
  });

  const now = new Date().toISOString();

  // status 필드 업데이트 (ADR-004)
  const updatedStatus: ProjectStatus = {
    ...project.status,
    targets: {
      confirmed: false,
      selectedCount: 0,
      excludedCount: 0,
    },
    approval: {
      status: 'REJECTED',
      rejectedAt: now,
      rejectionReason: reason,
    },
  };

  // 계산된 processStatus
  const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

  const updatedProject = updateProject(projectId, {
    processStatus: calculatedProcessStatus,
    status: updatedStatus,
    resources: updatedResources,
    isRejected: true,
    rejectionReason: reason,
    rejectedAt: now,
  });

  // History 기록
  addRejectionHistory(projectId, { id: user.id, name: user.name }, reason || '');

  return NextResponse.json({ success: true, project: updatedProject, reason });
}
