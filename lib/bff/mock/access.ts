/**
 * 서비스 접근 권한 관리 — in-memory mock (docs/api/access-assumed-contracts.md).
 *
 * The whole feature is assumed-contract, so this file is the only place the rules
 * live: approving a request is what grants the permission, every write appends to
 * one history log, and `/admin/access/*` requires ADMIN while `/access/*` does not
 * (a user with no permission still has to be able to ask for one).
 *
 * Owner decisions (2026-08-13) baked in here:
 *  - **email is the identity key** for every write. Reads still return `knox_id`
 *    alongside it, but nothing is addressed by an internal id.
 *  - **knox_id is what screens display.** The contract carries no person name.
 *  - **no grant metadata.** 담당자 목록은 사용자 목록 그 자체이고, 누가 언제 어떤
 *    경로로 부여했는지는 `/history` 의 이벤트로만 남는다.
 *
 * The store is built on FIRST CALL, not at import — `lib/bff/client.ts` imports the
 * mock adapter unconditionally, so module-level seeding would run in HTTP mode too.
 *
 * 사용자 디렉터리는 `lib/mock-data.ts` 하나다. 이 파일에 따로 두지 않는 이유: 현재
 * 사용자는 그 배열에서만 나오므로, 여기 둔 사용자는 절대 로그인할 수 없다 — 권한이
 * 없는 사용자로 요청 화면을 열어 보는 것 자체가 불가능해진다.
 */
import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import type { User } from '@/lib/types';
import type {
  AccessHistoryTypeWire,
  AccessRequestStatusWire,
  AccessPageWire,
} from '@/lib/bff/types';

/** 담당자 관계 그 자체. 부여 메타데이터는 계약에 없으므로 저장하지도 않는다. */
interface Grant {
  serviceCode: string;
  userId: string;
}

interface AccessRequest {
  requestId: number;
  serviceCode: string;
  userId: string;
  reason: string;
  requestedAt: string;
  status: AccessRequestStatusWire;
  processedAt: string | null;
  processedBy: string | null;
  verdictMessage: string | null;
}

interface HistoryEntry {
  historyId: number;
  type: AccessHistoryTypeWire;
  serviceCode: string | null;
  targetUserId: string;
  actorId: string;
  reason: string | null;
  createdAt: string;
}

interface Store {
  users: User[];
  grants: Grant[];
  requests: AccessRequest[];
  history: HistoryEntry[];
  /** 관리자 user id 집합 — 여기도 부여 메타데이터는 없다. */
  admins: string[];
  requestSeq: number;
  historySeq: number;
}

/** Fixed seed timestamps — a mock that moves every reload is impossible to test. */
const T = (day: number, hour = 10): string =>
  `2026-08-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:20:00Z`;

let store: Store | null = null;
/** 최초 seed 때의 선언값. 부여/해제가 User 레코드를 고치므로, 이게 없으면 리셋이 리셋이 아니다. */
let declaredPermissions: Map<string, string[]> | null = null;

function seed(): Store {
  // 사용자는 mockData 를 참조로 쓴다 — 부여/해제가 `/user/services/page` 에도 반영돼야
  // "권한을 받으면 그 서비스가 보인다"가 성립하고, 현재 사용자도 이 배열에서만 나온다.
  const users = mockData.mockUsers;
  declaredPermissions ??= new Map(users.map((u) => [u.id, [...u.serviceCodePermissions]]));
  const declaredRoles = new Map(users.map((u) => [u.id, u.role]));
  for (const user of users) {
    user.serviceCodePermissions = [...(declaredPermissions.get(user.id) ?? [])];
    user.role = declaredRoles.get(user.id) ?? user.role;
  }

  const grants: Grant[] = [];
  const history: HistoryEntry[] = [];
  let historySeq = 1;

  // 기존 권한은 그대로 담당자 관계가 된다. 이력에는 부여 이벤트를 남기되 경로를
  // 번갈아 준다 — 직접 부여와 요청 승인이 이력에서 어떻게 갈리는지 보여야 해서.
  let n = 0;
  for (const user of users) {
    for (const serviceCode of user.serviceCodePermissions) {
      grants.push({ serviceCode, userId: user.id });
      history.push({
        historyId: historySeq++,
        type: n % 3 === 0 ? 'GRANTED' : 'APPROVED',
        serviceCode,
        targetUserId: user.id,
        actorId: 'admin-1',
        reason: null,
        createdAt: T(1 + (n % 9), 9 + (n % 8)),
      });
      n += 1;
    }
  }

  const requests: AccessRequest[] = [
    { requestId: 1001, serviceCode: 'aws', userId: 'user-6', reason: '신규 입사자 온보딩 — AWS 대상 설치 담당으로 배정되었습니다.', requestedAt: T(10, 9), status: 'PENDING', processedAt: null, processedBy: null, verdictMessage: null },
    { requestId: 1002, serviceCode: 'gcp', userId: 'user-8', reason: 'GCP 논리 DB 점검 업무를 인계받았습니다.', requestedAt: T(10, 14), status: 'PENDING', processedAt: null, processedBy: null, verdictMessage: null },
    { requestId: 1003, serviceCode: 'SDU', userId: 'user-4', reason: 'SDU 연동 요청 대응이 필요합니다.', requestedAt: T(11, 11), status: 'PENDING', processedAt: null, processedBy: null, verdictMessage: null },
    { requestId: 1004, serviceCode: 'idc', userId: 'user-7', reason: 'IDC 방화벽 신청 건 확인용으로 조회 권한이 필요합니다.', requestedAt: T(9, 16), status: 'REJECTED', processedAt: T(9, 18), processedBy: 'admin-1', verdictMessage: '담당 조직이 달라 반려해요. 인프라운영팀을 통해 다시 요청해 주세요.' },
    { requestId: 1005, serviceCode: 'azure', userId: 'user-9', reason: 'Azure Private Link 점검 지원.', requestedAt: T(8, 13), status: 'REJECTED', processedAt: T(8, 17), processedBy: 'admin-1', verdictMessage: '점검 기간이 끝나 접근이 더 필요하지 않아요.' },
    { requestId: 1006, serviceCode: 'aws', userId: 'user-3', reason: '스캔 결과 확인 권한이 필요합니다.', requestedAt: T(5, 10), status: 'APPROVED', processedAt: T(5, 15), processedBy: 'admin-1', verdictMessage: '승인했어요. 대상 등록 전 스캔 결과부터 확인해 주세요.' },
  ];

  for (const request of requests) {
    if (request.status === 'PENDING') continue;
    history.push({
      historyId: historySeq++,
      type: request.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
      serviceCode: request.serviceCode,
      targetUserId: request.userId,
      actorId: request.processedBy ?? 'admin-1',
      reason: request.verdictMessage,
      createdAt: request.processedAt ?? request.requestedAt,
    });
  }

  return {
    users,
    grants,
    requests,
    history,
    admins: users.filter((user) => user.role === 'ADMIN').map((user) => user.id),
    requestSeq: 1007,
    historySeq,
  };
}

const getStore = (): Store => (store ??= seed());

/** Test seam — drops the store so the next call re-seeds. */
export const __resetAccessStore = (): void => {
  store = null;
};

// ── helpers ──────────────────────────────────────────────────────────────────

const forbidden = (message: string): NextResponse =>
  NextResponse.json({ error: 'FORBIDDEN', message }, { status: 403 });

const badRequest = (message: string): NextResponse =>
  NextResponse.json({ error: 'BAD_REQUEST', message }, { status: 400 });

const notFound = (message: string): NextResponse =>
  NextResponse.json({ error: 'NOT_FOUND', message }, { status: 404 });

const conflict = (message: string): NextResponse =>
  NextResponse.json({ error: 'CONFLICT', message }, { status: 409 });

/** The caller, or null when the session is gone. */
const me = (): User | null => mockData.getCurrentUser() ?? null;

const isAdmin = (user: User | null): boolean =>
  user != null && getStore().admins.includes(user.id);

const userOf = (userId: string): User | undefined =>
  getStore().users.find((u) => u.id === userId);

/** 쓰기의 식별 키는 email — 대소문자는 무시한다(같은 사람을 두 번 부여하면 안 된다). */
const userByEmail = (email: string): User | undefined => {
  const needle = email.trim().toLowerCase();
  return getStore().users.find((u) => u.email.toLowerCase() === needle);
};

/** UserSummary — 이름은 계약에 없다. */
const userWire = (userId: string): { knox_id: string; email: string; role: string } => {
  const user = userOf(userId);
  return {
    knox_id: user?.knoxId ?? userId,
    email: user?.email ?? '',
    role: user?.role ?? 'SERVICE_MANAGER',
  };
};

/** 이력의 행위자·대상 — 표시에 필요한 최소값. */
const actorWire = (userId: string): { knox_id: string; email: string } => {
  const user = userOf(userId);
  return { knox_id: user?.knoxId ?? userId, email: user?.email ?? '' };
};

const serviceName = (code: string): string =>
  mockData.mockServiceCodes.find((s) => s.code === code)?.name ?? code;

/** Spring `Page` envelope over an already-sorted array. */
function page<T>(items: T[], pageNumber: number, size: number): AccessPageWire<T> {
  const safeSize = size > 0 ? size : 10;
  const start = pageNumber * safeSize;
  return {
    content: items.slice(start, start + safeSize),
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / safeSize)),
    size: safeSize,
    number: pageNumber,
  };
}

const nowIso = (): string => new Date().toISOString();

function log(entry: Omit<HistoryEntry, 'historyId' | 'createdAt'>): void {
  const s = getStore();
  s.history.push({ ...entry, historyId: s.historySeq++, createdAt: nowIso() });
}

/** Grant + mirror onto the user record so `/user/services/page` agrees. */
function addGrant(serviceCode: string, userId: string): boolean {
  const s = getStore();
  if (s.grants.some((g) => g.serviceCode === serviceCode && g.userId === userId)) return false;
  s.grants.push({ serviceCode, userId });
  const user = userOf(userId);
  if (user && !user.serviceCodePermissions.includes(serviceCode)) {
    user.serviceCodePermissions.push(serviceCode);
  }
  return true;
}

const requestWire = (request: AccessRequest) => ({
  request_id: request.requestId,
  service_code: request.serviceCode,
  service_name: serviceName(request.serviceCode),
  requester: userWire(request.userId),
  reason: request.reason,
  requested_at: request.requestedAt,
  status: request.status,
  processed_at: request.processedAt,
  processed_by: request.processedBy ? actorWire(request.processedBy) : null,
  verdict_message: request.verdictMessage,
});

const MAX_TEXT = 1000;
const trim = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : '';

const emailList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v !== '') : [];

/** knox_id 오름차순 — 부여 일시가 없으니 정렬은 사람 식별자로 한다(항상 같은 순서). */
const byKnoxId = (a: string, b: string): number =>
  (userOf(a)?.knoxId ?? a).localeCompare(userOf(b)?.knoxId ?? b);

// ── handlers ─────────────────────────────────────────────────────────────────

export const mockAccess = {
  // §1 — 서비스 담당자 목록
  listServiceUsers: async (serviceCode: string, pageNumber: number, size: number) => {
    if (!isAdmin(me())) return forbidden('관리자만 서비스 권한을 조회할 수 있어요.');
    const rows = getStore()
      .grants.filter((g) => g.serviceCode === serviceCode)
      .map((g) => g.userId)
      .sort(byKnoxId)
      .map(userWire);
    return NextResponse.json(page(rows, pageNumber, size));
  },

  // §2 — 직접 부여 (bulk, email 키)
  grantServiceUsers: async (serviceCode: string, emails: string[]) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 권한을 부여할 수 있어요.');
    const list = emailList(emails);
    if (list.length === 0) return badRequest('부여할 사용자를 한 명 이상 선택해 주세요.');
    let granted = 0;
    for (const email of list) {
      const user = userByEmail(email);
      if (!user) continue;
      if (!addGrant(serviceCode, user.id)) continue;
      granted += 1;
      log({ type: 'GRANTED', serviceCode, targetUserId: user.id, actorId: caller.id, reason: null });
    }
    return NextResponse.json({ granted_count: granted });
  },

  // §3 — 권한 해제 (email 키)
  revokeServiceUser: async (serviceCode: string, email: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 권한을 해제할 수 있어요.');
    const user = userByEmail(email);
    if (!user) return notFound('사용자를 찾을 수 없어요.');
    const s = getStore();
    const index = s.grants.findIndex((g) => g.serviceCode === serviceCode && g.userId === user.id);
    if (index < 0) return notFound('해당 사용자는 이 서비스 권한을 가지고 있지 않아요.');
    s.grants.splice(index, 1);
    user.serviceCodePermissions = user.serviceCodePermissions.filter((c) => c !== serviceCode);
    log({ type: 'REVOKED', serviceCode, targetUserId: user.id, actorId: caller.id, reason: null });
    return NextResponse.json({ ok: true });
  },

  // §4 — 요청 목록 / 상세 / 승인 / 반려
  listRequests: async (status: string | undefined, pageNumber: number, size: number) => {
    if (!isAdmin(me())) return forbidden('관리자만 접근 요청을 조회할 수 있어요.');
    const rows = getStore()
      .requests.filter((r) => status == null || status === 'ALL' || r.status === status)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map(requestWire);
    return NextResponse.json(page(rows, pageNumber, size));
  },

  getRequest: async (requestId: number) => {
    if (!isAdmin(me())) return forbidden('관리자만 접근 요청을 조회할 수 있어요.');
    const request = getStore().requests.find((r) => r.requestId === requestId);
    if (!request) return notFound('요청을 찾을 수 없어요.');
    return NextResponse.json(requestWire(request));
  },

  approveRequest: async (requestId: number, message: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 승인할 수 있어요.');
    const request = getStore().requests.find((r) => r.requestId === requestId);
    if (!request) return notFound('요청을 찾을 수 없어요.');
    if (request.status !== 'PENDING') return conflict('이미 처리된 요청이에요.');
    request.status = 'APPROVED';
    request.processedAt = nowIso();
    request.processedBy = caller.id;
    request.verdictMessage = trim(message) || null;
    // 승인이 곧 부여다 — 별도의 부여 호출은 없다.
    addGrant(request.serviceCode, request.userId);
    log({
      type: 'APPROVED',
      serviceCode: request.serviceCode,
      targetUserId: request.userId,
      actorId: caller.id,
      reason: request.verdictMessage,
    });
    return NextResponse.json(requestWire(request));
  },

  rejectRequest: async (requestId: number, reason: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 반려할 수 있어요.');
    const text = trim(reason);
    if (!text) return badRequest('반려 사유를 입력해 주세요.');
    const request = getStore().requests.find((r) => r.requestId === requestId);
    if (!request) return notFound('요청을 찾을 수 없어요.');
    if (request.status !== 'PENDING') return conflict('이미 처리된 요청이에요.');
    request.status = 'REJECTED';
    request.processedAt = nowIso();
    request.processedBy = caller.id;
    request.verdictMessage = text;
    log({
      type: 'REJECTED',
      serviceCode: request.serviceCode,
      targetUserId: request.userId,
      actorId: caller.id,
      reason: text,
    });
    return NextResponse.json(requestWire(request));
  },

  // §5 — 이력. 담당자 목록이 부여 메타데이터를 잃은 뒤로, "누가 언제 어떤 경로로"는
  // 오직 여기에만 남는다.
  listHistory: async (
    query: { serviceCode?: string; type?: string },
    pageNumber: number,
    size: number,
  ) => {
    if (!isAdmin(me())) return forbidden('관리자만 이력을 조회할 수 있어요.');
    const rows = getStore()
      .history.filter(
        (h) =>
          (query.serviceCode == null || h.serviceCode === query.serviceCode) &&
          (query.type == null || query.type === 'ALL' || h.type === query.type),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.historyId - a.historyId)
      .map((h) => ({
        history_id: h.historyId,
        type: h.type,
        service_code: h.serviceCode,
        service_name: h.serviceCode ? serviceName(h.serviceCode) : null,
        target_user: actorWire(h.targetUserId),
        actor: actorWire(h.actorId),
        reason: h.reason,
        created_at: h.createdAt,
      }));
    return NextResponse.json(page(rows, pageNumber, size));
  },

  // §6 — 관리자 권한
  listAdmins: async (pageNumber: number, size: number) => {
    if (!isAdmin(me())) return forbidden('관리자만 조회할 수 있어요.');
    const rows = getStore().admins.slice().sort(byKnoxId).map(userWire);
    return NextResponse.json(page(rows, pageNumber, size));
  },

  grantAdmins: async (emails: string[]) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 관리자 권한을 부여할 수 있어요.');
    const list = emailList(emails);
    if (list.length === 0) return badRequest('부여할 사용자를 한 명 이상 선택해 주세요.');
    const s = getStore();
    let granted = 0;
    for (const email of list) {
      const user = userByEmail(email);
      if (!user || s.admins.includes(user.id)) continue;
      s.admins.push(user.id);
      user.role = 'ADMIN';
      granted += 1;
      log({ type: 'ADMIN_GRANTED', serviceCode: null, targetUserId: user.id, actorId: caller.id, reason: null });
    }
    return NextResponse.json({ granted_count: granted });
  },

  revokeAdmin: async (email: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 관리자 권한을 회수할 수 있어요.');
    const user = userByEmail(email);
    if (!user) return notFound('사용자를 찾을 수 없어요.');
    // 자기 자신은 회수할 수 없다 — 마지막 관리자가 스스로를 지우면 되돌릴 화면이 없다.
    if (caller.id === user.id) return badRequest('자신의 관리자 권한은 회수할 수 없어요.');
    const s = getStore();
    const index = s.admins.indexOf(user.id);
    if (index < 0) return notFound('관리자가 아닌 사용자예요.');
    s.admins.splice(index, 1);
    user.role = 'SERVICE_MANAGER';
    log({ type: 'ADMIN_REVOKED', serviceCode: null, targetUserId: user.id, actorId: caller.id, reason: null });
    return NextResponse.json({ ok: true });
  },

  // §7 — 피커용 사용자 검색
  searchUsers: async (query: { query?: string; excludeServiceCode?: string; role?: string }) => {
    if (!isAdmin(me())) return forbidden('관리자만 사용자를 검색할 수 있어요.');
    const s = getStore();
    const q = (query.query ?? '').trim().toLowerCase();
    const users = s.users
      .filter((user) => {
        if (query.role === 'ADMIN' && s.admins.includes(user.id)) return false;
        if (
          query.excludeServiceCode != null &&
          s.grants.some((g) => g.serviceCode === query.excludeServiceCode && g.userId === user.id)
        ) {
          return false;
        }
        if (!q) return true;
        // 이름은 계약에 없다 — 검색도 knox_id 와 email 로만 한다.
        return user.knoxId.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
      })
      .sort((a, b) => a.knoxId.localeCompare(b.knoxId))
      .slice(0, 50)
      .map((user) => userWire(user.id));
    return NextResponse.json({ users });
  },

  // §8 — 요청 가능한 서비스 (내가 아직 못 가진 것 − 이미 요청 중인 것)
  listRequestableServices: async (query: string | undefined, pageNumber: number, size: number) => {
    const caller = me();
    if (!caller) return forbidden('로그인이 필요해요.');
    const s = getStore();
    const q = (query ?? '').trim().toLowerCase();
    const rows = mockData.mockServiceCodes
      .filter((service) => {
        if (s.grants.some((g) => g.serviceCode === service.code && g.userId === caller.id)) return false;
        if (
          s.requests.some(
            (r) => r.userId === caller.id && r.serviceCode === service.code && r.status === 'PENDING',
          )
        ) {
          return false;
        }
        if (!q) return true;
        return service.code.toLowerCase().includes(q) || service.name.toLowerCase().includes(q);
      })
      .map((service) => ({ service_code: service.code, service_name: service.name }));
    return NextResponse.json(page(rows, pageNumber, size));
  },

  // §9 — 요청 생성
  createRequest: async (serviceCode: string, reason: string) => {
    const caller = me();
    if (!caller) return forbidden('로그인이 필요해요.');
    const text = trim(reason);
    if (!serviceCode || !text) return badRequest('서비스와 요청 사유를 모두 입력해 주세요.');
    const s = getStore();
    if (s.grants.some((g) => g.serviceCode === serviceCode && g.userId === caller.id)) {
      return conflict('이미 접근 권한을 가지고 있어요.');
    }
    if (
      s.requests.some(
        (r) => r.userId === caller.id && r.serviceCode === serviceCode && r.status === 'PENDING',
      )
    ) {
      return conflict('이미 승인을 기다리는 요청이 있어요.');
    }
    const request: AccessRequest = {
      requestId: s.requestSeq++,
      serviceCode,
      userId: caller.id,
      reason: text,
      requestedAt: nowIso(),
      status: 'PENDING',
      processedAt: null,
      processedBy: null,
      verdictMessage: null,
    };
    s.requests.push(request);
    return NextResponse.json(requestWire(request));
  },

  // §10 — 내 요청 내역
  listMyRequests: async (pageNumber: number, size: number) => {
    const caller = me();
    if (!caller) return forbidden('로그인이 필요해요.');
    const rows = getStore()
      .requests.filter((r) => r.userId === caller.id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map(requestWire);
    return NextResponse.json(page(rows, pageNumber, size));
  },
};
