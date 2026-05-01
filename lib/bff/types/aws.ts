/**
 * Typed shapes for `bff.aws` methods (ADR-011 setup spec adr011-01).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 */

import type {
  LegacyAwsInstallationStatus,
  LegacyCheckInstallationResponse,
  TerraformScriptResponse,
  VerifyTfRoleResponse,
} from '@/lib/types';

export type { LegacyAwsInstallationStatus, LegacyCheckInstallationResponse };

/** POST /aws/projects/{id}/check-installation (snake_case raw passthrough). */
export type AwsCheckInstallationResult = LegacyCheckInstallationResponse;

/** POST /aws/projects/{id}/installation-mode (snake_case raw passthrough). */
export interface AwsSetInstallationModeResult {
  success: boolean;
  mode?: 'AUTO' | 'MANUAL';
}

/** GET /aws/projects/{id}/installation-status. */
export type AwsInstallationStatusResponse = LegacyAwsInstallationStatus;

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
