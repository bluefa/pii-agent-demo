/**
 * Typed shapes for `bff.services` methods.
 *
 * Casing (ADR-019 D1/D2): responses are snake on the wire → `camelCaseKeys`
 * at the route-handler boundary → camel domain. These BffClient result types
 * are the post-`camelCaseKeys` (camel) domain shapes.
 *
 * Source of truth: `docs/swagger/install-v1.yaml` (operationId
 * getServiceAuthorizedUsers). Spec F §4.
 */

import type { ProjectSummary } from '@/lib/types';
import type { UserInfo } from '@/lib/bff/types/users';

/**
 * GET /services/{serviceCode}/authorized-users → `AuthorizedUsersResponse` (38).
 * `UserInfo` keys are case-neutral, so `camelCaseKeys` is a no-op.
 */
export interface ServiceAuthorizedUsersResponse {
  users?: UserInfo[];
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
