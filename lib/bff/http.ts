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
import type {
  TargetSourceCreationCandidateResponseWire,
  TargetSourceInfoWire,
  TargetSourcesByServiceResponseWire,
} from '@/lib/bff/types/target-sources';
import type {
  ApprovalRequestCreateBody,
  BffConfirmedIntegration,
  ConfirmedIntegrationResponsePayload,
  ResourceCatalogResponsePayload,
} from '@/lib/bff/types/confirm';
import type {
  TestConnectionCompletionStatusResponseWire,
  TestConnectionConfirmationResponseWire,
  TestConnectionLatestResultSummaryResponseWire,
  TestConnectionTriggerResponseWire,
  TestConnectionVersionResultWire,
} from '@/lib/bff/types/test-connection';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';
import { extractConfirmedIntegration } from '@/lib/confirmed-integration-response';
import { extractResourceCatalog } from '@/lib/resource-catalog-response';

const BFF_URL = process.env.BFF_API_URL ?? '';

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
  targetSources: {
    get: (id) => get(`/target-sources/${id}`),
    // 37: wire snake forwarded raw — the route normalizer owns the boundary (D1).
    list: (serviceCode) =>
      getSnakeRaw<TargetSourcesByServiceResponseWire>(
        `/target-sources/services/${serviceCode}`,
      ),
    // 36: the selected creation candidate is posted back verbatim → 201 TargetSourceInfo.
    create: (serviceCode, candidate) =>
      post<TargetSourceInfoWire>(
        `/target-sources/services/${serviceCode}/target-sources`,
        candidate,
      ),
    // 35: bare array of creation candidates (request body authored snake, D3).
    getCreationCandidates: (serviceCode, body) =>
      post<TargetSourceCreationCandidateResponseWire[]>(
        `/target-sources/services/${serviceCode}/creation-candidates`,
        body,
      ),
    getSecrets: (id) => get(`/target-sources/${id}/secrets`),
  },

  users: {
    search: (query, excludeIds) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      excludeIds.forEach((id) => params.append('excludeIds', id));
      const qs = params.toString();
      return get(`/users/search${qs ? `?${qs}` : ''}`);
    },
    me: () => get('/user/me'),
    getServicesPage: (page, size, query) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (query) params.set('query', query);
      return get(`/user/services/page?${params.toString()}`);
    },
  },

  services: {
    permissions: {
      list: (serviceCode) => get(`/services/${serviceCode}/authorized-users`),
    },
  },

  dashboard: {
    summary: () => get('/admin/dashboard/summary'),
    systems: (params) => {
      const qs = params.toString();
      return get(`/admin/dashboard/systems${qs ? `?${qs}` : ''}`);
    },
    systemsExport: (params) => {
      const qs = params.toString();
      return getRaw(`/admin/dashboard/systems/export${qs ? `?${qs}` : ''}`);
    },
  },

  dev: {
    getUsers: () => get('/dev/users'),
    switchUser: (body) => post('/dev/switch-user', body),
  },

  scan: {
    get: (id, scanId) => get(`/target-sources/${id}/scans/${scanId}`),
    getHistory: (id, query) => get(`/target-sources/${id}/scan/history${buildQuery(query)}`),
    create: (id, body) => post(`/target-sources/${id}/scan`, body),
    getStatus: (id) => get(`/target-sources/${id}/scanJob/latest`),
  },

  taskAdmin: {
    getApprovalRequestQueue: (params) => {
      const searchParams = new URLSearchParams();
      searchParams.set('status', params.status);
      if (params.requestType) searchParams.set('requestType', params.requestType);
      if (params.search) searchParams.set('search', params.search);
      if (params.page !== undefined) searchParams.set('page', String(params.page));
      if (params.size !== undefined) searchParams.set('size', String(params.size));
      if (params.sort) searchParams.set('sort', params.sort);
      return get(`/task-admin/approval-requests?${searchParams.toString()}`);
    },
  },

  aws: {
    getInstallationStatus: (id) => get(`/target-sources/${id}/aws/installation-status`),
    // Non-JSON binary (zip) — getRaw returns the raw Response (D6, no camelCaseKeys).
    getTerraformScript: (id) => getRaw(`/target-sources/${id}/aws/terraform-script/download`),
    verifyScanRole: (id) => get(`/target-sources/${id}/aws/verify-scan-role`),
    verifyExecutionRole: (id) => get(`/target-sources/${id}/aws/verify-execution-role`),
  },

  azure: {
    getInstallationStatus: (id) => get(`/target-sources/${id}/azure/installation-status`),
    getSubnetGuide: (id) => get(`/target-sources/${id}/azure/subnet-guide`),
    // Issue #222: snake_case raw passthrough — getSnakeRaw is the greppable D6 opt-out.
    getScanApp: (id) => getSnakeRaw(`/target-sources/${id}/azure/scan-app`),
    vmCheckInstallation: (id) => post(`/target-sources/${id}/azure/vm/check-installation`, {}),
    vmGetInstallationStatus: (id) => get(`/target-sources/${id}/azure/vm/installation-status`),
    vmGetTerraformScript: (id) => get(`/target-sources/${id}/azure/vm/terraform-script`),
  },

  gcp: {
    getInstallationStatus: (id) => get(`/target-sources/${id}/gcp/installation-status`),
    getScanServiceAccount: (id) => get(`/target-sources/${id}/gcp/scan-service-account`),
    getTerraformServiceAccount: (id) => get(`/target-sources/${id}/gcp/terraform-service-account`),
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
    getResources: async (id) => {
      const payload = await get<ResourceCatalogResponsePayload>(`/target-sources/${id}/resources`);
      return extractResourceCatalog(payload);
    },

    createApprovalRequest: (id, body: ApprovalRequestCreateBody) =>
      post<unknown>(`/target-sources/${id}/approval-requests`, body),

    getConfirmedIntegration: async (id): Promise<BffConfirmedIntegration> => {
      const payload = await get<ConfirmedIntegrationResponsePayload>(`/target-sources/${id}/confirmed-integration`);
      return extractConfirmedIntegration(payload);
    },

    getApprovedIntegration: (id) =>
      get<unknown>(`/target-sources/${id}/approved-integration`),

    getApprovalHistory: (id, page, size) =>
      get<unknown>(`/target-sources/${id}/approval-history?page=${page}&size=${size}`),

    getApprovalRequestLatest: (id) =>
      get<unknown>(`/target-sources/${id}/approval-requests/latest`),

    getProcessStatus: (id) =>
      get<unknown>(`/target-sources/${id}/process-status`),

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
      post<TestConnectionTriggerResponseWire>(
        `/target-sources/${id}/test-connection/async${buildQuery({ collectorImageTag })}`,
      ),

    // GETs returned raw (wire snake) so the route handler is the sole casing
    // boundary (ADR-019 D1) — the BffClient contract is the upstream wire shape.
    getTestConnectionLatest: (id) =>
      getSnakeRaw<TestConnectionVersionResultWire>(
        `/target-sources/${id}/test-connection/latest_version`,
      ),

    getLatestTestConnectionResultSummaries: (id) =>
      getSnakeRaw<TestConnectionLatestResultSummaryResponseWire[]>(
        `/target-sources/${id}/test-connection/latest-results`,
      ),

    getTestConnectionCompletionStatus: (id) =>
      getSnakeRaw<TestConnectionCompletionStatusResponseWire>(
        `/target-sources/${id}/test-connection/completion-status`,
      ),

    updateTestConnectionConfirmation: (id, body) =>
      put<TestConnectionConfirmationResponseWire>(
        `/target-sources/${id}/test-connection-acknowledgment`,
        body,
      ),
  },

  guides: {
    get: (name) => get(`/admin/guides/${encodeURIComponent(name)}`),
    put: (name, body) => put(`/admin/guides/${encodeURIComponent(name)}`, body),
  },
};
