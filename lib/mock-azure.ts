import { getProjectById } from '@/lib/mock-data';
import { Project, Resource } from '@/lib/types';
import {
  AzureInstallationStatus,
  AzureResourceStatus,
  AzureVmInstallationStatus,
  AzureVmStatus,
  AzureServiceSettings,
  AzureTerraformScript,
  AzureSubnetGuide,
  PrivateEndpointStatus,
} from '@/lib/types/azure';
import {
  AZURE_RESOURCE_TYPES,
  AZURE_GUIDE_URLS,
} from '@/lib/constants/azure';

// ===== 내부 상태 저장소 (개발용) =====

interface AzureStore {
  installationStatus: Record<string, AzureInstallationStatus>;
  vmInstallationStatus: Record<string, AzureVmInstallationStatus>;
  serviceSettings: Record<string, AzureServiceSettings>;
}

const azureStore: AzureStore = {
  installationStatus: {},
  vmInstallationStatus: {},
  serviceSettings: {},
};

// ===== 헬퍼 함수 =====

const isAzureProject = (project: Project): boolean => {
  return project.cloudProvider === 'Azure';
};

const isDbResource = (resource: Resource): boolean => {
  return AZURE_RESOURCE_TYPES.DB.includes(resource.type as typeof AZURE_RESOURCE_TYPES.DB[number]);
};

const isVmResource = (resource: Resource): boolean => {
  return AZURE_RESOURCE_TYPES.VM.includes(resource.type as typeof AZURE_RESOURCE_TYPES.VM[number]);
};

const generatePrivateEndpointStatus = (resourceId: string): PrivateEndpointStatus => {
  // 시뮬레이션: resourceId 해시 기반으로 상태 결정
  // NOT_REQUESTED = TF 미완료, 나머지 = TF 완료
  const hash = resourceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const statuses: PrivateEndpointStatus[] = ['NOT_REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
  return statuses[hash % statuses.length];
};

// ===== API 함수 =====

/**
 * Azure 설치 상태 조회 (DB 리소스)
 */
export const getAzureInstallationStatus = (
  projectId: string
): { data?: AzureInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return {
      error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
    };
  }

  if (!isAzureProject(project)) {
    return {
      error: { code: 'NOT_AZURE_PROJECT', message: 'Azure 프로젝트가 아닙니다.', status: 400 },
    };
  }

  // 캐시된 상태가 있으면 반환
  if (azureStore.installationStatus[projectId]) {
    return { data: azureStore.installationStatus[projectId] };
  }

  // DB 리소스만 필터링
  const dbResources = project.resources.filter(isDbResource);

  const resources: AzureResourceStatus[] = dbResources.map((resource) => {
    const peStatus = generatePrivateEndpointStatus(resource.resourceId);

    // TF 완료 여부는 privateEndpoint.status로 판단
    // - NOT_REQUESTED: TF 미완료
    // - PENDING_APPROVAL 이상: TF 완료
    return {
      resourceId: resource.resourceId,
      resourceName: resource.resourceId,
      resourceType: resource.type,
      privateEndpoint: {
        id: `pe-${resource.resourceId}`,
        name: `pe-${resource.resourceId}`,
        status: peStatus,
        requestedAt: peStatus !== 'NOT_REQUESTED' ? '2026-01-15T10:00:00Z' : undefined,
        approvedAt: peStatus === 'APPROVED' ? '2026-01-16T14:30:00Z' : undefined,
        rejectedAt: peStatus === 'REJECTED' ? '2026-01-16T14:30:00Z' : undefined,
      },
    };
  });

  // 전체 설치 완료 여부: 모든 리소스가 APPROVED일 때 true
  const installed = resources.length > 0 && resources.every(
    (r) => r.privateEndpoint.status === 'APPROVED'
  );

  const result: AzureInstallationStatus = {
    provider: 'Azure',
    installed,
    resources,
    lastCheckedAt: new Date().toISOString(),
  };

  azureStore.installationStatus[projectId] = result;
  return { data: result };
};

/**
 * Azure 설치 상태 새로고침 (DB 리소스)
 */
export const checkAzureInstallation = (
  projectId: string
): { data?: AzureInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return {
      error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
    };
  }

  if (!isAzureProject(project)) {
    return {
      error: { code: 'NOT_AZURE_PROJECT', message: 'Azure 프로젝트가 아닙니다.', status: 400 },
    };
  }

  // 캐시 삭제 후 새로 조회
  delete azureStore.installationStatus[projectId];

  // 상태 변경 시뮬레이션: 일부 PENDING -> APPROVED
  const result = getAzureInstallationStatus(projectId);

  if (result.data) {
    result.data.resources = result.data.resources.map((resource) => {
      if (resource.privateEndpoint?.status === 'PENDING_APPROVAL') {
        // 30% 확률로 승인됨으로 변경
        if (Math.random() < 0.3) {
          return {
            ...resource,
            privateEndpoint: {
              ...resource.privateEndpoint,
              status: 'APPROVED' as PrivateEndpointStatus,
              approvedAt: new Date().toISOString(),
            },
          };
        }
      }
      return resource;
    });

    // installed 재계산: 모든 리소스가 APPROVED일 때 true
    result.data.installed = result.data.resources.length > 0 && result.data.resources.every(
      (r) => r.privateEndpoint.status === 'APPROVED'
    );

    result.data.lastCheckedAt = new Date().toISOString();
    azureStore.installationStatus[projectId] = result.data;
  }

  return result;
};

/**
 * Azure VM 설치 상태 조회
 */
export const getAzureVmInstallationStatus = (
  projectId: string
): { data?: AzureVmInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return {
      error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
    };
  }

  if (!isAzureProject(project)) {
    return {
      error: { code: 'NOT_AZURE_PROJECT', message: 'Azure 프로젝트가 아닙니다.', status: 400 },
    };
  }

  // 캐시된 상태가 있으면 반환
  if (azureStore.vmInstallationStatus[projectId]) {
    return { data: azureStore.vmInstallationStatus[projectId] };
  }

  // VM 리소스만 필터링
  const vmResources = project.resources.filter(isVmResource);

  const vms: AzureVmStatus[] = vmResources.map((resource) => {
    const hash = resource.resourceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return {
      vmId: resource.resourceId,
      vmName: resource.resourceId,
      subnetExists: hash % 3 !== 0, // 66% 확률로 존재
      terraformInstalled: hash % 2 === 0, // 50% 확률로 설치됨
    };
  });

  const result: AzureVmInstallationStatus = {
    vms,
    lastCheckedAt: new Date().toISOString(),
  };

  azureStore.vmInstallationStatus[projectId] = result;
  return { data: result };
};

/**
 * Azure VM 설치 상태 새로고침
 */
export const checkAzureVmInstallation = (
  projectId: string
): { data?: AzureVmInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return {
      error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
    };
  }

  if (!isAzureProject(project)) {
    return {
      error: { code: 'NOT_AZURE_PROJECT', message: 'Azure 프로젝트가 아닙니다.', status: 400 },
    };
  }

  // 캐시 삭제 후 새로 조회
  delete azureStore.vmInstallationStatus[projectId];

  const result = getAzureVmInstallationStatus(projectId);

  if (result.data) {
    // 상태 변경 시뮬레이션: 일부 미설치 -> 설치됨
    result.data.vms = result.data.vms.map((vm) => {
      if (!vm.terraformInstalled && Math.random() < 0.3) {
        return { ...vm, terraformInstalled: true };
      }
      if (!vm.subnetExists && Math.random() < 0.2) {
        return { ...vm, subnetExists: true };
      }
      return vm;
    });

    result.data.lastCheckedAt = new Date().toISOString();
    azureStore.vmInstallationStatus[projectId] = result.data;
  }

  return result;
};

/**
 * Azure VM Terraform Script 조회
 */
export const getAzureVmTerraformScript = (
  projectId: string
): { data?: AzureTerraformScript; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return {
      error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
    };
  }

  if (!isAzureProject(project)) {
    return {
      error: { code: 'NOT_AZURE_PROJECT', message: 'Azure 프로젝트가 아닙니다.', status: 400 },
    };
  }

  // VM 리소스 확인
  const vmResources = project.resources.filter(isVmResource);
  if (vmResources.length === 0) {
    return {
      error: { code: 'NO_VM_RESOURCES', message: 'VM 리소스가 없습니다.', status: 400 },
    };
  }

  return {
    data: {
      downloadUrl: `/api/azure/projects/${projectId}/vm-terraform-script/download`,
      fileName: `terraform-${projectId}-${Date.now()}.tf`,
      generatedAt: new Date().toISOString(),
    },
  };
};

/**
 * Azure Subnet 가이드 조회
 */
export const getAzureSubnetGuide = (
  projectId: string
): { data?: AzureSubnetGuide; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return {
      error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
    };
  }

  if (!isAzureProject(project)) {
    return {
      error: { code: 'NOT_AZURE_PROJECT', message: 'Azure 프로젝트가 아닙니다.', status: 400 },
    };
  }

  return {
    data: {
      description: 'PII Agent VM이 연결될 서브넷을 구성하는 방법을 안내합니다.',
      documentUrl: AZURE_GUIDE_URLS.SUBNET_CONFIGURATION,
    },
  };
};

/**
 * Azure 서비스 설정 조회
 */
export const getAzureServiceSettings = (
  serviceCode: string
): { data?: AzureServiceSettings; error?: { code: string; message: string; status: number } } => {
  // 캐시된 설정이 있으면 반환
  if (azureStore.serviceSettings[serviceCode]) {
    return { data: azureStore.serviceSettings[serviceCode] };
  }

  // 시뮬레이션: 서비스 코드에 따라 다른 상태
  const hash = serviceCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isRegistered = hash % 2 === 0;

  const settings: AzureServiceSettings = {
    scanApp: isRegistered
      ? {
          registered: true,
          appId: `app-${serviceCode.toLowerCase()}-${hash.toString(16)}`,
          lastVerifiedAt: '2026-01-20T10:00:00Z',
          status: 'VALID',
        }
      : {
          registered: false,
        },
    guide: !isRegistered
      ? {
          description: 'Azure 스캔을 위해 Scan App을 등록해주세요.',
          documentUrl: AZURE_GUIDE_URLS.SCAN_APP_REGISTRATION,
        }
      : undefined,
  };

  azureStore.serviceSettings[serviceCode] = settings;
  return { data: settings };
};

// ===== 테스트용 유틸리티 =====

export const resetAzureStore = (): void => {
  azureStore.installationStatus = {};
  azureStore.vmInstallationStatus = {};
  azureStore.serviceSettings = {};
};

export const hasVmResources = (projectId: string): boolean => {
  const project = getProjectById(projectId);
  if (!project) return false;
  return project.resources.some(isVmResource);
};

export const hasDbResources = (projectId: string): boolean => {
  const project = getProjectById(projectId);
  if (!project) return false;
  return project.resources.some(isDbResource);
};
