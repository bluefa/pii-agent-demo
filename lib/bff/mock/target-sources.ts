import { NextResponse } from 'next/server';
import {
  addProject,
  generateId,
  generateTargetSourceId,
  getCurrentUser,
  getProjectsByServiceCode,
  mockServiceCodes,
} from '@/lib/mock-data';
import { mockProjects } from '@/lib/bff/mock/projects';
import { createInitialProjectStatus } from '@/lib/process';
import { ProcessStatus } from '@/lib/types';
import type { CloudProvider, Project } from '@/lib/types';

type Issue222CloudProvider = 'AWS' | 'GCP' | 'AZURE' | 'UNKNOWN';
type Issue222ProcessStatus =
  | 'IDLE'
  | 'PENDING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'INSTALLED'
  | 'CONNECTED'
  | 'COMPLETED';

interface Issue222CreateTargetSourceBody {
  serviceCode?: string;
  description?: string;
  cloudProvider?: string;
  awsAccountId?: string;
  awsRegionType?: 'global' | 'china';
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
}

const toIssue222CloudProvider = (cloudProvider: CloudProvider): Issue222CloudProvider => {
  switch (cloudProvider) {
    case 'Azure':
      return 'AZURE';
    default:
      return cloudProvider;
  }
};

const toInternalCloudProvider = (cloudProvider?: string): CloudProvider | null => {
  switch (cloudProvider?.toUpperCase()) {
    case 'AWS':
      return 'AWS';
    case 'GCP':
      return 'GCP';
    case 'AZURE':
      return 'Azure';
    case 'UNKNOWN':
      return 'AWS';
    default:
      return null;
  }
};

const toIssue222ProcessStatus = (processStatus: ProcessStatus): Issue222ProcessStatus => {
  switch (processStatus) {
    case ProcessStatus.WAITING_APPROVAL:
      return 'PENDING';
    case ProcessStatus.APPLYING_APPROVED:
      return 'CONFIRMING';
    case ProcessStatus.INSTALLING:
      return 'CONFIRMED';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return 'INSTALLED';
    case ProcessStatus.CONNECTION_VERIFIED:
      return 'CONNECTED';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return 'COMPLETED';
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
    default:
      return 'IDLE';
  }
};

const getIssue222Metadata = (project: Project) => ({
  ...(project.tenantId ? { tenant_id: project.tenantId } : {}),
  ...(project.subscriptionId ? { subscription_id: project.subscriptionId } : {}),
});

const toIssue222TargetSourceDetail = (project: Project) => ({
  description: project.description,
  target_source_id: project.targetSourceId,
  process_status: toIssue222ProcessStatus(project.processStatus),
  cloud_provider: toIssue222CloudProvider(project.cloudProvider),
  created_at: project.createdAt,
  ...(Object.keys(getIssue222Metadata(project)).length > 0
    ? { metadata: getIssue222Metadata(project) }
    : {}),
});

const toTargetSourceInfoCloudProvider = (cloudProvider: CloudProvider): string =>
  toIssue222CloudProvider(cloudProvider);

const toIssue222TargetSourceInfo = (project: Project) => ({
  id: project.id,
  targetSourceId: project.targetSourceId,
  projectCode: project.projectCode,
  serviceCode: project.serviceCode,
  cloudProvider: toTargetSourceInfoCloudProvider(project.cloudProvider),
  processStatus: project.processStatus,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  name: project.name,
  description: project.description,
  isRejected: project.isRejected,
  ...(project.rejectionReason ? { rejectionReason: project.rejectionReason } : {}),
  ...(project.rejectedAt ? { rejectedAt: project.rejectedAt } : {}),
  ...(project.approvalComment ? { approvalComment: project.approvalComment } : {}),
  ...(project.approvedAt ? { approvedAt: project.approvedAt } : {}),
  ...(project.piiAgentInstalled !== undefined ? { piiAgentInstalled: project.piiAgentInstalled } : {}),
  ...(project.piiAgentConnectedAt ? { piiAgentConnectedAt: project.piiAgentConnectedAt } : {}),
  ...(project.completionConfirmedAt ? { completionConfirmedAt: project.completionConfirmedAt } : {}),
  ...(project.connectionTestHistory ? { connectionTestHistory: project.connectionTestHistory } : {}),
  ...(project.awsInstallationMode ? { awsInstallationMode: project.awsInstallationMode } : {}),
  ...(project.awsAccountId ? { awsAccountId: project.awsAccountId } : {}),
  ...(project.awsRegionType ? { awsRegionType: project.awsRegionType } : {}),
  ...(project.tenantId ? { tenantId: project.tenantId } : {}),
  ...(project.subscriptionId ? { subscriptionId: project.subscriptionId } : {}),
  ...(project.gcpProjectId ? { gcpProjectId: project.gcpProjectId } : {}),
  ...(Object.keys(getIssue222Metadata(project)).length > 0
    ? { metadata: getIssue222Metadata(project) }
    : {}),
});

export const mockTargetSources = {
  list: async (serviceCode: string) => {
    const user = getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    if (!mockServiceCodes.some((service) => service.code === serviceCode)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '해당 서비스에 대한 권한이 없습니다.' },
        { status: 403 },
      );
    }

    return NextResponse.json(
      getProjectsByServiceCode(serviceCode).map(toIssue222TargetSourceDetail),
    );
  },

  get: async (targetSourceId: string) => {
    const response = await mockProjects.get(targetSourceId);
    if (!response.ok) return response;
    const { project } = (await response.json()) as { project: Project };
    return NextResponse.json({ targetSource: toIssue222TargetSourceInfo(project) });
  },

  create: async (body: unknown) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '관리자만 타겟 소스를 등록할 수 있습니다.' },
        { status: 403 },
      );
    }

    const {
      serviceCode,
      description,
      cloudProvider,
      awsAccountId,
      awsRegionType,
      tenantId,
      subscriptionId,
      gcpProjectId,
    } = (body ?? {}) as Issue222CreateTargetSourceBody;

    const normalizedProvider = toInternalCloudProvider(cloudProvider);

    if (!serviceCode || !normalizedProvider) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '필수 필드가 누락되었습니다.' },
        { status: 400 },
      );
    }

    if (!mockServiceCodes.some((service) => service.code === serviceCode)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (awsAccountId && !/^\d{12}$/.test(awsAccountId)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'AWS Account ID는 12자리 숫자여야 합니다.' },
        { status: 400 },
      );
    }

    if (awsRegionType && !['global', 'china'].includes(awsRegionType)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'AWS 리전 타입은 global 또는 china만 허용됩니다.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const targetSourceId = generateTargetSourceId();
    const internalProjectCode = `TS-${targetSourceId}`;
    const project: Project = {
      id: generateId('target-source'),
      targetSourceId,
      projectCode: internalProjectCode,
      name: internalProjectCode,
      description: description ?? '',
      serviceCode,
      cloudProvider: normalizedProvider,
      processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
      status: createInitialProjectStatus(),
      resources: [],
      terraformState: normalizedProvider === 'AWS'
        ? { serviceTf: 'PENDING', bdcTf: 'PENDING' }
        : { bdcTf: 'PENDING' },
      createdAt: now,
      updatedAt: now,
      isRejected: false,
      ...(awsAccountId ? { awsAccountId } : {}),
      ...(awsRegionType ? { awsRegionType } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(gcpProjectId ? { gcpProjectId } : {}),
    };

    addProject(project);

    return NextResponse.json(toIssue222TargetSourceInfo(project), { status: 201 });
  },
};
