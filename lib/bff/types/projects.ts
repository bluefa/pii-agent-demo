/**
 * Typed shapes for `bff.projects` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

import type {
  Project,
  ProjectHistory,
  ResourceExclusion,
  SecretKey,
  TerraformState,
  ConnectionTestHistory,
} from '@/lib/types';

/** GET /projects/{id} (camelCase) — mock currently wraps as `{ project }`. */
export interface ProjectGetResponse {
  project: Project;
}

/** DELETE /projects/{id} (snake_case raw passthrough). */
export interface ProjectMutationResult {
  success: boolean;
}

/** POST /projects (snake_case raw passthrough). */
export interface ProjectCreateResult {
  project: Project;
}

/** POST /projects/{id}/approve (snake_case raw passthrough). */
export interface ProjectApprovalResult {
  success: boolean;
  project?: Project;
}

/** POST /projects/{id}/reject (snake_case raw passthrough). */
export interface ProjectRejectionResult {
  success: boolean;
  project?: Project;
  reason?: string;
}

/** POST /projects/{id}/confirm-targets (snake_case raw passthrough). */
export interface ProjectConfirmTargetsResult {
  success: boolean;
  project?: Project;
  autoApproval?: { shouldAutoApprove: boolean; reason?: string };
}

/** POST /projects/{id}/complete-installation (snake_case raw passthrough). */
export interface ProjectCompleteInstallationResult {
  success: boolean;
  project?: Project;
}

/** POST /projects/{id}/confirm-completion (snake_case raw passthrough). */
export interface ProjectConfirmCompletionResult {
  project: Project;
}

/** GET /target-sources/{id}/secrets (camelCase) — list of credentials. */
export type ProjectCredentialsResponse =
  | SecretKey[]
  | { credentials: SecretKey[] };

/** GET /projects/{id}/history (camelCase). */
export interface ProjectHistoryResponse {
  history: ProjectHistory[];
  total: number;
}

/** PUT /target-sources/{id}/resources/credential (snake_case raw passthrough). */
export interface ProjectResourceCredentialResult {
  success: boolean;
  project?: Project;
}

/** GET /projects/{id}/resources/exclusions (camelCase). */
export interface ProjectResourceExclusionsResponse {
  exclusions: Array<
    {
      resourceId: string;
      resourceName: string;
      resourceType: string;
    } & Pick<ResourceExclusion, 'reason' | 'excludedAt' | 'excludedBy'>
  >;
  total: number;
}

/** GET /projects/{id}/resources (camelCase). */
export interface ProjectResourcesResponse {
  resources: Project['resources'];
}

/** POST /projects/{id}/scan (snake_case raw passthrough). */
export interface ProjectScanTriggerResult {
  success: boolean;
  newResourcesFound?: number;
  resources?: Project['resources'];
}

/** GET /projects/{id}/terraform-status (camelCase). */
export interface ProjectTerraformStatusResponse {
  terraformState: TerraformState;
}

/** POST /projects/{id}/test-connection (snake_case raw passthrough). */
export interface ProjectTestConnectionResult {
  success: boolean;
  project?: Project;
  history?: ConnectionTestHistory;
}
