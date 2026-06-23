/**
 * Typed shapes for `bff.azure` methods.
 *
 * ADR-019 /install/v1 migration (Spec G — cloud-status). GET responses are the
 * swagger camel domain (httpBff.get runs camelCaseKeys at the one boundary),
 * except `getScanApp` which is a sanctioned snake passthrough (Issue #222,
 * `getSnakeRaw`). Mocks author the snake wire so mock == swagger == real BFF.
 *
 * Source of truth: docs/swagger/install-v1.yaml
 *   - AzureInstallationStatusResponse (L5587) + AzureResourceStatus / PrivateEndpointDetail / VmInstallationDetail
 *   - AzureServicePrincipalVerificationResponse (scan-app, snake passthrough)
 *   - AzureHealthCheckResult (L5754) + AzurePrivateLinkHealthResult (G8, wire already camel)
 */

import type { AzureSubnetGuide } from '@/lib/types/azure';
import type { LastCheckInfo } from '@/lib/bff/types/aws';

/** swagger PrivateEndpointDetail (status is a free string, not an enum). */
export interface PrivateEndpointDetail {
  id?: string;
  name?: string;
  status?: string;
}

/**
 * swagger VmInstallationDetail. `load_balancer` is a bare `type: object` (no
 * declared props) — kept opaque per ADR-019 D2.3 (camelCaseKeys must not
 * rewrite inner keys; they may be Azure-supplied data keys).
 */
export interface VmInstallationDetail {
  subnetExists?: boolean;
  loadBalancer?: Record<string, unknown>;
}

/** swagger AzureResourceStatus. */
export interface AzureResourceStatus {
  resourceId: string;
  resourceName?: string;
  resourceType?: string;
  privateEndpoint?: PrivateEndpointDetail;
  vmInstallation?: VmInstallationDetail;
}

/** GET …/azure/installation-status — swagger AzureInstallationStatusResponse (camel domain). */
export interface AzureInstallationStatusResponse {
  lastCheck: LastCheckInfo;
  resources?: AzureResourceStatus[];
}

/** GET …/azure/subnet-guide (camelCase). */
export type AzureSubnetGuideResponse = AzureSubnetGuide;

/**
 * GET /target-sources/{id}/azure/scan-app.
 * Issue #222 contract: snake_case raw passthrough (route returns the upstream
 * payload verbatim via getSnakeRaw). Exception to the GET-camelCase rule.
 */
export interface AzureScanAppResponse {
  app_id: string | null;
  status: string;
  fail_reason?: string | null;
  fail_message?: string | null;
  last_verified_at?: string | null;
}

/**
 * GET /infra/target-sources/{id}/azure-private-link-health-check (G8).
 * Wire is already camelCase in swagger (camelCaseKeys is a no-op). `status`
 * 9-value enum; `resourceType` is the large cross-cloud resource enum.
 */
export type AzureHealthCheckStatus =
  | 'HEALTHY'
  | 'UPDATING'
  | 'UNHEALTHY'
  | 'UNHEALTHY_NEED_SERVICE_ACTION'
  | 'UNHEALTHY_NEED_BDC_SIDE_ACTION'
  | 'NEED_TERRAFORM_EXECUTION'
  | 'NEED_SCAN_PERMISSION'
  | 'INTERNAL_SERVER_ERROR'
  | 'EMPTY';

/** swagger AzurePrivateLinkHealthResult.resourceType (verbatim cross-cloud enum). */
export type HealthCheckResourceType =
  | 'AWS_ATHENA'
  | 'AWS_ATHENA_DATABASE'
  | 'AWS_DB_CLUSTER'
  | 'AWS_DB_INSTANCE'
  | 'AWS_REDSHIFT_CLUSTER'
  | 'AWS_DYNAMO_DB_REGION'
  | 'AWS_DYNAMO_DB_TABLE'
  | 'AWS_DYNAMO_DB_GLOBAL_TABLE'
  | 'AWS_NETWORK_INTERFACE'
  | 'AWS_SUBNET'
  | 'AWS_RDS_GLOBAL_CLUSTER'
  | 'AWS_RDS_SUBNET_GROUP'
  | 'AWS_RDS_PROXY'
  | 'AWS_RDS_DB_CLUSTER_PARAMETER_GROUP'
  | 'AWS_RDS_DB_PARAMETER_GROUP'
  | 'AWS_REDSHIFT_SUBNET_GROUP'
  | 'AWS_VPC_ENDPOINT_SERVICE'
  | 'AWS_VPC_ENDPOINT'
  | 'AWS_VPC_SECURITY_GROUP'
  | 'AWS_IAM_ROLE'
  | 'AWS_GLUE_RESOURCE_POLICY'
  | 'AWS_ECR_POLICY'
  | 'AWS_S3_BUCKET_POLICY'
  | 'AWS_GLUE_TABLE'
  | 'AWS_EC2_INSTANCE'
  | 'AWS_EC2_REGION'
  | 'AWS_OPEN_SEARCH_DOMAIN'
  | 'AWS_KMS'
  | 'AWS_AUTO_SCALING_GROUP'
  | 'AZURE_SQL_SERVER'
  | 'AZURE_SQL_SERVER_MANAGED_INSTANCE'
  | 'AZURE_MYSQL_FLEXIBLE_SERVER'
  | 'AZURE_MYSQL'
  | 'AZURE_POSTGRESQL'
  | 'AZURE_POSTGRESQL_FLEXIBLE_SERVER'
  | 'AZURE_MARIADB'
  | 'AZURE_COSMOSDB_NOSQL'
  | 'AZURE_SERVICE_PRINCIPAL'
  | 'AZURE_PRIVATE_ENDPOINT'
  | 'AZURE_VIRTUAL_MACHINE'
  | 'AZURE_VIRTUAL_SUBNET'
  | 'AZURE_SYNAPSE_WORKSPACE'
  | 'AZURE_NETWORK_INTERFACE'
  | 'GCP_SQL'
  | 'GCP_BIGQUERY_DATASET_REGION'
  | 'GCP_VPC_NETWORK'
  | 'IDC_RESOURCE';

/** swagger AzurePrivateLinkHealthResult. */
export interface AzurePrivateLinkHealthResult {
  provisioningState?: string;
  resourceId?: string;
  privateLinkId?: string;
  resourceType?: HealthCheckResourceType;
  healthCheckStatus?: AzureHealthCheckStatus;
}

/** GET …/azure-private-link-health-check — swagger AzureHealthCheckResult (camel domain). */
export interface AzureHealthCheckResult {
  healthCheckStatus?: AzureHealthCheckStatus;
  azurePrivateLinkHealthResultList?: AzurePrivateLinkHealthResult[];
}

// REMOVED-no-swagger: azure vm/* (check-installation, vm/installation-status,
// vm/terraform-script) are absent from install-v1.yaml. vm_installation is
// embedded in AzureInstallationStatusResponse; the legacy VM merge is dropped.
