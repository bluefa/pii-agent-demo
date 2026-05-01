/**
 * Typed shapes for `bff.services` methods (ADR-011 setup spec adr011-01).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 */

import type { ProjectSummary, User } from '@/lib/types';

/** GET /services/{code}/authorized-users. */
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

/** GET /services/{code}/projects. */
export interface ServiceProjectsResponse {
  projects: ProjectSummary[];
}

/** GET /services/{code}/settings/aws — legacy passthrough w/ scanRole. */
export interface LegacyAwsServiceSettings {
  account_id?: string;
  scan_role: {
    registered: boolean;
    role_arn?: string;
    last_verified_at?: string;
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
