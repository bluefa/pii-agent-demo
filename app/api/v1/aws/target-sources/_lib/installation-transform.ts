import type {
  AwsInstallationActionSummary,
  AwsInstallationStatus,
  InstallationDisplayStatus,
  LegacyAwsInstallationStatus,
  LegacyCheckInstallationResponse,
  ServiceTfScript,
  TfScriptStatus,
  V1ScriptStatus,
  V1ServiceScript,
} from '@/lib/types';

const toScriptStatus = (status: TfScriptStatus): V1ScriptStatus =>
  status === 'IN_PROGRESS' ? 'PENDING' : status;

const toInstallationDisplayStatus = (
  serviceStatus: V1ScriptStatus,
  bdcStatus: V1ScriptStatus,
): InstallationDisplayStatus =>
  serviceStatus === 'COMPLETED' && bdcStatus === 'COMPLETED'
    ? 'COMPLETED'
    : 'NOT_INSTALLED';

const toActionSummary = (
  serviceScripts: V1ServiceScript[],
  bdcStatus: V1ScriptStatus,
): AwsInstallationActionSummary => ({
  serviceActionRequired: serviceScripts.some(script => script.status !== 'COMPLETED'),
  bdcInstallationRequired: bdcStatus !== 'COMPLETED',
});

const transformServiceScript = (
  script: ServiceTfScript,
  bdcStatus: V1ScriptStatus,
): V1ServiceScript => {
  const serviceStatus = toScriptStatus(script.status);
  return {
    scriptId: script.id,
    scriptName: script.label,
    terraformScriptName: script.label,
    status: serviceStatus,
    resourceCount: script.resources.length,
    ...(script.region && { region: script.region }),
    resources: script.resources.map(resource => ({
      resourceId: resource.resourceId,
      type: resource.type,
      name: resource.name,
      installationDisplayStatus: toInstallationDisplayStatus(serviceStatus, bdcStatus),
    })),
  };
};

export const transformAwsInstallationStatus = (
  legacy: LegacyAwsInstallationStatus,
): AwsInstallationStatus => {
  const bdcStatus = toScriptStatus(legacy.bdcTf.status);
  const serviceScripts = legacy.serviceTfScripts.map(script => transformServiceScript(script, bdcStatus));

  return {
    hasExecutionPermission: legacy.hasTfPermission,
    ...(legacy.tfExecutionRoleArn && { executionRoleArn: legacy.tfExecutionRoleArn }),
    serviceScripts,
    bdcStatus: { status: bdcStatus },
    lastCheck: legacy.lastCheckedAt
      ? { status: 'SUCCESS', checkedAt: legacy.lastCheckedAt }
      : { status: 'SUCCESS' },
    actionSummary: toActionSummary(serviceScripts, bdcStatus),
  };
};

export const transformAwsCheckInstallationStatus = (
  legacy: LegacyCheckInstallationResponse,
): AwsInstallationStatus => {
  const bdcStatus = toScriptStatus(legacy.bdcTf.status);
  const serviceScripts = legacy.serviceTfScripts.map(script => transformServiceScript(script, bdcStatus));

  return {
    hasExecutionPermission: legacy.hasTfPermission,
    ...(legacy.tfExecutionRoleArn && { executionRoleArn: legacy.tfExecutionRoleArn }),
    serviceScripts,
    bdcStatus: { status: bdcStatus },
    lastCheck: legacy.error
      ? { status: 'FAILED', checkedAt: legacy.lastCheckedAt, failReason: legacy.error.message }
      : { status: 'SUCCESS', checkedAt: legacy.lastCheckedAt },
    actionSummary: toActionSummary(serviceScripts, bdcStatus),
  };
};
