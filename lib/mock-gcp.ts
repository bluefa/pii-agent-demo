import { getProjectById } from '@/lib/mock-data';
import { GCP_SERVICE_TF_RESOURCES } from '@/lib/constants/gcp';
import type { Project, Resource } from '@/lib/types';
import type {
  GcpInstallationStatus,
  GcpInstallResource,
  GcpConnectionType,
  GcpTfStatus,
  GcpPscStatus,
  GcpRegionalManagedProxyStatus,
  GcpServiceTfResources,
  GcpServiceSettings,
} from '@/lib/types/gcp';

// ===== 내부 상태 저장소 (개발용) =====

interface GcpStore {
  installationStatus: Record<string, GcpInstallationStatus>;
  proxySubnetCreated: Record<string, boolean>;
  serviceSettings: Record<string, GcpServiceSettings>;
}

const gcpStore: GcpStore = {
  installationStatus: {},
  proxySubnetCreated: {},
  serviceSettings: {},
};

// ===== 헬퍼 함수 =====

const isGcpProject = (project: Project): boolean =>
  project.cloudProvider === 'GCP';

const hashString = (str: string): number =>
  str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

const determineConnectionType = (resource: Resource): GcpConnectionType => {
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

  // PSC: 서비스 측 TF 없음 → serviceTfStatus는 자동 COMPLETED
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
    // PSC: BDC TF가 PSC Endpoint 생성 → 이후 서비스 측에서 PSC Connection 승인 필요
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

export const getGcpRegionalManagedProxy = (
  projectId: string,
  _resourceId: string
): { data?: GcpRegionalManagedProxyStatus; error?: { code: string; message: string; status: number } } => {
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

  const hash = hashString(projectId);
  const subnetKey = `${projectId}:${_resourceId}`;
  const exists = gcpStore.proxySubnetCreated[subnetKey] ?? hash % 3 !== 0;

  return {
    data: {
      exists,
      networkProjectId: `host-project-${hash % 10}`,
      vpcName: `vpc-main`,
      cloudSqlRegion: 'asia-northeast3',
      subnetName: exists ? `proxy-subnet-${projectId}` : undefined,
      subnetCidr: exists ? '10.129.0.0/23' : undefined,
    },
  };
};

export const createGcpProxySubnet = (
  projectId: string,
  resourceId: string
): { data?: { created: boolean }; error?: { code: string; message: string; status: number } } => {
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

  const subnetKey = `${projectId}:${resourceId}`;
  gcpStore.proxySubnetCreated[subnetKey] = true;

  return { data: { created: true } };
};

export const getGcpServiceTfResources = (
  _projectId: string,
  connectionType: GcpConnectionType
): { data?: GcpServiceTfResources; error?: { code: string; message: string; status: number } } => {
  const tfResources = GCP_SERVICE_TF_RESOURCES[connectionType];

  if (!tfResources) {
    return {
      error: { code: 'VALIDATION_FAILED', message: '유효하지 않은 연결 유형입니다.', status: 400 },
    };
  }

  return {
    data: {
      connectionType: tfResources.connectionType,
      resources: [...tfResources.resources],
      totalCount: tfResources.totalCount,
    },
  };
};

export const getGcpServiceSettings = (
  serviceCode: string
): { data?: GcpServiceSettings; error?: { code: string; message: string; status: number } } => {
  if (gcpStore.serviceSettings[serviceCode]) {
    return { data: gcpStore.serviceSettings[serviceCode] };
  }

  const hash = hashString(serviceCode);
  const hasScanPermission = hash % 2 === 0;
  const hasHostPermission = hash % 3 !== 0;

  const settings: GcpServiceSettings = {
    projectScanPermission: hasScanPermission,
    hostProjectPermission: hasHostPermission,
    subnetCreationRequired: hash % 4 === 0,
    guide: !hasScanPermission
      ? {
          description: 'GCP 스캔을 위해 프로젝트 권한을 등록해주세요.',
          documentUrl: 'https://docs.example.com/gcp/scan-permission',
        }
      : undefined,
  };

  gcpStore.serviceSettings[serviceCode] = settings;
  return { data: settings };
};

// ===== 테스트용 유틸리티 =====

export const resetGcpStore = (): void => {
  gcpStore.installationStatus = {};
  gcpStore.proxySubnetCreated = {};
  gcpStore.serviceSettings = {};
};
