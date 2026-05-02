/**
 * Typed shapes for `bff.projects` methods (ADR-011 setup spec adr011-01).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 */

import type {
  Project,
  ProjectHistory,
  ResourceExclusion,
  SecretKey,
  TerraformState,
  ConnectionTestHistory,
} from '@/lib/types';

/** GET /projects/{id} — mock currently wraps as `{ project }`. */
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
  auto_approval?: { should_auto_approve: boolean; reason?: string };
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

/** GET /target-sources/{id}/secrets — list of credentials. */
export type ProjectCredentialsResponse =
  | SecretKey[]
  | { credentials: SecretKey[] };

/** GET /projects/{id}/history. */
export interface ProjectHistoryResponse {
  history: ProjectHistory[];
  total: number;
}

/** PUT /target-sources/{id}/resources/credential (snake_case raw passthrough). */
export interface ProjectResourceCredentialResult {
  success: boolean;
  project?: Project;
}

/** GET /projects/{id}/resources/exclusions. */
export interface ProjectResourceExclusionsResponse {
  exclusions: Array<
    {
      resource_id: string;
      resource_name: string;
      resource_type: string;
    } & Pick<ResourceExclusion, 'reason' | 'excludedAt' | 'excludedBy'>
  >;
  total: number;
}

/** GET /projects/{id}/resources. */
export interface ProjectResourcesResponse {
  resources: Project['resources'];
}

/** POST /projects/{id}/scan (snake_case raw passthrough). */
export interface ProjectScanTriggerResult {
  success: boolean;
  new_resources_found?: number;
  resources?: Project['resources'];
}

/** GET /projects/{id}/terraform-status. */
export interface ProjectTerraformStatusResponse {
  terraform_state: TerraformState;
}

/** POST /projects/{id}/test-connection (snake_case raw passthrough). */
export interface ProjectTestConnectionResult {
  success: boolean;
  project?: Project;
  history?: ConnectionTestHistory;
}
