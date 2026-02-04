import { getProjectById, updateProject, generateId } from '@/lib/mock-data';
import { Project, Resource, DatabaseType } from '@/lib/types';
import {
  IdcInstallationStatus,
  IdcTfStatus,
  IdcServiceSettings,
  SourceIpRecommendation,
  ConfirmFirewallResponse,
  IpType,
  IdcResourceInput,
} from '@/lib/types/idc';
import {
  IDC_SOURCE_IP_RECOMMENDATIONS,
  IDC_GUIDE_URLS,
} from '@/lib/constants/idc';

// ===== 내부 상태 저장소 (개발용) =====

interface IdcStore {
  installationStatus: Record<string, IdcInstallationStatus>;
  serviceSettings: Record<string, IdcServiceSettings>;
  resources: Record<string, IdcResourceInput[]>;
}

const idcStore: IdcStore = {
  installationStatus: {},
  serviceSettings: {},
  resources: {},
};

// ===== 에러 코드 =====

const IDC_ERROR_CODES = {
  NOT_FOUND: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.', status: 404 },
  NOT_IDC_PROJECT: { code: 'NOT_IDC_PROJECT', message: 'IDC 프로젝트가 아닙니다.', status: 400 },
  NO_RESOURCES: { code: 'NO_RESOURCES', message: '최소 1개 이상의 리소스가 필요합니다.', status: 400 },
  INVALID_IP_TYPE: { code: 'INVALID_IP_TYPE', message: '유효하지 않은 IP 타입입니다.', status: 400 },
} as const;

// ===== 헬퍼 함수 =====

const isIdcProject = (project: Project): boolean => {
  return project.cloudProvider === 'IDC';
};

const generateTfStatus = (projectId: string): IdcTfStatus => {
  // 시뮬레이션: projectId 해시 기반으로 상태 결정
  const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const statuses: IdcTfStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];
  return statuses[hash % statuses.length];
};

const generateFirewallStatus = (projectId: string): boolean => {
  // 시뮬레이션: projectId 해시 기반으로 방화벽 상태 결정
  const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 2 === 0; // 50% 확률로 오픈됨
};

// ===== API 함수 =====

/**
 * IDC 설치 상태 조회
 */
export const getIdcInstallationStatus = (
  projectId: string
): { data?: IdcInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return { error: IDC_ERROR_CODES.NOT_FOUND };
  }

  if (!isIdcProject(project)) {
    return { error: IDC_ERROR_CODES.NOT_IDC_PROJECT };
  }

  // 캐시된 상태가 있으면 반환
  if (idcStore.installationStatus[projectId]) {
    return { data: idcStore.installationStatus[projectId] };
  }

  const bdcTfStatus = generateTfStatus(projectId);
  const firewallOpened = generateFirewallStatus(projectId);

  const result: IdcInstallationStatus = {
    provider: 'IDC',
    bdcTf: bdcTfStatus,
    firewallOpened,
    lastCheckedAt: new Date().toISOString(),
  };

  idcStore.installationStatus[projectId] = result;
  return { data: result };
};

/**
 * IDC 설치 상태 새로고침
 */
export const checkIdcInstallation = (
  projectId: string
): { data?: IdcInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return { error: IDC_ERROR_CODES.NOT_FOUND };
  }

  if (!isIdcProject(project)) {
    return { error: IDC_ERROR_CODES.NOT_IDC_PROJECT };
  }

  // 캐시 삭제 후 새로 조회
  delete idcStore.installationStatus[projectId];

  // 상태 변경 시뮬레이션
  const result = getIdcInstallationStatus(projectId);

  if (result.data) {
    // IN_PROGRESS -> COMPLETED 진행 (30% 확률)
    if (result.data.bdcTf === 'IN_PROGRESS' && Math.random() < 0.3) {
      result.data.bdcTf = 'COMPLETED';
    }
    // PENDING -> IN_PROGRESS 진행 (40% 확률)
    else if (result.data.bdcTf === 'PENDING' && Math.random() < 0.4) {
      result.data.bdcTf = 'IN_PROGRESS';
    }

    result.data.lastCheckedAt = new Date().toISOString();
    idcStore.installationStatus[projectId] = result.data;
  }

  return result;
};

/**
 * 방화벽 오픈 확인 (서비스 담당자가 방화벽 오픈 후 호출)
 */
export const confirmFirewall = (
  projectId: string
): { data?: ConfirmFirewallResponse; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return { error: IDC_ERROR_CODES.NOT_FOUND };
  }

  if (!isIdcProject(project)) {
    return { error: IDC_ERROR_CODES.NOT_IDC_PROJECT };
  }

  // 설치 상태 업데이트
  const currentStatus = idcStore.installationStatus[projectId] || {
    provider: 'IDC' as const,
    bdcTf: generateTfStatus(projectId),
    firewallOpened: false,
    lastCheckedAt: new Date().toISOString(),
  };

  currentStatus.firewallOpened = true;
  currentStatus.lastCheckedAt = new Date().toISOString();
  idcStore.installationStatus[projectId] = currentStatus;

  return {
    data: {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
    },
  };
};

/**
 * Source IP 추천 조회
 */
export const getSourceIpRecommendation = (
  ipType: IpType
): { data?: SourceIpRecommendation; error?: { code: string; message: string; status: number } } => {
  const recommendation = IDC_SOURCE_IP_RECOMMENDATIONS[ipType];

  if (!recommendation) {
    return { error: IDC_ERROR_CODES.INVALID_IP_TYPE };
  }

  return {
    data: {
      sourceIps: [...recommendation.sourceIps],
      port: recommendation.port,
      description: recommendation.description,
    },
  };
};

/**
 * IDC 서비스 설정 조회
 */
export const getIdcServiceSettings = (
  serviceCode: string
): { data?: IdcServiceSettings; error?: { code: string; message: string; status: number } } => {
  // 캐시된 설정이 있으면 반환
  if (idcStore.serviceSettings[serviceCode]) {
    return { data: idcStore.serviceSettings[serviceCode] };
  }

  // 시뮬레이션: 서비스 코드에 따라 다른 상태
  const hash = serviceCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const firewallPrepared = hash % 2 === 0;

  const settings: IdcServiceSettings = {
    firewallPrepared,
    guide: !firewallPrepared
      ? {
          description: 'IDC 연동을 위해 방화벽 설정이 필요합니다.',
          documentUrl: IDC_GUIDE_URLS.FIREWALL_CONFIGURATION,
        }
      : undefined,
  };

  idcStore.serviceSettings[serviceCode] = settings;
  return { data: settings };
};

/**
 * IDC 서비스 설정 수정
 */
export const updateIdcServiceSettings = (
  serviceCode: string,
  firewallPrepared: boolean
): { data?: IdcServiceSettings; error?: { code: string; message: string; status: number } } => {
  const currentSettings = idcStore.serviceSettings[serviceCode] || {
    firewallPrepared: false,
  };

  const updatedSettings: IdcServiceSettings = {
    ...currentSettings,
    firewallPrepared,
    guide: !firewallPrepared
      ? {
          description: 'IDC 연동을 위해 방화벽 설정이 필요합니다.',
          documentUrl: IDC_GUIDE_URLS.FIREWALL_CONFIGURATION,
        }
      : undefined,
  };

  idcStore.serviceSettings[serviceCode] = updatedSettings;
  return { data: updatedSettings };
};

// ===== 리소스 관련 함수 =====

/**
 * IDC 리소스 목록 조회
 */
export const getIdcResources = (
  projectId: string
): { data?: IdcResourceInput[]; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return { error: IDC_ERROR_CODES.NOT_FOUND };
  }

  if (!isIdcProject(project)) {
    return { error: IDC_ERROR_CODES.NOT_IDC_PROJECT };
  }

  const resources = idcStore.resources[projectId] || [];
  return { data: resources };
};

/**
 * IDC 리소스 전체 저장 (임시 저장용 - 프로젝트에 반영 안 함)
 */
export const updateIdcResources = (
  projectId: string,
  resources: IdcResourceInput[]
): { data?: IdcResourceInput[]; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return { error: IDC_ERROR_CODES.NOT_FOUND };
  }

  if (!isIdcProject(project)) {
    return { error: IDC_ERROR_CODES.NOT_IDC_PROJECT };
  }

  if (resources.length === 0) {
    return { error: IDC_ERROR_CODES.NO_RESOURCES };
  }

  // 임시 저장만 (프로젝트 리소스에는 반영하지 않음)
  idcStore.resources[projectId] = resources;

  return { data: resources };
};

/**
 * IDC 연동 대상 확정 - 리소스를 프로젝트에 추가하고 단계 전이
 */
export const confirmIdcTargets = (
  projectId: string,
  resources: IdcResourceInput[]
): { data?: { confirmed: boolean; confirmedAt: string; project: Project }; error?: { code: string; message: string; status: number } } => {
  const project = getProjectById(projectId);

  if (!project) {
    return { error: IDC_ERROR_CODES.NOT_FOUND };
  }

  if (!isIdcProject(project)) {
    return { error: IDC_ERROR_CODES.NOT_IDC_PROJECT };
  }

  if (!resources || resources.length === 0) {
    return { error: IDC_ERROR_CODES.NO_RESOURCES };
  }

  // IdcResourceInput을 Resource로 변환
  const convertedResources: Resource[] = resources.map((input) => {
    const hostInfo = input.inputFormat === 'IP'
      ? (input.ips?.join(', ') || '')
      : (input.host || '');

    return {
      id: generateId('idc-res'),
      type: 'IDC',
      resourceId: `${input.name} (${hostInfo}:${input.port})`,
      connectionStatus: 'PENDING' as const,
      isSelected: true, // 확정된 리소스는 선택된 상태
      databaseType: input.databaseType as DatabaseType,
      lifecycleStatus: 'TARGET' as const,
      isNew: true,
    };
  });

  // 프로젝트 리소스 추가 및 단계 전이 (INSTALLING으로)
  const updatedProject = updateProject(projectId, {
    resources: convertedResources,
    processStatus: 3, // ProcessStatus.INSTALLING
  });

  // IDC 설치 상태 초기화
  idcStore.installationStatus[projectId] = {
    provider: 'IDC',
    bdcTf: 'PENDING',
    firewallOpened: false,
    lastCheckedAt: new Date().toISOString(),
  };

  return {
    data: {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      project: updatedProject!,
    },
  };
};

// ===== 테스트용 유틸리티 =====

export const resetIdcStore = (): void => {
  idcStore.installationStatus = {};
  idcStore.serviceSettings = {};
  idcStore.resources = {};
};

export const getIdcStore = (): IdcStore => {
  return { ...idcStore };
};
