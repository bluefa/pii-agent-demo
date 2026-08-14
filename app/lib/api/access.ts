/**
 * 서비스 접근 권한 관리 — CSR adapter (docs/api/access-assumed-contracts.md).
 *
 * 라우트가 스펙의 snake wire 를 그대로 흘려보내므로 **이 파일이 이 기능의 유일한
 * wire↔domain 경계**다 — 운영 콘솔과 같은 분업. 아래 화면들은 여기 선언된 camel 도메인만
 * 본다.
 *
 * 계약은 오너가 준 백엔드 초안 스펙 그대로다. 세 가지가 화면 모양을 정한다:
 *  - 사람에겐 **이름이 없다**. `knoxId` 를 찍고 `email` 로 쓴다.
 *  - 권한 사용자·관리자 목록은 **페이지가 아니다**. 전체를 받아 화면에서 나눠 그린다.
 *  - 승인·반려·회수는 **204** 다. 응답 본문이 없으니 호출한 화면이 다시 읽는다.
 */
import { fetchInfraJson } from '@/app/lib/api/infra';
import type {
  AccessHistoryPageWire,
  AccessHistoryRowWire,
  AccessHistoryTypeWire,
  AccessPageWire,
  AccessRequestStatusWire,
  AccessUserSearchWire,
  AccessUserWire,
  AdminListWire,
  AdminServicePageWire,
  AdminServiceRowWire,
  MyAccessRequestPageWire,
  MyAccessRequestWire,
  PermissionRequestDetailWire,
  PermissionRequestPageWire,
  PermissionRequestRowWire,
  ServiceAccessStatusWire,
  ServiceOwnersWire,
  ServicePageRowWire,
  ServicePageWire,
  UserServicePageWire,
  UserServiceRowWire,
} from '@/lib/bff/types';

// ── Domain models ────────────────────────────────────────────────────────────

/**
 * 사람. **이름이 없다** — 계약이 주지 않는다.
 * 화면에 찍는 값은 `knoxId`, 서버에 보내는 키는 `email`.
 */
export interface AccessUser {
  knoxId: string;
  email: string;
  role: string;
}

export type AccessRequestStatus = AccessRequestStatusWire;
export type AccessHistoryType = AccessHistoryTypeWire;
export type ServiceAccessStatus = ServiceAccessStatusWire;

/** Spring `Page` subset — 페이지드 엔드포인트가 주는 다섯 키. */
export interface AccessPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * 관리자 서비스 목록의 행 — 레일이 그리는 것이 전부다.
 *
 * 계약은 `owner_count`·`owners`·`last_modified_at` 도 싣지만 레일은 타일·이름·코드만
 * 그린다. 안 그리는 것을 행마다 도메인 객체로 빚어 두면 "어딘가 쓰이겠지"로 읽히므로
 * 투영하지 않는다 — 그릴 자리가 생기면 그때 `toServiceRow` 한 곳만 늘리면 된다.
 */
export interface AdminServiceRow {
  serviceCode: string;
  serviceName: string;
}

/** 한 서비스의 권한 사용자 — 페이지가 아니라 전체. */
export interface ServiceOwners {
  serviceCode: string;
  serviceName: string;
  owners: AccessUser[];
}

/** 요청 목록의 행. 사유와 상태가 없다 — 계약 갭(B3). */
export interface PermissionRequestRow {
  requestId: number;
  serviceCode: string;
  serviceName: string;
  requester: AccessUser;
  requestedAt: string;
}

/** 요청 상세 — 사유와 판정이 사는 곳. */
export interface PermissionRequestDetail {
  requestId: number;
  serviceCode: string;
  serviceName: string;
  requester: AccessUser;
  reason: string;
  status: AccessRequestStatus;
  requestedAt: string;
  processedAt: string | null;
  processedBy: AccessUser | null;
  /** 승인 메시지 또는 반려 사유. */
  processedNote: string | null;
}

/**
 * 내 요청 한 줄 — `GET /user/permission-access` 가 싣는 것이 전부다.
 *
 * 관리자 상세(`PermissionRequestDetail`)와 이름이 겹치지만 **다른 것이다.** 처리 결과
 * 셋도 요청자도 오지 않는다. 없는 것을 타입에 적어 두면 화면이 언제나 비어 있는 열을
 * 그리고, 코드는 오지 않는 필드를 읽는다 — `requester.knox_id` 에서 실제로 터졌다.
 * 반려 사유가 요청자에게 닿지 않는 건 갭이다(B5).
 */
export interface MyAccessRequest {
  requestId: number;
  serviceCode: string;
  serviceName: string;
  status: AccessRequestStatus;
  reason: string;
  requestedAt: string;
}

export interface AccessHistoryEntry {
  historyId: number;
  type: AccessHistoryType;
  serviceCode: string | null;
  serviceName: string | null;
  targetUser: AccessUser;
  actorUser: AccessUser;
  note: string | null;
  createdAt: string;
}

/** 사용자 시점의 서비스 한 줄 — 담당 서비스 목록(`/user/services/page`). */
export interface UserServiceRow {
  serviceCode: string;
  serviceName: string;
  accessStatus: ServiceAccessStatus;
  isEosService: boolean | null;
}

/**
 * 전체 서비스 목록의 한 줄(`/services/page`) — 신청 대상 선택용.
 *
 * 담당자를 함께 싣는 계약이라 행이 이름 하나로 끝나지 않는다. 이름이 비슷한 서비스가
 * 많아 어디에 신청할지 헷갈린다는 게 그 필드가 생긴 이유이고, 화면은 정확히 그 자리에
 * 그린다 — 이름 아래 둘째 단.
 */
export interface ServiceRow extends UserServiceRow {
  /** 없으면 null — 카탈로그가 약어를 갖고 있을 때만 온다. */
  serviceAbbrName: string | null;
  /** 담당자 표시명. `ownerCount` 는 이 배열이 잘려 와도 맞는 전체 수다. */
  owners: string[];
  ownerCount: number;
}

// ── Wire → domain ────────────────────────────────────────────────────────────

/**
 * 페이지가 아닌 응답(권한 사용자·관리자 전체)을 카드가 쓰는 페이지 모양으로 자른다.
 * 계약이 전체를 주기로 한 이상 나누는 일은 화면 몫이다.
 */
export function sliceToPage<T>(items: T[], page: number, size: number): AccessPage<T> {
  const safeSize = size > 0 ? size : 10;
  const start = page * safeSize;
  return {
    content: items.slice(start, start + safeSize),
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / safeSize)),
    number: page,
    size: safeSize,
  };
}

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

const toServiceRow = (wire: AdminServiceRowWire): AdminServiceRow => ({
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
});

const toServiceOwners = (wire: ServiceOwnersWire): ServiceOwners => ({
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
  owners: (wire.owners ?? []).map(toUser),
});

const toRequestRow = (wire: PermissionRequestRowWire): PermissionRequestRow => ({
  requestId: wire.request_id,
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
  requester: toUser(wire.requester),
  requestedAt: wire.requested_at,
});

const toRequestDetail = (wire: PermissionRequestDetailWire): PermissionRequestDetail => ({
  requestId: wire.request_id,
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
  requester: toUser(wire.requester),
  reason: wire.reason,
  status: wire.status,
  requestedAt: wire.requested_at,
  processedAt: wire.processed_at,
  processedBy: wire.processed_by ? toUser(wire.processed_by) : null,
  processedNote: wire.processed_note,
});

const toMyRequest = (wire: MyAccessRequestWire): MyAccessRequest => ({
  requestId: wire.request_id,
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
  status: wire.status,
  reason: wire.reason,
  requestedAt: wire.requested_at,
});

const toHistoryEntry = (wire: AccessHistoryRowWire): AccessHistoryEntry => ({
  historyId: wire.history_id,
  type: wire.type,
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
  targetUser: toUser(wire.target_user),
  actorUser: toUser(wire.actor_user),
  note: wire.note,
  createdAt: wire.created_at,
});

const toUserService = (wire: UserServiceRowWire): UserServiceRow => ({
  serviceCode: wire.service_code,
  serviceName: wire.service_name,
  accessStatus: wire.access_status,
  // 미지정은 "EOS 아님"이 아니라 "모름"이다 — false 로 접지 않는다.
  isEosService: wire.is_eos_service ?? null,
});

const toServicePageRow = (wire: ServicePageRowWire): ServiceRow => ({
  ...toUserService(wire),
  serviceAbbrName: wire.service_abbr_name ?? null,
  owners: wire.owners ?? [],
  ownerCount: wire.owner_count ?? 0,
});

// ── Client funcs ─────────────────────────────────────────────────────────────

/**
 * 카드 본문 한 장의 행 수 — 화면들이 공유하는 높이이자 조회의 기본 `size` 다.
 *
 * 둘은 같은 수여야 한다. 갈리면 한 장에 열 줄을 받아 다섯 줄짜리 칸에 그리거나,
 * 스켈레톤이 실제 행보다 짧게 뜬다. 그래서 이름도 하나다 — `PagedCard` 의 스켈레톤과
 * `sliceToPage` 의 폭까지 전부 여기서 온다.
 */
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

/** 관리자 서비스 목록 — 레일의 데이터원. */
export async function getAdminServices(
  search: string | undefined,
  page: number,
  opts?: Opts,
): Promise<AccessPage<AdminServiceRow>> {
  const wire = await fetchInfraJson<AdminServicePageWire>(
    `/admin/access/services?${query({ q: search, page, size: opts?.size ?? ACCESS_PAGE_SIZE })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toServiceRow);
}

/** 한 서비스의 권한 사용자 전체. */
export async function getServiceOwners(
  serviceCode: string,
  opts?: { signal?: AbortSignal },
): Promise<ServiceOwners> {
  return toServiceOwners(
    await fetchInfraJson<ServiceOwnersWire>(
      `/admin/access/services/${encodeURIComponent(serviceCode)}/owners`,
      { signal: opts?.signal },
    ),
  );
}

/** 직접 부여 — 갱신된 전체 목록이 돌아오므로 재조회가 필요 없다. */
export async function addServiceOwners(
  serviceCode: string,
  emails: string[],
): Promise<ServiceOwners> {
  return toServiceOwners(
    await fetchInfraJson<ServiceOwnersWire>(
      `/admin/access/services/${encodeURIComponent(serviceCode)}/owners`,
      { method: 'POST', body: { emails } },
    ),
  );
}

/** 권한 해제 — email 은 body 로 보낸다(URL 에 실으면 로그에 개인정보가 남는다). */
export async function removeServiceOwner(
  serviceCode: string,
  email: string,
): Promise<ServiceOwners> {
  return toServiceOwners(
    await fetchInfraJson<ServiceOwnersWire>(
      `/admin/access/services/${encodeURIComponent(serviceCode)}/owners/remove`,
      { method: 'POST', body: { email } },
    ),
  );
}

/** 관리자 전체 — 페이지가 아니다. */
export async function getAdmins(opts?: { signal?: AbortSignal }): Promise<AccessUser[]> {
  const wire = await fetchInfraJson<AdminListWire>('/admin/access/admins', {
    signal: opts?.signal,
  });
  return (wire.admins ?? []).map(toUser);
}

/** 관리자 권한 부여 — 계약이 단수라 한 번에 한 명이다. */
export async function addAdmin(email: string): Promise<AccessUser> {
  return toUser(
    await fetchInfraJson<AccessUserWire>('/admin/access/admins', {
      method: 'POST',
      body: { email },
    }),
  );
}

/** 관리자 권한 회수 — 마지막 관리자면 서버가 400. */
export function removeAdmin(email: string): Promise<void> {
  return fetchInfraJson<void>('/admin/access/admins/remove', {
    method: 'POST',
    body: { email },
  });
}

/** 요청 목록. `status` 생략 = 서버 기본값(PENDING). */
export async function getAccessRequests(
  status: AccessRequestStatus | undefined,
  page: number,
  opts?: Opts,
): Promise<AccessPage<PermissionRequestRow>> {
  const wire = await fetchInfraJson<PermissionRequestPageWire>(
    `/admin/access/permission-access?${query({
      status,
      page,
      size: opts?.size ?? ACCESS_PAGE_SIZE,
    })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toRequestRow);
}

export async function getAccessRequest(
  requestId: number,
  opts?: { signal?: AbortSignal },
): Promise<PermissionRequestDetail> {
  return toRequestDetail(
    await fetchInfraJson<PermissionRequestDetailWire>(
      `/admin/access/permission-access/${requestId}`,
      { signal: opts?.signal },
    ),
  );
}

/**
 * 승인 — 이 호출이 곧 부여다. 204 라 반환값이 없다.
 *
 * 메시지는 선택이라 비어 있으면 **키째 뺀다.** `{ message: "" }` 를 보내면 빈 문자열을
 * 그대로 저장하는 서버에서 상세 화면의 "메시지 없이 승인했어요" 대체 문구가 빗나가고,
 * 처리 결과 자리가 빈칸으로 남는다.
 */
export function approveAccessRequest(requestId: number, message: string): Promise<void> {
  const trimmed = message.trim();
  return fetchInfraJson<void>(`/admin/access/permission-access/${requestId}/approve`, {
    method: 'POST',
    body: trimmed ? { message: trimmed } : {},
  });
}

/** 반려 — 사유는 요청자에게 그대로 전달된다. 204. */
export function rejectAccessRequest(requestId: number, reason: string): Promise<void> {
  return fetchInfraJson<void>(`/admin/access/permission-access/${requestId}/reject`, {
    method: 'POST',
    body: { reason },
  });
}

/** 이력. `serviceCode` 를 주면 그 서비스 코드 단위 이력이 된다. */
export async function getAccessHistory(
  filter: { serviceCode?: string; type?: AccessHistoryType },
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

/**
 * 부여 피커용 검색.
 *
 * 이미 가진 사람은 **여기서** 걸러 낸다. 계약의 `excludeIds` 가 무엇으로 키잉되는지
 * 확인되지 않았고(응답에는 id 가 없다) 틀린 키를 실으면 서버가 조용히 무시해 후보가
 * 다시 올라온다 — 확인 전까지는 확실한 쪽에서 거른다(E4).
 */
export async function searchAccessUsers(
  search: string | undefined,
  excludeEmails: string[],
  opts?: { signal?: AbortSignal },
): Promise<AccessUser[]> {
  const wire = await fetchInfraJson<AccessUserSearchWire>(
    `/admin/access/users?${query({ q: search })}`,
    { signal: opts?.signal },
  );
  const excluded = new Set(excludeEmails.map((email) => email.trim().toLowerCase()));
  return (wire.users ?? []).filter((u) => !excluded.has(u.email.toLowerCase())).map(toUser);
}

/** 내가 담당인 서비스 목록 — ADMIN 은 전체가 오므로 화면이 `OWNED` 로 한 번 더 거른다. */
export async function getUserServices(
  search: string | undefined,
  page: number,
  opts?: Opts,
): Promise<AccessPage<UserServiceRow>> {
  const wire = await fetchInfraJson<UserServicePageWire>(
    `/access/user-services?${query({
      query: search,
      page,
      size: opts?.size ?? ACCESS_PAGE_SIZE,
    })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toUserService);
}

/** 전체 서비스 목록 — 신청 대상을 고르는 쪽. 담당자가 행마다 실려 온다. */
export async function getServicesPage(
  search: string | undefined,
  page: number,
  opts?: Opts,
): Promise<AccessPage<ServiceRow>> {
  const wire = await fetchInfraJson<ServicePageWire>(
    `/access/services-page?${query({
      query: search,
      page,
      size: opts?.size ?? ACCESS_PAGE_SIZE,
    })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toServicePageRow);
}

/** 권한 요청 생성 — 멱등이라 이미 대기 중이어도 성공한다. 204. */
export function createAccessRequest(serviceCode: string, reason: string): Promise<void> {
  return fetchInfraJson<void>(
    `/access/services/${encodeURIComponent(serviceCode)}/permission-access`,
    { method: 'POST', body: { reason } },
  );
}

/**
 * 내 요청 내역 — `GET /user/permission-access`.
 *
 * `status` 를 주면 그 상태만 온다. 헤더 판정이 상태별 건수를 말해야 하는데 세는 데
 * 필요한 건 `totalElements` 뿐이라, 목록을 통째로 받아 화면에서 세는 대신 `size=1` 로
 * 상태마다 한 줄씩 받아 수만 읽는다. 서비스가 2,000 개인 계정에서 전체를 훑으면
 * 화면 하나가 열 몇 번의 왕복이 된다.
 */
export async function getMyAccessRequests(
  status: AccessRequestStatus | undefined,
  page: number,
  opts?: Opts,
): Promise<AccessPage<MyAccessRequest>> {
  const wire = await fetchInfraJson<MyAccessRequestPageWire>(
    `/access/permission-access/mine?${query({
      status,
      page,
      size: opts?.size ?? ACCESS_PAGE_SIZE,
    })}`,
    { signal: opts?.signal },
  );
  return toPage(wire, toMyRequest);
}
