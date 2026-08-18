/**
 * 서비스 접근 권한 관리 — in-memory mock.
 *
 * 계약은 오너가 준 백엔드 초안 스펙 그대로다(docs/api/access-assumed-contracts.md) —
 * 경로·필드명·상태코드까지. 그래서 이 파일은 "우리가 지어낸 규칙"이 아니라 그 스펙의
 * 동작 정의를 담는다:
 *
 *  - **승인이 곧 부여다.** approve 는 담당자 부여까지 한 트랜잭션이고 204 를 준다.
 *  - **이미 처리된 요청은 400.** (409 가 아니라 — 스펙이 400 이라고 적었다.)
 *  - **마지막 관리자는 회수할 수 없다.** 400.
 *  - **사용자 요청 생성은 멱등이다.** PENDING 이 있으면 그대로 두고 204.
 *  - email 이 모든 쓰기의 식별 키, knox_id 가 화면에 찍는 값, 사람 이름은 없다.
 *
 * The store is built on FIRST CALL, not at import — `lib/bff/client.ts` imports the
 * mock adapter unconditionally, so module-level seeding would run in HTTP mode too.
 *
 * 사용자 디렉터리는 `lib/mock-data.ts` 하나다. 현재 사용자는 그 배열에서만 나오므로,
 * 여기 둔 사용자는 절대 로그인할 수 없다.
 */
import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import type { User } from '@/lib/types';
import type {
  AccessHistoryTypeWire,
  AccessPageWire,
  AccessRequestStatusWire,
  ServiceAccessStatusWire,
} from '@/lib/bff/types';

/** 권한 사용자 관계 그 자체. 부여 메타데이터는 계약에 없으므로 저장하지도 않는다. */
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
  processedNote: string | null;
}

interface HistoryEntry {
  historyId: number;
  type: AccessHistoryTypeWire;
  serviceCode: string | null;
  targetUserId: string;
  actorUserId: string;
  note: string | null;
  createdAt: string;
}

interface Store {
  users: User[];
  grants: Grant[];
  requests: AccessRequest[];
  history: HistoryEntry[];
  /** 관리자 user id 집합 — 여기도 부여 메타데이터는 없다. */
  admins: string[];
  /** service_code → 마지막 담당자 변경 시각 (AdminServiceRow.last_modified_at). */
  serviceTouchedAt: Record<string, string>;
  requestSeq: number;
  historySeq: number;
}

/** Fixed seed timestamps — a mock that moves every reload is impossible to test. */
const T = (day: number, hour = 10): string =>
  `2026-08-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:20:00Z`;

/**
 * 스토어는 **globalThis 에** 산다 — 모듈 레벨 변수로 두면 안 된다.
 *
 * Next 는 라우트 핸들러를 파일별로 번들링하므로 이 모듈이 라우트마다 별도 인스턴스로
 * 로드된다. `let store` 로 두면 `POST /access/services/{code}/permission-access` 가 쓴
 * 요청을 `GET /access/permission-access/mine` 이 영영 못 본다 — 쓰기는 204 로 성공하고
 * 목록만 조용히 그대로다. 같은 파일 안의 GET·POST 만 우연히 맞아 떨어져서 더 안 보인다.
 * pipeline·task-queue·ops 목이 이미 같은 이유로 globalThis 를 쓴다.
 *
 * `__accessMockDeclared` 는 최초 seed 때의 선언값이다. 부여/해제/관리자 변경이 User
 * 레코드를 **직접** 고치므로 이게 없으면 리셋이 리셋이 아니다. 권한과 role 을 한
 * 스냅샷에 같이 담는 게 핵심이다 — role 만 매 seed 때 다시 찍으면 "이미 바뀐 값"을
 * 선언값으로 굳혀 버려서, 관리자에서 내려온 사용자가 리셋 후에도 일반 사용자로 남고
 * 그 사용자가 호출자였다면 그 뒤 모든 관리자 조회가 403 이 된다.
 *
 * 이쪽도 같은 이유로 globalThis 다. 지역 변수로 두면 두 번째 번들이 **이미 바뀐**
 * mockUsers 를 선언값으로 굳힌다 — 지금은 seed 가 프로세스당 한 번뿐이라 닿지 않지만,
 * 리셋 seam 이 테스트 밖으로 나가는 순간 참이 된다.
 */
declare global {
  var __accessMockStore: Store | undefined;
  var __accessMockDeclared:
    | Map<string, { permissions: string[]; role: User['role'] }>
    | undefined;
}

function seed(): Store {
  // 사용자는 mockData 를 참조로 쓴다 — 부여/해제가 `/user/services/page` 에도 반영돼야
  // "권한을 받으면 그 서비스가 보인다"가 성립하고, 현재 사용자도 이 배열에서만 나온다.
  const users = mockData.mockUsers;
  const declared = (globalThis.__accessMockDeclared ??= new Map(
    users.map((u) => [u.id, { permissions: [...u.serviceCodePermissions], role: u.role }]),
  ));
  for (const user of users) {
    const initial = declared.get(user.id);
    user.serviceCodePermissions = [...(initial?.permissions ?? [])];
    user.role = initial?.role ?? user.role;
  }

  const grants: Grant[] = [];
  const history: HistoryEntry[] = [];
  const serviceTouchedAt: Record<string, string> = {};
  let historySeq = 1;

  // 기존 권한은 그대로 담당 관계가 된다. 이력에는 부여 이벤트를 남기되 경로를 번갈아
  // 준다 — 직접 부여와 요청 승인이 이력에서 어떻게 갈리는지 보여야 해서.
  let n = 0;
  for (const user of users) {
    for (const serviceCode of user.serviceCodePermissions) {
      const at = T(1 + (n % 9), 9 + (n % 8));
      grants.push({ serviceCode, userId: user.id });
      history.push({
        historyId: historySeq++,
        type: n % 3 === 0 ? 'OWNER_GRANTED' : 'REQUEST_APPROVED',
        serviceCode,
        targetUserId: user.id,
        actorUserId: 'admin-1',
        note: null,
        createdAt: at,
      });
      if (!serviceTouchedAt[serviceCode] || serviceTouchedAt[serviceCode] < at) {
        serviceTouchedAt[serviceCode] = at;
      }
      n += 1;
    }
  }

  const requests: AccessRequest[] = [
    { requestId: 1001, serviceCode: 'aws', userId: 'user-6', reason: '신규 입사자 온보딩 — AWS 대상 설치 담당으로 배정되었습니다.', requestedAt: T(10, 9), status: 'PENDING', processedAt: null, processedBy: null, processedNote: null },
    { requestId: 1002, serviceCode: 'gcp', userId: 'user-8', reason: 'GCP 논리 DB 점검 업무를 인계받았습니다.', requestedAt: T(10, 14), status: 'PENDING', processedAt: null, processedBy: null, processedNote: null },
    { requestId: 1003, serviceCode: 'SDU', userId: 'user-4', reason: 'SDU 연동 요청 대응이 필요합니다.', requestedAt: T(11, 11), status: 'PENDING', processedAt: null, processedBy: null, processedNote: null },
    { requestId: 1004, serviceCode: 'idc', userId: 'user-7', reason: 'IDC 방화벽 신청 건 확인용으로 조회 권한이 필요합니다.', requestedAt: T(9, 16), status: 'REJECTED', processedAt: T(9, 18), processedBy: 'admin-1', processedNote: '담당 조직이 달라 반려해요. 인프라운영팀을 통해 다시 요청해 주세요.' },
    { requestId: 1005, serviceCode: 'azure', userId: 'user-9', reason: 'Azure Private Link 점검 지원.', requestedAt: T(8, 13), status: 'REJECTED', processedAt: T(8, 17), processedBy: 'admin-1', processedNote: '점검 기간이 끝나 접근이 더 필요하지 않아요.' },
    { requestId: 1006, serviceCode: 'aws', userId: 'user-3', reason: '스캔 결과 확인 권한이 필요합니다.', requestedAt: T(5, 10), status: 'APPROVED', processedAt: T(5, 15), processedBy: 'admin-1', processedNote: '승인했어요. 대상 등록 전 스캔 결과부터 확인해 주세요.' },

    // 호출자(`admin-1`) 본인의 내역 — `/access-requests` 의 "내 요청 내역" 이 여기서만
    // 나온다. 세 상태를 모두 담고 5행 페이저를 한 번 넘기도록 7건이다.
    //
    // APPROVED 두 건의 서비스는 `mockUsers` 의 `admin-1` 권한 목록에도 들어 있다.
    // 승인은 났는데 접근 가능 목록에는 없는 상태가 되면 같은 화면의 두 탭이 서로 다른
    // 말을 한다(seed 는 승인 이력만 남기고 grant 를 따로 만들지 않는다).
    { requestId: 1007, serviceCode: 'PAY', userId: 'admin-1', reason: '결제 승인 로그의 PII 태깅 현황을 직접 확인해야 합니다.', requestedAt: T(3, 10), status: 'APPROVED', processedAt: T(3, 14), processedBy: 'admin-1', processedNote: '승인했어요.' },
    { requestId: 1008, serviceCode: 'MBR', userId: 'admin-1', reason: '회원 통합 인증 대상 등록 지원 건입니다.', requestedAt: T(4, 11), status: 'APPROVED', processedAt: T(4, 16), processedBy: 'admin-1', processedNote: '승인했어요. 대상 등록까지 함께 봐 주세요.' },
    { requestId: 1009, serviceCode: 'ORD', userId: 'admin-1', reason: '주문 취소·반품 경로의 개인정보 흐름을 점검하려 합니다.', requestedAt: T(6, 9), status: 'REJECTED', processedAt: T(6, 13), processedBy: 'admin-1', processedNote: '점검 범위가 확정되면 다시 요청해 주세요. 지금은 대상 목록이 비어 있어요.' },
    { requestId: 1010, serviceCode: 'ADS', userId: 'admin-1', reason: '광고 리포팅 적재 경로 확인.', requestedAt: T(7, 15), status: 'REJECTED', processedAt: T(7, 17), processedBy: 'admin-1', processedNote: '광고 도메인은 담당 조직에서 직접 관리해요.' },
    { requestId: 1011, serviceCode: 'CSC', userId: 'admin-1', reason: '고객센터 상담 이력은 EOS 예정 서비스라 종료 전 스캔 결과를 남겨 두려 합니다.', requestedAt: T(11, 9), status: 'PENDING', processedAt: null, processedBy: null, processedNote: null },
    { requestId: 1012, serviceCode: 'SEL', userId: 'admin-1', reason: '셀러 정산 대상 등록 문의 대응.', requestedAt: T(12, 10), status: 'PENDING', processedAt: null, processedBy: null, processedNote: null },
    { requestId: 1013, serviceCode: 'LOG', userId: 'admin-1', reason: '통합 로그 수집 파이프라인 점검.', requestedAt: T(12, 16), status: 'PENDING', processedAt: null, processedBy: null, processedNote: null },

    // 아래 둘은 이력 첫 장이 여섯 종류를 다 담게 하려고 최근으로 처리해 둔 건이다.
    // 이력에 REQUEST_* 를 직접 심지 않고 요청 행으로 두는 이유: 반려 탭은 반려된
    // **요청**을 세므로, 로그에만 반려 이벤트를 넣으면 탭은 4건인데 이력엔 5번
    // 반려한 것으로 보인다.
    //
    // 승인 건의 서비스는 대상자의 권한 목록에 이미 있고(minsu.park ← PRD), 반려 건의
    // 서비스는 없다(seoyeon.yoon ↛ NTF). 반대로 두면 "승인했는데 권한이 없다"거나
    // "반려했는데 들어가 있다"가 된다.
    { requestId: 1014, serviceCode: 'PRD', userId: 'user-4', reason: '상품 마스터 스캔 대상 등록을 맡게 되었습니다.', requestedAt: T(11, 9), status: 'APPROVED', processedAt: T(12, 17), processedBy: 'admin-1', processedNote: '승인했어요.' },
    { requestId: 1015, serviceCode: 'NTF', userId: 'user-8', reason: '알림 발송 로그의 수신자 정보를 확인하려 합니다.', requestedAt: T(10, 14), status: 'REJECTED', processedAt: T(11, 10), processedBy: 'admin-1', processedNote: '수신자 정보는 마스킹 대상이라 조회 권한을 드리기 어려워요.' },
  ];

  for (const request of requests) {
    if (request.status === 'PENDING') continue;
    history.push({
      historyId: historySeq++,
      type: request.status === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
      serviceCode: request.serviceCode,
      targetUserId: request.userId,
      actorUserId: request.processedBy ?? 'admin-1',
      note: request.processedNote,
      createdAt: request.processedAt ?? request.requestedAt,
    });
  }

  /**
   * 요청을 거치지 않는 네 종류 — 직접 부여·해제와 관리자 부여·회수. 이 넷은 런타임
   * 행동으로만 생겨서 seed 직후 이력에는 승인·반려 둘밖에 없었고, 그러면 화면이
   * 여섯 종류를 어떻게 그리는지 첫 장에서 볼 수가 없다.
   *
   * 날짜를 요청 처리분보다 뒤(10~13일)에 두어 위의 REQUEST_* 둘과 함께 이력 첫 장
   * 8줄 안에 여섯 종류가 다 든다.
   *
   * 부여는 대상자가 실제로 그 권한을 갖고 있는 쌍으로, 회수·해제는 갖고 있지 **않은**
   * 쌍으로 고른다 — 이력과 담당자 목록이 서로 다른 말을 하면 안 된다. 사유는 회수 쪽에만
   * 있다(피드는 사유가 있을 때만 셋째 줄을 그린다).
   *
   * `ADMIN_*` 둘은 서비스가 아니라 **관리자 역할**의 부여·회수다 — `service_code` 는
   * 계약상 언제나 null 이고(계약서 `AccessHistoryRow`), 이 파일의 런타임 기록부도 그렇게
   * 쓴다. 한동안 여기 seed 만 'RVW'·'CSC' 를 싣고 있어서, 서비스 이력에 실서버가 만들 수
   * 없는 줄이 떴다. 둘 다 대상이 `user-6` 인 것도 그래서다: 줬다가(12일) 거둔(13일) 한
   * 사람이라 최종 상태가 `admins` 와 맞는다.
   */
  const directEvents: Omit<HistoryEntry, 'historyId'>[] = [
    { type: 'ADMIN_REVOKED', serviceCode: null, targetUserId: 'user-6', actorUserId: 'admin-1', note: null, createdAt: T(13, 16) },
    { type: 'OWNER_GRANTED', serviceCode: 'IVT', targetUserId: 'user-5', actorUserId: 'user-1', note: null, createdAt: T(13, 11) },
    { type: 'ADMIN_GRANTED', serviceCode: null, targetUserId: 'user-6', actorUserId: 'admin-1', note: null, createdAt: T(12, 13) },
    { type: 'OWNER_REVOKED', serviceCode: 'DLV', targetUserId: 'user-7', actorUserId: 'user-2', note: '배송 정산 과제가 끝나 해제했어요.', createdAt: T(11, 15) },
  ];
  for (const event of directEvents) {
    history.push({ ...event, historyId: historySeq++ });
  }

  return {
    users,
    grants,
    requests,
    history,
    admins: users.filter((user) => user.role === 'ADMIN').map((user) => user.id),
    serviceTouchedAt,
    /** seed 의 마지막 requestId 다음 값 — 위 배열을 늘리면 여기도 같이 올린다. */
    requestSeq: 1016,
    historySeq,
  };
}

const getStore = (): Store => (globalThis.__accessMockStore ??= seed());

/** Test seam — drops the store so the next call re-seeds. */
export const __resetAccessStore = (): void => {
  globalThis.__accessMockStore = undefined;
};

// ── helpers ──────────────────────────────────────────────────────────────────

const forbidden = (message: string): NextResponse =>
  NextResponse.json({ error: 'FORBIDDEN', message }, { status: 403 });

const badRequest = (message: string): NextResponse =>
  NextResponse.json({ error: 'BAD_REQUEST', message }, { status: 400 });

const notFound = (message: string): NextResponse =>
  NextResponse.json({ error: 'NOT_FOUND', message }, { status: 404 });

const noContent = (): NextResponse => NextResponse.json({ ok: true });

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
  if (entry.serviceCode) s.serviceTouchedAt[entry.serviceCode] = nowIso();
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

/** knox_id 오름차순 — 부여 일시가 없으니 정렬은 사람 식별자로 한다(항상 같은 순서). */
const byKnoxId = (a: string, b: string): number =>
  (userOf(a)?.knoxId ?? a).localeCompare(userOf(b)?.knoxId ?? b);

const ownersOf = (serviceCode: string): string[] =>
  getStore()
    .grants.filter((g) => g.serviceCode === serviceCode)
    .map((g) => g.userId)
    .sort(byKnoxId);

const serviceOwnersWire = (serviceCode: string) => ({
  service_code: serviceCode,
  service_name: serviceName(serviceCode),
  owners: ownersOf(serviceCode).map(userWire),
});

const requestDetailWire = (request: AccessRequest) => ({
  request_id: request.requestId,
  service_code: request.serviceCode,
  service_name: serviceName(request.serviceCode),
  requester: userWire(request.userId),
  reason: request.reason,
  status: request.status,
  requested_at: request.requestedAt,
  processed_at: request.processedAt,
  processed_by: request.processedBy ? userWire(request.processedBy) : null,
  processed_note: request.processedNote,
});

/** 목록의 행 — 계약이 사유와 상태를 싣지 않는다(갭 B3). */
const requestRowWire = (request: AccessRequest) => ({
  request_id: request.requestId,
  service_code: request.serviceCode,
  service_name: serviceName(request.serviceCode),
  requester: userWire(request.userId),
  requested_at: request.requestedAt,
});

/** 한 사용자가 한 서비스에 대해 지금 어떤 상태인가. */
function accessStatusFor(userId: string, serviceCode: string): ServiceAccessStatusWire {
  const s = getStore();
  if (s.grants.some((g) => g.serviceCode === serviceCode && g.userId === userId)) return 'OWNED';
  const mine = s.requests
    .filter((r) => r.userId === userId && r.serviceCode === serviceCode)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  if (mine.some((r) => r.status === 'PENDING')) return 'REQUESTED';
  if (mine[0]?.status === 'REJECTED') return 'REJECTED';
  return 'NONE';
}

const MAX_TEXT = 1000;
const trim = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : '';

const emailList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v !== '') : [];

const matches = (haystack: string[], needle: string): boolean =>
  !needle || haystack.some((value) => value.toLowerCase().includes(needle));

// ── handlers ─────────────────────────────────────────────────────────────────

export const mockAccess = {
  // GET /admin/access/services?page&size&q — 코드·이름·담당자로 검색한다(2026-08-14 오너 스펙).
  listServices: async (query: string | undefined, pageNumber: number, size: number) => {
    if (!isAdmin(me())) return forbidden('관리자만 서비스를 조회할 수 있어요.');
    const s = getStore();
    const q = (query ?? '').trim().toLowerCase();
    const rows = mockData.mockServiceCodes
      .filter((service) => {
        // 담당자 축은 사람을 찾는 게 아니라 "이 사람이 담당인 서비스"를 찾는 것이다 —
        // 그래서 한 명이라도 걸리면 서비스가 남는다. 화면에 찍히는 값이 Knox ID 라
        // 그걸로도, 식별 키인 email 로도 걸린다.
        const people = ownersOf(service.code).flatMap((userId) => {
          const owner = userWire(userId);
          return [owner.knox_id, owner.email];
        });
        return matches([service.code, service.name, ...people], q);
      })
      .map((service) => {
        const owners = ownersOf(service.code);
        return {
          service_code: service.code,
          service_name: service.name,
          owner_count: owners.length,
          owners: owners.map(userWire),
          last_modified_at: s.serviceTouchedAt[service.code] ?? null,
        };
      });
    return NextResponse.json(page(rows, pageNumber, size));
  },

  // GET /admin/access/services/{serviceCode}/owners — 페이지가 아니다, 전체를 준다.
  listServiceOwners: async (serviceCode: string) => {
    if (!isAdmin(me())) return forbidden('관리자만 권한 사용자를 조회할 수 있어요.');
    return NextResponse.json(serviceOwnersWire(serviceCode));
  },

  // POST /admin/access/services/{serviceCode}/owners — 직접 부여 (일괄, email 키)
  addServiceOwners: async (serviceCode: string, emails: string[]) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 권한을 부여할 수 있어요.');
    const list = emailList(emails);
    if (list.length === 0) return badRequest('부여할 사용자를 한 명 이상 선택해 주세요.');
    for (const email of list) {
      const user = userByEmail(email);
      if (!user || !addGrant(serviceCode, user.id)) continue;
      log({ type: 'OWNER_GRANTED', serviceCode, targetUserId: user.id, actorUserId: caller.id, note: null });
    }
    return NextResponse.json(serviceOwnersWire(serviceCode));
  },

  // POST /admin/access/services/{serviceCode}/owners/remove — 해제 (email 키)
  removeServiceOwner: async (serviceCode: string, email: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 권한을 해제할 수 있어요.');
    const user = userByEmail(email);
    if (!user) return notFound('사용자를 찾을 수 없어요.');
    const s = getStore();
    const index = s.grants.findIndex((g) => g.serviceCode === serviceCode && g.userId === user.id);
    if (index < 0) return notFound('해당 사용자는 이 서비스 권한을 가지고 있지 않아요.');
    s.grants.splice(index, 1);
    user.serviceCodePermissions = user.serviceCodePermissions.filter((c) => c !== serviceCode);
    log({ type: 'OWNER_REVOKED', serviceCode, targetUserId: user.id, actorUserId: caller.id, note: null });
    return NextResponse.json(serviceOwnersWire(serviceCode));
  },

  // GET /admin/access/admins — 페이지가 아니다.
  listAdmins: async () => {
    if (!isAdmin(me())) return forbidden('관리자만 조회할 수 있어요.');
    return NextResponse.json({ admins: getStore().admins.slice().sort(byKnoxId).map(userWire) });
  },

  // POST /admin/access/admins — 한 명씩(계약이 단수다).
  addAdmin: async (email: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 관리자 권한을 부여할 수 있어요.');
    const user = userByEmail(email);
    if (!user) return notFound('사용자를 찾을 수 없어요.');
    const s = getStore();
    if (!s.admins.includes(user.id)) {
      s.admins.push(user.id);
      user.role = 'ADMIN';
      log({ type: 'ADMIN_GRANTED', serviceCode: null, targetUserId: user.id, actorUserId: caller.id, note: null });
    }
    return NextResponse.json(userWire(user.id));
  },

  // POST /admin/access/admins/remove — 마지막 관리자면 400.
  removeAdmin: async (email: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 관리자 권한을 회수할 수 있어요.');
    const user = userByEmail(email);
    if (!user) return notFound('사용자를 찾을 수 없어요.');
    const s = getStore();
    const index = s.admins.indexOf(user.id);
    if (index < 0) return notFound('관리자가 아닌 사용자예요.');
    // 스펙의 규칙은 "마지막 관리자면 400" — 자기 자신이냐가 아니라 몇 명 남느냐다.
    if (s.admins.length <= 1) return badRequest('마지막 관리자는 회수할 수 없어요.');
    s.admins.splice(index, 1);
    user.role = 'SERVICE_MANAGER';
    log({ type: 'ADMIN_REVOKED', serviceCode: null, targetUserId: user.id, actorUserId: caller.id, note: null });
    return noContent();
  },

  // GET /admin/access/permission-access?status&page&size
  listRequests: async (status: string | undefined, pageNumber: number, size: number) => {
    if (!isAdmin(me())) return forbidden('관리자만 접근 요청을 조회할 수 있어요.');
    const wanted = status ?? 'PENDING';
    const rows = getStore()
      .requests.filter((r) => wanted === 'ALL' || r.status === wanted)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map(requestRowWire);
    return NextResponse.json(page(rows, pageNumber, size));
  },

  getRequest: async (requestId: number) => {
    if (!isAdmin(me())) return forbidden('관리자만 접근 요청을 조회할 수 있어요.');
    const request = getStore().requests.find((r) => r.requestId === requestId);
    if (!request) return notFound('요청을 찾을 수 없어요.');
    return NextResponse.json(requestDetailWire(request));
  },

  // POST /admin/access/permission-access/{id}/approve — 담당자 부여까지 한 트랜잭션, 204.
  approveRequest: async (requestId: number, message: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 승인할 수 있어요.');
    const request = getStore().requests.find((r) => r.requestId === requestId);
    if (!request) return notFound('요청을 찾을 수 없어요.');
    if (request.status !== 'PENDING') return badRequest('이미 처리된 요청이에요.');
    request.status = 'APPROVED';
    request.processedAt = nowIso();
    request.processedBy = caller.id;
    request.processedNote = trim(message) || null;
    addGrant(request.serviceCode, request.userId);
    log({
      type: 'REQUEST_APPROVED',
      serviceCode: request.serviceCode,
      targetUserId: request.userId,
      actorUserId: caller.id,
      note: request.processedNote,
    });
    return noContent();
  },

  // POST /admin/access/permission-access/{id}/reject — 사유 필수, 204.
  rejectRequest: async (requestId: number, reason: string) => {
    const caller = me();
    if (!isAdmin(caller) || !caller) return forbidden('관리자만 반려할 수 있어요.');
    const text = trim(reason);
    if (!text) return badRequest('반려 사유를 입력해 주세요.');
    const request = getStore().requests.find((r) => r.requestId === requestId);
    if (!request) return notFound('요청을 찾을 수 없어요.');
    if (request.status !== 'PENDING') return badRequest('이미 처리된 요청이에요.');
    request.status = 'REJECTED';
    request.processedAt = nowIso();
    request.processedBy = caller.id;
    request.processedNote = text;
    log({
      type: 'REQUEST_REJECTED',
      serviceCode: request.serviceCode,
      targetUserId: request.userId,
      actorUserId: caller.id,
      note: text,
    });
    return noContent();
  },

  // GET /admin/access/history?service_code&type&page&size — 부여 경로는 여기서만 갈린다.
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
        target_user: userWire(h.targetUserId),
        actor_user: userWire(h.actorUserId),
        note: h.note,
        created_at: h.createdAt,
      }));
    return NextResponse.json(page(rows, pageNumber, size));
  },

  // GET /users/search?q= — 실계약. 이름이 없으니 knox_id·email 로만 찾는다.
  //
  // 제외 목록은 받지 않는다 — 계약의 `excludeIds` 키잉이 미확정이라 화면이 거른다(E4).
  //
  // 빈 질의는 아무도 돌려주지 않는다. 검색은 "찾는 사람을 아는 사람"을 위한 것이고,
  // 질의 없이 부르면 사람 디렉터리 전체를 열거하는 창구가 된다. 화면도 검색어가 있을
  // 때만 부르지만, 규칙은 서버 쪽에도 있어야 다른 호출자가 우회하지 못한다.
  searchUsers: async (query: string | undefined) => {
    if (!isAdmin(me())) return forbidden('관리자만 사용자를 검색할 수 있어요.');
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return NextResponse.json({ users: [] });
    const users = getStore()
      .users.filter((user) => matches([user.knoxId, user.email], q))
      .sort((a, b) => a.knoxId.localeCompare(b.knoxId))
      .slice(0, 50)
      .map((user) => userWire(user.id));
    return NextResponse.json({ users });
  },

  // POST /services/{serviceCode}/permission-access — 사용자 측, 멱등, 204.
  createRequest: async (serviceCode: string, reason: string) => {
    const caller = me();
    if (!caller) return forbidden('로그인이 필요해요.');
    const text = trim(reason);
    if (!serviceCode || !text) return badRequest('서비스와 요청 사유를 모두 입력해 주세요.');
    const s = getStore();
    // 멱등: 이미 대기 중이면 그대로 두고 성공으로 답한다(중복 신청이 에러가 아니다).
    const pending = s.requests.some(
      (r) => r.userId === caller.id && r.serviceCode === serviceCode && r.status === 'PENDING',
    );
    if (!pending) {
      s.requests.push({
        requestId: s.requestSeq++,
        serviceCode,
        userId: caller.id,
        reason: text,
        requestedAt: nowIso(),
        status: 'PENDING',
        processedAt: null,
        processedBy: null,
        processedNote: null,
      });
    }
    return noContent();
  },

  /**
   * GET /permission-access/mine?status&page&size — 사용자 본인의 요청 내역.
   *
   * 업스트림은 `/user/permission-access` — 2026-08-14 실구현으로 갭 B4 가 닫혔다.
   * **상세와 같은 shape 이 아니다**: 실응답은 여섯 필드뿐이라 요청자도 처리 결과도 오지
   * 않는다(그 shape 을 가정했다가 `requester.knox_id` 에서 터졌다). `access_status`
   * 만으로는 처리 일시를 말할 수 없어서, 이 엔드포인트가 있어야 "승인 내역 조회"가
   * 성립한다 — 반려 사유는 아직 못 온다(B5).
   *
   * `status` 를 주면 그 상태만. 화면 머리가 상태별 건수를 `size=1` 로 세는 축이다.
   */
  listMyRequests: async (status: string | undefined, pageNumber: number, size: number) => {
    const caller = me();
    if (!caller) return forbidden('로그인이 필요해요.');
    const rows = getStore()
      .requests.filter((r) => r.userId === caller.id)
      .filter((r) => !status || r.status === status)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      // 실구현이 싣는 여섯 필드만 — 관리자 상세의 shape 을 여기서 흉내 내면 목이
      // 있지도 않은 처리 결과를 주고, 화면은 실서버에서만 비는 열을 그린다.
      .map((r) => ({
        request_id: r.requestId,
        service_code: r.serviceCode,
        service_name: serviceName(r.serviceCode),
        status: r.status,
        reason: r.reason,
        requested_at: r.requestedAt,
      }));
    return NextResponse.json(page(rows, pageNumber, size));
  },

  /**
   * GET /user/services/page — **내가 담당인 서비스만**. ADMIN 은 전체를 받는다.
   *
   * 2026-08-14 오너 스펙: 경로 이름과 뜻이 어긋나지 않게 이 호출을 담당 서비스로 좁혔다.
   * 화면의 "내가 접근할 수 있는 서비스" 탭이 여기서 나온다 — ADMIN 은 전체가 오므로
   * 화면이 `OWNED` 로 한 번 더 거른다(관리자는 role 로 통과할 뿐 담당자는 아니다).
   */
  listUserServices: async (query: string | undefined, pageNumber: number, size: number) => {
    const caller = me();
    if (!caller) return forbidden('로그인이 필요해요.');
    const q = (query ?? '').trim().toLowerCase();
    const rows = mockData.mockServiceCodes
      .filter((service) => matches([service.code, service.name], q))
      .filter((service) => isAdmin(caller) || accessStatusFor(caller.id, service.code) === 'OWNED')
      .map((service) => ({
        service_code: service.code,
        service_name: service.name,
        access_status: accessStatusFor(caller.id, service.code),
        is_eos_service: service.isEosService ?? null,
      }));
    return NextResponse.json(page(rows, pageNumber, size));
  },

  /**
   * GET /services/page — 전체 서비스 + 내 access_status + 담당자. 신청 대상 선택용.
   *
   * `/user/services/page` 가 담당 서비스로 좁혀지면서 갈라져 나온 목록이다. 담당자를
   * 함께 싣는 건 "이름이 비슷한 서비스가 많아 어디에 신청할지 헷갈린다"는 요청 때문이고,
   * 화면은 그 이름들을 행의 둘째 단에 그린다.
   */
  listServicesPage: async (query: string | undefined, pageNumber: number, size: number) => {
    const caller = me();
    if (!caller) return forbidden('로그인이 필요해요.');
    const q = (query ?? '').trim().toLowerCase();
    const rows = mockData.mockServiceCodes
      .filter((service) => matches([service.code, service.name], q))
      .map((service) => {
        const owners = ownersOf(service.code);
        return {
          service_code: service.code,
          service_name: service.name,
          // 카탈로그에 약어가 없다 — 목이 지어내면 있지도 않은 값이 화면에 선다.
          service_abbr_name: null,
          access_status: accessStatusFor(caller.id, service.code),
          is_eos_service: service.isEosService ?? null,
          // "담당자 표시명" — 계약에 사람 이름이 없으므로 Knox ID 가 그 이름이다.
          owners: owners.map((userId) => userWire(userId).knox_id),
          owner_count: owners.length,
        };
      });
    return NextResponse.json(page(rows, pageNumber, size));
  },
};
