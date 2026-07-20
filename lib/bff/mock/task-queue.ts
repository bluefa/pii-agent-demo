import { NextResponse } from 'next/server';

/**
 * Admin Task Queue mocks. Ported from the prototype consts in
 * `design/pipeline/admin-taskqueue.html` (PROC / REQUESTS / NLB / TC / TC_DETAILS)
 * so mock mode shows the same demo data as the storyboard.
 *
 * Each method authors the swagger WIRE shape (snake, except the camel islands
 * TargetSourceInfo / NlbTableResponse); the admin/queue routes validate with
 * `schemas.X.parse` then reshape to camel domain (lib/types/task-queue.ts).
 *
 * Mutable module state gives the round-trips the api-spec calls for:
 *   - putNlbIndex moves listener occupancy across NLB rows (nlbState),
 *   - rejectTestConnection flips a target's test-connection status (tcState).
 * approval approve/reject/confirm reuse the existing `confirm.*` mock and are
 * intentionally NOT mirrored here (that state is owned by the confirm domain).
 */

// ── Process Status monitor (P1) ─────────────────────────────────────────────
interface ProcRow {
  ts: number;
  svc: string;
  code: string;
  pv: string;
  st: string;
  delay: number;
  at: string;
}

const PROC: ProcRow[] = [
  { ts: 1027, svc: '주문서비스', code: 'ORD', pv: 'IDC', st: 'PENDING', delay: 99120, at: '2026-07-19T16:08:00Z' },
  { ts: 2013, svc: '결제서비스', code: 'PAY', pv: 'AWS', st: 'PENDING', delay: 5430, at: '2026-07-20T18:09:00Z' },
  { ts: 1980, svc: '회원서비스', code: 'MBR', pv: 'GCP', st: 'CONFIRMING', delay: 1120, at: '2026-07-20T19:21:00Z' },
  { ts: 1861, svc: '정산서비스', code: 'STL', pv: 'AWS', st: 'CONFIRMED', delay: 262000, at: '2026-07-17T18:56:00Z' },
  { ts: 1799, svc: '배송서비스', code: 'DLV', pv: 'AZURE', st: 'INSTALLED', delay: 8460, at: '2026-07-20T17:19:00Z' },
  { ts: 1642, svc: '쿠폰서비스', code: 'CPN', pv: 'AWS', st: 'CONNECTED', delay: 47800, at: '2026-07-20T06:23:00Z' },
  { ts: 1511, svc: '리뷰서비스', code: 'RVW', pv: 'GCP', st: 'COMPLETED', delay: 604800, at: '2026-07-13T19:40:00Z' },
  { ts: 1444, svc: '검색서비스', code: 'SRC', pv: 'IDC', st: 'IDLE', delay: 1266000, at: '2026-07-06T04:00:00Z' },
  { ts: 2044, svc: '포인트서비스', code: 'PNT', pv: 'GCP', st: 'PENDING', delay: 12300, at: '2026-07-20T16:15:00Z' },
  { ts: 2051, svc: '알림서비스', code: 'NTF', pv: 'AZURE', st: 'PENDING', delay: 3400, at: '2026-07-20T18:43:00Z' },
  { ts: 1907, svc: '광고서비스', code: 'ADS', pv: 'AWS', st: 'IDLE', delay: 175000, at: '2026-07-18T11:02:00Z' },
  { ts: 1873, svc: '채팅서비스', code: 'CHT', pv: 'IDC', st: 'IDLE', delay: 445000, at: '2026-07-15T09:47:00Z' },
  { ts: 1583, svc: '재고서비스', code: 'IVT', pv: 'IDC', st: 'INSTALLED', delay: 93500, at: '2026-07-19T14:52:00Z' },
  { ts: 1520, svc: '추천서비스', code: 'RCM', pv: 'GCP', st: 'CONFIRMED', delay: 31700, at: '2026-07-20T10:52:00Z' },
  { ts: 1498, svc: '번역서비스', code: 'TRN', pv: 'AWS', st: 'COMPLETED', delay: 1123000, at: '2026-07-07T19:44:00Z' },
  { ts: 1462, svc: '인증서비스', code: 'ATH', pv: 'AZURE', st: 'CONNECTED', delay: 65900, at: '2026-07-20T01:22:00Z' },
  { ts: 1430, svc: '미디어서비스', code: 'MDA', pv: 'AWS', st: 'CONFIRMING', delay: 2300, at: '2026-07-20T19:02:00Z' },
  { ts: 1415, svc: '로그서비스', code: 'LOG', pv: 'GCP', st: 'COMPLETED', delay: 2210000, at: '2026-06-25T01:47:00Z' },
  { ts: 1388, svc: '과금서비스', code: 'BIL', pv: 'AWS', st: 'CONFIRMED', delay: 118000, at: '2026-07-19T10:53:00Z' },
  { ts: 1350, svc: '문의서비스', code: 'CSQ', pv: 'IDC', st: 'IDLE', delay: 1900000, at: '2026-06-28T15:53:00Z' },
  { ts: 1322, svc: '예약서비스', code: 'RSV', pv: 'AZURE', st: 'INSTALLED', delay: 15800, at: '2026-07-20T15:17:00Z' },
  { ts: 1287, svc: '통계서비스', code: 'STA', pv: 'GCP', st: 'COMPLETED', delay: 3020000, at: '2026-06-15T16:47:00Z' },
  { ts: 1255, svc: '메일서비스', code: 'MAI', pv: 'AWS', st: 'CONNECTED', delay: 52100, at: '2026-07-20T05:11:00Z' },
];

// ts → header identity (service/provider), sourced from the monitor list.
const TS_INDEX = new Map(PROC.map((p) => [p.ts, p]));

// ── Approval request queue (P2) ─────────────────────────────────────────────
interface RequestRow {
  ts: number;
  svc: string;
  code: string;
  pv: string;
  cs: string;
  reason?: string;
  at?: string;
}

const REQUESTS_PENDING: RequestRow[] = [
  { ts: 1027, svc: '주문서비스', code: 'ORD', pv: 'IDC', cs: 'PENDING' },
  { ts: 2013, svc: '결제서비스', code: 'PAY', pv: 'AWS', cs: 'PENDING' },
  { ts: 2044, svc: '포인트서비스', code: 'PNT', pv: 'GCP', cs: 'PENDING' },
  { ts: 2051, svc: '알림서비스', code: 'NTF', pv: 'AZURE', cs: 'PENDING' },
];

const REQUESTS_REJECTED: RequestRow[] = [
  {
    ts: 1907, svc: '광고서비스', code: 'ADS', pv: 'AWS', cs: 'REJECTED',
    reason: '선택된 리소스 중 stg 계정 리소스가 포함되어 있습니다. 운영 계정 리소스만 선택 후 재요청해 주세요.',
    at: '2026-07-18T11:02:00Z',
  },
  {
    ts: 1873, svc: '채팅서비스', code: 'CHT', pv: 'IDC', cs: 'REJECTED',
    reason: 'Oracle SID 미기입 — 접속 정보를 채워 다시 요청해 주세요.',
    at: '2026-07-15T09:47:00Z',
  },
];

const REQUESTS_ALL: RequestRow[] = [
  { ts: 1027, svc: '주문서비스', code: 'ORD', pv: 'IDC', cs: 'PENDING' },
  { ts: 2013, svc: '결제서비스', code: 'PAY', pv: 'AWS', cs: 'PENDING' },
  { ts: 1980, svc: '회원서비스', code: 'MBR', pv: 'GCP', cs: 'CONFIRMING' },
  { ts: 1907, svc: '광고서비스', code: 'ADS', pv: 'AWS', cs: 'REJECTED' },
  { ts: 1873, svc: '채팅서비스', code: 'CHT', pv: 'IDC', cs: 'REJECTED' },
  { ts: 1861, svc: '정산서비스', code: 'STL', pv: 'AWS', cs: 'CONFIRMED' },
  { ts: 1799, svc: '배송서비스', code: 'DLV', pv: 'AZURE', cs: 'CONFIRMED' },
  { ts: 1444, svc: '검색서비스', code: 'SRC', pv: 'IDC', cs: 'NO_REQUEST' },
];

const REASON_BY_TS = new Map(REQUESTS_REJECTED.map((r) => [r.ts, r]));

// ── NLB current occupancy (P3, IDC) — mutable so nlb saves move occupancy ────
interface NlbRow {
  nlbIndex: number;
  nlbIpList: string[];
  occupiedListenerCount: number;
}

const nlbState: NlbRow[] = [
  { nlbIndex: 1, nlbIpList: ['10.30.0.11', '10.30.0.12'], occupiedListenerCount: 12 },
  { nlbIndex: 2, nlbIpList: ['10.30.0.21', '10.30.0.22'], occupiedListenerCount: 28 },
  { nlbIndex: 3, nlbIpList: ['10.30.0.31', '10.30.0.32'], occupiedListenerCount: 42 },
  { nlbIndex: 4, nlbIpList: ['10.30.0.41', '10.30.0.42'], occupiedListenerCount: 55 },
  { nlbIndex: 5, nlbIpList: ['10.30.0.51', '10.30.0.52'], occupiedListenerCount: 8 },
  { nlbIndex: 6, nlbIpList: ['10.30.0.61', '10.30.0.62'], occupiedListenerCount: 31 },
];

// Current NLB assignment per (targetSourceId:resourceId), seeded from DETAILS[1027]
// so repeated saves move occupancy off the previous index.
const nlbAssignment = new Map<string, number>([
  ['1027:idc-r-8f21', 3],
  ['1027:idc-r-8f22', 3],
  ['1027:idc-r-8f23', 5],
]);

/** Shared with the reused `idc.getNlbTable` mock so both read one occupancy source. */
export function getNlbTableRows(): NlbRow[] {
  return nlbState.map((r) => ({ ...r, nlbIpList: [...r.nlbIpList] }));
}

function assignNlbIndex(targetSourceId: number, resourceId: string, nextIndex: number): void {
  const key = `${targetSourceId}:${resourceId}`;
  const prev = nlbAssignment.get(key);
  if (prev === nextIndex) return;
  if (prev !== undefined) {
    const prevRow = nlbState.find((r) => r.nlbIndex === prev);
    if (prevRow && prevRow.occupiedListenerCount > 0) prevRow.occupiedListenerCount -= 1;
  }
  const nextRow = nlbState.find((r) => r.nlbIndex === nextIndex);
  if (nextRow) nextRow.occupiedListenerCount += 1;
  nlbAssignment.set(key, nextIndex);
}

// ── Test Connection queue (P4/P5) — mutable status per target source ─────────
interface TcState {
  ts: number;
  svc: string;
  code: string;
  pv: string;
  status: string;
  completed_at: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
}

const tcState = new Map<number, TcState>([
  [1799, { ts: 1799, svc: '배송서비스', code: 'DLV', pv: 'AZURE', status: 'TEST_CONNECTION_COMPLETED', completed_at: '2026-07-20T17:19:00Z', rejected_at: null, reject_reason: null }],
  [1642, { ts: 1642, svc: '쿠폰서비스', code: 'CPN', pv: 'AWS', status: 'TEST_CONNECTION_COMPLETED', completed_at: '2026-07-20T06:23:00Z', rejected_at: null, reject_reason: null }],
  [1511, { ts: 1511, svc: '리뷰서비스', code: 'RVW', pv: 'GCP', status: 'TEST_CONNECTION_COMPLETED', completed_at: '2026-07-13T19:40:00Z', rejected_at: null, reject_reason: null }],
  [1583, { ts: 1583, svc: '재고서비스', code: 'IVT', pv: 'IDC', status: 'TEST_CONNECTION_REJECTED', completed_at: null, rejected_at: '2026-07-19T14:52:00Z', reject_reason: '대상 3건 중 1건 접속 실패(10.20.4.18:1521 timeout) — NLB 리스너 미반영 여부 확인 후 재실행 요청' }],
]);

// ── Wire builders ────────────────────────────────────────────────────────────
interface WirePage<T> {
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  content: T[];
  numberOfElements: number;
  empty: boolean;
  pageable: { pageNumber: number; pageSize: number; offset: number; paged: boolean; unpaged: boolean };
  sort: never[];
}

function wirePage<T>(all: T[], page: number, size: number): WirePage<T> {
  const offset = page * size;
  const content = all.slice(offset, offset + size);
  const totalPages = Math.max(1, Math.ceil(all.length / size));
  return {
    totalElements: all.length,
    totalPages,
    number: page,
    size,
    first: page === 0,
    last: page >= totalPages - 1,
    content,
    numberOfElements: content.length,
    empty: content.length === 0,
    pageable: { pageNumber: page, pageSize: size, offset, paged: true, unpaged: false },
    sort: [],
  };
}

function toProcessWire(p: ProcRow) {
  return {
    target_source_id: p.ts,
    process_status: p.st,
    status_changed_at: p.at,
    delay_seconds: p.delay,
    target_source: {
      id: p.ts,
      cloudProvider: p.pv,
      service_info: { serviceName: p.svc, code: p.code, abbr: p.code },
    },
  };
}

function toTargetSourceInfoWire(r: RequestRow) {
  const isRejected = r.cs === 'REJECTED';
  const rejected = REASON_BY_TS.get(r.ts) ?? r;
  const hasRequest = r.cs !== 'NO_REQUEST';
  return {
    targetSourceId: r.ts,
    serviceName: r.svc,
    serviceCode: r.code,
    cloudProvider: r.pv,
    confirmStatus: r.cs,
    latest_approval_request: hasRequest
      ? {
          request_id: r.ts,
          status: r.cs,
          requested_at: TS_INDEX.get(r.ts)?.at ?? null,
          reason: isRejected ? rejected.reason ?? null : null,
          processed_at: isRejected ? rejected.at ?? null : null,
        }
      : undefined,
  };
}

function toTcWire(s: TcState) {
  return {
    target_source_id: s.ts,
    target_source_exists: true,
    status: s.status,
    service_name: s.svc,
    service_code: s.code,
    cloud_provider: s.pv,
    completed_at: s.completed_at,
    rejected_at: s.rejected_at,
    reject_reason: s.reject_reason,
  };
}

export const mockTaskQueue = {
  // GET /dashboard/summary
  getDashboardSummary: async () =>
    NextResponse.json({
      pending_approval_count: REQUESTS_PENDING.length,
      rejected_approval_count: REQUESTS_REJECTED.length,
      test_connection_completed_count: [...tcState.values()].filter((s) => s.status === 'TEST_CONNECTION_COMPLETED').length,
      test_connection_rejection_count: [...tcState.values()].filter((s) => s.status === 'TEST_CONNECTION_REJECTED').length,
      evaluated_at: new Date().toISOString(),
    }),

  // GET /process-statuses?processStatus=&targetSourceId=&page=&size=
  getProcessStatuses: async (query: { processStatus?: string; targetSourceId?: number; page: number; size: number }) => {
    let rows = PROC;
    if (query.processStatus) rows = rows.filter((p) => p.st === query.processStatus);
    if (query.targetSourceId !== undefined) rows = rows.filter((p) => p.ts === query.targetSourceId);
    return NextResponse.json(wirePage(rows.map(toProcessWire), query.page, query.size));
  },

  // GET /target-sources/page?confirmStatus=&targetSourceId=&page=&size=
  getTargetSourcesPage: async (query: { confirmStatus?: string; targetSourceId?: number; page: number; size: number }) => {
    // Single-target header lookup (api-spec P3) — resolve from the monitor index.
    if (query.targetSourceId !== undefined) {
      const p = TS_INDEX.get(query.targetSourceId);
      const cs =
        REQUESTS_ALL.find((r) => r.ts === query.targetSourceId)?.cs ??
        (REASON_BY_TS.has(query.targetSourceId) ? 'REJECTED' : 'PENDING');
      const row: RequestRow | null = p
        ? { ts: p.ts, svc: p.svc, code: p.code, pv: p.pv, cs }
        : null;
      const content = row ? [toTargetSourceInfoWire(row)] : [];
      return NextResponse.json(wirePage(content, query.page, query.size));
    }

    const source =
      query.confirmStatus === 'PENDING'
        ? REQUESTS_PENDING
        : query.confirmStatus === 'REJECTED'
          ? REQUESTS_REJECTED
          : REQUESTS_ALL;
    return NextResponse.json(wirePage(source.map(toTargetSourceInfoWire), query.page, query.size));
  },

  // PUT …/approval-requests/nlb-indices — single { resource_id, nlb_index }.
  putNlbIndex: async (id: number, body: { resource_id?: string | null; nlb_index?: number | null }) => {
    if (body.resource_id && typeof body.nlb_index === 'number') {
      assignNlbIndex(id, body.resource_id, body.nlb_index);
    }
    return NextResponse.json({ resource_id: body.resource_id ?? null, nlb_index: body.nlb_index ?? null });
  },

  // GET /target-sources/test-connection/status?status=&page=&size=
  getTestConnectionPage: async (query: { status: string; page: number; size: number }) => {
    const rows = [...tcState.values()].filter((s) => s.status === query.status).map(toTcWire);
    return NextResponse.json(wirePage(rows, query.page, query.size));
  },

  // GET …/{id}/test-connection/status (single)
  getTestConnectionStatus: async (id: number) => {
    const s = tcState.get(id);
    if (s) return NextResponse.json(toTcWire(s));
    return NextResponse.json({ target_source_id: id, target_source_exists: false, status: null });
  },

  // POST …/{id}/test-connection/reject — flips the target to REJECTED.
  rejectTestConnection: async (id: number, body: { reason?: string | null }) => {
    const existing = tcState.get(id);
    const base: TcState = existing ?? {
      ts: id,
      svc: TS_INDEX.get(id)?.svc ?? '',
      code: TS_INDEX.get(id)?.code ?? '',
      pv: TS_INDEX.get(id)?.pv ?? 'IDC',
      status: 'TEST_CONNECTION_REJECTED',
      completed_at: null,
      rejected_at: null,
      reject_reason: null,
    };
    tcState.set(id, {
      ...base,
      status: 'TEST_CONNECTION_REJECTED',
      rejected_at: new Date().toISOString(),
      reject_reason: body.reason ?? null,
    });
    return NextResponse.json({ target_source_id: id, status: 'TEST_CONNECTION_REJECTED' });
  },
};
