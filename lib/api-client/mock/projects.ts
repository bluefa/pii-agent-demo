import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as mockHistory from '@/lib/mock-history';
import { ProcessStatus } from '@/lib/types';
import { getCurrentStep, createInitialProjectStatus } from '@/lib/process';
import { evaluateAutoApproval } from '@/lib/policies';
import {
  HISTORY_ERROR_CODES,
  VALID_HISTORY_TYPES,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
} from '@/lib/constants/history';
import type {
  ResourceLifecycleStatus,
  ProjectStatus,
  CloudProvider,
  Project,
  Resource,
  ResourceExclusion,
  ConnectionStatus,
  ConnectionTestResult,
  ConnectionTestHistory,
  AwsResourceType,
  DatabaseType,
  VmDatabaseConfig,
} from '@/lib/types';
import type { HistoryFilterType } from '@/lib/mock-history';

interface ConfirmTargetsBody {
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

interface ResourceCredentialInput {
  resourceId: string;
  credentialId?: string;
}

const awsTypeToDatabaseType = (awsType: AwsResourceType): DatabaseType => {
  switch (awsType) {
    case 'RDS':
    case 'RDS_CLUSTER':
      return Math.random() > 0.5 ? 'MYSQL' : 'POSTGRESQL';
    case 'DYNAMODB':
      return 'DYNAMODB';
    case 'ATHENA':
      return 'ATHENA';
    case 'REDSHIFT':
      return 'REDSHIFT';
    default:
      return 'MYSQL';
  }
};

export const mockProjects = {
  get: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = mockData.getProjectById(projectId);
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
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 과제를 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    const success = mockData.deleteProject(projectId);
    if (!success) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  },

  approve: async (projectId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 승인할 수 있습니다.' },
        { status: 403 }
      );
    }

    const project = mockData.getProjectById(projectId);
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

    // selected 기반: 선택된 리소스 중 아직 연결되지 않은 것만 승인 대상
    const updatedResources = project.resources.map((r) => {
      if (!r.isSelected || r.connectionStatus === 'CONNECTED') return r;
      return { ...r };
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

    const updatedProject = mockData.updateProject(projectId, {
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

    mockHistory.addApprovalHistory(projectId, { id: user.id, name: user.name });

    return NextResponse.json({ success: true, project: updatedProject });
  },

  create: async (body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 과제를 등록할 수 있습니다.' },
        { status: 403 }
      );
    }

    const {
      projectCode, serviceCode, cloudProvider, description,
      awsAccountId, awsRegionType, tenantId, subscriptionId, gcpProjectId,
    } = body as {
      projectCode: string;
      serviceCode: string;
      cloudProvider: CloudProvider;
      description?: string;
      awsAccountId?: string;
      awsRegionType?: 'global' | 'china';
      tenantId?: string;
      subscriptionId?: string;
      gcpProjectId?: string;
    };

    if (!projectCode || !serviceCode || !cloudProvider) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (awsAccountId && !/^\d{12}$/.test(awsAccountId)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'AWS Account ID는 12자리 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    if (awsRegionType && !['global', 'china'].includes(awsRegionType)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'AWS 리전 타입은 global 또는 china만 허용됩니다.' },
        { status: 400 }
      );
    }

    if (!mockData.mockServiceCodes.find((s) => s.code === serviceCode)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '존재하지 않는 서비스 코드입니다.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const initialStatus = createInitialProjectStatus();
    const newProject: Project = {
      id: mockData.generateId('proj'),
      targetSourceId: mockData.generateTargetSourceId(),
      projectCode,
      serviceCode,
      cloudProvider,
      processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
      status: initialStatus,
      resources: [],
      terraformState: cloudProvider === 'AWS'
        ? { serviceTf: 'PENDING', bdcTf: 'PENDING' }
        : { bdcTf: 'PENDING' },
      createdAt: now,
      updatedAt: now,
      name: projectCode,
      description: description || '',
      isRejected: false,
      ...(awsAccountId && { awsAccountId }),
      ...(awsRegionType && { awsRegionType }),
      ...(tenantId && { tenantId }),
      ...(subscriptionId && { subscriptionId }),
      ...(gcpProjectId && { gcpProjectId }),
    };

    mockData.addProject(newProject);

    return NextResponse.json({ project: newProject }, { status: 201 });
  },

  completeInstallation: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (project.processStatus !== ProcessStatus.INSTALLING) {
      return NextResponse.json(
        { error: 'INVALID_STATE', message: '설치중 상태가 아닙니다.' },
        { status: 400 }
      );
    }

    const updatedResources = project.resources.map((r) => {
      if (r.lifecycleStatus !== 'INSTALLING') return r;
      return {
        ...r,
        lifecycleStatus: 'READY_TO_TEST' as ResourceLifecycleStatus,
      };
    });

    const terraformState = {
      ...project.terraformState,
      serviceTf: project.cloudProvider === 'AWS' ? 'COMPLETED' as const : undefined,
      bdcTf: 'COMPLETED' as const,
    };

    const now = new Date().toISOString();

    const updatedStatus: ProjectStatus = {
      ...project.status,
      installation: {
        status: 'COMPLETED',
        completedAt: now,
      },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    const updatedProject = mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
      terraformState,
    });

    return NextResponse.json({ success: true, project: updatedProject });
  },

  confirmCompletion: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 설치 완료를 확정할 수 있습니다.' },
        { status: 403 }
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (project.processStatus !== ProcessStatus.CONNECTION_VERIFIED) {
      return NextResponse.json(
        { error: 'INVALID_STATE', message: '연결 확인이 완료된 상태에서만 설치 완료를 확정할 수 있습니다.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const updatedStatus: ProjectStatus = {
      ...project.status,
      connectionTest: {
        ...project.status.connectionTest,
        status: 'PASSED',
        passedAt: project.status.connectionTest.passedAt || now,
      },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    const updatedProject = mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      completionConfirmedAt: now,
      piiAgentInstalled: true,
      piiAgentConnectedAt: project.piiAgentConnectedAt || now,
    });

    return NextResponse.json({ project: updatedProject });
  },

  confirmPiiAgent: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 설치 확정할 수 있습니다.' },
        { status: 403 }
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST) {
      return NextResponse.json(
        { error: 'INVALID_STATE', message: '연결 테스트 대기 상태가 아닙니다.' },
        { status: 400 }
      );
    }

    const updatedResources = project.resources.map((r) => {
      if (r.lifecycleStatus !== 'READY_TO_TEST') return r;
      return {
        ...r,
        lifecycleStatus: 'ACTIVE' as ResourceLifecycleStatus,
        connectionStatus: 'CONNECTED' as const,
      };
    });

    const now = new Date().toISOString();

    const updatedStatus: ProjectStatus = {
      ...project.status,
      connectionTest: {
        status: 'PASSED',
        lastTestedAt: now,
        passedAt: now,
      },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    const updatedProject = mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
      piiAgentInstalled: true,
    });

    return NextResponse.json({ success: true, project: updatedProject });
  },

  confirmTargets: async (projectId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = mockData.getProjectById(projectId);
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

    const { resourceIds, vmConfigs = [], exclusions = [] } = body as ConfirmTargetsBody;

    if (!resourceIds || resourceIds.length === 0) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: '연동 대상으로 선택한 리소스가 1개 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const selectedSet = new Set(resourceIds);
    const exclusionMap = new Map(exclusions.map(e => [e.resourceId, e.reason]));

    const unselectedWithoutReason = project.resources.filter(r =>
      r.integrationCategory === 'TARGET' &&
      !selectedSet.has(r.id) &&
      r.connectionStatus !== 'CONNECTED' &&
      !exclusionMap.has(r.id) &&
      !r.exclusion
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

    const vmConfigMap = new Map(vmConfigs.map(vc => [vc.resourceId, vc.config]));

    const updatedResources: Resource[] = project.resources.map((r) => {
      const isSelected = selectedSet.has(r.id);

      let exclusion: ResourceExclusion | undefined = r.exclusion;
      if (!isSelected && exclusionMap.has(r.id)) {
        exclusion = {
          reason: exclusionMap.get(r.id)!,
          excludedAt: now,
          excludedBy,
        };
      }

      const vmDatabaseConfig = vmConfigMap.get(r.id) ?? r.vmDatabaseConfig;

      return {
        ...r,
        isSelected,
        exclusion,
        vmDatabaseConfig,
      };
    });

    const actor = { id: user.id, name: user.name };
    const selectedCount = resourceIds.length;
    const excludedCount = exclusions.length;

    const autoApprovalResult = evaluateAutoApproval({
      resources: project.resources,
      selectedResourceIds: resourceIds,
    });

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

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    const updatedProject = await mockData.updateProject(projectId, {
      resources: updatedResources,
      status: updatedStatus,
      processStatus: calculatedProcessStatus,
    });

    await mockHistory.addTargetConfirmedHistory(projectId, actor, selectedCount, excludedCount);

    if (autoApprovalResult.shouldAutoApprove) {
      await mockHistory.addAutoApprovedHistory(projectId);
    }

    return NextResponse.json({
      success: true,
      project: updatedProject,
      autoApproval: autoApprovalResult,
    });
  },

  credentials: async (projectId: string) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    const credentials = await mockData.getCredentials();

    return NextResponse.json({ credentials });
  },

  history: async (projectId: string, query: { type: string; limit: string; offset: string }) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: HISTORY_ERROR_CODES.UNAUTHORIZED.message },
        { status: HISTORY_ERROR_CODES.UNAUTHORIZED.status }
      );
    }

    const project = await mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: HISTORY_ERROR_CODES.NOT_FOUND.message },
        { status: HISTORY_ERROR_CODES.NOT_FOUND.status }
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: HISTORY_ERROR_CODES.FORBIDDEN.message },
        { status: HISTORY_ERROR_CODES.FORBIDDEN.status }
      );
    }

    const typeParam = query.type || 'all';
    const limitParam = parseInt(query.limit || String(DEFAULT_HISTORY_LIMIT), 10);
    const offsetParam = parseInt(query.offset || '0', 10);

    if (!VALID_HISTORY_TYPES.includes(typeParam as HistoryFilterType)) {
      return NextResponse.json(
        { error: 'INVALID_TYPE', message: HISTORY_ERROR_CODES.INVALID_TYPE.message },
        { status: HISTORY_ERROR_CODES.INVALID_TYPE.status }
      );
    }

    const limit = Math.min(Math.max(1, limitParam), MAX_HISTORY_LIMIT);
    const offset = Math.max(0, offsetParam);

    const { history, total } = await mockHistory.getProjectHistory({
      projectId,
      type: typeParam as HistoryFilterType,
      limit,
      offset,
    });

    return NextResponse.json({
      history: history.map((h) => ({
        id: h.id,
        type: h.type,
        actor: h.actor,
        timestamp: h.timestamp,
        details: h.details,
      })),
      total,
    });
  },

  reject: async (projectId: string, body: unknown) => {
    const user = await mockData.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 반려할 수 있습니다.' },
        { status: 403 }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    const { reason } = (body ?? {}) as { reason?: string };

    // selected 기반: 선택된 리소스만 반려 처리
    const updatedResources = project.resources.map((r) => {
      if (!r.isSelected) return r;
      return {
        ...r,
        isSelected: false,
        exclusion: undefined,
        note: reason ? `반려: ${reason}` : r.note,
      };
    });

    const now = new Date().toISOString();

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

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    const updatedProject = await mockData.updateProject(projectId, {
      processStatus: calculatedProcessStatus,
      status: updatedStatus,
      resources: updatedResources,
      isRejected: true,
      rejectionReason: reason,
      rejectedAt: now,
    });

    await mockHistory.addRejectionHistory(projectId, { id: user.id, name: user.name }, reason || '');

    return NextResponse.json({ success: true, project: updatedProject, reason });
  },

  resourceCredential: async (projectId: string, body: unknown) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST &&
        project.processStatus !== ProcessStatus.CONNECTION_VERIFIED &&
        project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE) {
      return NextResponse.json(
        { error: 'INVALID_STATE', message: '연결 테스트 단계에서만 Credential을 변경할 수 있습니다.' },
        { status: 400 }
      );
    }

    const { resourceId, credentialId } = body as { resourceId?: string; credentialId?: string };

    if (!resourceId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'resourceId가 필요합니다.' },
        { status: 400 }
      );
    }

    const updatedResources = project.resources.map((r) => {
      if (r.id !== resourceId) return r;
      return {
        ...r,
        selectedCredentialId: credentialId || undefined,
      };
    });

    const updatedProject = await mockData.updateProject(projectId, {
      resources: updatedResources,
    });

    return NextResponse.json({
      success: true,
      project: updatedProject,
    });
  },

  resourceExclusions: async (projectId: string) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    const exclusions = project.resources
      .filter(r => r.exclusion)
      .map(r => ({
        resourceId: r.id,
        resourceName: r.resourceId,
        resourceType: r.type,
        reason: r.exclusion!.reason,
        excludedAt: r.exclusion!.excludedAt,
        excludedBy: r.exclusion!.excludedBy,
      }));

    return NextResponse.json({
      exclusions,
      total: exclusions.length,
    });
  },

  resources: async (projectId: string) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    return NextResponse.json({ resources: project.resources });
  },

  scan: async (projectId: string) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    if (project.cloudProvider === 'IDC') {
      return NextResponse.json(
        { error: 'NOT_SUPPORTED', message: 'IDC 환경에서는 스캔 기능을 지원하지 않습니다.' },
        { status: 400 }
      );
    }

    const shouldAddNew = Math.random() > 0.5;
    let newResourcesFound = 0;
    const updatedResources = [...project.resources];

    if (shouldAddNew) {
      const awsTypes = ['RDS', 'RDS_CLUSTER', 'DYNAMODB', 'ATHENA', 'REDSHIFT'] as const;
      const regions = ['ap-northeast-2', 'ap-northeast-1', 'us-east-1'] as const;
      const accountIds = ['123456789012', '210987654321'] as const;

      const awsType = awsTypes[Math.floor(Math.random() * awsTypes.length)];
      const region = regions[Math.floor(Math.random() * regions.length)];
      const accountId = accountIds[Math.floor(Math.random() * accountIds.length)];

      const rand = Math.random().toString(36).substring(2, 10);

      const makeArn = () => {
        if (awsType === 'RDS') {
          return `arn:aws:rds:${region}:${accountId}:db:pii-demo-db-${rand}`;
        }
        if (awsType === 'RDS_CLUSTER') {
          return `arn:aws:rds:${region}:${accountId}:cluster:pii-demo-cluster-${rand}`;
        }
        if (awsType === 'DYNAMODB') {
          return `arn:aws:dynamodb:${region}:${accountId}:table/pii_demo_table_${rand}`;
        }
        if (awsType === 'ATHENA') {
          return `arn:aws:athena:${region}:${accountId}:workgroup/pii-demo-wg-${rand}`;
        }
        return `arn:aws:redshift:${region}:${accountId}:cluster:pii-demo-rs-${rand}`;
      };

      const newResource = {
        id: await mockData.generateId('res'),
        type: awsType,
        resourceId: makeArn(),
        databaseType: awsTypeToDatabaseType(awsType),
        connectionStatus: 'PENDING' as const,
        isSelected: false,
        awsType,
        region,
        lifecycleStatus: 'DISCOVERED' as const,
        isNew: true,
        note: 'NEW',
        integrationCategory: 'TARGET' as const,
      };

      updatedResources.push(newResource);
      newResourcesFound = 1;
    }

    const updatedProject = await mockData.updateProject(projectId, {
      resources: updatedResources,
    });

    return NextResponse.json({
      success: true,
      newResourcesFound,
      resources: updatedProject?.resources || [],
    });
  },

  terraformStatus: async (projectId: string) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    return NextResponse.json({ terraformState: project.terraformState });
  },

  testConnection: async (projectId: string, body: unknown) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST &&
        project.processStatus !== ProcessStatus.CONNECTION_VERIFIED &&
        project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE) {
      return NextResponse.json(
        { error: 'INVALID_STATE', message: '연결 테스트가 필요한 상태가 아닙니다.' },
        { status: 400 }
      );
    }

    const { resourceCredentials = [] } = (body ?? {}) as { resourceCredentials?: ResourceCredentialInput[] };

    const selectedResources = project.resources.filter((r) => r.isSelected);

    const credentialMap = new Map<string, string | undefined>();
    resourceCredentials.forEach((rc) => {
      credentialMap.set(rc.resourceId, rc.credentialId);
    });

    const results: ConnectionTestResult[] = await Promise.all(selectedResources.map(async (r) => {
      const credentialId = credentialMap.get(r.id);
      const credential = credentialId ? await mockData.getCredentialById(credentialId) : undefined;
      return mockData.simulateConnectionTest(
        r.resourceId,
        r.type,
        r.databaseType,
        credentialId,
        credential?.name
      );
    }));

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const allSuccess = failCount === 0;

    const historyEntry: ConnectionTestHistory = {
      id: await mockData.generateId('history'),
      executedAt: new Date().toISOString(),
      status: allSuccess ? 'SUCCESS' : 'FAIL',
      successCount,
      failCount,
      results,
    };

    const updatedResources = project.resources.map((r) => {
      if (!r.isSelected) return r;

      const credentialId = credentialMap.get(r.id);
      const result = results.find((res) => res.resourceId === r.resourceId);

      if (!result) {
        return {
          ...r,
          selectedCredentialId: credentialId,
        };
      }

      if (result.success) {
        return {
          ...r,
          connectionStatus: 'CONNECTED' as ConnectionStatus,
          lifecycleStatus: 'ACTIVE' as ResourceLifecycleStatus,
          isNew: false,
          note: r.note === 'NEW' ? undefined : r.note,
          selectedCredentialId: credentialId,
        };
      } else {
        return {
          ...r,
          connectionStatus: 'DISCONNECTED' as ConnectionStatus,
          selectedCredentialId: credentialId,
        };
      }
    });

    const existingHistory = project.connectionTestHistory || [];
    const updatedHistory = [historyEntry, ...existingHistory];

    const shouldUpdateConnectionTest = allSuccess && project.status.connectionTest.status !== 'PASSED';
    const isFirstSuccess = allSuccess && !project.piiAgentConnectedAt;
    const now = new Date().toISOString();

    const updatedStatus: ProjectStatus = shouldUpdateConnectionTest
      ? {
          ...project.status,
          connectionTest: {
            status: 'PASSED',
            lastTestedAt: now,
            passedAt: now,
          },
        }
      : {
          ...project.status,
          connectionTest: {
            ...project.status.connectionTest,
            status: allSuccess ? 'PASSED' : 'FAILED',
            lastTestedAt: now,
          },
        };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

    const updatedProject = await mockData.updateProject(projectId, {
      resources: updatedResources,
      connectionTestHistory: updatedHistory,
      status: updatedStatus,
      processStatus: calculatedProcessStatus,
      ...(isFirstSuccess ? { piiAgentConnectedAt: now } : {}),
    });

    return NextResponse.json({
      success: allSuccess,
      project: updatedProject,
      history: historyEntry,
    });
  },
};
