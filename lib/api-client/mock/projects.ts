import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { ProcessStatus } from '@/lib/types';
import type { ResourceLifecycleStatus, ProjectStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';

export const mockProjects = {
  get: async (projectId: string) => {
    const user = await dataAdapter.getCurrentUser();
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

    return NextResponse.json({ project });
  },

  delete: async (projectId: string) => {
    const user = await dataAdapter.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 과제를 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    const success = await dataAdapter.deleteProject(projectId);
    if (!success) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  },

  approve: async (projectId: string, body: unknown) => {
    const user = await dataAdapter.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 승인할 수 있습니다.' },
        { status: 403 }
      );
    }

    const project = await dataAdapter.getProjectById(projectId);
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

    const { comment } = (body ?? {}) as { comment?: string };

    const updatedResources = project.resources.map((r) => {
      if (r.lifecycleStatus !== 'PENDING_APPROVAL') return r;
      return {
        ...r,
        lifecycleStatus: 'INSTALLING' as ResourceLifecycleStatus,
        isNew: false,
      };
    });

    const terraformState = project.cloudProvider === 'AWS'
      ? { serviceTf: 'PENDING' as const, bdcTf: 'PENDING' as const }
      : { bdcTf: 'PENDING' as const };

    const now = new Date().toISOString();

    const updatedStatus: ProjectStatus = {
      ...project.status,
      approval: { status: 'APPROVED', approvedAt: now },
      installation: { status: 'IN_PROGRESS' },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    const updatedProject = await dataAdapter.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
      terraformState,
      isRejected: false,
      rejectionReason: undefined,
      rejectedAt: undefined,
      approvalComment: comment,
      approvedAt: now,
    });

    await dataAdapter.addApprovalHistory(projectId, { id: user.id, name: user.name });

    return NextResponse.json({ success: true, project: updatedProject });
  },
};
