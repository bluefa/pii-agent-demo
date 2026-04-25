/**
 * Typed shapes for `bff.services` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

import type { ProjectSummary, User } from '@/lib/types';
import type { LegacyAzureSettings } from '@/lib/bff/types/azure';

/** GET /services/{code}/authorized-users (camelCase). */
export interface ServiceAuthorizedUsersResponse {
  users: User[];
}

/** POST /services/{code}/authorized-users (snake_case raw passthrough). */
export interface ServicePermissionAddResult {
  success: boolean;
}

/** DELETE /services/{code}/authorized-users/{userId} (snake_case raw passthrough). */
export interface ServicePermissionRemoveResult {
  success: boolean;
}

/** GET /services/{code}/projects (camelCase). */
export interface ServiceProjectsResponse {
  projects: ProjectSummary[];
}

/** GET /services/{code}/settings/aws (camelCase) — legacy passthrough w/ scanRole. */
export interface LegacyAwsServiceSettings {
  accountId?: string;
  scanRole: {
    registered: boolean;
    roleArn?: string;
    lastVerifiedAt?: string;
    status?: string;
  };
  guide?: unknown;
}

export type ServiceSettingsAwsResponse = LegacyAwsServiceSettings;

/** PUT /services/{code}/settings/aws (snake_case raw passthrough). */
export interface ServiceSettingsAwsUpdateResult {
  updated: boolean;
  account_id?: string;
  scan_role?: {
    registered: boolean;
    role_arn?: string;
    status?: string;
  };
}

/** POST /services/{code}/settings/aws/verify-scan-role (snake_case raw passthrough). */
export interface ServiceSettingsAwsVerifyScanRoleResult {
  valid: boolean;
  role_arn?: string;
  verified_at?: string;
  error_code?: string;
  error_message?: string;
}

/** GET /services/{code}/settings/azure (camelCase). */
export type ServiceSettingsAzureResponse = LegacyAzureSettings;
