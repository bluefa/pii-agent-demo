import { getProjectByTargetSourceId } from '@/lib/mock-data';
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
  installationStatus: Record<number, GcpInstallationStatus>;
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

// [subnet, serviceTf, bdcTf] — true=활성, false=SKIP
const STEP_MATRIX: Record<string, [boolean, boolean, boolean]> = {
  'BIGQUERY:': [false, true, true],
  'CLOUD_SQL:PRIVATE_IP_MODE': [true, true, true],
  'CLOUD_SQL:PSC_MODE': [false, false, true],
  'CLOUD_SQL:BDC_PRIVATE_HOST_MODE': [false, false, false],
};

const FAIL_GUIDES = [
  'Subnet 생성에 실패했습니다. 네트워크 권한을 확인하세요.',
  'Service Terraform 적용에 실패했습니다. 로그를 확인하세요.',
  'BDC Terraform 적용에 실패했습니다. 관리자에게 문의하세요.',
];

const buildStep = (active: boolean, resourceId: string, offset: number, failGuide: string): StepStatus => {
  if (!active) return { status: 'SKIP' };
  const status = generateStepStatus(resourceId, offset);
  return { status, guide: status === 'FAIL' ? failGuide : null };
};

const buildInstallResource = (resource: Resource): GcpInstallResource => {
  const resourceSubType = determineResourceSubType(resource);
  const key = `${resource.type}:${resourceSubType ?? ''}`;
  const [subnetActive, svcActive, bdcActive] = STEP_MATRIX[key] ?? [false, false, false];

  const subnetCreation = buildStep(subnetActive, resource.resourceId, 200, FAIL_GUIDES[0]);
  const serviceTf = buildStep(svcActive, resource.resourceId, 0, FAIL_GUIDES[1]);
  const bdcTf = buildStep(bdcActive, resource.resourceId, 100, FAIL_GUIDES[2]);

  return {
    resourceId: resource.resourceId,
    resourceName: resource.resourceId,
    resourceType: resource.type as 'CLOUD_SQL' | 'BIGQUERY',
    resourceSubType: resourceSubType,
    installationStatus: deriveInstallationStatus([subnetCreation, serviceTf, bdcTf]),
    serviceSideSubnetCreation: subnetCreation,
    serviceSideTerraformApply: serviceTf,
    bdcSideTerraformApply: bdcTf,
  };
};

// ===== API 함수 =====

export const getGcpInstallationStatus = (
  targetSourceId: number
): { data?: GcpInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

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

  if (gcpStore.installationStatus[targetSourceId]) {
    return { data: gcpStore.installationStatus[targetSourceId] };
  }

  const selectedResources = project.resources.filter((r) => r.isSelected);
  const resources = selectedResources.map(buildInstallResource);

  const result: GcpInstallationStatus = {
    provider: 'GCP',
    resources,
    lastCheckedAt: new Date().toISOString(),
  };

  gcpStore.installationStatus[targetSourceId] = result;
  return { data: result };
};

export const checkGcpInstallation = (
  targetSourceId: number
): { data?: GcpInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

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

  delete gcpStore.installationStatus[targetSourceId];
  const result = getGcpInstallationStatus(targetSourceId);

  if (result.data) {
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
    gcpStore.installationStatus[targetSourceId] = result.data;
  }

  return result;
};

// ===== 테스트용 유틸리티 =====

export const resetGcpStore = (): void => {
  gcpStore.installationStatus = {};
};
