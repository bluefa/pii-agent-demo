import { getProjectById } from '@/lib/mock-data';
import type { Project, Resource } from '@/lib/types';
import type {
  GcpTfStatus,
  GcpPscStatus,
} from '@/lib/types/gcp';

// ===== Legacy 내부 타입 (v1 route 변환용) =====

interface GcpInstallResource {
  id: string;
  name: string;
  resourceType: 'CLOUD_SQL' | 'BIGQUERY';
  connectionType: 'PRIVATE_IP' | 'PSC' | 'BIGQUERY';
  databaseType: string;
  serviceTfStatus: GcpTfStatus;
  bdcTfStatus: GcpTfStatus;
  regionalManagedProxy?: {
    exists: boolean;
    networkProjectId: string;
    vpcName: string;
    cloudSqlRegion: string;
    subnetName?: string;
    subnetCidr?: string;
  };
  pscConnection?: {
    status: GcpPscStatus;
    connectionId?: string;
    serviceAttachmentUri?: string;
    requestedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
  };
  isCompleted: boolean;
}

interface GcpInstallationStatus {
  provider: 'GCP';
  resources: GcpInstallResource[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

// ===== 내부 상태 저장소 (개발용) =====

interface GcpStore {
  installationStatus: Record<string, GcpInstallationStatus>;
}

const gcpStore: GcpStore = {
  installationStatus: {},
};

// ===== 헬퍼 함수 =====

const isGcpProject = (project: Project): boolean =>
  project.cloudProvider === 'GCP';

const hashString = (str: string): number =>
  str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

const determineConnectionType = (resource: Resource): 'PRIVATE_IP' | 'PSC' | 'BIGQUERY' => {
  if (resource.type === 'BIGQUERY') return 'BIGQUERY';
  const hash = hashString(resource.resourceId);
  return hash % 2 === 0 ? 'PRIVATE_IP' : 'PSC';
};

const generateTfStatus = (resourceId: string, offset: number): GcpTfStatus => {
  const hash = hashString(resourceId) + offset;
  const statuses: GcpTfStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED'];
  return statuses[hash % statuses.length];
};

const generatePscStatus = (resourceId: string): GcpPscStatus => {
  const hash = hashString(resourceId);
  const statuses: GcpPscStatus[] = ['NOT_REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
  return statuses[hash % statuses.length];
};

const buildInstallResource = (resource: Resource): GcpInstallResource => {
  const connectionType = determineConnectionType(resource);

  const serviceTfStatus = connectionType === 'PSC'
    ? 'COMPLETED' as GcpTfStatus
    : generateTfStatus(resource.resourceId, 0);
  const bdcTfStatus = serviceTfStatus === 'COMPLETED'
    ? generateTfStatus(resource.resourceId, 100)
    : 'PENDING';

  const base: GcpInstallResource = {
    id: resource.resourceId,
    name: resource.resourceId,
    resourceType: resource.type as 'CLOUD_SQL' | 'BIGQUERY',
    connectionType,
    databaseType: resource.databaseType,
    serviceTfStatus,
    bdcTfStatus,
    isCompleted: false,
  };

  if (connectionType === 'PRIVATE_IP') {
    const hash = hashString(resource.resourceId);
    const proxyExists = hash % 3 !== 0;
    base.regionalManagedProxy = {
      exists: proxyExists,
      networkProjectId: `host-project-${hash % 10}`,
      vpcName: `vpc-${resource.resourceId}`,
      cloudSqlRegion: 'asia-northeast3',
      subnetName: proxyExists ? `proxy-subnet-${resource.resourceId}` : undefined,
      subnetCidr: proxyExists ? '10.129.0.0/23' : undefined,
    };
    base.isCompleted = serviceTfStatus === 'COMPLETED' && bdcTfStatus === 'COMPLETED';
  } else if (connectionType === 'PSC') {
    const pscStatus = generatePscStatus(resource.resourceId);
    base.pscConnection = {
      status: pscStatus,
      connectionId: pscStatus !== 'NOT_REQUESTED' ? `psc-${resource.resourceId}` : undefined,
      serviceAttachmentUri: pscStatus !== 'NOT_REQUESTED'
        ? `projects/host-project/regions/asia-northeast3/serviceAttachments/sa-${resource.resourceId}`
        : undefined,
      requestedAt: pscStatus !== 'NOT_REQUESTED' ? '2026-01-15T10:00:00Z' : undefined,
      approvedAt: pscStatus === 'APPROVED' ? '2026-01-16T14:30:00Z' : undefined,
      rejectedAt: pscStatus === 'REJECTED' ? '2026-01-16T14:30:00Z' : undefined,
    };
    base.isCompleted = bdcTfStatus === 'COMPLETED' && pscStatus === 'APPROVED';
  } else {
    base.isCompleted = serviceTfStatus === 'COMPLETED' && bdcTfStatus === 'COMPLETED';
  }

  return base;
};

// ===== API 함수 =====

export const getGcpInstallationStatus = (
  projectId: string
): { data?: GcpInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return {
      error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
    };
  }

  if (!isGcpProject(project)) {
    return {
      error: { code: 'NOT_GCP_PROJECT', message: 'GCP 프로젝트가 아닙니다.', status: 400 },
    };
  }

  if (gcpStore.installationStatus[projectId]) {
    return { data: gcpStore.installationStatus[projectId] };
  }

  const selectedResources = project.resources.filter((r) => r.isSelected);
  const resources = selectedResources.map(buildInstallResource);

  const result: GcpInstallationStatus = {
    provider: 'GCP',
    resources,
    lastCheckedAt: new Date().toISOString(),
  };

  gcpStore.installationStatus[projectId] = result;
  return { data: result };
};

export const checkGcpInstallation = (
  projectId: string
): { data?: GcpInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return {
      error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
    };
  }

  if (!isGcpProject(project)) {
    return {
      error: { code: 'NOT_GCP_PROJECT', message: 'GCP 프로젝트가 아닙니다.', status: 400 },
    };
  }

  delete gcpStore.installationStatus[projectId];
  const result = getGcpInstallationStatus(projectId);

  if (result.data) {
    result.data.resources = result.data.resources.map((resource) => {
      if (resource.serviceTfStatus === 'IN_PROGRESS' && Math.random() < 0.4) {
        return { ...resource, serviceTfStatus: 'COMPLETED' as GcpTfStatus };
      }
      if (resource.bdcTfStatus === 'PENDING' && resource.serviceTfStatus === 'COMPLETED' && Math.random() < 0.3) {
        return { ...resource, bdcTfStatus: 'IN_PROGRESS' as GcpTfStatus };
      }
      if (resource.pscConnection?.status === 'PENDING_APPROVAL' && Math.random() < 0.3) {
        return {
          ...resource,
          pscConnection: {
            ...resource.pscConnection,
            status: 'APPROVED' as GcpPscStatus,
            approvedAt: new Date().toISOString(),
          },
        };
      }
      return resource;
    });

    result.data.lastCheckedAt = new Date().toISOString();
    gcpStore.installationStatus[projectId] = result.data;
  }

  return result;
};

// ===== 테스트용 유틸리티 =====

export const resetGcpStore = (): void => {
  gcpStore.installationStatus = {};
};
