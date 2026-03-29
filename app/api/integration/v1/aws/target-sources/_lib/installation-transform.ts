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

type TransformSource = LegacyAwsInstallationStatus | LegacyCheckInstallationResponse;

const toScriptStatus = (status: TfScriptStatus): V1ScriptStatus =>
  status === 'IN_PROGRESS' ? 'INSTALLING' : status;

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
      resource_id: resource.resourceId,
      type: resource.type,
      resource_type: resource.type,
      name: resource.name,
      installationDisplayStatus: toInstallationDisplayStatus(serviceStatus, bdcStatus),
    })),
  };
};

export const transformAwsInstallationStatus = (
  legacy: TransformSource,
): AwsInstallationStatus => {
  const bdcStatus = toScriptStatus(legacy.bdcTf.status);
  const serviceScripts = legacy.serviceTfScripts.map(script => transformServiceScript(script, bdcStatus));
  const hasCheckError = 'error' in legacy && Boolean(legacy.error);
  const lastCheck = hasCheckError
    ? { status: 'FAILED' as const, checkedAt: legacy.lastCheckedAt, failReason: legacy.error?.message }
    : legacy.lastCheckedAt
      ? { status: 'SUCCESS' as const, checkedAt: legacy.lastCheckedAt }
      : { status: 'SUCCESS' as const };

  return {
    hasExecutionPermission: legacy.hasTfPermission,
    ...(legacy.tfExecutionRoleArn && { executionRoleArn: legacy.tfExecutionRoleArn }),
    serviceScripts,
    bdcStatus: { status: bdcStatus },
    lastCheck,
    actionSummary: toActionSummary(serviceScripts, bdcStatus),
  };
};
