/**
 * Typed shapes for `bff.aws` methods.
 *
 * ADR-019 /install/v1 migration (Spec G — cloud-status). GET responses are the
 * swagger camel domain (httpBff.get runs camelCaseKeys at the one boundary);
 * the BffClient contract is the *swagger* response shape, so mocks author the
 * snake wire and the same hand-written transforms run for mock and real BFF.
 *
 * Source of truth: docs/swagger/install-v1.yaml
 *   - AwsInstallationStatusResponse (L5639)
 *   - AwsResourceInstallationStatusDto (L5650)
 *   - AwsTerraformExecutionRoleVerifyDto (L5671)
 *   - LastCheckInfoDto / CloudInstallationStepStatusDto (shared)
 *   - AwsRoleVerificationResponse (L5625)
 */

/** Shared 5-value step/installation status (swagger CloudInstallationStepStatusDto.status). */
export type CloudStepStatus =
  | 'COMPLETED'
  | 'FAIL'
  | 'IN_PROGRESS'
  | 'SKIP'
  | 'UNKNOWN';

/** Shared last-check status (swagger LastCheckInfoDto.status, 5 values). */
export type LastCheckStatus =
  | 'NEVER_CHECKED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SUCCESS';

/** swagger CloudInstallationStepStatusDto (shared per-step DTO). */
export interface CloudInstallationStepStatus {
  status: CloudStepStatus;
  guide?: string;
}

/** swagger LastCheckInfoDto (shared by AWS/Azure/GCP installation-status). */
export interface LastCheckInfo {
  status: LastCheckStatus;
  checkedAt?: string;
  failReason?: string;
}

/** swagger AwsResourceInstallationStatusDto. */
export interface AwsResourceInstallationStatus {
  resourceId: string;
  resourceName?: string;
  installationStatus: CloudStepStatus;
  serviceTerraform: CloudInstallationStepStatus;
  bdcServiceTerraform: CloudInstallationStepStatus;
  bdcCommonTerraform: CloudInstallationStepStatus;
}

/** swagger AwsTerraformExecutionRoleVerifyDto. */
export interface AwsTerraformExecutionRoleVerify {
  status: CloudStepStatus;
  roleArn?: string;
}

/** GET …/aws/installation-status — swagger AwsInstallationStatusResponse (camel domain). */
export interface AwsInstallationStatusResponse {
  lastCheck: LastCheckInfo;
  resources: AwsResourceInstallationStatus[];
  terraformExecutionRoleVerify?: AwsTerraformExecutionRoleVerify;
}

/**
 * GET /target-sources/{id}/aws/verify-{scan,execution}-role — swagger
 * `AwsRoleVerificationResponse` (camel domain). `status`/`fail_reason` are free
 * strings in the contract; the UI maps known values (ADR-019 G §G4/§G13).
 */
export interface AwsRoleVerificationResponse {
  status?: string;
  roleArn?: string;
  failReason?: string;
  failMessage?: string;
  lastVerifiedAt?: string;
}
