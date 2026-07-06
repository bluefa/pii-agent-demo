/**
 * Real BFF API HTTP client. Used when USE_MOCK_DATA=false.
 *
 * ADR-019 /install/v1 migration. Upstream paths match `docs/swagger/install-v1.yaml`
 * VERBATIM. Endpoints absent from the swagger were removed (governing rule).
 *
 * Casing (ADR-019 D1/D2/D6):
 *   - `get` runs `camelCaseKeys` (the one boundary for most GETs).
 *   - `getSnakeRaw` is the greppable opt-out for sanctioned snake passthrough
 *     (azure scan-app, Issue #222) and for domains whose own route/mapper owns
 *     the boundary (IDC, logical-DB, test-connection) — casing in one place.
 *   - `getRaw` returns the raw `Response` for non-JSON downloads (terraform zip).
 *   - POST/PUT bodies are raw passthrough (I-3); request casing is per-endpoint (D3).
 */
import type { BffClient } from '@/lib/bff/types';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { OrchestratorRawResponse } from '@/lib/pipeline/types';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { OrchestratorUnreachableError } from '@/lib/bff/errors';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';

const BFF_URL = process.env.BFF_API_URL ?? '';

// ── pipeline-orchestrator upstream (LIN-25) — its own env, distinct from BFF_API_URL ──
const PIPELINE_URL = process.env.PIPELINE_API_URL ?? 'http://localhost:8080';
const PIPELINE_TIMEOUT_MS = 30_000;

/**
 * Calls the pipeline-orchestrator upstream and returns `{ status, body }`
 * VERBATIM for ANY HTTP status (204 → body null). Never throws on a non-2xx
 * response — the passthrough contract requires the route wrapper to see the
 * real upstream status + snake_case body. Only an unreachable upstream
 * (connection refused / DNS / timeout / reset) throws
 * `OrchestratorUnreachableError`, which the wrapper maps to 502.
 */
async function pipelineRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<OrchestratorRawResponse> {
  const url = `${PIPELINE_URL}/api/v1${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('TIMEOUT'), PIPELINE_TIMEOUT_MS);
  const init: RequestInit = { method, headers: { Accept: 'application/json' }, signal: controller.signal };
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    console.log(`[Orchestrator] → ${method} ${url}`);
    res = await fetch(url, init);
  } catch (cause) {
    // Network failure / DNS / connection refused / abort(timeout) — no HTTP response.
    throw new OrchestratorUnreachableError(`pipeline-orchestrator unreachable at ${url}`, cause);
  } finally {
    clearTimeout(timeoutId);
  }

  console.log(`[Orchestrator] ← ${method} ${url} (${res.status})`);
  const status = res.status;
  if (status === 204) return { status, body: null };

  const text = await res.text();
  if (text.length === 0) return { status, body: null };
  try {
    return { status, body: JSON.parse(text) as unknown };
  } catch {
    // Non-JSON upstream body — pass the raw text through rather than masking status.
    return { status, body: text };
  }
}

const withQuery = (path: string, query: string): string => (query ? `${path}?${query}` : path);
const enc = (value: string): string => encodeURIComponent(value);

async function throwBffError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw bffErrorFromBody(res.status, body);
}

async function get<T>(path: string, opts?: { raw?: boolean }): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath}`);
  const res = await fetch(fullPath, { headers: { Accept: 'application/json' } });
  console.log(`[BFF] ← GET ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  const data = await res.json();
  return (opts?.raw ? data : camelCaseKeys(data)) as T;
}

/**
 * ADR-019 D6 greppable opt-out: returns the upstream JSON as-authored (snake),
 * bypassing the `camelCaseKeys` boundary. Used where the casing boundary is
 * owned downstream (route normalizer / IDC mapper) or for sanctioned snake
 * passthrough (azure scan-app, Issue #222).
 */
const getSnakeRaw = <T>(path: string): Promise<T> => get<T>(path, { raw: true });

async function getRaw(path: string): Promise<Response> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath} (raw)`);
  const res = await fetch(fullPath, { headers: { Accept: '*/*' } });
  console.log(`[BFF] ← GET ${fullPath} (${res.status}, raw)`);
  if (!res.ok) await throwBffError(res);
  return res;
}

async function send<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → ${method} ${fullPath}`);
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(fullPath, init);
  console.log(`[BFF] ← ${method} ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  if (res.status === 204) return undefined as T;
  // I-3 invariant: POST/PUT bodies are raw passthrough (snake_case), no camelCase.
  return await res.json() as T;
}

const post = <T>(path: string, body?: unknown) => send<T>('POST', path, body);
const put = <T>(path: string, body?: unknown) => send<T>('PUT', path, body);

const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const httpBff: BffClient = {
  // Pipeline domain (LIN-25): verbatim `{ status, body }` passthrough to the
  // pipeline-orchestrator upstream; only unreachable upstream throws.
  pipeline: {
    liveStatistics: () => pipelineRequest('GET', '/pipelines/statistics/live'),
    statistics: (period) =>
      pipelineRequest('GET', withQuery('/pipelines/statistics', period ? `period=${enc(period)}` : '')),
    list: (query) => pipelineRequest('GET', withQuery('/pipelines', query)),
    detail: (pipelineId) => pipelineRequest('GET', `/pipelines/${enc(pipelineId)}`),
    taskDetail: (pipelineId, taskId) =>
      pipelineRequest('GET', `/pipelines/${enc(pipelineId)}/tasks/${enc(taskId)}`),
    cancel: (pipelineId) => pipelineRequest('POST', `/pipelines/${enc(pipelineId)}/cancel`),
    listByTarget: (targetSourceId, query) =>
      pipelineRequest('GET', withQuery(`/target-sources/${enc(targetSourceId)}/pipelines`, query)),
    latestByTarget: (targetSourceId) =>
      pipelineRequest('GET', `/target-sources/${enc(targetSourceId)}/pipelines/latest`),
    preview: (targetSourceId, type) =>
      pipelineRequest(
        'GET',
        withQuery(`/target-sources/${enc(targetSourceId)}/pipelines/preview`, type ? `type=${enc(type)}` : ''),
      ),
    create: (targetSourceId, body) =>
      pipelineRequest('POST', `/target-sources/${enc(targetSourceId)}/pipelines`, body),
    createCustom: (targetSourceId, body) =>
      pipelineRequest('POST', `/target-sources/${enc(targetSourceId)}/pipelines/custom`, body),
    taskDefinitions: (provider) =>
      pipelineRequest('GET', withQuery('/task-definitions', provider ? `provider=${enc(provider)}` : '')),
  },

  targetSources: {
    // ADR-019 zod-codegen: route owns the parse boundary — return raw snake wire.
    get: (id) => getSnakeRaw<z.infer<typeof schemas.TargetSourceDetail>>(`/target-sources/${id}`),
    // 37: wire snake forwarded raw — the route normalizer owns the boundary (D1).
    list: (serviceCode) =>
      getSnakeRaw<z.infer<typeof schemas.TargetSourceDetail>[]>(
        `/target-sources/services/${serviceCode}`,
      ),
    // 36: the selected creation candidate is posted back verbatim → 201 TargetSourceInfo.
    create: (serviceCode, candidate) =>
      post<z.infer<typeof schemas.TargetSourceInfo>>(
        `/target-sources/services/${serviceCode}/target-sources`,
        candidate,
      ),
    // 35: bare array of creation candidates (request body authored snake, D3).
    getCreationCandidates: (serviceCode, body) =>
      post<z.infer<typeof schemas.TargetSourceCreationCandidateResponse>[]>(
        `/target-sources/services/${serviceCode}/creation-candidates`,
        body,
      ),
    getSecrets: (id) =>
      getSnakeRaw<z.infer<typeof schemas.SecretResponse>[]>(`/target-sources/${id}/secrets`),
  },

  // USER/services: raw snake passthrough — routes validate with schemas.X.parse(raw).
  users: {
    search: (query, excludeIds) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      excludeIds.forEach((id) => params.append('excludeIds', id));
      const qs = params.toString();
      return getSnakeRaw(`/users/search${qs ? `?${qs}` : ''}`);
    },
    me: () => getSnakeRaw('/user/me'),
    getServicesPage: (page, size, query) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (query) params.set('query', query);
      return getSnakeRaw(`/user/services/page?${params.toString()}`);
    },
  },

  services: {
    permissions: {
      list: (serviceCode) => getSnakeRaw(`/services/${serviceCode}/authorized-users`),
    },
  },

  // SCAN: raw snake passthrough — routes validate with schemas.X.parse(raw).
  scan: {
    get: (id, scanId) => getSnakeRaw(`/target-sources/${id}/scans/${scanId}`),
    getHistory: (id, query) => getSnakeRaw(`/target-sources/${id}/scan/history${buildQuery(query)}`),
    create: (id, body) => post(`/target-sources/${id}/scan`, body),
    getStatus: (id) => getSnakeRaw(`/target-sources/${id}/scanJob/latest`),
  },

  aws: {
    // ADR-019 zod-codegen: routes own the parse boundary — return raw snake wire.
    getInstallationStatus: (id) => getSnakeRaw(`/target-sources/${id}/aws/installation-status`),
    // Non-JSON binary (zip) — getRaw returns the raw Response (D6, no camelCaseKeys).
    getTerraformScript: (id) => getRaw(`/target-sources/${id}/aws/terraform-script/download`),
    verifyScanRole: (id) => getSnakeRaw(`/target-sources/${id}/aws/verify-scan-role`),
    verifyExecutionRole: (id) => getSnakeRaw(`/target-sources/${id}/aws/verify-execution-role`),
  },

  // Azure responses are raw snake passthrough — the route validates with
  // schemas.X.parse(raw) and the CSR adapter owns the camel conversion.
  // (AzureHealthCheckResult wire is already camelCase per swagger; getSnakeRaw is a
  // no-op camelize; the route's schemas.AzureHealthCheckResult.parse() validates.)
  azure: {
    getInstallationStatus: (id) => getSnakeRaw(`/target-sources/${id}/azure/installation-status`),
    // Issue #222: snake_case raw passthrough — getSnakeRaw is the greppable D6 opt-out.
    getScanApp: (id) => getSnakeRaw(`/target-sources/${id}/azure/scan-app`),
    // G8 — swagger getAzurePrivateLinkHealthCheck. Note the `/infra/` infix.
    getPrivateLinkHealthCheck: (id) =>
      getSnakeRaw(`/infra/target-sources/${id}/azure-private-link-health-check`),
  },

  // GCP responses are raw snake passthrough — the route validates with
  // schemas.X.parse(raw) and the CSR adapter owns the camel conversion.
  gcp: {
    getInstallationStatus: (id) => getSnakeRaw(`/target-sources/${id}/gcp/installation-status`),
    getScanServiceAccount: (id) => getSnakeRaw(`/target-sources/${id}/gcp/scan-service-account`),
    getTerraformServiceAccount: (id) => getSnakeRaw(`/target-sources/${id}/gcp/terraform-service-account`),
  },

  // IDC responses are raw snake passthrough — the mapper (app/lib/api/idc.ts)
  // owns conversion. NLB responses are raw CAMEL passthrough (camel on the wire
  // per swagger). Upstream paths live only here; a path change touches this block.
  idc: {
    getInstallationStatus: (id) =>
      getSnakeRaw(`/target-sources/${id}/idc/installation-status`),
    getPreviousRequest: (id) =>
      getSnakeRaw(`/target-sources/${id}/idc/previous-request`),
    getOccupiedResources: (nlbIndex) =>
      getSnakeRaw(`/idc/nlb/${nlbIndex}/resources`),
    getNlbTable: () => getSnakeRaw(`/idc/nlb/table`),
  },

  // Logical-DB: the CSR client (app/lib/api/logical-db.ts) owns the single camel
  // boundary, so these forward raw snake (ADR-019 D1 one-boundary). PUT body is
  // authored snake by the caller (D3).
  logicalDb: {
    getTestedByResourceId: (id, resourceId) =>
      getSnakeRaw(
        `/target-sources/${id}/tested-logical-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
      ),
    getExcludedByResourceId: (id, resourceId) =>
      getSnakeRaw(
        `/target-sources/${id}/excluded-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
      ),
    updateExcludedByResourceId: (id, resourceId, body) =>
      put(
        `/target-sources/${id}/excluded-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
        body,
      ),
  },

  confirm: {
    // ADR-019 zod-codegen: routes own the parse boundary — return raw snake wire.
    getResources: (id) =>
      getSnakeRaw<z.infer<typeof schemas.CloudResourceResponse>>(`/target-sources/${id}/resources`),

    createApprovalRequest: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-requests`, body),

    getConfirmedIntegration: (id) =>
      getSnakeRaw<z.infer<typeof schemas.ConfirmedIntegrationResponse>>(
        `/target-sources/${id}/confirmed-integration`,
      ),

    getApprovedIntegration: (id) =>
      getSnakeRaw<z.infer<typeof schemas.ApprovedIntegrationResponseDto>>(
        `/target-sources/${id}/approved-integration`,
      ),

    getApprovalHistory: (id, page, size) =>
      getSnakeRaw<unknown>(`/target-sources/${id}/approval-history?page=${page}&size=${size}`),

    getApprovalRequestLatest: (id) =>
      getSnakeRaw<unknown>(`/target-sources/${id}/approval-requests/latest`),

    getProcessStatus: (id) =>
      getSnakeRaw<z.infer<typeof schemas.ProcessStatusResponseDto>>(
        `/target-sources/${id}/process-status`,
      ),

    approveApprovalRequest: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-requests/approve`, body),

    rejectApprovalRequest: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-requests/reject`, body),

    cancelApprovalRequest: (id) =>
      post<unknown>(`/target-sources/${id}/approval-requests/cancel`, {}),

    markApprovalRequestUnavailable: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-unavailable`, body),

    confirmApprovalUnavailable: (id) =>
      post<unknown>(`/target-sources/${id}/approval-unavailable/confirm`, {}),

    confirmInstallation: (id, body) =>
      post<unknown>(`/target-sources/${id}/pii-agent-installation/confirm`, body),

    updateResourceCredential: (id, body) =>
      put<unknown>(`/target-sources/${id}/resources/credential`, body),

    // 202 — no request body; optional collectorImageTag query (ADR-019 D6).
    testConnection: (id, collectorImageTag) =>
      post<z.infer<typeof schemas.TestConnectionTriggerResponse>>(
        `/target-sources/${id}/test-connection/async${buildQuery({ collectorImageTag })}`,
      ),

    // GETs returned raw (wire snake) — route validates with schemas.X.parse(raw).
    getTestConnectionLatest: (id) =>
      getSnakeRaw<z.infer<typeof schemas.TestConnectionVersionResult>>(
        `/target-sources/${id}/test-connection/latest_version`,
      ),

    getLatestTestConnectionResultSummaries: (id) =>
      getSnakeRaw<z.infer<typeof schemas.TestConnectionLatestResultSummaryResponse>[]>(
        `/target-sources/${id}/test-connection/latest-results`,
      ),

    getTestConnectionCompletionStatus: (id) =>
      getSnakeRaw<z.infer<typeof schemas.TestConnectionCompletionStatusResponse>>(
        `/target-sources/${id}/test-connection/completion-status`,
      ),

    updateTestConnectionConfirmation: (id, body) =>
      put<z.infer<typeof schemas.TestConnectionConfirmationResponse>>(
        `/target-sources/${id}/test-connection-acknowledgment`,
        body,
      ),
  },

  // Guides: raw snake passthrough — route validates with schemas.GuideDetail.parse(raw).
  guides: {
    get: (name) => getSnakeRaw(`/admin/guides/${encodeURIComponent(name)}`),
    put: (name, body) => put(`/admin/guides/${encodeURIComponent(name)}`, body),
  },
};
