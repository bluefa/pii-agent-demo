import type { AwsInstallationStatus, V1ScriptStatus, V1ServiceScript } from '@/lib/types';
import type { InstallTaskStatus } from '@/lib/constants/install-task';
import type { InstallTaskPipelineItem } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';

// ===== AWS install task copy (v15 markup, verbatim) =====

export const AWS_INSTALL_TITLES = {
  awsTfPermission: 'Terraform 권한 부여 확인',
  awsServiceResources: '서비스 측 계정에 리소스 생성',
  awsServiceTerraform: '서비스 측 Terraform 생성',
  awsBdcResources: 'BDC 측 리소스 생성',
} as const;

export const AWS_INSTALL_SUBS = {
  awsTfPermission:
    '대상 AWS 계정에 Terraform 실행을 위한 IAM Role / AssumeRole 권한이 부여되었는지 검증',
  awsServiceResources:
    '서비스 AWS 계정에 Private Endpoint / IAM Role / Glue Policy 설정 등을 Terraform으로 자동 배포 중',
  awsServiceTerraform:
    '서비스 AWS 계정에 Private Endpoint / IAM Role / Glue Policy 설정 등을 사용자가 직접 Terraform으로 적용',
  awsBdcResources:
    'BDC 계정에 Private Endpoint Service / IAM Role 설정 등을 Terraform으로 자동 배포 중',
} as const;

// ===== Script status → card status =====

const SCRIPT_TO_CARD_STATUS: Record<V1ScriptStatus, InstallTaskStatus> = {
  COMPLETED: 'done',
  INSTALLING: 'running',
  FAILED: 'failed',
  PENDING: 'pending',
};

export const mapScriptStatus = (s: V1ScriptStatus): InstallTaskStatus =>
  SCRIPT_TO_CARD_STATUS[s];

// ===== Service script aggregation =====

export interface AwsServiceScriptsSummary {
  status: InstallTaskStatus;
  completedCount: number;
  activeCount: number;
}

// Same aggregation algorithm as getGcpStepSummary: every script is active,
// any FAILED wins, all-COMPLETED is done, partial progress is running.
export const aggregateServiceScripts = (
  scripts: V1ServiceScript[],
): AwsServiceScriptsSummary => {
  const activeCount = scripts.length;
  let completedCount = 0;
  let hasFailed = false;
  let hasInstalling = false;

  for (const script of scripts) {
    if (script.status === 'COMPLETED') completedCount++;
    else if (script.status === 'FAILED') hasFailed = true;
    else if (script.status === 'INSTALLING') hasInstalling = true;
  }

  let status: InstallTaskStatus;
  if (activeCount === 0) status = 'pending';
  else if (hasFailed) status = 'failed';
  else if (completedCount === activeCount) status = 'done';
  else if (hasInstalling || completedCount > 0) status = 'running';
  else status = 'pending';

  return { status, completedCount, activeCount };
};

// ===== Pipeline builders =====

const permissionCardStatus = (status: AwsInstallationStatus): InstallTaskStatus => {
  if (status.hasExecutionPermission) return 'done';
  return status.lastCheck.status === 'IN_PROGRESS' ? 'running' : 'pending';
};

// Auto mode: 3 non-clickable cards (permission check → service → BDC).
export const buildAwsAutoItems = (
  status: AwsInstallationStatus,
): InstallTaskPipelineItem[] => {
  const service = aggregateServiceScripts(status.serviceScripts);
  return [
    {
      key: 'awsTfPermission',
      title: AWS_INSTALL_TITLES.awsTfPermission,
      sub: AWS_INSTALL_SUBS.awsTfPermission,
      status: permissionCardStatus(status),
    },
    {
      key: 'awsServiceResources',
      title: AWS_INSTALL_TITLES.awsServiceResources,
      sub: AWS_INSTALL_SUBS.awsServiceResources,
      status: service.status,
      completedCount: service.completedCount,
      activeCount: service.activeCount,
    },
    {
      key: 'awsBdcResources',
      title: AWS_INSTALL_TITLES.awsBdcResources,
      sub: AWS_INSTALL_SUBS.awsBdcResources,
      status: mapScriptStatus(status.bdcStatus.status),
    },
  ];
};

// Manual mode: 2 cards (cols-2), no permission card.
export const buildAwsManualItems = (
  status: AwsInstallationStatus,
): InstallTaskPipelineItem[] => {
  const service = aggregateServiceScripts(status.serviceScripts);
  return [
    {
      key: 'awsServiceTerraform',
      title: AWS_INSTALL_TITLES.awsServiceTerraform,
      sub: AWS_INSTALL_SUBS.awsServiceTerraform,
      status: service.status,
      completedCount: service.completedCount,
      activeCount: service.activeCount,
    },
    {
      key: 'awsBdcResources',
      title: AWS_INSTALL_TITLES.awsBdcResources,
      sub: AWS_INSTALL_SUBS.awsBdcResources,
      status: mapScriptStatus(status.bdcStatus.status),
    },
  ];
};
