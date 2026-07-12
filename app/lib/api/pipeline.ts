/**
 * CSR client for the pipeline-orchestrator BFF proxy (LIN-25).
 *
 * Deliberately bypasses `lib/fetch-json.ts`: that generic mapper drops unknown
 * error codes and their messages, but the orchestrator's stable
 * `ORCHESTRATION_*` codes (esp. 409 `ORCHESTRATION_PIPELINE_ALREADY_ACTIVE`)
 * MUST survive to the caller. Non-2xx responses throw `OrchestratorApiError`
 * (an Error subclass — NOT a plain object, so `useApiMutation` keeps the
 * structured fields). CSR files must NOT import `@/lib/bff/*`.
 *
 * See docs/api/pipeline-orchestrator-bff.md §1 (boxed error passthrough).
 */
import { toInternalInfraApiPath } from '@/lib/infra-api';
import type {
  CloudProvider,
  CreatePipelineRequest,
  CustomPipelineRequest,
  LivePipelineStatistics,
  PipelineDetail,
  PipelineStatistics,
  PipelineStatus,
  PipelineSummary,
  PipelineType,
  RecipePreview,
  SpringPage,
  StatisticsPeriodToken,
  TaskCatalogResponse,
  TaskDetail,
  TerraformJobResultDetail,
  TerraformJobStateDetail,
} from '@/lib/pipeline/types';

/**
 * Non-2xx response from the orchestrator proxy. Preserves the upstream HTTP
 * `status`, the stable `code` (`ORCHESTRATION_*` or `ORCHESTRATOR_UNREACHABLE`),
 * the human `message`, and the raw `body` for callers that need to branch
 * (e.g. `code === 'ORCHESTRATION_PIPELINE_ALREADY_ACTIVE'`).
 */
export class OrchestratorApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly body: unknown;

  constructor(init: { status: number; code: string | null; message: string; body: unknown }) {
    super(init.message);
    this.name = 'OrchestratorApiError';
    this.status = init.status;
    this.code = init.code;
    this.body = init.body;
  }
}

const ORCH = '/orchestrator';

/** Encode a path segment (pipelineId/taskId/targetSourceId) before URL interpolation. */
const seg = (value: number | string): string => encodeURIComponent(String(value));

async function toOrchestratorError(res: Response): Promise<OrchestratorApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const code = typeof record.code === 'string' ? record.code : null;
  const message = typeof record.message === 'string' ? record.message : `HTTP ${res.status}`;
  return new OrchestratorApiError({ status: res.status, code, message, body });
}

async function orchestratorGet<T>(path: string, opts?: { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(toInternalInfraApiPath(path), {
    headers: { Accept: 'application/json' },
    signal: opts?.signal,
  });
  if (!res.ok) throw await toOrchestratorError(res);
  return (await res.json()) as T;
}

async function orchestratorPost<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: 'POST', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(toInternalInfraApiPath(path), init);
  if (!res.ok) throw await toOrchestratorError(res);
  return (await res.json()) as T;
}

type QueryValue = string | number | undefined | null | Array<string | number>;

function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== '' && item !== undefined && item !== null) search.append(key, String(item));
      }
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface ListPipelinesParams {
  status?: PipelineStatus;
  provider?: CloudProvider;
  type?: PipelineType;
  period?: StatisticsPeriodToken;
  page?: number;
  size?: number;
  /** Repeatable — passed through in order (e.g. ['createdAt,desc', 'id,desc']). */
  sort?: string | string[];
}

export interface ListByTargetParams {
  page?: number;
  size?: number;
  sort?: string | string[];
}

// #1
export const getLiveStatistics = (): Promise<LivePipelineStatistics> =>
  orchestratorGet<LivePipelineStatistics>(`${ORCH}/pipelines/statistics/live`);

// #2
export const getPipelineStatistics = (period: StatisticsPeriodToken): Promise<PipelineStatistics> =>
  orchestratorGet<PipelineStatistics>(`${ORCH}/pipelines/statistics${buildQuery({ period })}`);

// #3
export const listPipelines = (params: ListPipelinesParams = {}): Promise<SpringPage<PipelineSummary>> =>
  orchestratorGet<SpringPage<PipelineSummary>>(`${ORCH}/pipelines${buildQuery({ ...params })}`);

// #4
export const getPipeline = (
  pipelineId: number | string,
  opts?: { signal?: AbortSignal },
): Promise<PipelineDetail> =>
  orchestratorGet<PipelineDetail>(`${ORCH}/pipelines/${seg(pipelineId)}`, opts);

// #5
export const getTaskDetail = (
  pipelineId: number | string,
  taskId: number | string,
  opts?: { signal?: AbortSignal },
): Promise<TaskDetail> =>
  orchestratorGet<TaskDetail>(`${ORCH}/pipelines/${seg(pipelineId)}/tasks/${seg(taskId)}`, opts);

// #5a — a single terraform job's log body (tail-first, ≤16MB). `content: null`
// is a valid 200 (pointer row / live fetch miss), NOT a 404.
export const getJobResult = (
  pipelineId: number | string,
  taskId: number | string,
  attemptNumber: number | string,
  jobId: number | string,
): Promise<TerraformJobResultDetail> =>
  orchestratorGet<TerraformJobResultDetail>(
    `${ORCH}/pipelines/${seg(pipelineId)}/tasks/${seg(taskId)}/attempts/${seg(attemptNumber)}/jobs/${seg(jobId)}/result`,
  );

// #5b — a single terraform job's last state observation (incl. raw last_response).
export const getJobState = (
  pipelineId: number | string,
  taskId: number | string,
  attemptNumber: number | string,
  jobId: number | string,
): Promise<TerraformJobStateDetail> =>
  orchestratorGet<TerraformJobStateDetail>(
    `${ORCH}/pipelines/${seg(pipelineId)}/tasks/${seg(taskId)}/attempts/${seg(attemptNumber)}/jobs/${seg(jobId)}/state`,
  );

// #6
export const cancelPipeline = (pipelineId: number | string): Promise<PipelineDetail> =>
  orchestratorPost<PipelineDetail>(`${ORCH}/pipelines/${seg(pipelineId)}/cancel`);

// #7
export const listPipelinesByTarget = (
  targetSourceId: number | string,
  params: ListByTargetParams = {},
): Promise<SpringPage<PipelineSummary>> =>
  orchestratorGet<SpringPage<PipelineSummary>>(
    `${ORCH}/target-sources/${seg(targetSourceId)}/pipelines${buildQuery({ ...params })}`,
  );

// #8 — 204 (no runs) resolves to null.
export const getLatestPipelineByTarget = async (
  targetSourceId: number | string,
): Promise<PipelineSummary | null> => {
  const res = await fetch(
    toInternalInfraApiPath(`${ORCH}/target-sources/${seg(targetSourceId)}/pipelines/latest`),
    { headers: { Accept: 'application/json' } },
  );
  if (res.status === 204) return null;
  if (!res.ok) throw await toOrchestratorError(res);
  return (await res.json()) as PipelineSummary;
};

// #9
export const previewRecipe = (
  targetSourceId: number | string,
  type: PipelineType,
): Promise<RecipePreview> =>
  orchestratorGet<RecipePreview>(
    `${ORCH}/target-sources/${seg(targetSourceId)}/pipelines/preview${buildQuery({ type })}`,
  );

// #10
export const createPipeline = (
  targetSourceId: number | string,
  body: CreatePipelineRequest,
): Promise<PipelineDetail> =>
  orchestratorPost<PipelineDetail>(`${ORCH}/target-sources/${seg(targetSourceId)}/pipelines`, body);

// #11
export const createCustomPipeline = (
  targetSourceId: number | string,
  body: CustomPipelineRequest,
): Promise<PipelineDetail> =>
  orchestratorPost<PipelineDetail>(
    `${ORCH}/target-sources/${seg(targetSourceId)}/pipelines/custom`,
    body,
  );

// #12
export const getTaskDefinitions = (provider?: CloudProvider): Promise<TaskCatalogResponse> =>
  orchestratorGet<TaskCatalogResponse>(`${ORCH}/task-definitions${buildQuery({ provider })}`);
