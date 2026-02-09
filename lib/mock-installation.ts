/**
 * AWS 설치 상태 관리 로직
 * - TF Role 검증
 * - N개 Service TF Script + 1 BDC TF 기반 설치 시뮬레이션
 * - 설치 상태 조회/확인
 * - TF Script 다운로드
 */

import { getStore } from '@/lib/mock-store';
import type {
  AwsInstallationStatus,
  AwsResourceType,
  VerifyTfRoleRequest,
  VerifyTfRoleResponse,
  CheckInstallationResponse,
  TerraformScriptResponse,
  ServiceTfScript,
  ServiceTfScriptResource,
  TfScriptStatus,
  ApiGuide,
  Resource,
} from '@/lib/types';

// ===== Internal type =====

type InstallationInternal = AwsInstallationStatus & {
  _scriptTimings?: Record<string, number>;
  _bdcStartedAt?: number;
};

// ===== 상수 =====

const TF_ROLE_GUIDES: Record<string, ApiGuide> = {
  ROLE_NOT_FOUND: {
    title: 'TerraformExecutionRole 생성 필요',
    steps: [
      'AWS Console에서 IAM > Roles로 이동',
      'Create role 클릭',
      'Trusted entity로 AWS account 선택',
      'Role 이름을 TerraformExecutionRole로 지정',
      '필요한 정책 연결 (AdministratorAccess 또는 커스텀)',
    ],
    documentUrl: 'https://docs.example.com/aws/tf-role-setup',
  },
  INSUFFICIENT_PERMISSIONS: {
    title: '권한 부족',
    steps: [
      'IAM > Roles에서 TerraformExecutionRole 선택',
      'Permissions 탭에서 Add permissions 클릭',
      '필요한 정책 추가: AmazonRDSFullAccess, AmazonS3FullAccess 등',
    ],
    documentUrl: 'https://docs.example.com/aws/tf-role-permissions',
  },
  ACCESS_DENIED: {
    title: 'AssumeRole 설정 필요',
    steps: [
      'IAM > Roles에서 TerraformExecutionRole 선택',
      'Trust relationships 탭 클릭',
      'Edit trust policy 클릭',
      'BDC 계정의 AssumeRole 권한 추가',
    ],
    documentUrl: 'https://docs.example.com/aws/assume-role-setup',
  },
};

const CHECK_INSTALLATION_GUIDES: Record<string, ApiGuide> = {
  VALIDATION_FAILED: {
    title: 'Terraform 리소스 검증 실패',
    steps: [
      'Terraform Script를 AWS 계정에서 실행했는지 확인',
      'terraform apply 명령이 성공적으로 완료되었는지 확인',
      '생성된 리소스가 삭제되지 않았는지 확인',
    ],
  },
  ACCESS_DENIED: {
    title: '검증 권한 없음',
    steps: [
      'ScanRole이 올바르게 설정되어 있는지 확인',
      'ScanRole에 필요한 읽기 권한이 있는지 확인',
    ],
  },
};

// ===== 시뮬레이션 설정 =====

const SCRIPT_DURATIONS: Record<string, number> = {
  VPC_ENDPOINT: 8000,
  DYNAMODB_ROLE: 6000,
  ATHENA_GLUE: 7000,
};
const VPC_STAGGER_MS = 2000;
const BDC_TF_DURATION = 5000;

// ===== TF Role 검증 =====

export const verifyTfRole = (request: VerifyTfRoleRequest): VerifyTfRoleResponse => {
  const { accountId, roleArn } = request;

  if (accountId.endsWith('000')) {
    return {
      valid: false,
      errorCode: 'ROLE_NOT_FOUND',
      errorMessage: `Account ${accountId}에서 TerraformExecutionRole을 찾을 수 없습니다.`,
      guide: TF_ROLE_GUIDES.ROLE_NOT_FOUND,
    };
  }

  if (accountId.endsWith('111')) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
      errorMessage: 'TerraformExecutionRole에 필요한 권한이 부족합니다.',
      guide: TF_ROLE_GUIDES.INSUFFICIENT_PERMISSIONS,
    };
  }

  if (accountId.endsWith('222')) {
    return {
      valid: false,
      errorCode: 'ACCESS_DENIED',
      errorMessage: 'AssumeRole 권한이 설정되지 않았습니다.',
      guide: TF_ROLE_GUIDES.ACCESS_DENIED,
    };
  }

  const resolvedRoleArn = roleArn || `arn:aws:iam::${accountId}:role/TerraformExecutionRole`;
  return {
    valid: true,
    roleArn: resolvedRoleArn,
    permissions: {
      canCreateResources: true,
      canManageIam: true,
      canAccessS3: true,
    },
  };
};

// ===== Script Generation Helpers =====

const VPC_RESOURCE_TYPES: AwsResourceType[] = ['RDS', 'RDS_CLUSTER', 'DOCUMENTDB', 'REDSHIFT', 'EC2'];

const toScriptResource = (r: Resource): ServiceTfScriptResource => ({
  resourceId: r.resourceId,
  type: r.awsType!,
  name: r.resourceId,
});

const generateServiceTfScripts = (resources: Resource[]): ServiceTfScript[] => {
  const selected = resources.filter(r => r.isSelected && r.awsType);
  const scripts: ServiceTfScript[] = [];

  // VPC_ENDPOINT scripts: group by (vpcId, region)
  const vpcResources = selected.filter(r => VPC_RESOURCE_TYPES.includes(r.awsType!));
  const vpcGroups = new Map<string, Resource[]>();
  vpcResources.forEach(r => {
    const key = `${r.vpcId ?? 'unknown'}|${r.region ?? 'unknown'}`;
    const group = vpcGroups.get(key) ?? [];
    group.push(r);
    vpcGroups.set(key, group);
  });

  let vpcIndex = 0;
  vpcGroups.forEach((group, key) => {
    const [vpcId, region] = key.split('|');
    scripts.push({
      id: `vpc-endpoint-${vpcIndex}`,
      type: 'VPC_ENDPOINT',
      status: 'PENDING',
      label: `VPC Endpoint (${vpcId})`,
      vpcId: vpcId === 'unknown' ? undefined : vpcId,
      region: region === 'unknown' ? undefined : region,
      resources: group.map(toScriptResource),
    });
    vpcIndex++;
  });

  // DYNAMODB_ROLE script: single script for all DynamoDB resources
  const dynamoResources = selected.filter(r => r.awsType === 'DYNAMODB');
  if (dynamoResources.length > 0) {
    scripts.push({
      id: 'dynamodb-role-0',
      type: 'DYNAMODB_ROLE',
      status: 'PENDING',
      label: 'DynamoDB Role',
      resources: dynamoResources.map(toScriptResource),
    });
  }

  // ATHENA_GLUE script: single script for all Athena resources
  const athenaResources = selected.filter(r => r.awsType === 'ATHENA');
  if (athenaResources.length > 0) {
    scripts.push({
      id: 'athena-glue-0',
      type: 'ATHENA_GLUE',
      status: 'PENDING',
      label: 'Athena & Glue',
      resources: athenaResources.map(toScriptResource),
    });
  }

  return scripts;
};

// ===== Computed Helper =====

const computeStatus = (
  scripts: ServiceTfScript[],
  bdcTf: { status: TfScriptStatus },
): { serviceTfCompleted: boolean; bdcTfCompleted: boolean } => ({
  serviceTfCompleted: scripts.length > 0 && scripts.every(s => s.status === 'COMPLETED'),
  bdcTfCompleted: bdcTf.status === 'COMPLETED',
});

const getScriptDuration = (script: ServiceTfScript, index: number): number => {
  const base = SCRIPT_DURATIONS[script.type] ?? 8000;
  return script.type === 'VPC_ENDPOINT' ? base + index * VPC_STAGGER_MS : base;
};

// ===== 설치 상태 관리 =====

export const initializeInstallation = (
  projectId: string,
  hasTfPermission: boolean,
): AwsInstallationStatus => {
  const store = getStore();
  const project = store.projects.find(p => p.id === projectId);
  const accountId = project?.awsAccountId ?? '000000000000';
  const resources = project?.resources ?? [];

  const serviceTfScripts = generateServiceTfScripts(resources);
  const bdcTf: AwsInstallationStatus['bdcTf'] = { status: 'PENDING' };

  const status: InstallationInternal = {
    provider: 'AWS',
    hasTfPermission,
    tfExecutionRoleArn: hasTfPermission
      ? `arn:aws:iam::${accountId}:role/TerraformExecutionRole`
      : undefined,
    serviceTfScripts,
    bdcTf,
    ...computeStatus(serviceTfScripts, bdcTf),
  };

  if (hasTfPermission) {
    const now = Date.now();
    const timings: Record<string, number> = {};
    serviceTfScripts.forEach(s => { timings[s.id] = now; });
    status._scriptTimings = timings;
  }

  store.awsInstallations.set(projectId, status);

  return {
    ...status,
    ...computeStatus(status.serviceTfScripts, status.bdcTf),
  };
};

export const getInstallationStatus = (projectId: string): AwsInstallationStatus | null => {
  const store = getStore();
  const status = store.awsInstallations.get(projectId) as InstallationInternal | undefined;
  if (!status) return null;

  // Auto mode time-based progression
  if (status.hasTfPermission && !status.completedAt && status._scriptTimings) {
    const now = Date.now();

    // Update each service TF script independently
    let vpcIndex = 0;
    status.serviceTfScripts.forEach(script => {
      const startedAt = status._scriptTimings?.[script.id];
      if (!startedAt || script.status === 'COMPLETED') {
        if (script.type === 'VPC_ENDPOINT') vpcIndex++;
        return;
      }

      const duration = getScriptDuration(script, script.type === 'VPC_ENDPOINT' ? vpcIndex : 0);
      const elapsed = now - startedAt;

      if (elapsed >= duration) {
        script.status = 'COMPLETED';
        script.completedAt = new Date().toISOString();
      } else {
        script.status = 'IN_PROGRESS';
      }

      if (script.type === 'VPC_ENDPOINT') vpcIndex++;
    });

    // When ALL service scripts are COMPLETED → start BDC TF
    const allServiceDone = status.serviceTfScripts.length > 0 &&
      status.serviceTfScripts.every(s => s.status === 'COMPLETED');

    if (allServiceDone && status.bdcTf.status === 'PENDING') {
      status.bdcTf.status = 'IN_PROGRESS';
      status._bdcStartedAt = now;
    }

    // BDC TF progression
    if (status._bdcStartedAt && status.bdcTf.status === 'IN_PROGRESS') {
      if (now - status._bdcStartedAt >= BDC_TF_DURATION) {
        status.bdcTf.status = 'COMPLETED';
        status.bdcTf.completedAt = new Date().toISOString();
        status.completedAt = new Date().toISOString();
      }
    }
  }

  const computed = computeStatus(status.serviceTfScripts, status.bdcTf);
  return { ...status, ...computed };
};

export const checkInstallation = (
  projectId: string,
  scriptId?: string,
): CheckInstallationResponse | null => {
  const store = getStore();
  const status = store.awsInstallations.get(projectId) as InstallationInternal | undefined;
  if (!status) return null;

  const now = new Date().toISOString();

  // Manual mode
  if (!status.hasTfPermission) {
    // Find target script
    const targetScript = scriptId
      ? status.serviceTfScripts.find(s => s.id === scriptId)
      : status.serviceTfScripts.find(s => s.status === 'PENDING');

    if (targetScript && targetScript.status !== 'COMPLETED') {
      if (projectId.includes('fail')) {
        targetScript.status = 'FAILED';
        targetScript.error = {
          code: 'VALIDATION_FAILED',
          message: 'Terraform 리소스를 찾을 수 없습니다.',
          guide: CHECK_INSTALLATION_GUIDES.VALIDATION_FAILED,
        };

        const computed = computeStatus(status.serviceTfScripts, status.bdcTf);
        return {
          ...status,
          ...computed,
          lastCheckedAt: now,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Terraform 리소스를 찾을 수 없습니다.',
            guide: CHECK_INSTALLATION_GUIDES.VALIDATION_FAILED,
          },
        };
      }

      targetScript.status = 'COMPLETED';
      targetScript.completedAt = new Date().toISOString();
    }

    // Check if all service scripts are now COMPLETED → start BDC TF
    const allServiceDone = status.serviceTfScripts.length > 0 &&
      status.serviceTfScripts.every(s => s.status === 'COMPLETED');

    if (allServiceDone && status.bdcTf.status === 'PENDING') {
      status.bdcTf.status = 'IN_PROGRESS';
      status._bdcStartedAt = Date.now();
    }

    // BDC TF progression
    if (status._bdcStartedAt && status.bdcTf.status === 'IN_PROGRESS') {
      if (Date.now() - status._bdcStartedAt >= BDC_TF_DURATION) {
        status.bdcTf.status = 'COMPLETED';
        status.bdcTf.completedAt = new Date().toISOString();
        status.completedAt = new Date().toISOString();
      }
    }

    status.lastCheckedAt = now;
    const computed = computeStatus(status.serviceTfScripts, status.bdcTf);
    return { ...status, ...computed, lastCheckedAt: now };
  }

  // Auto mode: delegate to time-based update
  getInstallationStatus(projectId);
  status.lastCheckedAt = now;

  const computed = computeStatus(status.serviceTfScripts, status.bdcTf);
  return { ...status, ...computed, lastCheckedAt: now };
};

// ===== TF Script Download =====

/** @deprecated Use getTerraformScriptDownload instead */
export const getTerraformScript = (projectId: string): TerraformScriptResponse | null => {
  const status = getInstallationStatus(projectId);
  if (!status || status.hasTfPermission) return null;

  const firstScript = status.serviceTfScripts[0];
  if (!firstScript) return null;

  return {
    downloadUrl: `https://storage.example.com/tf-scripts/${projectId}/${firstScript.id}.zip?token=mock-token`,
    fileName: `${firstScript.id}-${projectId}.zip`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
};

export const getTerraformScriptDownload = (
  projectId: string,
  scriptId: string,
): TerraformScriptResponse | null => {
  const status = getInstallationStatus(projectId);
  if (!status || status.hasTfPermission) return null;

  const script = status.serviceTfScripts.find(s => s.id === scriptId);
  if (!script) return null;

  return {
    downloadUrl: `https://storage.example.com/tf-scripts/${projectId}/${scriptId}.zip?token=mock-token`,
    fileName: `${scriptId}-${projectId}.zip`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
};
