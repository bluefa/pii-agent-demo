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
import type { BffClient, ConfirmedResourceProvider } from '@/lib/bff/types';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { OrchestratorRawResponse } from '@/lib/pipeline/types';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { OrchestratorUnreachableError } from '@/lib/bff/errors';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';
import { authHeaders } from '@/lib/bff/auth-headers';

const BFF_URL = process.env.BFF_API_URL ?? '';

// ── pipeline-orchestrator upstream (LIN-25) — served behind the BFF server,
// no separate env: BFF_API_URL + /install/v1 ──
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
  const url = `${BFF_URL}/install/v1${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('TIMEOUT'), PIPELINE_TIMEOUT_MS);
  const init: RequestInit = {
    method,
    headers: { Accept: 'application/json', ...(await authHeaders()) },
    signal: controller.signal,
  };
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
  const res = await fetch(fullPath, {
    headers: { Accept: 'application/json', ...(await authHeaders()) },
  });
  console.log(`[BFF] ← GET ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  // 204 No Content has no body to parse.
  if (res.status === 204) return null as T;
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
  const res = await fetch(fullPath, { headers: { Accept: '*/*', ...(await authHeaders()) } });
  console.log(`[BFF] ← GET ${fullPath} (${res.status}, raw)`);
  if (!res.ok) await throwBffError(res);
  return res;
}

/**
 * `emptyBodyOk` opts into tolerating a 2xx with no body. Scoped to the one
 * endpoint observed violating its own contract — PUT
 * excluded-databases/by-resource-id answers 200 with an empty body although
 * install-v1.yaml declares SkipLogicalDatabaseResponse. It is opt-in per call, not
 * a default, so a silent contract break stays visible everywhere else. Two reasons
 * a caller passes it: a declared body that does not arrive (above), or — for the
 * assumed writers — no declared body at all (`setDoesSupportRaw`, §9).
 */
async function send<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  opts?: { emptyBodyOk?: boolean },
): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → ${method} ${fullPath}`);
  const init: RequestInit = { method, headers: await authHeaders() };
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(fullPath, init);
  console.log(`[BFF] ← ${method} ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (opts?.emptyBodyOk && text.trim().length === 0) return undefined as T;
  // I-3 invariant: POST/PUT bodies are raw passthrough (snake_case), no camelCase.
  return JSON.parse(text) as T;
}

const post = <T>(path: string, body?: unknown) => send<T>('POST', path, body);

/**
 * One file, one request. The 5MB per-file cap is what lets this stay a single
 * `multipart/form-data` POST instead of a resumable/chunked protocol — see
 * docs/bff-api/tag-guides/faq-notices.md §5 본문 이미지.
 *
 * `Content-Type` is deliberately not set: fetch derives it from the FormData
 * so the multipart boundary matches the body.
 */
async function postMultipart<T>(
  path: string,
  file: { bytes: Uint8Array<ArrayBuffer>; contentType: string },
): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  const form = new FormData();
  form.append('file', new Blob([file.bytes], { type: file.contentType }));
  console.log(`[BFF] → POST ${fullPath} (multipart)`);
  const res = await fetch(fullPath, { method: 'POST', headers: await authHeaders(), body: form });
  console.log(`[BFF] ← POST ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  return await res.json() as T;
}
const put = <T>(path: string, body?: unknown, opts?: { emptyBodyOk?: boolean }) =>
  send<T>('PUT', path, body, opts);

/**
 * 확정 리소스 쓰기 경로 — swagger 가 CSP 별 path 로 같은 조작을 선언한다
 * (create/delete{Csp}ConfirmedResource). provider 는 조작이 아니라 path 를 고른다.
 */
const CONFIRMED_RESOURCE_PATH: Record<ConfirmedResourceProvider, string> = {
  AWS: 'aws-resources',
  GCP: 'gcp-resources',
  AZURE: 'azure-resources',
  IDC: 'idc-resources',
};

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
    jobResult: (pipelineId, taskId, attemptNumber, jobId) =>
      pipelineRequest(
        'GET',
        `/pipelines/${enc(pipelineId)}/tasks/${enc(taskId)}/attempts/${enc(attemptNumber)}/jobs/${enc(jobId)}/result`,
      ),
    jobState: (pipelineId, taskId, attemptNumber, jobId) =>
      pipelineRequest(
        'GET',
        `/pipelines/${enc(pipelineId)}/tasks/${enc(taskId)}/attempts/${enc(attemptNumber)}/jobs/${enc(jobId)}/state`,
      ),
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
    restartPreview: (targetSourceId, pipelineId, fromSequence) =>
      pipelineRequest(
        'GET',
        withQuery(
          `/target-sources/${enc(targetSourceId)}/pipelines/${enc(pipelineId)}/restart-preview`,
          fromSequence ? `from_sequence=${enc(fromSequence)}` : '',
        ),
      ),
    restart: (targetSourceId, pipelineId, body) =>
      pipelineRequest(
        'POST',
        `/target-sources/${enc(targetSourceId)}/pipelines/${enc(pipelineId)}/restart`,
        body,
      ),
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
    // JiraTicketResponse is a camel-cased wire — raw passthrough, route parses.
    getJiraTicket: (id) =>
      getSnakeRaw<z.infer<typeof schemas.JiraTicketResponse>>(`/target-sources/${id}/jira-ticket`),
    // ASSUMED (docs/api/ops-assumed-contracts.md §8) — 404s against the real BFF
    // until it ships. Snake body, matching the read side (TargetSourceDetail).
    putDescription: (id, description) =>
      put(`/target-sources/${id}/description`, { description }),
    // 실데이터 여부 (docs/api/ops-assumed-contracts.md §9) — 업스트림은 값을 경로에
    // 싣고 본문을 받지 않는다. 응답 본문은 선언돼 있지 않으므로 204 도 200 빈 본문도
    // 성공으로 받는다 (읽는 값이 없다).
    setDoesSupportRaw: (id, enabled) =>
      put<void>(
        `/target-sources/${id}/support-raw-data/${enabled ? 'enabled' : 'disabled'}`,
        undefined,
        { emptyBodyOk: true },
      ),
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
    // JiraTicketResponse is a camel wire like the target-source one — raw
    // passthrough, route parses. detach unmaps only; the Jira issue survives.
    jiraTickets: {
      list: (serviceCode) => getSnakeRaw(`/services/${enc(serviceCode)}/jira-tickets`),
      attach: (serviceCode, cloudProvider, issueKey, validate) =>
        post(`/services/${enc(serviceCode)}/jira-tickets/${enc(cloudProvider)}`, {
          issueKey,
          ...(validate === undefined ? {} : { validate }),
        }),
      detach: (serviceCode, cloudProvider) =>
        send('DELETE', `/services/${enc(serviceCode)}/jira-tickets/${enc(cloudProvider)}`),
      addWatcher: (serviceCode, cloudProvider, userId) =>
        post(`/services/${enc(serviceCode)}/jira-tickets/${enc(cloudProvider)}/watchers`, { userId }),
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
    // Owner-provided endpoint, absent from install-v1.yaml — the route parses it.
    searchEc2Resources: (id, query, limit) =>
      getSnakeRaw(
        `/target-sources/${id}/ec2-resources/search${buildQuery({ query, limit })}`,
      ),
  },

  // OPS: ASSUMED contracts (docs/api/ops-assumed-contracts.md) — these paths do
  // not exist upstream yet; they 404 against the real BFF until it ships them.
  ops: {
    getStatusHistory: (id, page, size) =>
      getSnakeRaw(`/target-sources/${id}/status-history${buildQuery({ page, size })}`),
    putInstallationMode: (id, grant) =>
      put(`/target-sources/${id}/installation-mode`, {
        grant_service_terraform_execution_permission: grant,
      }),
    // REAL contract (install-v1 upsert) — full ARN in, camel wire both ways.
    putRole: (id, kind, roleArn) =>
      put(`/target-sources/${id}/aws/${kind === 'scan' ? 'scan-role' : 'terraform-execution-role'}`, {
        roleArn,
      }),
    getTargetSourceList: (query, page, size) =>
      getSnakeRaw(`/admin/ops/target-sources${buildQuery({ query, page, size })}`),
  },

  // 서비스 접근 권한 — 오너가 준 백엔드 초안 스펙 그대로
  // (docs/api/access-assumed-contracts.md).
  //
  // 관리자 API 의 base 는 **`/admin/access`** 다 — 2026-08-14 오너 확정(D6 닫힘).
  // 스펙 표가 base 없이 bare 로 적어 둔 걸 우리가 `/admin` 으로 읽어 `/admin/admins`,
  // `/admin/services` 로 나가고 있었다. 이제 업스트림 경로가 우리 프록시 경로
  // (`/api/v1/admin/access/**`)와 같은 모양이다.
  //
  // wire 는 snake 이고 camel 경계는 CSR 어댑터가 갖는다.
  access: {
    listServices: (query, page, size) =>
      getSnakeRaw(`/admin/access/services${buildQuery({ q: query, page, size })}`),
    listServiceOwners: (serviceCode) =>
      getSnakeRaw(`/admin/access/services/${encodeURIComponent(serviceCode)}/owners`),
    addServiceOwners: (serviceCode, emails) =>
      post(`/admin/access/services/${encodeURIComponent(serviceCode)}/owners`, { emails }),
    removeServiceOwner: (serviceCode, email) =>
      post(`/admin/access/services/${encodeURIComponent(serviceCode)}/owners/remove`, { email }),
    listAdmins: () => getSnakeRaw('/admin/access/admins'),
    addAdmin: (email) => post('/admin/access/admins', { email }),
    removeAdmin: (email) => post('/admin/access/admins/remove', { email }),
    listRequests: (status, page, size) =>
      getSnakeRaw(`/admin/access/permission-access${buildQuery({ status, page, size })}`),
    getRequest: (requestId) => getSnakeRaw(`/admin/access/permission-access/${requestId}`),
    approveRequest: (requestId, message) =>
      post(`/admin/access/permission-access/${requestId}/approve`, { message }),
    rejectRequest: (requestId, reason) =>
      post(`/admin/access/permission-access/${requestId}/reject`, { reason }),
    listHistory: (query, page, size) =>
      getSnakeRaw(
        `/admin/access/history${buildQuery({
          service_code: query.serviceCode,
          type: query.type,
          page,
          size,
        })}`,
      ),
    // 사용자 측 — admin 게이트 밖. 요청 생성은 멱등이라 재시도가 안전하다.
    createRequest: (serviceCode, reason) =>
      post(`/services/${encodeURIComponent(serviceCode)}/permission-access`, { reason }),
    // 2026-08-14 오너 확정 — 본인 신청 내역은 `/user/permission-access` (갭 B4 해소).
    // 헤더 판정이 상태별 건수를 말하므로 `status` 를 실어 수만 받는다 — 목록을 통째로
    // 훑던 것을 이걸로 바꿨다.
    listMyRequests: (status, page, size) =>
      getSnakeRaw(`/user/permission-access${buildQuery({ status, page, size })}`),
    // 담당 서비스만 — ADMIN 은 전체를 받는다. "내가 접근할 수 있는 서비스"가 이것이다.
    listUserServices: (query, page, size) =>
      getSnakeRaw(`/user/services/page${buildQuery({ query, page, size })}`),
    // 전체 서비스 + 내 access_status + 담당자 — 신청 대상을 고르는 목록.
    listServicesPage: (query, page, size) =>
      getSnakeRaw(`/services/page${buildQuery({ query, page, size })}`),
    // ADMIN 전용으로 좁혀졌다(임직원 명부라서). 요청자 화면은 부르지 않는다.
    //
    // 질의 키는 swagger 가 선언한 `q` 다(`searchUsers`, install-v1.yaml). 오너의 08-14
    // 노트는 **응답 본문**만 바꿨다("고정 응답 → 실구현, knoxId·이메일·역할") — 파라미터
    // 이름은 건드리지 않았으므로 선언된 이름을 그대로 쓴다. 우리가 `query` 로 보내면 실
    // BFF 는 조용히 무시하고 명부 전체를 돌려준다.
    //
    // 제외 목록은 **보내지 않는다.** swagger 의 `excludeIds` 는 무엇으로 키잉되는지 알 수
    // 없고(사번? knoxId?) 새 응답에는 id 가 아예 없다. 이메일을 id 자리에 실으면 역시
    // 조용히 무시된다 — 확인 전까지는 화면이 거른다(E4).
    searchUsers: (query) => getSnakeRaw(`/users/search${buildQuery({ q: query })}`),
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

  // Admin Task Queue: raw wire passthrough — the admin/queue routes own the
  // wire→camel boundary (ADR-019, lib/types/task-queue.ts). Upstream paths match
  // install-v1.yaml verbatim. PUT/POST bodies are authored snake (D3).
  taskQueue: {
    getDashboardSummary: () =>
      getSnakeRaw<z.infer<typeof schemas.DashboardSummaryResponse>>(`/dashboard/summary`),
    getProcessStatuses: (query) =>
      getSnakeRaw<z.infer<typeof schemas.PageProcessStatusCurrentResponse>>(
        `/process-statuses${buildQuery({
          processStatus: query.processStatus,
          targetSourceId: query.targetSourceId,
          page: query.page,
          size: query.size,
        })}`,
      ),
    getAlertTargetSources: (query) =>
      getSnakeRaw<z.infer<typeof schemas.PageTargetSourceInfo>>(
        `/dashboard/target-sources/${query.kind}${buildQuery({
          page: query.page,
          size: query.size,
        })}`,
      ),
    getTargetSourcesPage: (query) =>
      getSnakeRaw<z.infer<typeof schemas.PageTargetSourceInfo>>(
        `/target-sources/page${buildQuery({
          confirmStatus: query.confirmStatus,
          targetSourceId: query.targetSourceId,
          serviceCode: query.serviceCode,
          page: query.page,
          size: query.size,
        })}`,
      ),
    putNlbIndex: (id, body) =>
      put<z.infer<typeof schemas.ApprovalRequestDetailDto>>(
        `/target-sources/${id}/approval-requests/nlb-indices`,
        body,
      ),
    getTestConnectionPage: (query) =>
      getSnakeRaw<z.infer<typeof schemas.PageTestConnectionRejectStatusResponse>>(
        `/target-sources/test-connection/status${buildQuery({
          status: query.status,
          page: query.page,
          size: query.size,
        })}`,
      ),
    getTestConnectionStatus: (id) =>
      getSnakeRaw<z.infer<typeof schemas.TestConnectionRejectStatusResponse>>(
        `/target-sources/${id}/test-connection/status`,
      ),
    rejectTestConnection: (id, body) =>
      post<z.infer<typeof schemas.TestConnectionRejectResponse>>(
        `/target-sources/${id}/test-connection/reject`,
        body,
      ),
    getApprovalHistory: (query) =>
      getSnakeRaw<z.infer<typeof schemas.Page>>(
        `/approval-history${buildQuery({
          toStatuses: query.toStatuses?.length ? query.toStatuses.join(',') : undefined,
          page: query.page,
          size: query.size,
        })}`,
      ),
    getNlbIndexMappings: (id) =>
      getSnakeRaw<unknown>(`/target-sources/${id}/approval-requests/latest/nlb-index-mappings`),
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
        { emptyBodyOk: true },
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

    // 확정 정보 등록/삭제 — 응답 본문이 계약에 선언되지 않아(201/200, 스키마 없음)
    // 빈 본문을 허용한다. 요청 본문도 `type: object` 라 그대로 흘려보낸다.
    createConfirmedResources: (id, provider, body, applyNlbSecurityGroup) =>
      send<unknown>(
        'POST',
        // 계약이 이 flag 를 AWS path 에만 둔다. 기본값이 false 라 켠 경우에만 붙이고,
        // **provider 도 함께 본다** — 게이트가 UI 에만 있으면(체크박스는 AWS 에서만 렌더된다)
        // 내부 라우트를 직접 부르는 쪽이 `?provider=GCP&applyNLBSecurityGroup=true` 로
        // 선언되지 않은 파라미터를 gcp path 에 실어 보낼 수 있다. 경로를 만드는 이 자리가
        // 파라미터가 그 경로에 있는지 아는 유일한 자리다.
        `/target-sources/${id}/${CONFIRMED_RESOURCE_PATH[provider]}${
          provider === 'AWS' && applyNlbSecurityGroup ? '?applyNLBSecurityGroup=true' : ''
        }`,
        body,
        { emptyBodyOk: true },
      ),

    deleteConfirmedResources: (id, provider) =>
      send<unknown>(
        'DELETE',
        `/target-sources/${id}/${CONFIRMED_RESOURCE_PATH[provider]}`,
        undefined,
        { emptyBodyOk: true },
      ),

    // 추천값 — 등록 본문과 같은 opaque object 다. 재구성하지 않고 그대로 넘긴다.
    getApprovedRecommendations: (id, provider) =>
      getSnakeRaw<unknown>(
        `/target-sources/${id}/${CONFIRMED_RESOURCE_PATH[provider]}/approved-recommendations`,
      ),

    getApprovedIntegration: (id) =>
      getSnakeRaw<z.infer<typeof schemas.ApprovedIntegrationResponseDto>>(
        `/target-sources/${id}/approved-integration`,
      ),

    getApprovalHistory: (id, page, size) =>
      getSnakeRaw<unknown>(`/target-sources/${id}/approval-history?page=${page}&size=${size}`),

    getApprovalRequestLatest: (id) =>
      getSnakeRaw<unknown>(`/target-sources/${id}/approval-requests/latest`),

    getApprovalRequestDetail: (id, requestId) =>
      getSnakeRaw<unknown>(`/target-sources/${id}/approval-requests/${requestId}`),

    getProcessStatus: (id) =>
      getSnakeRaw<z.infer<typeof schemas.ProcessStatusResponseDto>>(
        `/target-sources/${id}/process-status`,
      ),

    // DB-only Terraform state — may disagree with installation-status by design.
    getTerraformStatus: (id) =>
      getSnakeRaw<z.infer<typeof schemas.TerraformStatusResponse>>(
        `/target-sources/${id}/terraform-status`,
      ),

    approveApprovalRequest: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-requests/approve`, body),

    rejectApprovalRequest: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-requests/reject`, body),

    cancelApprovalRequest: (id) =>
      post<unknown>(`/target-sources/${id}/approval-requests/cancel`, {}),

    resetTargetSource: (id, body) =>
      post<z.infer<typeof schemas.ApprovalActionResponseDto>>(`/target-sources/${id}/reset`, body),

    markApprovalRequestUnavailable: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-unavailable`, body),

    confirmApprovalUnavailable: (id) =>
      post<unknown>(`/target-sources/${id}/approval-unavailable/confirm`, {}),

    confirmInstallation: (id) =>
      post<unknown>(`/target-sources/${id}/pii-agent-installation/confirm`),

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

    getTestConnectionHistory: (id, page, size) =>
      getSnakeRaw<z.infer<typeof schemas.PageTestConnectionHistoryItemResponse>>(
        `/target-sources/${id}/test-connection/history${buildQuery({ page, size })}`,
      ),

    getTestConnectionExecutionHistory: (id, page, size) =>
      getSnakeRaw<z.infer<typeof schemas.PageTestConnectionExecutionHistoryResponse>>(
        `/target-sources/${id}/test-connection/execution-history${buildQuery({ page, size })}`,
      ),
  },

  // Guides: raw snake passthrough — route validates with schemas.GuideDetail.parse(raw).
  guides: {
    get: (name) => getSnakeRaw(`/admin/guides/${encodeURIComponent(name)}`),
    put: (name, body) => put(`/admin/guides/${encodeURIComponent(name)}`, body),
  },

  // FAQ & Notices — the tag guide authors camelCase throughout, so `get`'s
  // camelCaseKeys pass is a no-op here rather than a reshape.
  posts: {
    list: (type, categoryId) => get(`/posts${buildQuery({ type, categoryId })}`),
    get: (postId) => get(`/posts/${postId}`),
    listCategories: (type) => get(`/post-categories${buildQuery({ type })}`),
    listAdmin: (type, hidden) =>
      get(`/admin/posts${buildQuery({ type, hidden: hidden === undefined ? undefined : String(hidden) })}`),
    getAdmin: (postId) => get(`/admin/posts/${postId}`),
    create: (body) => post('/admin/posts', body),
    update: (postId, body) => put(`/admin/posts/${postId}`, body),
    setHidden: (postId, hidden) => put(`/admin/posts/${postId}/hidden`, { hidden }),
    setPinned: (postId, pinned) => put(`/admin/posts/${postId}/pinned`, { pinned }),
    uploadImage: (file) => postMultipart('/admin/posts/images', file),
    listAdminCategories: (type) => get(`/admin/post-categories${buildQuery({ type })}`),
    createCategory: (body) => post('/admin/post-categories', body),
    deleteCategory: (categoryId) => send('DELETE', `/admin/post-categories/${categoryId}`),
  },
};
