/**
 * 서비스 접근 권한 관리 — CSR adapter (docs/api/access-assumed-contracts.md).
 *
 * The routes pass the assumed snake wire through verbatim, so THIS FILE is the
 * one wire↔domain boundary for the feature — same split the ops console uses.
 * Components below it only ever see the camel domain types declared here.
 *
 * Every endpoint here is ASSUMED: it 404s against the real BFF until the
 * contract ships. The doc above is the record of what was invented and why.
 */
import { fetchInfraJson } from '@/app/lib/api/infra';
import type {
  AccessActorWire,
  AccessGrantPageWire,
  AccessGrantResultWire,
  AccessHistoryItemWire,
  AccessHistoryPageWire,
  AccessHistoryTypeWire,
  AccessPageWire,
  AccessRequestItemWire,
  AccessRequestPageWire,
  AccessRequestStatusWire,
  AccessUserSearchWire,
  AccessUserWire,
  AdminGrantPageWire,
  RequestableServicePageWire,
} from '@/lib/bff/types';

// ── Domain models ────────────────────────────────────────────────────────────

/**
 * 사람. **이름이 없다** — 계약이 주지 않는다(owner decision 2026-08-13).
 * 화면에 찍는 값은 `knoxId`, 서버에 보내는 키는 `email`.
 */
export interface AccessUser {
  knoxId: string;
  email: string;
  role: string;
}

/** 이력의 행위자·대상 — 표시에 필요한 최소값. */
export interface AccessActor {
  knoxId: string;
  email: string;
}

export type AccessRequestStatus = AccessRequestStatusWire;
export type AccessHistoryType = AccessHistoryTypeWire;

/** Spring `Page` subset — the assumed endpoints return exactly these five keys. */
export interface AccessPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface AccessRequest {
  requestId: number;
  serviceCode: string;
  serviceName: string;
  requester: AccessUser;
  reason: string;
  requestedAt: string;
  status: AccessRequestStatus;
  processedAt: string | null;
  processedBy: AccessActor | null;
  /** 승인 메시지 또는 반려 사유 — 결정의 말이 한 자리에 있다. */
  verdictMessage: string | null;
}

export interface AccessHistoryEntry {
  historyId: number;
  type: AccessHistoryType;
  serviceCode: string | null;
  serviceName: string | null;
  targetUser: AccessActor;
  actor: AccessActor;
  reason: string | null;
  createdAt: string;
}

export interface RequestableService {
  serviceCode: string;
  serviceName: string;
}

// ── Wire → domain ────────────────────────────────────────────────────────────

const toPage = <W, T>(wire: AccessPageWire<W>, map: (item: W) => T): AccessPage<T> => ({
  content: (wire.content ?? []).map(map),
  totalElements: wire.totalElements ?? 0,
  totalPages: Math.max(1, wire.totalPages ?? 1),
  number: wire.number ?? 0,
  size: wire.size ?? 0,
});

const toUser = (wire: AccessUserWire): AccessUser => ({
  knoxId: wire.knox_id,
  email: wire.email,
  role: wire.role,
});

const toActor = (wire: AccessActorWire): AccessActor => ({
  knoxId: wire.knox_id,
  email: wire.email,
});

const toRequest = (wire: AccessRequestItemWire): AccessRequest => ({
  requestId: wire.request_id,
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
  requester: toUser(wire.requester),
  reason: wire.reason,
  requestedAt: wire.requested_at,
  status: wire.status,
  processedAt: wire.processed_at,
  processedBy: wire.processed_by ? toActor(wire.processed_by) : null,
  verdictMessage: wire.verdict_message,
});

const toHistoryEntry = (wire: AccessHistoryItemWire): AccessHistoryEntry => ({
  historyId: wire.history_id,
  type: wire.type,
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
  targetUser: toActor(wire.target_user),
  actor: toActor(wire.actor),
  reason: wire.reason,
  createdAt: wire.created_at,
});

// ── Client funcs ─────────────────────────────────────────────────────────────

/** Shared page size — one card body height across every table in the section. */
export const ACCESS_PAGE_SIZE = 5;

interface Opts {
  signal?: AbortSignal;
  size?: number;
}

const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
};

/** §1 — 서비스 담당자. 항목은 사용자 그 자체다(부여 메타데이터는 계약에 없다). */
export async function getServiceUsers(
  serviceCode: string,
  page: number,
  opts?: Opts,
): Promise<AccessPage<AccessUser>> {
  const wire = await fetchInfraJson<AccessGrantPageWire>(
    `/admin/access/services/${encodeURIComponent(serviceCode)}/users?${query({
      page,
      size: opts?.size ?? ACCESS_PAGE_SIZE,
    })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toUser);
}

/** §2 — 직접 부여. 한 번의 호출로 선택한 사용자 전부를 부여한다(키는 email). */
export function grantServiceUsers(
  serviceCode: string,
  emails: string[],
): Promise<AccessGrantResultWire> {
  return fetchInfraJson<AccessGrantResultWire>(
    `/admin/access/services/${encodeURIComponent(serviceCode)}/users`,
    { method: 'POST', body: { emails } },
  );
}

/** §3 — 권한 해제. email 은 body 로 보낸다 — URL 에 실으면 로그에 개인정보가 남는다. */
export function revokeServiceUser(serviceCode: string, email: string): Promise<void> {
  return fetchInfraJson<void>(
    `/admin/access/services/${encodeURIComponent(serviceCode)}/users/remove`,
    { method: 'POST', body: { email } },
  );
}

/** §4 — 접근 요청 목록. `status` 생략 = 전체. */
export async function getAccessRequests(
  status: AccessRequestStatus | 'ALL' | undefined,
  page: number,
  opts?: Opts,
): Promise<AccessPage<AccessRequest>> {
  const wire = await fetchInfraJson<AccessRequestPageWire>(
    `/admin/access/requests?${query({ status, page, size: opts?.size ?? ACCESS_PAGE_SIZE })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toRequest);
}

/** §4 — 요청 상세. */
export async function getAccessRequest(
  requestId: number,
  opts?: { signal?: AbortSignal },
): Promise<AccessRequest> {
  return toRequest(
    await fetchInfraJson<AccessRequestItemWire>(`/admin/access/requests/${requestId}`, {
      signal: opts?.signal,
    }),
  );
}

/** §4 — 승인. 이 호출이 곧 권한 부여다. */
export async function approveAccessRequest(
  requestId: number,
  message: string,
): Promise<AccessRequest> {
  return toRequest(
    await fetchInfraJson<AccessRequestItemWire>(`/admin/access/requests/${requestId}/approve`, {
      method: 'POST',
      body: { message },
    }),
  );
}

/** §4 — 반려. 사유는 요청자에게 그대로 전달된다. */
export async function rejectAccessRequest(
  requestId: number,
  reason: string,
): Promise<AccessRequest> {
  return toRequest(
    await fetchInfraJson<AccessRequestItemWire>(`/admin/access/requests/${requestId}/reject`, {
      method: 'POST',
      body: { reason },
    }),
  );
}

/** §5 — 이력. `serviceCode` 를 주면 그 서비스 코드 단위 이력이 된다. */
export async function getAccessHistory(
  filter: { serviceCode?: string; type?: AccessHistoryType | 'ALL' },
  page: number,
  opts?: Opts,
): Promise<AccessPage<AccessHistoryEntry>> {
  const wire = await fetchInfraJson<AccessHistoryPageWire>(
    `/admin/access/history?${query({
      service_code: filter.serviceCode,
      type: filter.type,
      page,
      size: opts?.size ?? ACCESS_PAGE_SIZE,
    })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toHistoryEntry);
}

/** §6 — 관리자 목록. 여기도 항목은 사용자 그 자체다. */
export async function getAccessAdmins(
  page: number,
  opts?: Opts,
): Promise<AccessPage<AccessUser>> {
  const wire = await fetchInfraJson<AdminGrantPageWire>(
    `/admin/access/admins?${query({ page, size: opts?.size ?? ACCESS_PAGE_SIZE })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toUser);
}

/** §6 — 관리자 권한 부여 (키는 email). */
export function grantAdmins(emails: string[]): Promise<AccessGrantResultWire> {
  return fetchInfraJson<AccessGrantResultWire>('/admin/access/admins', {
    method: 'POST',
    body: { emails },
  });
}

/** §6 — 관리자 권한 회수 (자기 자신은 서버가 400). */
export function revokeAdmin(email: string): Promise<void> {
  return fetchInfraJson<void>('/admin/access/admins/remove', {
    method: 'POST',
    body: { email },
  });
}

/** §7 — 부여 피커용 사용자 검색. */
export async function searchAccessUsers(
  filter: { query?: string; excludeServiceCode?: string; role?: 'ADMIN' },
  opts?: { signal?: AbortSignal },
): Promise<AccessUser[]> {
  const wire = await fetchInfraJson<AccessUserSearchWire>(
    `/admin/access/users?${query({
      query: filter.query,
      exclude_service_code: filter.excludeServiceCode,
      role: filter.role,
    })}`,
    { signal: opts?.signal },
  );
  return (wire.users ?? []).map(toUser);
}

/** §8 — 내가 아직 권한이 없는(그리고 대기 중 요청도 없는) 서비스. */
export async function getRequestableServices(
  search: string | undefined,
  page: number,
  opts?: Opts,
): Promise<AccessPage<RequestableService>> {
  const wire = await fetchInfraJson<RequestableServicePageWire>(
    `/access/requestable-services?${query({
      query: search,
      page,
      size: opts?.size ?? ACCESS_PAGE_SIZE,
    })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, (item) => ({
    serviceCode: item.service_code,
    serviceName: item.service_name,
  }));
}

/** §9 — 권한 요청 생성. 이미 보유/대기 중이면 서버가 409. */
export async function createAccessRequest(
  serviceCode: string,
  reason: string,
): Promise<AccessRequest> {
  return toRequest(
    await fetchInfraJson<AccessRequestItemWire>('/access/requests', {
      method: 'POST',
      body: { service_code: serviceCode, reason },
    }),
  );
}

/** §10 — 내 요청 내역 (승인·반려 결과 포함). */
export async function getMyAccessRequests(
  page: number,
  opts?: Opts,
): Promise<AccessPage<AccessRequest>> {
  const wire = await fetchInfraJson<AccessRequestPageWire>(
    `/access/requests?${query({ page, size: opts?.size ?? ACCESS_PAGE_SIZE })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toRequest);
}
