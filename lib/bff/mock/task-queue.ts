import { NextResponse } from 'next/server';
import type { AlertTargetKind } from '@/lib/types/task-queue';

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
  { ts: 1031, svc: '주문서비스', code: 'ORD', pv: 'IDC', st: 'PENDING', delay: 99120, at: '2026-07-19T16:08:00Z' },
  { ts: 2113, svc: '결제서비스', code: 'PAY', pv: 'AWS', st: 'PENDING', delay: 5430, at: '2026-07-20T18:09:00Z' },
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
  { ts: 1031, svc: '주문서비스', code: 'ORD', pv: 'IDC', cs: 'PENDING' },
  { ts: 2113, svc: '결제서비스', code: 'PAY', pv: 'AWS', cs: 'PENDING' },
  { ts: 2044, svc: '포인트서비스', code: 'PNT', pv: 'GCP', cs: 'PENDING' },
  { ts: 2051, svc: '알림서비스', code: 'NTF', pv: 'AZURE', cs: 'PENDING' },
];

// 100자 반려 사유 — 목록 셀에서 잘리고 hover 툴팁에서만 전문이 보이는 경로를
// 실제로 밟게 하는 표본. 짧은 사유만 있으면 잘림·툴팁이 검증되지 않는다.
// P2 목록(REQUESTS_REJECTED)과 P3 상세(SEED_APPROVAL_DEMO)가 같은 문장을
// 들어야 하므로 한 곳에서 선언한다.
const ADS_REJECT_REASON =
  '선택된 리소스 중 stg 계정 리소스가 포함되어 있고, 운영 계정 태그 규칙(env=prod)도 지켜지지 않았습니다. 태그를 정리한 뒤 운영 계정 리소스만 다시 선택해 재요청해 주세요.';
const ADS_REJECTED_AT = '2026-07-18T11:02:00Z';

// 짧은 사유 쪽 표본(IDC) — 같은 블록이 한 줄짜리 사유에서도 성립하는지 본다.
const CHT_REJECT_REASON = 'Oracle SID 미기입 — 접속 정보를 채워 다시 요청해 주세요.';
const CHT_REJECTED_AT = '2026-07-15T09:47:00Z';

const REQUESTS_REJECTED: RequestRow[] = [
  {
    ts: 1907, svc: '광고서비스', code: 'ADS', pv: 'AWS', cs: 'REJECTED',
    reason: ADS_REJECT_REASON,
    at: ADS_REJECTED_AT,
  },
  {
    ts: 1873, svc: '채팅서비스', code: 'CHT', pv: 'IDC', cs: 'REJECTED',
    reason: CHT_REJECT_REASON,
    at: CHT_REJECTED_AT,
  },
];

// ── Approval history (global, GET /approval-history) ────────────────────────
// Item wire = user-sanctioned assumption (swagger 200 is the generic Page; gap
// documented in lib/types/task-queue.ts). Newest first; covers all 7 enums.
// Real /approval-history rows are flat camelCase keyed by historyRecordId (the
// only unique id — requestId AND targetSourceId repeat: e.g. 1031 spans 3 rows).
// actorId is the acting admin; null while PENDING (not yet processed), 시스템 for
// AUTO_APPROVED.
interface ApprovalHistoryFixture {
  historyRecordId: number;
  requestId: number;
  targetSourceId: number;
  status: string;
  createdAt: string;
  serviceName: string;
  serviceCode: string;
  actorId: string | null;
  // Target source cloud — UPPERCASE wire; consistent per targetSourceId.
  cloudProvider: string;
}

const APPROVAL_HISTORY: ApprovalHistoryFixture[] = [
  { historyRecordId: 923, requestId: 5121, targetSourceId: 1031, status: 'PENDING', createdAt: '2026-07-20T09:12:00Z', serviceName: '주문서비스', serviceCode: 'ORD', actorId: null, cloudProvider: 'IDC' },
  { historyRecordId: 922, requestId: 5118, targetSourceId: 2113, status: 'PENDING', createdAt: '2026-07-20T08:40:00Z', serviceName: '결제서비스', serviceCode: 'PAY', actorId: null, cloudProvider: 'AWS' },
  { historyRecordId: 921, requestId: 5116, targetSourceId: 2044, status: 'PENDING', createdAt: '2026-07-19T18:03:00Z', serviceName: '포인트서비스', serviceCode: 'PNT', actorId: null, cloudProvider: 'GCP' },
  { historyRecordId: 920, requestId: 5112, targetSourceId: 2051, status: 'PENDING', createdAt: '2026-07-19T15:27:00Z', serviceName: '알림서비스', serviceCode: 'NTF', actorId: null, cloudProvider: 'AZURE' },
  { historyRecordId: 919, requestId: 5107, targetSourceId: 1861, status: 'APPROVED', createdAt: '2026-07-19T11:20:00Z', serviceName: '정산서비스', serviceCode: 'STL', actorId: '관리자', cloudProvider: 'AWS' },
  { historyRecordId: 918, requestId: 5101, targetSourceId: 1907, status: 'REJECTED', createdAt: '2026-07-18T11:02:00Z', serviceName: '광고서비스', serviceCode: 'ADS', actorId: '관리자', cloudProvider: 'AWS' },
  { historyRecordId: 917, requestId: 5093, targetSourceId: 1980, status: 'AUTO_APPROVED', createdAt: '2026-07-17T22:10:00Z', serviceName: '회원서비스', serviceCode: 'MBR', actorId: '시스템', cloudProvider: 'GCP' },
  { historyRecordId: 916, requestId: 5090, targetSourceId: 1799, status: 'APPROVED', createdAt: '2026-07-17T14:55:00Z', serviceName: '배송서비스', serviceCode: 'DLV', actorId: '관리자', cloudProvider: 'AZURE' },
  { historyRecordId: 915, requestId: 5084, targetSourceId: 1027, status: 'UNAVAILABLE_ACKNOWLEDGED', createdAt: '2026-07-16T10:31:00Z', serviceName: '쿠폰서비스', serviceCode: 'CPN', actorId: '관리자', cloudProvider: 'AWS' },
  { historyRecordId: 914, requestId: 5080, targetSourceId: 1027, status: 'UNAVAILABLE', createdAt: '2026-07-16T09:02:00Z', serviceName: '쿠폰서비스', serviceCode: 'CPN', actorId: '관리자', cloudProvider: 'AWS' },
  { historyRecordId: 913, requestId: 5074, targetSourceId: 1873, status: 'REJECTED', createdAt: '2026-07-15T09:47:00Z', serviceName: '채팅서비스', serviceCode: 'CHT', actorId: '관리자', cloudProvider: 'IDC' },
  { historyRecordId: 912, requestId: 5069, targetSourceId: 1583, status: 'CANCELLED', createdAt: '2026-07-14T17:26:00Z', serviceName: '인증서비스', serviceCode: 'ATH', actorId: '관리자', cloudProvider: 'IDC' },
  { historyRecordId: 911, requestId: 5061, targetSourceId: 1583, status: 'PENDING', createdAt: '2026-07-14T09:15:00Z', serviceName: '인증서비스', serviceCode: 'ATH', actorId: null, cloudProvider: 'IDC' },
  { historyRecordId: 910, requestId: 5055, targetSourceId: 1861, status: 'PENDING', createdAt: '2026-07-13T13:44:00Z', serviceName: '정산서비스', serviceCode: 'STL', actorId: null, cloudProvider: 'AWS' },
  { historyRecordId: 909, requestId: 5049, targetSourceId: 1444, status: 'CANCELLED', createdAt: '2026-07-12T16:08:00Z', serviceName: '검색서비스', serviceCode: 'SRC', actorId: '관리자', cloudProvider: 'IDC' },
  { historyRecordId: 908, requestId: 5041, targetSourceId: 1980, status: 'PENDING', createdAt: '2026-07-11T10:52:00Z', serviceName: '회원서비스', serviceCode: 'MBR', actorId: null, cloudProvider: 'GCP' },
  { historyRecordId: 907, requestId: 5033, targetSourceId: 1799, status: 'AUTO_APPROVED', createdAt: '2026-07-10T19:37:00Z', serviceName: '배송서비스', serviceCode: 'DLV', actorId: '시스템', cloudProvider: 'AZURE' },
  { historyRecordId: 906, requestId: 5027, targetSourceId: 1907, status: 'PENDING', createdAt: '2026-07-10T08:21:00Z', serviceName: '광고서비스', serviceCode: 'ADS', actorId: null, cloudProvider: 'AWS' },
  { historyRecordId: 905, requestId: 5019, targetSourceId: 1873, status: 'PENDING', createdAt: '2026-07-09T15:03:00Z', serviceName: '채팅서비스', serviceCode: 'CHT', actorId: null, cloudProvider: 'IDC' },
  { historyRecordId: 904, requestId: 5012, targetSourceId: 1031, status: 'REJECTED', createdAt: '2026-07-08T11:49:00Z', serviceName: '주문서비스', serviceCode: 'ORD', actorId: '관리자', cloudProvider: 'IDC' },
  { historyRecordId: 903, requestId: 5006, targetSourceId: 1031, status: 'PENDING', createdAt: '2026-07-08T09:30:00Z', serviceName: '주문서비스', serviceCode: 'ORD', actorId: null, cloudProvider: 'IDC' },
  { historyRecordId: 902, requestId: 4998, targetSourceId: 1444, status: 'APPROVED', createdAt: '2026-07-07T14:12:00Z', serviceName: '검색서비스', serviceCode: 'SRC', actorId: '관리자', cloudProvider: 'IDC' },
  { historyRecordId: 901, requestId: 4991, targetSourceId: 2113, status: 'CANCELLED', createdAt: '2026-07-06T10:05:00Z', serviceName: '결제서비스', serviceCode: 'PAY', actorId: '관리자', cloudProvider: 'AWS' },
];

// ── NLB index mappings (…/approval-requests/latest/nlb-index-mappings) ──────
// OFF-CONTRACT endpoint (user-provided wire, 2026-07-21). Per resource: the NLB
// listeners currently serving it, one entry per consuming service.
interface NlbIndexMappingFixture {
  resource_id: string;
  nlb_index_mapping_list: { service_code: string; nlb_index: number }[];
}

/**
 * Worst-case fan-out for the 서비스·NLB 조합 modal: 30 NLB indexes × 20 services = 600
 * combinations on ONE IP Set (오너 확인: NLB 30, NLB당 서비스 ~20). The old 24-entry
 * fixture hid every layout question this surface actually has.
 *
 * The 24 hand-written codes stay at the front so the demo still reads as real service
 * codes; the remaining 576 are generated as unique base-26 triples, strided by 389 so
 * they scatter instead of running AAA, AAB, AAC. 389 is coprime with 26³, so the stride
 * visits every triple once and the codes cannot collide.
 */
const NAMED_SERVICE_CODES = [
  'ORD', 'PAY', 'MBR', 'DLV', 'STL', 'CHT', 'ADS', 'SRC', 'PNT', 'NTF', 'CPN', 'ATH',
  'RVW', 'INV', 'FLT', 'CRM', 'BIL', 'LOG', 'RCM', 'EVT', 'QNA', 'VOC', 'TAG', 'GFT',
] as const;

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 600 distinct codes: the 24 named ones, then strided triples, skipping any that
 *  collide with a named code (the stride reaches ORD and PNT on its own). */
function serviceCodes(count: number): string[] {
  const out: string[] = [...NAMED_SERVICE_CODES];
  const used = new Set(out);
  for (let n = 0; out.length < count; n += 1) {
    const k = (n * 389) % 17576;
    const code =
      ALPHA[Math.floor(k / 676) % 26]! + ALPHA[Math.floor(k / 26) % 26]! + ALPHA[k % 26]!;
    if (used.has(code)) continue;
    used.add(code);
    out.push(code);
  }
  return out;
}

/** 600 combinations: NLB #1…#30, 20 services each. */
const WIDE_FAN_OUT = serviceCodes(600).map((service_code, i) => ({
  service_code,
  nlb_index: (i % 30) + 1,
}));

const NLB_INDEX_MAPPINGS = new Map<number, NlbIndexMappingFixture[]>([
  [1031, [
    { resource_id: 'idc-r-8f21', nlb_index_mapping_list: WIDE_FAN_OUT },
    { resource_id: 'idc-r-8f22', nlb_index_mapping_list: [
      { service_code: 'ORD', nlb_index: 3 },
    ] },
    { resource_id: 'idc-r-8f23', nlb_index_mapping_list: [
      { service_code: 'ORD', nlb_index: 5 },
      { service_code: 'PNT', nlb_index: 5 },
    ] },
    { resource_id: 'idc-r-8f24', nlb_index_mapping_list: [] },
  ]],
]);

const REQUESTS_ALL: RequestRow[] = [
  { ts: 1031, svc: '주문서비스', code: 'ORD', pv: 'IDC', cs: 'PENDING' },
  { ts: 2113, svc: '결제서비스', code: 'PAY', pv: 'AWS', cs: 'PENDING' },
  { ts: 1980, svc: '회원서비스', code: 'MBR', pv: 'GCP', cs: 'CONFIRMING' },
  { ts: 1907, svc: '광고서비스', code: 'ADS', pv: 'AWS', cs: 'REJECTED' },
  { ts: 1873, svc: '채팅서비스', code: 'CHT', pv: 'IDC', cs: 'REJECTED' },
  { ts: 1861, svc: '정산서비스', code: 'STL', pv: 'AWS', cs: 'CONFIRMED' },
  { ts: 1799, svc: '배송서비스', code: 'DLV', pv: 'AZURE', cs: 'CONFIRMED' },
  { ts: 1444, svc: '검색서비스', code: 'SRC', pv: 'IDC', cs: 'NO_REQUEST' },
];



// ── NLB current occupancy (P3, IDC) — mutable so nlb saves move occupancy ────
interface NlbRow {
  nlbIndex: number;
  nlbIpList: string[];
  occupiedListenerCount: number;
}

const SEED_NLB: readonly NlbRow[] = [
  { nlbIndex: 1, nlbIpList: ['10.30.0.11', '10.30.0.12'], occupiedListenerCount: 12 },
  { nlbIndex: 2, nlbIpList: ['10.30.0.21', '10.30.0.22'], occupiedListenerCount: 28 },
  { nlbIndex: 3, nlbIpList: ['10.30.0.31', '10.30.0.32'], occupiedListenerCount: 42 },
  { nlbIndex: 4, nlbIpList: ['10.30.0.41', '10.30.0.42'], occupiedListenerCount: 55 },
  { nlbIndex: 5, nlbIpList: ['10.30.0.51', '10.30.0.52'], occupiedListenerCount: 8 },
  { nlbIndex: 6, nlbIpList: ['10.30.0.61', '10.30.0.62'], occupiedListenerCount: 31 },
  // #7–#40. 40 is the ceiling an operator actually sees, and the picker has to hold up at
  // it — six rows never showed what the list does once it stops fitting the modal.
  // Occupancy cycles through 여유 / 주의 / Hard Limit instead of running in order, so the
  // unpickable rows are scattered through the list the way they are in practice.
  ...Array.from({ length: 34 }, (_, i): NlbRow => {
    const nlbIndex = i + 7;
    return {
      nlbIndex,
      nlbIpList: [`10.30.1.${nlbIndex * 2}`, `10.30.1.${nlbIndex * 2 + 1}`],
      occupiedListenerCount: [7, 33, 51, 19, 45, 26, 58, 3][i % 8]!,
    };
  }),
];

// Current NLB assignment per (targetSourceId:resourceId), seeded from DETAILS[1031]
// so repeated saves move occupancy off the previous index.
const SEED_NLB_ASSIGNMENT = new Map<string, number>([
  ['1031:idc-r-8f21', 3],
  ['1031:idc-r-8f22', 3],
  // Deliberately deep in the 40-row list, and on a Hard Limit NLB: opening this row's
  // picker has to land on #33 rather than at #1, and #33 has to stay selectable because
  // it is where the resource already is (nlbOptionDisabled's current-index exemption).
  ['1031:idc-r-8f23', 33],
]);

/** Shared with the reused `idc.getNlbTable` mock so both read one occupancy source. */
export function getNlbTableRows(): NlbRow[] {
  return tq().nlbState.map((r) => ({ ...r, nlbIpList: [...r.nlbIpList] }));
}

function assignNlbIndex(targetSourceId: number, resourceId: string, nextIndex: number): void {
  const state = tq();
  const key = `${targetSourceId}:${resourceId}`;
  const prev = state.nlbAssignment.get(key);
  if (prev === nextIndex) return;
  if (prev !== undefined) {
    const prevRow = state.nlbState.find((r) => r.nlbIndex === prev);
    if (prevRow && prevRow.occupiedListenerCount > 0) prevRow.occupiedListenerCount -= 1;
  }
  const nextRow = state.nlbState.find((r) => r.nlbIndex === nextIndex);
  if (nextRow) nextRow.occupiedListenerCount += 1;
  state.nlbAssignment.set(key, nextIndex);
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

const SEED_TC = new Map<number, TcState>([
  [1799, { ts: 1799, svc: '배송서비스', code: 'DLV', pv: 'AZURE', status: 'TEST_CONNECTION_COMPLETED', completed_at: '2026-07-20T17:19:00Z', rejected_at: null, reject_reason: null }],
  [1642, { ts: 1642, svc: '쿠폰서비스', code: 'CPN', pv: 'AWS', status: 'TEST_CONNECTION_COMPLETED', completed_at: '2026-07-20T06:23:00Z', rejected_at: null, reject_reason: null }],
  [1511, { ts: 1511, svc: '리뷰서비스', code: 'RVW', pv: 'GCP', status: 'TEST_CONNECTION_COMPLETED', completed_at: '2026-07-13T19:40:00Z', rejected_at: null, reject_reason: null }],
  // 리소스 30개 대상 — 카드/표가 규모에 견디는지 볼 수 있는 유일한 시드.
  [1801, { ts: 1801, svc: '물류서비스', code: 'LGS', pv: 'AZURE', status: 'TEST_CONNECTION_COMPLETED', completed_at: '2026-08-01T11:05:00Z', rejected_at: null, reject_reason: null }],
  [1583, { ts: 1583, svc: '재고서비스', code: 'IVT', pv: 'IDC', status: 'TEST_CONNECTION_REJECTED', completed_at: null, rejected_at: '2026-07-19T14:52:00Z', reject_reason: '대상 3건 중 1건 접속 실패(10.20.4.18:1521 timeout) — NLB 리스너 미반영 여부 확인 후 재실행 요청' }],
]);

// ── Approval-request demo fixture (P3) ──────────────────────────────────────
// Demo target sources (1031 IDC / 2113 AWS) are NOT store projects, so the
// confirm mock falls back here when getProjectByTargetSourceId misses. Ported
// from prototype DETAILS. nlb_index is read live from nlbAssignment so NLB
// saves round-trip into the resource table.
interface ApprovalDemoResource {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  selected: boolean;
  exclusion_reason?: string;
  metadata: Record<string, unknown>;
}

interface ApprovalDemo {
  ts: number;
  status: string;
  requested_by: string;
  requested_at: string;
  processed_at: string | null;
  /** 결정한 관리자 — 반려 사유 아래 '처리자'로 나온다. */
  processed_by: string | null;
  reason: string | null;
  resources: ApprovalDemoResource[];
}

/** 2113 요청의 Aurora 멤버 인스턴스 ARN 공통 앞부분. */
const PAY_AURORA_INSTANCE_ARN_BASE =
  'arn:aws:rds:ap-northeast-2:558712049371:db:aurora-pay-prod';

const SEED_APPROVAL_DEMO = new Map<number, ApprovalDemo>([
  [1031, {
    ts: 1031, status: 'PENDING', requested_by: 'jun.park', requested_at: '2026-07-19T16:08:00Z',
    processed_at: null, processed_by: null, reason: null,
    resources: [
      { resource_id: 'idc-r-8f21', resource_name: 'oracle-order-prod', resource_type: 'IDC', selected: true,
        // 8 IPs — the ceiling an IP Set can carry (오너 확인). Two never showed what the
        // 접속 주소 cell or the 조합 modal's key block do when the set is full.
        metadata: { provider: 'IDC', database_type: 'Oracle', port: 1521, oracle_service_id: 'ORCLPDB1', idc_host_format: 'IP', idc_ips: ['10.20.1.11', '10.20.1.12', '10.20.1.13', '10.20.1.14', '10.20.1.15', '10.20.1.16', '10.20.1.17', '10.20.1.18'], idc_source_ips: ['10.20.9.1', '10.20.9.2'] } },
      { resource_id: 'idc-r-8f22', resource_name: 'mysql-order-prod', resource_type: 'IDC', selected: true,
        metadata: { provider: 'IDC', database_type: 'MySQL', port: 3306, idc_host_format: 'HOST', idc_host: 'db-mysql.order.prod.internal', idc_source_ips: ['10.20.9.1'] } },
      { resource_id: 'idc-r-8f23', resource_name: 'pg-order-prod', resource_type: 'IDC', selected: true,
        metadata: { provider: 'IDC', database_type: 'PostgreSQL', port: 5432, idc_host_format: 'IP', idc_ips: ['10.20.2.31'], idc_source_ips: ['10.20.9.4'] } },
      { resource_id: 'idc-r-8f24', resource_name: 'mysql-order-dev', resource_type: 'IDC', selected: false,
        exclusion_reason: '개발(dev) 인스턴스 — 서비스 오너 제외',
        metadata: { provider: 'IDC', database_type: 'MySQL', port: 3306, idc_host_format: 'HOST', idc_host: 'db-mysql.order.dev.internal' } },
    ],
  }],
  [2113, {
    ts: 2113, status: 'PENDING', requested_by: 'mina.choi', requested_at: '2026-07-20T18:09:00Z',
    processed_at: null, processed_by: null, reason: null,
    resources: [
      // 큐에서 인스턴스 목록이 실제로 그려지는 유일한 요청. wire 순서를 일부러
      // 어긋나게(Writer 먼저, Reader 는 -3 → -2) 두어 화면의 Reader 우선 정렬이
      // 눈에 보이게 하고, 선택은 Reader(-2)를 가리켜 '선택됨' 칩을 검증한다.
      // 1907 의 클러스터 행들은 candidates 없이 남겨 태그만 뜨는 상태를 데모한다.
      { resource_id: 'arn:aws:rds:ap-northeast-2:558712049371:cluster:aurora-pay-prod', resource_name: 'aurora-pay-prod', resource_type: 'RDS_CLUSTER', selected: true,
        metadata: {
          provider: 'AWS', region: 'ap-northeast-2', database_type: 'MySQL',
          rds_instance_candidates: [
            { resource_id: `${PAY_AURORA_INSTANCE_ARN_BASE}-1`, resource_name: 'aurora-pay-prod-1', host: 'aurora-pay-prod-1.cluster-c9x2plq7.ap-northeast-2.rds.amazonaws.com', port: 3306, availability_zone: 'ap-northeast-2a', cluster_member_role: 'WRITER' },
            { resource_id: `${PAY_AURORA_INSTANCE_ARN_BASE}-3`, resource_name: 'aurora-pay-prod-3', host: 'aurora-pay-prod-3.cluster-ro-c9x2plq7.ap-northeast-2.rds.amazonaws.com', port: 3306, availability_zone: 'ap-northeast-2c', cluster_member_role: 'READER' },
            { resource_id: `${PAY_AURORA_INSTANCE_ARN_BASE}-2`, resource_name: 'aurora-pay-prod-2', host: 'aurora-pay-prod-2.cluster-ro-c9x2plq7.ap-northeast-2.rds.amazonaws.com', port: 3306, availability_zone: 'ap-northeast-2b', cluster_member_role: 'READER' },
          ],
          selected_rds_instance_resource_id: `${PAY_AURORA_INSTANCE_ARN_BASE}-2`,
        } },
      { resource_id: 'arn:aws:redshift:ap-northeast-2:558712049371:cluster:pay-redshift-main', resource_name: 'pay-redshift-main', resource_type: 'REDSHIFT', selected: true,
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'Redshift' } },
      { resource_id: 'arn:aws:rds:ap-northeast-2:558712049371:db-proxy:prx-pay', resource_name: 'pay-rds-proxy', resource_type: 'RDS', selected: false,
        exclusion_reason: 'RDS Proxy — 설치 불필요 리소스',
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'MySQL' } },
    ],
  }],
  // 반려된 요청 — P2 '연동 요청 반려 확인' 행에서 들어오는 상세. processed_at 이
  // 있어야 wire 에 result(판정)가 실리고, 화면이 반려 사유 블록을 그린다.
  [1907, {
    ts: 1907, status: 'REJECTED', requested_by: 'sora.han', requested_at: '2026-07-17T09:31:00Z',
    processed_at: ADS_REJECTED_AT, processed_by: '관리자', reason: ADS_REJECT_REASON,
    resources: [
      { resource_id: 'arn:aws:rds:ap-northeast-2:558712049371:cluster:aurora-ads-prod', resource_name: 'aurora-ads-prod', resource_type: 'RDS_CLUSTER', selected: true,
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'MySQL' } },
      { resource_id: 'arn:aws:rds:ap-northeast-2:558712049371:cluster:aurora-ads-stg', resource_name: 'aurora-ads-stg', resource_type: 'RDS_CLUSTER', selected: true,
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'MySQL' } },
      { resource_id: 'arn:aws:redshift:ap-northeast-2:558712049371:cluster:ads-redshift-main', resource_name: 'ads-redshift-main', resource_type: 'REDSHIFT', selected: true,
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'Redshift' } },
      { resource_id: 'arn:aws:rds:ap-northeast-2:558712049371:db:ads-mysql-dev', resource_name: 'ads-mysql-dev', resource_type: 'RDS', selected: false,
        exclusion_reason: '개발(dev) 인스턴스 — 서비스 오너 제외',
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'MySQL' } },
    ],
  }],
  // 반려된 IDC 요청 — 반려 상세의 IDC 경로(접속 주소·포트·SID·출발지 IP 컬럼과
  // 잠긴 NLB Index)를 밟는다. 사유가 반려 원인(Oracle SID 미기입)을 가리키므로
  // 해당 리소스의 oracle_service_id 는 비워 둔다.
  [1873, {
    ts: 1873, status: 'REJECTED', requested_by: 'dohee.kim', requested_at: '2026-07-14T13:20:00Z',
    processed_at: CHT_REJECTED_AT, processed_by: '관리자', reason: CHT_REJECT_REASON,
    resources: [
      { resource_id: 'idc-r-4c11', resource_name: 'oracle-chat-prod', resource_type: 'IDC', selected: true,
        metadata: { provider: 'IDC', database_type: 'Oracle', port: 1521, idc_host_format: 'IP', idc_ips: ['10.30.1.21', '10.30.1.22'], idc_source_ips: ['10.30.9.1'], nlb_index: 2 } },
      { resource_id: 'idc-r-4c12', resource_name: 'mysql-chat-prod', resource_type: 'IDC', selected: true,
        metadata: { provider: 'IDC', database_type: 'MySQL', port: 3306, idc_host_format: 'HOST', idc_host: 'db-mysql.chat.prod.internal', idc_source_ips: ['10.30.9.1', '10.30.9.2'], nlb_index: 3 } },
      { resource_id: 'idc-r-4c13', resource_name: 'mysql-chat-stg', resource_type: 'IDC', selected: false,
        exclusion_reason: 'STG 인스턴스 — 서비스 오너 제외',
        metadata: { provider: 'IDC', database_type: 'MySQL', port: 3306, idc_host_format: 'HOST', idc_host: 'db-mysql.chat.stg.internal' } },
    ],
  }],
]);

/** Fallback ApprovalRequestLatestDto wire for demo targets (null = not a demo id). */
export function getTqApprovalLatest(ts: number): Record<string, unknown> | null {
  const demo = tq().approvalDemoState.get(ts);
  if (!demo) return null;
  const selected = demo.resources.filter((r) => r.selected).length;
  return {
    request: {
      id: demo.ts,
      target_source_id: demo.ts,
      status: demo.status,
      requested_by: { user_id: demo.requested_by },
      requested_at: demo.requested_at,
      resource_total_count: demo.resources.length,
      resource_selected_count: selected,
    },
    resources: demo.resources.map((r) => ({
      ...r,
      metadata: {
        ...r.metadata,
        ...(tq().nlbAssignment.has(`${demo.ts}:${r.resource_id}`)
          ? { nlb_index: tq().nlbAssignment.get(`${demo.ts}:${r.resource_id}`) }
          : {}),
      },
    })),
    ...(demo.processed_at
      ? {
          result: {
            request_id: demo.ts,
            status: demo.status,
            processed_by: demo.processed_by ? { user_id: demo.processed_by } : null,
            processed_at: demo.processed_at,
            reason: demo.reason,
          },
        }
      : {}),
  };
}

/** Fallback approve/reject for demo targets — mutates the P2 lists so the queue round-trips. */
export function applyTqApprovalDecision(
  ts: number,
  decision: 'APPROVED' | 'REJECTED',
  reason: string | null,
): Record<string, unknown> | null {
  const state = tq();
  const demo = state.approvalDemoState.get(ts);
  if (!demo) return null;
  const now = new Date().toISOString();
  demo.status = decision;
  demo.processed_at = now;
  demo.processed_by = '관리자';
  demo.reason = reason;

  const pIdx = state.requestsPending.findIndex((r) => r.ts === ts);
  const row = pIdx >= 0 ? state.requestsPending.splice(pIdx, 1)[0] : undefined;
  const allRow = state.requestsAll.find((r) => r.ts === ts);
  if (decision === 'REJECTED') {
    const rejected: RequestRow = {
      ts, svc: row?.svc ?? allRow?.svc ?? '', code: row?.code ?? allRow?.code ?? '',
      pv: row?.pv ?? allRow?.pv ?? 'IDC', cs: 'REJECTED', reason: reason ?? undefined, at: now,
    };
    state.requestsRejected.unshift(rejected);
    state.reasonByTs.set(ts, rejected);
  }
  if (allRow) allRow.cs = decision === 'APPROVED' ? 'CONFIRMING' : 'REJECTED';
  return { request_id: ts, status: decision, processed_by: { user_id: '관리자' }, processed_at: now, reason };
}

// ── Test-connection per-resource results + logical DBs (P5 demo fixture) ────
// Demo tc targets (1799/1583) are not store projects either; the confirm and
// logical-db mocks fall back here for latest-results and by-resource-id reads.
interface TcLogicalItem {
  database_name: string;
  schema_name?: string;
  type: 'DATABASE' | 'SCHEMA';
  skip_reason?: string;
  // Passthrough wire compatibility (zod .passthrough() output is indexable).
  [k: string]: unknown;
}

interface TcResultFixture {
  resource_id: string;
  database_type: string;
  connection_target: string;
  connection_status: 'SUCCESS' | 'FAILED';
  tested: TcLogicalItem[];
  excluded: TcLogicalItem[];
}

const dbList = (names: string[]): TcLogicalItem[] => names.map((n) => ({ database_name: n, type: 'DATABASE' }));
const schemaList = (db: string, names: string[]): TcLogicalItem[] =>
  names.map((n) => ({ database_name: db, schema_name: n, type: 'SCHEMA' }));

const TC_RESULTS = new Map<number, TcResultFixture[]>([
  [1799, [
    { resource_id: '/subscriptions/2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforMySQL/servers/mysql-dlv-01',
      database_type: 'MySQL', connection_target: 'mysql-dlv-01', connection_status: 'SUCCESS',
      tested: dbList(['dlv_main', 'dlv_order', 'dlv_ship', 'dlv_return', 'dlv_track', 'dlv_billing', 'dlv_partner', 'dlv_stats', 'dlv_noti', 'dlv_geo', 'dlv_history', 'dlv_audit']),
      excluded: [
        { database_name: 'dlv_stg', type: 'DATABASE', skip_reason: 'STG' },
        { database_name: 'dlv_dev', type: 'DATABASE', skip_reason: 'DEV' },
        { database_name: 'tmp_batch', type: 'DATABASE', skip_reason: 'TEMP' },
      ] },
    { resource_id: '/subscriptions/2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforMySQL/servers/mysql-dlv-02',
      database_type: 'MySQL', connection_target: 'mysql-dlv-02', connection_status: 'SUCCESS',
      tested: dbList(['ship_core', 'ship_route', 'ship_fleet', 'ship_driver', 'ship_zone', 'ship_fee', 'ship_event', 'ship_log']),
      excluded: [{ database_name: 'ship_dev', type: 'DATABASE', skip_reason: 'DEV' }] },
    { resource_id: '/subscriptions/2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforPostgreSQL/servers/pg-dlv-main',
      database_type: 'PostgreSQL', connection_target: 'pg-dlv-main', connection_status: 'SUCCESS',
      tested: schemaList('pg_dlv', ['public', 'delivery', 'partner', 'billing', 'analytics']),
      excluded: [
        { database_name: 'pg_dlv', schema_name: 'scratch', type: 'SCHEMA', skip_reason: 'TEMP' },
        { database_name: 'pg_dlv', schema_name: 'dev_sandbox', type: 'SCHEMA', skip_reason: 'DEV' },
      ] },
  ]],
  [1583, [
    { resource_id: 'idc-ivt-9a01', database_type: 'MySQL', connection_target: 'db-mysql.ivt.prod.internal', connection_status: 'SUCCESS',
      tested: dbList(['ivt_main', 'ivt_stock', 'ivt_wh', 'ivt_supplier', 'ivt_audit', 'ivt_stats']),
      excluded: [{ database_name: 'ivt_dev', type: 'DATABASE', skip_reason: 'DEV' }] },
    { resource_id: 'idc-ivt-9a02', database_type: 'MySQL', connection_target: '10.20.4.11', connection_status: 'SUCCESS',
      tested: dbList(['ivt_order', 'ivt_out', 'ivt_in', 'ivt_move']), excluded: [] },
    { resource_id: 'idc-ivt-9a03', database_type: 'Oracle', connection_target: '10.20.4.18', connection_status: 'FAILED',
      tested: [], excluded: [] },
  ]],
]);

/** Fallback latest-results rows for demo tc targets (null = not a demo id). */
export function getTcLatestResultRows(ts: number): Record<string, unknown>[] | null {
  const rows = TC_RESULTS.get(ts);
  if (!rows) return null;
  return rows.map((r) => ({
    resource_id: r.resource_id,
    agent_id: r.resource_id,
    database_type: r.database_type,
    connection_target: r.connection_target,
    connection_status: r.connection_status,
    ...(r.connection_status === 'SUCCESS'
      ? { logical_database_count: r.tested.length, excluded_logical_database_count: r.excluded.length }
      : {}),
  }));
}

// ── Mutable state container ──────────────────────────────────────────────────
// Next dev compiles each route into its own module graph, so plain module-level
// mutable state is NOT shared between the PUT and GET routes (same trap the
// main mock-store solves). All mutable task-queue state therefore lives on
// globalThis, seeded lazily from the consts above.
interface TqMockState {
  requestsPending: RequestRow[];
  requestsRejected: RequestRow[];
  requestsAll: RequestRow[];
  reasonByTs: Map<number, RequestRow>;
  nlbState: NlbRow[];
  nlbAssignment: Map<string, number>;
  tcState: Map<number, TcState>;
  approvalDemoState: Map<number, ApprovalDemo>;
}

declare global {
  var __piiAgentTaskQueueMock: TqMockState | undefined;
}

function tq(): TqMockState {
  if (!globalThis.__piiAgentTaskQueueMock) {
    const requestsRejected = REQUESTS_REJECTED.map((r) => ({ ...r }));
    globalThis.__piiAgentTaskQueueMock = {
      requestsPending: REQUESTS_PENDING.map((r) => ({ ...r })),
      requestsRejected,
      requestsAll: REQUESTS_ALL.map((r) => ({ ...r })),
      reasonByTs: new Map(requestsRejected.map((r) => [r.ts, r])),
      nlbState: SEED_NLB.map((r) => ({ ...r, nlbIpList: [...r.nlbIpList] })),
      nlbAssignment: new Map(SEED_NLB_ASSIGNMENT),
      tcState: new Map([...SEED_TC].map(([k, v]) => [k, { ...v }])),
      approvalDemoState: new Map(
        [...SEED_APPROVAL_DEMO].map(([k, v]) => [
          k,
          { ...v, resources: v.resources.map((r) => ({ ...r, metadata: { ...r.metadata } })) },
        ]),
      ),
    };
  }
  return globalThis.__piiAgentTaskQueueMock;
}

/** Fallback tested/excluded logical-DB lists for demo tc targets. */
export function getTcLogicalDbs(
  ts: number,
  resourceId: string,
): { tested: TcLogicalItem[]; excluded: TcLogicalItem[] } | null {
  const row = TC_RESULTS.get(ts)?.find((r) => r.resource_id === resourceId);
  if (!row) return null;
  return { tested: row.tested.map((i) => ({ ...i })), excluded: row.excluded.map((i) => ({ ...i })) };
}

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

/**
 * 운영 알림 — the process_status that puts a target in each alert bucket.
 * Upstream owns this mapping; the mock reproduces it off the monitor fixture so
 * counts and drill-down lists stay consistent with each other.
 */
const ALERT_KIND_STATUS: Record<AlertTargetKind, string> = {
  confirming: 'CONFIRMING',
  'need-install': 'CONFIRMED',
  'need-test-connection': 'INSTALLED',
  'need-pii-agent-confirm': 'CONNECTED',
};

const alertRows = (kind: AlertTargetKind): ProcRow[] =>
  PROC.filter((p) => p.st === ALERT_KIND_STATUS[kind]);

/**
 * TargetSourceInfo.description — the owner's own line about what the target source
 * holds. Keyed by target source, not by service: one service can register several.
 * Unlisted ids return undefined, which is the honest shape of an optional field.
 */
const TS_DESCRIPTION: Record<number, string> = {
  1031: '주문/결제 원장 Oracle · MySQL 운영 DB. 개인정보 스캔 대상 등록 건',
  2113: '결제 승인 이력 Aurora 클러스터 (PCI 범위)',
  2044: '포인트 적립·소멸 이력 Cloud SQL',
  2051: '알림 발송 로그 Azure SQL',
  1861: '정산 마감 배치 RDS',
  1027: '쿠폰 발급 이력 RDS — 연동 불가 회신 건',
  1583: '통합 인증 세션 저장소 (IDC)',
};

/**
 * TargetSourceMetadata — 계약이 선언한 CSP 계정 식별자. 소유한 provider 의 필드 하나만
 * 차고, IDC·SDU 는 전부 빈다. 서비스 운영 카드가 계정 줄을 이 값으로 그린다. 값은 ts 에서
 * 결정적으로 만들어 새로고침해도 같은 계정이 나온다.
 */
/**
 * 소유하지 않은 provider 필드는 `undefined` 가 아니라 **명시적 null** 이다.
 * `NextResponse.json()` 이 undefined 키를 통째로 지워버리므로, undefined 로 두면 실 BFF 가
 * 보내는 `{"aws_account_id": null}` 모양을 목이 한 번도 재현하지 못한다 — 소비자가 언젠가
 * `!== undefined` 로 재는 순간 목은 그 회귀를 못 잡는다.
 *
 * 중국 리전은 마지막 한 자리로 가른다. 전부 false 로 두면 화면의 `중국` 태그와 라우트의
 * `aws_region_type: 'china'` 분기가 목에서 한 번도 안 돈다.
 */
function toMetadataWire(r: RequestRow) {
  const digits = String(r.ts).padStart(4, '0');
  const isAws = r.pv === 'AWS';
  return {
    tenant_id: r.pv === 'AZURE' ? `t-${digits}-0000-0000-0000-000000000000` : null,
    subscription_id: r.pv === 'AZURE' ? `s-${digits}-1111-2222-3333-444444444444` : null,
    gcp_project_id: r.pv === 'GCP' ? `gcp-demo-${digits}` : null,
    aws_account_id: isAws ? `9${digits}`.padEnd(12, '0') : null,
    is_sdu_type: r.pv === 'SDU',
    is_china_region: isAws && r.ts % 2 === 1,
  };
}

function toTargetSourceInfoWire(r: RequestRow) {
  const isRejected = r.cs === 'REJECTED';
  const rejected = tq().reasonByTs.get(r.ts) ?? r;
  const hasRequest = r.cs !== 'NO_REQUEST';
  return {
    targetSourceId: r.ts,
    serviceName: r.svc,
    description: TS_DESCRIPTION[r.ts],
    serviceCode: r.code,
    cloudProvider: r.pv,
    confirmStatus: r.cs,
    metadata: toMetadataWire(r),
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
      pending_approval_count: tq().requestsPending.length,
      rejected_approval_count: tq().requestsRejected.length,
      test_connection_completed_count: [...tq().tcState.values()].filter((s) => s.status === 'TEST_CONNECTION_COMPLETED').length,
      test_connection_rejection_count: [...tq().tcState.values()].filter((s) => s.status === 'TEST_CONNECTION_REJECTED').length,
      confirming_count: alertRows('confirming').length,
      need_install_count: alertRows('need-install').length,
      need_test_connection_count: alertRows('need-test-connection').length,
      need_pii_agent_confirm_count: alertRows('need-pii-agent-confirm').length,
      evaluated_at: new Date().toISOString(),
    }),

  // GET /dashboard/target-sources/{kind} — 운영 알림 drill-down (TargetSourceInfo
  // camel island, same page shape as /target-sources/page).
  getAlertTargetSources: async (query: { kind: AlertTargetKind; page: number; size: number }) => {
    const content = alertRows(query.kind).map((p) => ({
      targetSourceId: p.ts,
      serviceName: p.svc,
      serviceCode: p.code,
      cloudProvider: p.pv,
      confirmStatus: p.st === 'CONFIRMING' ? 'CONFIRMING' : 'CONFIRMED',
      updatedAt: p.at,
    }));
    return NextResponse.json(wirePage(content, query.page, query.size));
  },

  // GET /process-statuses?processStatus=&targetSourceId=&page=&size=
  getProcessStatuses: async (query: { processStatus?: string; targetSourceId?: number; page: number; size: number }) => {
    let rows = PROC;
    if (query.processStatus) rows = rows.filter((p) => p.st === query.processStatus);
    if (query.targetSourceId !== undefined) rows = rows.filter((p) => p.ts === query.targetSourceId);
    return NextResponse.json(wirePage(rows.map(toProcessWire), query.page, query.size));
  },

  // GET /target-sources/page?confirmStatus=&targetSourceId=&serviceCode=&page=&size=
  getTargetSourcesPage: async (query: { confirmStatus?: string; targetSourceId?: number; serviceCode?: string; page: number; size: number }) => {
    // Single-target header lookup (api-spec P3) — resolve from the monitor index.
    if (query.targetSourceId !== undefined) {
      const p = TS_INDEX.get(query.targetSourceId);
      const cs =
        tq().requestsAll.find((r) => r.ts === query.targetSourceId)?.cs ??
        (tq().reasonByTs.has(query.targetSourceId) ? 'REJECTED' : 'PENDING');
      const row: RequestRow | null = p
        ? { ts: p.ts, svc: p.svc, code: p.code, pv: p.pv, cs }
        : null;
      const content = row ? [toTargetSourceInfoWire(row)] : [];
      return NextResponse.json(wirePage(content, query.page, query.size));
    }

    const byStatus =
      query.confirmStatus === 'PENDING'
        ? tq().requestsPending
        : query.confirmStatus === 'REJECTED'
          ? tq().requestsRejected
          : tq().requestsAll;
    // serviceCode 는 계약이 선언한 필터다 (install-v1.yaml /target-sources/page).
    // 서비스 운영 상세가 이걸로 한 서비스의 대상만 받아 간다.
    const source = query.serviceCode
      ? byStatus.filter((r) => r.code === query.serviceCode)
      : byStatus;
    return NextResponse.json(wirePage(source.map(toTargetSourceInfoWire), query.page, query.size));
  },

  // PUT …/approval-requests/nlb-indices — single { resource_id, nlb_index }.
  // Contract returns the updated ApprovalRequestDetailDto; reuse the demo latest
  // (which reads nlb_index live from nlbAssignment) so the save round-trips.
  putNlbIndex: async (id: number, body: { resource_id?: string | null; nlb_index?: number | null }) => {
    if (body.resource_id && typeof body.nlb_index === 'number') {
      assignNlbIndex(id, body.resource_id, body.nlb_index);
    }
    return NextResponse.json(getTqApprovalLatest(id) ?? {});
  },

  // GET /approval-history?toStatuses=&page=&size= — global history (newest first).
  getApprovalHistory: async (query: { toStatuses?: string[]; page: number; size: number }) => {
    let rows: ApprovalHistoryFixture[] = APPROVAL_HISTORY;
    if (query.toStatuses?.length) {
      const wanted = new Set(query.toStatuses);
      rows = rows.filter((r) => wanted.has(r.status));
    }
    return NextResponse.json(wirePage(rows, query.page, query.size));
  },

  // GET …/{id}/approval-requests/latest/nlb-index-mappings — off-contract wire.
  getNlbIndexMappings: async (id: number) =>
    NextResponse.json(NLB_INDEX_MAPPINGS.get(id) ?? []),

  // GET /target-sources/test-connection/status?status=&page=&size=
  getTestConnectionPage: async (query: { status: string; page: number; size: number }) => {
    const rows = [...tq().tcState.values()].filter((s) => s.status === query.status).map(toTcWire);
    return NextResponse.json(wirePage(rows, query.page, query.size));
  },

  // GET …/{id}/test-connection/status (single)
  getTestConnectionStatus: async (id: number) => {
    const s = tq().tcState.get(id);
    if (s) return NextResponse.json(toTcWire(s));
    return NextResponse.json({ target_source_id: id, target_source_exists: false, status: null });
  },

  // POST …/{id}/test-connection/reject — flips the target to REJECTED.
  rejectTestConnection: async (id: number, body: { reason?: string | null }) => {
    const existing = tq().tcState.get(id);
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
    const rejectedAt = new Date().toISOString();
    tq().tcState.set(id, {
      ...base,
      status: 'TEST_CONNECTION_REJECTED',
      rejected_at: rejectedAt,
      reject_reason: body.reason ?? null,
    });
    return NextResponse.json({
      target_source_id: id,
      test_connection_rejected: true,
      test_connection_reject_reason: body.reason ?? null,
      test_connection_rejected_at: rejectedAt,
    });
  },
};
