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

// ── Approval history (global, GET /approval-history) ────────────────────────
// Item wire = user-sanctioned assumption (swagger 200 is the generic Page; gap
// documented in lib/types/task-queue.ts). Newest first; covers all 7 enums.
interface ApprovalHistoryFixture {
  request_id: number;
  target_source_id: number;
  status: string;
  created_at: string;
  service_name: string;
  service_code: string;
}

const APPROVAL_HISTORY: ApprovalHistoryFixture[] = [
  { request_id: 5121, target_source_id: 1031, status: 'PENDING', created_at: '2026-07-20T09:12:00Z', service_name: '주문서비스', service_code: 'ORD' },
  { request_id: 5118, target_source_id: 2113, status: 'PENDING', created_at: '2026-07-20T08:40:00Z', service_name: '결제서비스', service_code: 'PAY' },
  { request_id: 5116, target_source_id: 2044, status: 'PENDING', created_at: '2026-07-19T18:03:00Z', service_name: '포인트서비스', service_code: 'PNT' },
  { request_id: 5112, target_source_id: 2051, status: 'PENDING', created_at: '2026-07-19T15:27:00Z', service_name: '알림서비스', service_code: 'NTF' },
  { request_id: 5107, target_source_id: 1861, status: 'APPROVED', created_at: '2026-07-19T11:20:00Z', service_name: '정산서비스', service_code: 'STL' },
  { request_id: 5101, target_source_id: 1907, status: 'REJECTED', created_at: '2026-07-18T11:02:00Z', service_name: '광고서비스', service_code: 'ADS' },
  { request_id: 5093, target_source_id: 1980, status: 'AUTO_APPROVED', created_at: '2026-07-17T22:10:00Z', service_name: '회원서비스', service_code: 'MBR' },
  { request_id: 5090, target_source_id: 1799, status: 'APPROVED', created_at: '2026-07-17T14:55:00Z', service_name: '배송서비스', service_code: 'DLV' },
  { request_id: 5084, target_source_id: 1027, status: 'UNAVAILABLE_ACKNOWLEDGED', created_at: '2026-07-16T10:31:00Z', service_name: '쿠폰서비스', service_code: 'CPN' },
  { request_id: 5080, target_source_id: 1027, status: 'UNAVAILABLE', created_at: '2026-07-16T09:02:00Z', service_name: '쿠폰서비스', service_code: 'CPN' },
  { request_id: 5074, target_source_id: 1873, status: 'REJECTED', created_at: '2026-07-15T09:47:00Z', service_name: '채팅서비스', service_code: 'CHT' },
  { request_id: 5069, target_source_id: 1583, status: 'CANCELLED', created_at: '2026-07-14T17:26:00Z', service_name: '인증서비스', service_code: 'ATH' },
  { request_id: 5061, target_source_id: 1583, status: 'PENDING', created_at: '2026-07-14T09:15:00Z', service_name: '인증서비스', service_code: 'ATH' },
  { request_id: 5055, target_source_id: 1861, status: 'PENDING', created_at: '2026-07-13T13:44:00Z', service_name: '정산서비스', service_code: 'STL' },
  { request_id: 5049, target_source_id: 1444, status: 'CANCELLED', created_at: '2026-07-12T16:08:00Z', service_name: '검색서비스', service_code: 'SRC' },
  { request_id: 5041, target_source_id: 1980, status: 'PENDING', created_at: '2026-07-11T10:52:00Z', service_name: '회원서비스', service_code: 'MBR' },
  { request_id: 5033, target_source_id: 1799, status: 'AUTO_APPROVED', created_at: '2026-07-10T19:37:00Z', service_name: '배송서비스', service_code: 'DLV' },
  { request_id: 5027, target_source_id: 1907, status: 'PENDING', created_at: '2026-07-10T08:21:00Z', service_name: '광고서비스', service_code: 'ADS' },
  { request_id: 5019, target_source_id: 1873, status: 'PENDING', created_at: '2026-07-09T15:03:00Z', service_name: '채팅서비스', service_code: 'CHT' },
  { request_id: 5012, target_source_id: 1031, status: 'REJECTED', created_at: '2026-07-08T11:49:00Z', service_name: '주문서비스', service_code: 'ORD' },
  { request_id: 5006, target_source_id: 1031, status: 'PENDING', created_at: '2026-07-08T09:30:00Z', service_name: '주문서비스', service_code: 'ORD' },
  { request_id: 4998, target_source_id: 1444, status: 'APPROVED', created_at: '2026-07-07T14:12:00Z', service_name: '검색서비스', service_code: 'SRC' },
  { request_id: 4991, target_source_id: 2113, status: 'CANCELLED', created_at: '2026-07-06T10:05:00Z', service_name: '결제서비스', service_code: 'PAY' },
];

// ── NLB index mappings (…/approval-requests/latest/nlb-index-mappings) ──────
// OFF-CONTRACT endpoint (user-provided wire, 2026-07-21). Per resource: the NLB
// listeners currently serving it, one entry per consuming service.
interface NlbIndexMappingFixture {
  resource_id: string;
  nlb_index_mapping_list: { service_code: string; nlb_index: number }[];
}

const NLB_INDEX_MAPPINGS = new Map<number, NlbIndexMappingFixture[]>([
  [1031, [
    { resource_id: 'idc-r-8f21', nlb_index_mapping_list: [
      { service_code: 'ORD', nlb_index: 3 },
      { service_code: 'PAY', nlb_index: 3 },
      { service_code: 'MBR', nlb_index: 1 },
      { service_code: 'DLV', nlb_index: 1 },
      { service_code: 'STL', nlb_index: 2 },
      { service_code: 'CHT', nlb_index: 6 },
      { service_code: 'ADS', nlb_index: 6 },
      { service_code: 'SRC', nlb_index: 5 },
    ] },
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
];

// Current NLB assignment per (targetSourceId:resourceId), seeded from DETAILS[1031]
// so repeated saves move occupancy off the previous index.
const SEED_NLB_ASSIGNMENT = new Map<string, number>([
  ['1031:idc-r-8f21', 3],
  ['1031:idc-r-8f22', 3],
  ['1031:idc-r-8f23', 5],
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
  reason: string | null;
  resources: ApprovalDemoResource[];
}

const SEED_APPROVAL_DEMO = new Map<number, ApprovalDemo>([
  [1031, {
    ts: 1031, status: 'PENDING', requested_by: 'jun.park', requested_at: '2026-07-19T16:08:00Z',
    processed_at: null, reason: null,
    resources: [
      { resource_id: 'idc-r-8f21', resource_name: 'oracle-order-prod', resource_type: 'IDC', selected: true,
        metadata: { provider: 'IDC', database_type: 'Oracle', port: 1521, oracle_service_id: 'ORCLPDB1', idc_host_format: 'IP', idc_ips: ['10.20.1.11', '10.20.1.12'], idc_source_ips: ['10.20.9.1', '10.20.9.2'] } },
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
    processed_at: null, reason: null,
    resources: [
      { resource_id: 'arn:aws:rds:ap-northeast-2:558712049371:cluster:aurora-pay-prod', resource_name: 'aurora-pay-prod', resource_type: 'RDS_CLUSTER', selected: true,
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'MySQL' } },
      { resource_id: 'arn:aws:redshift:ap-northeast-2:558712049371:cluster:pay-redshift-main', resource_name: 'pay-redshift-main', resource_type: 'REDSHIFT', selected: true,
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'Redshift' } },
      { resource_id: 'arn:aws:rds:ap-northeast-2:558712049371:db-proxy:prx-pay', resource_name: 'pay-rds-proxy', resource_type: 'RDS', selected: false,
        exclusion_reason: 'RDS Proxy — 설치 불필요 리소스',
        metadata: { provider: 'AWS', region: 'ap-northeast-2', database_type: 'MySQL' } },
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
      ? { result: { request_id: demo.ts, status: demo.status, processed_at: demo.processed_at, reason: demo.reason } }
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
  return { request_id: ts, status: decision, processed_at: now, reason };
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

function toTargetSourceInfoWire(r: RequestRow) {
  const isRejected = r.cs === 'REJECTED';
  const rejected = tq().reasonByTs.get(r.ts) ?? r;
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
      pending_approval_count: tq().requestsPending.length,
      rejected_approval_count: tq().requestsRejected.length,
      test_connection_completed_count: [...tq().tcState.values()].filter((s) => s.status === 'TEST_CONNECTION_COMPLETED').length,
      test_connection_rejection_count: [...tq().tcState.values()].filter((s) => s.status === 'TEST_CONNECTION_REJECTED').length,
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
        tq().requestsAll.find((r) => r.ts === query.targetSourceId)?.cs ??
        (tq().reasonByTs.has(query.targetSourceId) ? 'REJECTED' : 'PENDING');
      const row: RequestRow | null = p
        ? { ts: p.ts, svc: p.svc, code: p.code, pv: p.pv, cs }
        : null;
      const content = row ? [toTargetSourceInfoWire(row)] : [];
      return NextResponse.json(wirePage(content, query.page, query.size));
    }

    const source =
      query.confirmStatus === 'PENDING'
        ? tq().requestsPending
        : query.confirmStatus === 'REJECTED'
          ? tq().requestsRejected
          : tq().requestsAll;
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
