import { getProjectById } from '@/lib/mock-data';
import type { Project, Resource } from '@/lib/types';

// ===== Step 상태 타입 (내부용) =====

type StepStatusValue = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'SKIP';

interface StepStatus {
  status: StepStatusValue;
  guide?: string | null;
}

type ResourceSubType = 'PRIVATE_IP_MODE' | 'BDC_PRIVATE_HOST_MODE' | 'PSC_MODE';
type InstallationStatus = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS';

interface GcpInstallResource {
  resourceId: string;
  resourceName: string;
  resourceType: 'CLOUD_SQL' | 'BIGQUERY';
  resourceSubType: ResourceSubType | null;
  installationStatus: InstallationStatus;
  serviceSideSubnetCreation: StepStatus;
  serviceSideTerraformApply: StepStatus;
  bdcSideTerraformApply: StepStatus;
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

const determineResourceSubType = (resource: Resource): ResourceSubType | null => {
  if (resource.type === 'BIGQUERY') return null;
  const hash = hashString(resource.resourceId);
  const subTypes: ResourceSubType[] = ['PRIVATE_IP_MODE', 'BDC_PRIVATE_HOST_MODE', 'PSC_MODE'];
  return subTypes[hash % subTypes.length];
};

const generateStepStatus = (resourceId: string, offset: number): StepStatusValue => {
  const hash = hashString(resourceId) + offset;
  const statuses: StepStatusValue[] = ['IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'FAIL', 'COMPLETED'];
  return statuses[hash % statuses.length];
};

const deriveInstallationStatus = (steps: StepStatus[]): InstallationStatus => {
  const active = steps.filter(s => s.status !== 'SKIP');
  if (active.length === 0) return 'COMPLETED';
  if (active.every(s => s.status === 'COMPLETED')) return 'COMPLETED';
  if (active.some(s => s.status === 'FAIL')) return 'FAIL';
  return 'IN_PROGRESS';
};

const buildInstallResource = (resource: Resource): GcpInstallResource => {
  const resourceSubType = determineResourceSubType(resource);

  // Step 활성화 매트릭스 적용
  let subnetCreation: StepStatus;
  let serviceTf: StepStatus;
  let bdcTf: StepStatus;

  if (resource.type === 'BIGQUERY') {
    // BIGQUERY: subnet=SKIP, serviceTF=활성, bdcTF=활성
    subnetCreation = { status: 'SKIP' };
    serviceTf = { status: generateStepStatus(resource.resourceId, 0), guide: null };
    bdcTf = { status: generateStepStatus(resource.resourceId, 100), guide: null };
  } else if (resourceSubType === 'PRIVATE_IP_MODE') {
    // CLOUD_SQL/PRIVATE_IP_MODE: 전부 활성
    subnetCreation = { status: generateStepStatus(resource.resourceId, 200), guide: null };
    serviceTf = { status: generateStepStatus(resource.resourceId, 0), guide: null };
    bdcTf = { status: generateStepStatus(resource.resourceId, 100), guide: null };
  } else if (resourceSubType === 'PSC_MODE') {
    // CLOUD_SQL/PSC_MODE: subnet=SKIP, serviceTF=SKIP, bdcTF=활성
    subnetCreation = { status: 'SKIP' };
    serviceTf = { status: 'SKIP' };
    bdcTf = { status: generateStepStatus(resource.resourceId, 100), guide: null };
  } else {
    // CLOUD_SQL/BDC_PRIVATE_HOST_MODE: 전부 SKIP
    subnetCreation = { status: 'SKIP' };
    serviceTf = { status: 'SKIP' };
    bdcTf = { status: 'SKIP' };
  }

  // FAIL 상태에 guide 텍스트 추가
  if (subnetCreation.status === 'FAIL') {
    subnetCreation.guide = 'Subnet 생성에 실패했습니다. 네트워크 권한을 확인하세요.';
  }
  if (serviceTf.status === 'FAIL') {
    serviceTf.guide = 'Service Terraform 적용에 실패했습니다. 로그를 확인하세요.';
  }
  if (bdcTf.status === 'FAIL') {
    bdcTf.guide = 'BDC Terraform 적용에 실패했습니다. 관리자에게 문의하세요.';
  }

  const steps = [subnetCreation, serviceTf, bdcTf];

  return {
    resourceId: resource.resourceId,
    resourceName: resource.resourceId,
    resourceType: resource.type as 'CLOUD_SQL' | 'BIGQUERY',
    resourceSubType: resourceSubType,
    installationStatus: deriveInstallationStatus(steps),
    serviceSideSubnetCreation: subnetCreation,
    serviceSideTerraformApply: serviceTf,
    bdcSideTerraformApply: bdcTf,
  };
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
    // 랜덤 진행: IN_PROGRESS → COMPLETED
    result.data.resources = result.data.resources.map((resource) => {
      const updated = { ...resource };
      const advanceStep = (step: StepStatus): StepStatus => {
        if (step.status === 'IN_PROGRESS' && Math.random() < 0.4) {
          return { status: 'COMPLETED', guide: null };
        }
        return step;
      };
      updated.serviceSideSubnetCreation = advanceStep(resource.serviceSideSubnetCreation);
      updated.serviceSideTerraformApply = advanceStep(resource.serviceSideTerraformApply);
      updated.bdcSideTerraformApply = advanceStep(resource.bdcSideTerraformApply);
      updated.installationStatus = deriveInstallationStatus([
        updated.serviceSideSubnetCreation,
        updated.serviceSideTerraformApply,
        updated.bdcSideTerraformApply,
      ]);
      return updated;
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
