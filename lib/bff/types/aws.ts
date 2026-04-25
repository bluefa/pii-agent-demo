/**
 * Typed shapes for `bff.aws` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
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

/** GET /aws/projects/{id}/installation-status (camelCase). */
export type AwsInstallationStatusResponse = LegacyAwsInstallationStatus;

/** GET /aws/projects/{id}/terraform-script (camelCase). */
export type AwsTerraformScriptResponse = TerraformScriptResponse;

/** POST /aws/verify-tf-role (snake_case raw passthrough). */
export type AwsVerifyTfRoleResult = VerifyTfRoleResponse;

/** POST /aws/projects/{id}/installation-mode request body. */
export interface AwsSetInstallationModeBody {
  mode: 'AUTO' | 'MANUAL';
}

/** POST /aws/verify-tf-role request body. */
export interface AwsVerifyTfRoleBody {
  roleArn?: string;
  accountId?: string;
}
