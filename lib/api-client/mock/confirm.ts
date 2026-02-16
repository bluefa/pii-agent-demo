import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as mockHistory from '@/lib/mock-history';
import { ProcessStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';
import { evaluateAutoApproval } from '@/lib/policies';
import type {
  Resource,
  ResourceLifecycleStatus,
  ProjectStatus,
  VmDatabaseConfig,
  ResourceExclusion,
  Project,
} from '@/lib/types';

// --- Helpers ---

const PROCESS_STATUS_NAMES: Record<number, string> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]: 'WAITING_TARGET_CONFIRMATION',
  [ProcessStatus.WAITING_APPROVAL]: 'WAITING_APPROVAL',
  [ProcessStatus.INSTALLING]: 'INSTALLING',
  [ProcessStatus.WAITING_CONNECTION_TEST]: 'WAITING_CONNECTION_TEST',
  [ProcessStatus.CONNECTION_VERIFIED]: 'CONNECTION_VERIFIED',
  [ProcessStatus.INSTALLATION_COMPLETE]: 'INSTALLATION_COMPLETE',
};

function buildMetadata(resource: Resource, project: Project): Record<string, unknown> {
  const base: Record<string, unknown> = { resourceType: resource.type };

  switch (project.cloudProvider) {
    case 'AWS':
      return {
        provider: 'AWS',
        resourceType: resource.awsType ?? resource.type,
        ...(resource.region && { region: resource.region }),
        ...(resource.vpcId && { vpcId: resource.vpcId }),
      };
    case 'Azure':
      return { provider: 'Azure', resourceType: resource.type, region: '' };
    case 'GCP':
      return {
        provider: 'GCP',
        resourceType: resource.type,
        region: '',
        projectId: project.gcpProjectId ?? '',
      };
    default:
      return { provider: project.cloudProvider, ...base };
  }
}

function toResourceSnapshot(r: Resource) {
  let vm_config = null;
  if (r.vmDatabaseConfig) {
    vm_config = {
      resource_id: r.id,
      db_type: r.vmDatabaseConfig.databaseType,
      port: r.vmDatabaseConfig.port,
      host: r.vmDatabaseConfig.host ?? '',
      ...(r.vmDatabaseConfig.oracleServiceId && {
        oracleServiceId: r.vmDatabaseConfig.oracleServiceId,
      }),
      ...(r.vmDatabaseConfig.selectedNicId && {
        selectedNicId: r.vmDatabaseConfig.selectedNicId,
      }),
    };
  }
  return {
    resource_id: r.id,
    resource_type: r.type,
    vm_config,
    selectedCredentialId: r.selectedCredentialId ?? null,
  };
}

interface ApprovalRequestBody {
  target_resource_ids: string[];
  excluded_resource_ids?: string[];
  exclusion_reason?: string;
  vm_configs?: Array<{
    resource_id: string;
    db_type: string;
    port: number;
    host: string;
    oracleServiceId?: string;
    selectedNicId?: string;
  }>;
}

// --- Mock Confirm Module ---

export const mockConfirm = {
  getResources: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const resources = project.resources.map((r) => ({
      id: r.id,
      resourceId: r.resourceId,
      name: r.resourceId,
      resourceType: r.type,
      integrationCategory: r.integrationCategory,
      selectedCredentialId: r.selectedCredentialId ?? null,
      metadata: buildMetadata(r, project),
    }));

    return NextResponse.json({ resources, totalCount: resources.length });
  },

  createApprovalRequest: async (projectId: string, body: unknown) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // 409 conflict checks
    if (project.processStatus === ProcessStatus.INSTALLING) {
      return NextResponse.json(
        { error: 'CONFLICT_APPLYING_IN_PROGRESS', message: '인프라 반영이 진행 중입니다.' },
        { status: 409 },
      );
    }
    if (project.processStatus === ProcessStatus.WAITING_APPROVAL) {
      return NextResponse.json(
        { error: 'CONFLICT_REQUEST_PENDING', message: '승인 대기 중인 요청이 있습니다.' },
        { status: 409 },
      );
    }

    const {
      target_resource_ids = [],
      excluded_resource_ids = [],
      exclusion_reason,
      vm_configs = [],
    } = body as ApprovalRequestBody;

    if (target_resource_ids.length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: '연동 대상이 1개 이상이어야 합니다.' },
        { status: 400 },
      );
    }

    const vmConfigMap = new Map(
      vm_configs.map((vc) => [
        vc.resource_id,
        {
          host: vc.host,
          databaseType: vc.db_type as VmDatabaseConfig['databaseType'],
          port: vc.port,
          ...(vc.oracleServiceId && { oracleServiceId: vc.oracleServiceId }),
          ...(vc.selectedNicId && { selectedNicId: vc.selectedNicId }),
        } as VmDatabaseConfig,
      ]),
    );

    const selectedSet = new Set(target_resource_ids);
    const excludedSet = new Set(excluded_resource_ids);
    const now = new Date().toISOString();
    const excludedBy = { id: user.id, name: user.name };

    const updatedResources: Resource[] = project.resources.map((r) => {
      const isSelected = selectedSet.has(r.id);

      let lifecycleStatus: ResourceLifecycleStatus;
      if (r.lifecycleStatus === 'ACTIVE') {
        lifecycleStatus = 'ACTIVE';
      } else {
        lifecycleStatus = isSelected ? 'PENDING_APPROVAL' : 'DISCOVERED';
      }

      let exclusion: ResourceExclusion | undefined = r.exclusion;
      if (excludedSet.has(r.id) && exclusion_reason) {
        exclusion = { reason: exclusion_reason, excludedAt: now, excludedBy };
      }

      const vmDatabaseConfig = vmConfigMap.get(r.id) ?? r.vmDatabaseConfig;

      return { ...r, isSelected, lifecycleStatus, exclusion, vmDatabaseConfig };
    });

    const selectedCount = target_resource_ids.length;
    const excludedCount = excluded_resource_ids.length;

    const autoApprovalResult = evaluateAutoApproval({
      resources: project.resources,
      selectedResourceIds: target_resource_ids,
    });

    const updatedStatus: ProjectStatus = {
      ...project.status,
      scan: { ...project.status.scan, status: 'COMPLETED' },
      targets: { confirmed: true, selectedCount, excludedCount },
      approval: autoApprovalResult.shouldAutoApprove
        ? { status: 'AUTO_APPROVED', approvedAt: now }
        : { status: 'PENDING' },
      installation: autoApprovalResult.shouldAutoApprove
        ? { status: 'IN_PROGRESS' }
        : { status: 'PENDING' },
    };

    const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);
    const actor = { id: user.id, name: user.name };

    await mockData.updateProject(projectId, {
      resources: updatedResources,
      status: updatedStatus,
      processStatus: calculatedProcessStatus,
    });

    await mockHistory.addTargetConfirmedHistory(projectId, actor, selectedCount, excludedCount);
    if (autoApprovalResult.shouldAutoApprove) {
      await mockHistory.addAutoApprovedHistory(projectId);
    }

    const requestId = `req-${Date.now()}`;
    return NextResponse.json(
      {
        success: true,
        approval_request: {
          id: requestId,
          requested_at: now,
          requested_by: user.name,
          target_resource_ids,
          excluded_resource_ids,
          exclusion_reason,
        },
      },
      { status: 201 },
    );
  },

  getConfirmedIntegration: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const activeResources = project.resources.filter((r) => r.lifecycleStatus === 'ACTIVE');
    if (activeResources.length === 0 || project.processStatus < ProcessStatus.INSTALLATION_COMPLETE) {
      return NextResponse.json({ confirmed_integration: null });
    }

    return NextResponse.json({
      confirmed_integration: {
        id: `ci-${project.id}`,
        confirmed_at: project.completionConfirmedAt ?? project.updatedAt,
        resource_infos: activeResources.map(toResourceSnapshot),
      },
    });
  },

  getApprovedIntegration: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const inFlightResources = project.resources.filter(
      (r) => r.lifecycleStatus === 'INSTALLING' || r.lifecycleStatus === 'READY_TO_TEST',
    );

    if (
      inFlightResources.length === 0 ||
      (project.processStatus !== ProcessStatus.INSTALLING &&
        project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST)
    ) {
      return NextResponse.json({ approved_integration: null });
    }

    const excludedResources = project.resources.filter((r) => r.exclusion);

    return NextResponse.json({
      approved_integration: {
        id: `ai-${project.id}`,
        request_id: `req-${project.id}`,
        approved_at: project.approvedAt ?? project.updatedAt,
        resource_infos: inFlightResources.map(toResourceSnapshot),
        excluded_resource_ids: excludedResources.map((r) => r.id),
        exclusion_reason: excludedResources[0]?.exclusion?.reason,
      },
    });
  },

  getApprovalHistory: async (projectId: string, page: number, size: number) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const { history, total } = mockHistory.getProjectHistory({
      projectId,
      type: 'approval',
      limit: size,
      offset: page * size,
    });

    const content = history.map((h) => {
      const request = {
        id: h.id,
        requested_at: h.timestamp,
        requested_by: h.actor.name,
        target_resource_ids: [] as string[],
        excluded_resource_ids: [] as string[],
      };

      let result;
      if (h.type === 'APPROVAL') {
        result = {
          id: `result-${h.id}`,
          request_id: h.id,
          result: 'APPROVED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: h.actor.id, reason: null },
        };
      } else if (h.type === 'AUTO_APPROVED') {
        result = {
          id: `result-${h.id}`,
          request_id: h.id,
          result: 'AUTO_APPROVED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: null, reason: null },
        };
      } else if (h.type === 'REJECTION') {
        result = {
          id: `result-${h.id}`,
          request_id: h.id,
          result: 'REJECTED' as const,
          processed_at: h.timestamp,
          process_info: { user_id: h.actor.id, reason: h.details.reason ?? null },
        };
      }

      return { request, ...(result && { result }) };
    });

    return NextResponse.json({
      content,
      page: {
        totalElements: total,
        totalPages: Math.ceil(total / size) || 1,
        number: page,
        size,
      },
    });
  },

  getProcessStatus: async (projectId: string) => {
    const user = mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const project = mockData.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      process_status: PROCESS_STATUS_NAMES[project.processStatus] ?? 'UNKNOWN',
      status_inputs: {
        last_rejection_reason: project.status.approval.rejectionReason ?? null,
      },
    });
  },
};
