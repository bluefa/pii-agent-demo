/**
 * Pipeline Orchestrator wire types (LIN-25 Phase A — BFF proxy layer).
 *
 * These mirror the upstream `pipeline-orchestrator` (Spring Boot) DTO
 * serialization EXACTLY: snake_case field names, enums as constant names,
 * Instants/Durations as ISO-8601 strings. The BFF proxies these verbatim
 * (no camelCase conversion), so the shapes here are the browser-facing contract.
 *
 * Source of truth: pipeline-orchestrator `com.bff.pipeline.dto.pipeline.*` +
 * `com.bff.pipeline.enums.*`. See docs/api/pipeline-orchestrator-bff.md.
 *
 * Timestamps/durations stay `string` (hard gate — never `Date`).
 */

// ---------------------------------------------------------------------------
// Enums (wire = constant names; StatisticsPeriod uses tokens 1h/1d/7d)
// ---------------------------------------------------------------------------

export type PipelineStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';

export type PipelineType = 'INSTALL' | 'DELETE' | 'CUSTOM';

export type TaskStatus =
  | 'BLOCKED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED';

export type CloudProvider = 'AWS' | 'GCP' | 'AZURE' | 'IDC';

export type ErrorCode =
  | 'JOB_FAILED'
  | 'EXECUTION_TIMEOUT'
  | 'CONDITION_NOT_MET'
  | 'CHECK_ERROR'
  | 'CALL_TIMEOUT'
  | 'UNKNOWN_TASK';

/** Task execution mechanism = task type name (`kind`). */
export type TaskKind = 'TERRAFORM_JOB' | 'CONDITION_CHECK';

/** Statistics window token (wire value of StatisticsPeriod via @JsonValue). */
export type StatisticsPeriodToken = '1h' | '1d' | '7d';

/**
 * TaskOperation (25) — the domain action a task performs. 8 execution units ×
 * {PLAN,APPLY,DESTROY} + NETWORK_READY (condition check).
 */
export type TaskOperation =
  | 'AWS_SERVICE_TF_PLAN'
  | 'AWS_SERVICE_TF_APPLY'
  | 'AWS_SERVICE_TF_DESTROY'
  | 'AWS_BDC_COMMON_TF_PLAN'
  | 'AWS_BDC_COMMON_TF_APPLY'
  | 'AWS_BDC_COMMON_TF_DESTROY'
  | 'AWS_BDC_SERVICE_LEVEL_TF_PLAN'
  | 'AWS_BDC_SERVICE_LEVEL_TF_APPLY'
  | 'AWS_BDC_SERVICE_LEVEL_TF_DESTROY'
  | 'GCP_SERVICE_TF_PLAN'
  | 'GCP_SERVICE_TF_APPLY'
  | 'GCP_SERVICE_TF_DESTROY'
  | 'GCP_BDC_TF_PLAN'
  | 'GCP_BDC_TF_APPLY'
  | 'GCP_BDC_TF_DESTROY'
  | 'AZURE_BDC_TF_PLAN'
  | 'AZURE_BDC_TF_APPLY'
  | 'AZURE_BDC_TF_DESTROY'
  | 'IDC_CX_TF_PLAN'
  | 'IDC_CX_TF_APPLY'
  | 'IDC_CX_TF_DESTROY'
  | 'IDC_BDP_TF_PLAN'
  | 'IDC_BDP_TF_APPLY'
  | 'IDC_BDP_TF_DESTROY'
  | 'NETWORK_READY';

// ---------------------------------------------------------------------------
// Pipeline / task views
// ---------------------------------------------------------------------------

/** Pipeline summary row (list / history / latest card). #3 #7 #8 content. */
export interface PipelineSummary {
  pipeline_id: number;
  type: PipelineType;
  target_source_id: string;
  /** Owning service — assumed addition to #3 (dashboard search filters on it). */
  service_code: string;
  service_name: string;
  cloud_provider: CloudProvider;
  /** RecipeDefinition constant name; null for CUSTOM pipelines (no catalog recipe). */
  recipe_definition: string | null;
  status: PipelineStatus;
  done_task_count: number;
  total_task_count: number;
  created_at: string;
  last_activity_at: string;
}

/** One task-flow node in a pipeline detail (`tasks[]`). */
export interface TaskSummary {
  task_id: number;
  sequence: number;
  kind: TaskKind;
  task_definition: string;
  operation: TaskOperation | null;
  status: TaskStatus;
  fail_count: number;
  /** Only populated when status === 'FAILED'. */
  error_code: ErrorCode | null;
  consumes_terraform_slot: boolean | null;
  started_at: string | null;
  finished_at: string | null;
  /** Custom-recipe operator description; null for catalog tasks. */
  description: string | null;
}

/** Pipeline detail (#4 / #6 / #10 response). */
export interface PipelineDetail {
  pipeline_id: number;
  type: PipelineType;
  target_source_id: string;
  cloud_provider: CloudProvider;
  /** RecipeDefinition constant name; null for CUSTOM pipelines (no catalog recipe). */
  recipe_definition: string | null;
  status: PipelineStatus;
  created_at: string;
  last_activity_at: string;
  next_due_at: string | null;
  leased: boolean;
  cancel_requested: boolean;
  due_lag_millis: number;
  current_task_sequence: number | null;
  final_task_sequence: number | null;
  current_fail_count: number | null;
  current_max_fail_count: number | null;
  done_task_count: number;
  total_task_count: number;
  tasks: TaskSummary[];
}

/**
 * TaskDefinition catalog execution-contract view. Serialized NON_NULL upstream:
 * `dispatch_api`/`result_api` are OMITTED for CONDITION_CHECK entries.
 */
export interface TaskDefinitionView {
  name: string;
  display_name: string;
  description: string;
  dispatch_api?: string;
  status_api: string;
  result_api?: string;
  success_policy: string;
  result_storage: string;
}

/** Poll-phase summary of a single attempt (nullable). */
export interface TaskCheckView {
  call_count: number;
  not_met_count: number;
  api_error_count: number;
  call_timeout_count: number;
  last_external_status: string | null;
  last_checked_at: string | null;
}

/**
 * Per-job terminal result, inlined on a TERRAFORM_JOB attempt. Recorded only at
 * the judgment-terminal turn (one row per job). `has_body` false = the result
 * exists but its log body was not collected. Empty for CONDITION_CHECK.
 */
export interface TerraformJobResultSummary {
  job_id: string;
  succeeded: boolean | null;
  truncated: boolean;
  has_body: boolean;
  created_at: string;
}

/**
 * Per-job last-observed state, inlined on a TERRAFORM_JOB attempt. `last_state`
 * is the raw external terraformState string (never re-encoded); null when the
 * last poll of this job errored before returning a state. Empty for
 * CONDITION_CHECK. Derive the job list from `terraform_results ∪ job_states`
 * (join on job_id) — never parse `response`.
 */
export interface TerraformJobStateSummary {
  job_id: string;
  last_state: string | null;
  last_fail_reason: string | null;
  last_error: string | null;
  poll_count: number;
  last_polled_at: string | null;
}

/** A single retry attempt and its poll summary. */
export interface TaskAttemptView {
  attempt_number: number;
  status: TaskStatus;
  error_code: ErrorCode | null;
  /** Raw external response text — never parsed by this API. */
  response: string | null;
  /** Human-readable terminal-failure detail (≤512 chars); null unless failed. */
  failure_detail: string | null;
  started_at: string | null;
  finished_at: string | null;
  check: TaskCheckView | null;
  /** Per-job terminal results (TERRAFORM_JOB only; empty otherwise). */
  terraform_results: TerraformJobResultSummary[];
  /** Per-job last-observed states (TERRAFORM_JOB only; empty otherwise). */
  job_states: TerraformJobStateSummary[];
}

/** Task detail (#5) — task columns + effective settings + attempt history. */
export interface TaskDetail {
  task_id: number;
  pipeline_id: number;
  sequence: number;
  kind: TaskKind;
  task_definition: string;
  /** null when the definition name is unresolvable (deleted/renamed). */
  definition: TaskDefinitionView | null;
  operation: TaskOperation | null;
  status: TaskStatus;
  fail_count: number;
  error_code: ErrorCode | null;
  consumes_terraform_slot: boolean | null;
  started_at: string | null;
  ready_at: string | null;
  finished_at: string | null;
  next_check_at: string | null;
  effective_polling_interval: string;
  /** null for CONDITION_CHECK (bounded by retry budget, not timeout). */
  effective_execution_timeout: string | null;
  effective_max_fail_count: number;
  attempts: TaskAttemptView[];
  description: string | null;
}

/**
 * P11 GET …/attempts/{n}/jobs/{jobId}/result — a single job's terraform log.
 * Body is tail-first and capped at 16MB (`truncated` marks the cut). Note:
 * `content: null` is a valid 200 pointer row (the result exists but its body was
 * not collected) — distinct from a 404 (no result row at all).
 *
 * `source: "live"` = the orchestrator had no stored row and read the body
 * through to InfraManager on demand (`created_at` null, `fetch_error` set if the
 * live read failed). `source: "stored"` = the recorded terraform_result body.
 */
export interface TerraformJobResultDetail {
  task_id: number;
  attempt_number: number;
  job_id: string;
  succeeded: boolean | null;
  truncated: boolean;
  source: 'stored' | 'live';
  created_at: string | null;
  content: string | null;
  fetch_error: string | null;
}

/**
 * GET …/attempts/{n}/jobs/{jobId}/state — the last status observation of one
 * job, including the raw external `last_response` body preserved verbatim.
 */
export interface TerraformJobStateDetail {
  task_id: number;
  attempt_number: number;
  job_id: string;
  last_state: string | null;
  last_fail_reason: string | null;
  last_error: string | null;
  last_response: string | null;
  poll_count: number;
  last_polled_at: string | null;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Live/instantaneous statistics (#1). All numbers, never null. */
export interface LivePipelineStatistics {
  running_pipeline_count: number;
  pending_pipeline_count: number;
  in_progress_terraform_task_count: number;
  terraform_slot_cap: number;
  running_pipeline_cap: number;
  active_claim_count: number;
}

/** Period statistics (#2). */
export interface PipelineStatistics {
  period: StatisticsPeriodToken;
  since: string;
  pending_count: number;
  running_count: number;
  failed_count: number;
  done_count: number;
  cancelled_count: number;
  total_count: number;
}

// ---------------------------------------------------------------------------
// Recipe preview / task catalog
// ---------------------------------------------------------------------------

/** One step of a recipe preview (#9). */
export interface RecipePreviewStep {
  sequence: number;
  task_definition: string;
  kind: TaskKind;
  operation: TaskOperation;
  display_name: string;
  consumes_terraform_slot: boolean;
  definition: TaskDefinitionView;
}

/** Recipe preview (#9). */
export interface RecipePreview {
  type: PipelineType;
  provider: CloudProvider;
  recipe_definition: string;
  display_name: string;
  description: string;
  steps: RecipePreviewStep[];
}

/** Thin catalog row for the custom-recipe builder (#12). */
export interface TaskCatalogEntry {
  name: string;
  display_name: string;
  description: string;
  provider: CloudProvider;
  kind: TaskKind;
  consumes_terraform_slot: boolean;
}

/** Task catalog response (#12). */
export interface TaskCatalogResponse {
  task_definitions: TaskCatalogEntry[];
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/** #10 body — catalog pipeline execution. */
export interface CreatePipelineRequest {
  type: PipelineType;
}

/** #11 body — custom recipe execution. */
export interface CustomTaskRequest {
  name: string;
  description?: string;
}

export interface CustomPipelineRequest {
  tasks: CustomTaskRequest[];
}

// ---------------------------------------------------------------------------
// Spring Page envelope + error body
// ---------------------------------------------------------------------------

export interface SpringSort {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

export interface SpringPageable {
  pageNumber: number;
  pageSize: number;
  sort: SpringSort;
  offset: number;
  paged: boolean;
  unpaged: boolean;
}

/** Spring `Page<T>` direct envelope. */
export interface SpringPage<T> {
  content: T[];
  pageable: SpringPageable;
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: SpringSort;
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

/**
 * Upstream error body (all endpoints). `status` is the HttpStatus string
 * (e.g. "409 CONFLICT"); `code` is a stable `ORCHESTRATION_*` token.
 */
export interface OrchestratorErrorBody {
  timestamp: string;
  status: string;
  code: string;
  message: string;
  path: string;
}

/**
 * Non-throwing raw response returned by every `bff.pipeline.*` method: the
 * upstream HTTP status and parsed JSON body VERBATIM (204 → body null). The
 * route wrapper passes this through without rewriting non-2xx bodies.
 */
export interface OrchestratorRawResponse {
  status: number;
  body: unknown;
}
