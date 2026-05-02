import type {
  AwsInstallationActionSummary,
  AwsInstallationStatus,
  InstallationDisplayStatus,
  ServiceTfScript,
  TfScriptStatus,
  V1ScriptStatus,
  V1ServiceScript,
} from '@/lib/types';
import type {
  BffAwsCheckInstallationResponse,
  BffAwsInstallationStatus,
} from '@/lib/bff/types/aws';

type TransformSource = BffAwsInstallationStatus | BffAwsCheckInstallationResponse;

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
  source: TransformSource,
): AwsInstallationStatus => {
  const bdcStatus = toScriptStatus(source.bdc_tf.status);
  const serviceScripts = source.service_tf_scripts.map(script => transformServiceScript(script, bdcStatus));
  const hasCheckError = 'error' in source && Boolean(source.error);
  const lastCheck = hasCheckError
    ? { status: 'FAILED' as const, checkedAt: source.last_checked_at, failReason: source.error?.message }
    : source.last_checked_at
      ? { status: 'SUCCESS' as const, checkedAt: source.last_checked_at }
      : { status: 'SUCCESS' as const };

  return {
    hasExecutionPermission: source.has_tf_permission,
    ...(source.tf_execution_role_arn && { executionRoleArn: source.tf_execution_role_arn }),
    serviceScripts,
    bdcStatus: { status: bdcStatus },
    lastCheck,
    actionSummary: toActionSummary(serviceScripts, bdcStatus),
  };
};
