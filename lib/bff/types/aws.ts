/**
 * Typed shapes for `bff.aws` methods.
 *
 * Responses are snake_case at the BFF boundary (see ADR-014). The route
 * layer maps these into the camelCase v1 public API via `installation-transform.ts`.
 */

import type {
  ServiceTfScript,
  TerraformScriptResponse,
  TfScriptError,
  TfScriptStatus,
  VerifyTfRoleResponse,
} from '@/lib/types';

/**
 * BFF wire shape for AWS installation status (snake_case). Built from the
 * legacy `LegacyAwsInstallationStatus` (camelCase, lib/types.ts) which mocks
 * still produce internally — `mockBff.unwrap` snake_cases the keys at the
 * boundary to match this contract.
 */
export interface BffAwsInstallationStatus {
  provider: 'AWS';
  has_tf_permission: boolean;
  tf_execution_role_arn?: string;
  service_tf_scripts: ServiceTfScript[];
  bdc_tf: {
    status: TfScriptStatus;
    completed_at?: string;
    error?: TfScriptError;
  };
  service_tf_completed: boolean;
  bdc_tf_completed: boolean;
  completed_at?: string;
  last_checked_at?: string;
}

export interface BffAwsCheckInstallationResponse extends BffAwsInstallationStatus {
  last_checked_at: string;
  error?: TfScriptError;
}

/** POST /aws/projects/{id}/check-installation. */
export type AwsCheckInstallationResult = BffAwsCheckInstallationResponse;

/** POST /aws/projects/{id}/installation-mode. */
export interface AwsSetInstallationModeResult {
  success: boolean;
  mode?: 'AUTO' | 'MANUAL';
}

/** GET /aws/projects/{id}/installation-status. */
export type AwsInstallationStatusResponse = BffAwsInstallationStatus;

/** GET /aws/projects/{id}/terraform-script. */
export type AwsTerraformScriptResponse = TerraformScriptResponse;

/** POST /aws/verify-tf-role (snake_case raw passthrough). */
export type AwsVerifyTfRoleResult = VerifyTfRoleResponse;

/** POST /aws/projects/{id}/installation-mode request body. */
export interface AwsSetInstallationModeBody {
  mode: 'AUTO' | 'MANUAL';
}

/**
 * POST /aws/verify-tf-role request body.
 *
 * Request bodies are out of ADR-014 scope (see §"미해결 사항 O2"); fields
 * remain camelCase to match the upstream BFF wire format and the frontend.
 */
export interface AwsVerifyTfRoleBody {
  roleArn?: string;
  accountId?: string;
}
