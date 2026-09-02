/**
 * Approval-queue fixtures — the 연동 요청 큐's three views (pending / rejected /
 * history) and the per-target description the queue prints.
 *
 * These live in their own leaf module, apart from lib/bff/mock/task-queue.ts, for
 * one reason: lib/mock-data.ts has to seed a target source for every id these
 * fixtures can show, and task-queue.ts already imports lib/mock-data.ts, so
 * importing back would close a cycle. This module imports nothing, so both sides
 * read one list instead of hand-copying ids that then rot apart.
 */

// ── Approval request queue (P2) ─────────────────────────────────────────────
export interface RequestRow {
  ts: number;
  svc: string;
  code: string;
  pv: string;
  cs: string;
  reason?: string;
  at?: string;
}

export const REQUESTS_PENDING: RequestRow[] = [
  { ts: 1031, svc: '주문서비스', code: 'ORD', pv: 'IDC', cs: 'PENDING' },
  { ts: 2113, svc: '결제서비스', code: 'PAY', pv: 'AWS', cs: 'PENDING' },
  { ts: 2044, svc: '포인트서비스', code: 'PNT', pv: 'GCP', cs: 'PENDING' },
  { ts: 2051, svc: '알림서비스', code: 'NTF', pv: 'AZURE', cs: 'PENDING' },
];

// 100자 반려 사유 — 목록 셀에서 잘리고 hover 툴팁에서만 전문이 보이는 경로를
// 실제로 밟게 하는 표본. 짧은 사유만 있으면 잘림·툴팁이 검증되지 않는다.
// P2 목록(REQUESTS_REJECTED)과 P3 상세(SEED_APPROVAL_DEMO)가 같은 문장을
// 들어야 하므로 한 곳에서 선언한다.
export const ADS_REJECT_REASON =
  '선택된 리소스 중 stg 계정 리소스가 포함되어 있고, 운영 계정 태그 규칙(env=prod)도 지켜지지 않았습니다. 태그를 정리한 뒤 운영 계정 리소스만 다시 선택해 재요청해 주세요.';
export const ADS_REJECTED_AT = '2026-07-18T11:02:00Z';

// 짧은 사유 쪽 표본(IDC) — 같은 블록이 한 줄짜리 사유에서도 성립하는지 본다.
export const CHT_REJECT_REASON = 'Oracle SID 미기입 — 접속 정보를 채워 다시 요청해 주세요.';
export const CHT_REJECTED_AT = '2026-07-15T09:47:00Z';

export const REQUESTS_REJECTED: RequestRow[] = [
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
export interface ApprovalHistoryFixture {
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

export const APPROVAL_HISTORY: ApprovalHistoryFixture[] = [
  { historyRecordId: 923, requestId: 5121, targetSourceId: 1031, status: 'PENDING', createdAt: '2026-07-20T09:12:00Z', serviceName: '주문서비스', serviceCode: 'ORD', actorId: null, cloudProvider: 'IDC' },
  { historyRecordId: 922, requestId: 5118, targetSourceId: 2113, status: 'PENDING', createdAt: '2026-07-20T08:40:00Z', serviceName: '결제서비스', serviceCode: 'PAY', actorId: null, cloudProvider: 'AWS' },
  { historyRecordId: 921, requestId: 5116, targetSourceId: 2044, status: 'PENDING', createdAt: '2026-07-19T18:03:00Z', serviceName: '포인트서비스', serviceCode: 'PNT', actorId: null, cloudProvider: 'GCP' },
  { historyRecordId: 920, requestId: 5112, targetSourceId: 2051, status: 'PENDING', createdAt: '2026-07-19T15:27:00Z', serviceName: '알림서비스', serviceCode: 'NTF', actorId: null, cloudProvider: 'AZURE' },
  { historyRecordId: 919, requestId: 5107, targetSourceId: 1861, status: 'APPROVED', createdAt: '2026-07-19T11:20:00Z', serviceName: '정산서비스', serviceCode: 'STL', actorId: '관리자', cloudProvider: 'AWS' },
  { historyRecordId: 918, requestId: 5101, targetSourceId: 1907, status: 'REJECTED', createdAt: '2026-07-18T11:02:00Z', serviceName: '광고서비스', serviceCode: 'ADS', actorId: '관리자', cloudProvider: 'AWS' },
  { historyRecordId: 917, requestId: 5093, targetSourceId: 1980, status: 'AUTO_APPROVED', createdAt: '2026-07-17T22:10:00Z', serviceName: '회원서비스', serviceCode: 'MBR', actorId: '시스템', cloudProvider: 'GCP' },
  { historyRecordId: 916, requestId: 5090, targetSourceId: 1799, status: 'APPROVED', createdAt: '2026-07-17T14:55:00Z', serviceName: '배송서비스', serviceCode: 'DLV', actorId: '관리자', cloudProvider: 'AZURE' },
  // 연동 불가 한 벌. 원래 1027 을 달고 있었는데, 1027 은 카탈로그에서 IDC 연동 불가 데모
  // 대상이다 — 같은 id 를 두고 이력은 '쿠폰서비스 · CPN · AWS' 라고, 상세는 'IDC' 라고 말했다.
  // 행이 하는 말(쿠폰서비스)이 맞는 쪽이라, 실제 쿠폰서비스 대상인 1642 로 옮긴다.
  { historyRecordId: 915, requestId: 5084, targetSourceId: 1642, status: 'UNAVAILABLE_ACKNOWLEDGED', createdAt: '2026-07-16T10:31:00Z', serviceName: '쿠폰서비스', serviceCode: 'CPN', actorId: '관리자', cloudProvider: 'AWS' },
  { historyRecordId: 914, requestId: 5080, targetSourceId: 1642, status: 'UNAVAILABLE', createdAt: '2026-07-16T09:02:00Z', serviceName: '쿠폰서비스', serviceCode: 'CPN', actorId: '관리자', cloudProvider: 'AWS' },
  { historyRecordId: 913, requestId: 5074, targetSourceId: 1873, status: 'REJECTED', createdAt: '2026-07-15T09:47:00Z', serviceName: '채팅서비스', serviceCode: 'CHT', actorId: '관리자', cloudProvider: 'IDC' },
  // 1583 은 다른 곳 전부에서 재고서비스(IVT)다 — 모니터 픽스처(PROC)도, 카탈로그의 IDC
  // 대상도. 인증서비스(ATH)는 1462 이고 그쪽은 Azure 다. 이 두 행만 다른 말을 하고 있었다.
  { historyRecordId: 912, requestId: 5069, targetSourceId: 1583, status: 'CANCELLED', createdAt: '2026-07-14T17:26:00Z', serviceName: '재고서비스', serviceCode: 'IVT', actorId: '관리자', cloudProvider: 'IDC' },
  { historyRecordId: 911, requestId: 5061, targetSourceId: 1583, status: 'PENDING', createdAt: '2026-07-14T09:15:00Z', serviceName: '재고서비스', serviceCode: 'IVT', actorId: null, cloudProvider: 'IDC' },
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

export const REQUESTS_ALL: RequestRow[] = [
  { ts: 1031, svc: '주문서비스', code: 'ORD', pv: 'IDC', cs: 'PENDING' },
  { ts: 2113, svc: '결제서비스', code: 'PAY', pv: 'AWS', cs: 'PENDING' },
  { ts: 1980, svc: '회원서비스', code: 'MBR', pv: 'GCP', cs: 'CONFIRMING' },
  { ts: 1907, svc: '광고서비스', code: 'ADS', pv: 'AWS', cs: 'REJECTED' },
  { ts: 1873, svc: '채팅서비스', code: 'CHT', pv: 'IDC', cs: 'REJECTED' },
  { ts: 1861, svc: '정산서비스', code: 'STL', pv: 'AWS', cs: 'CONFIRMED' },
  { ts: 1799, svc: '배송서비스', code: 'DLV', pv: 'AZURE', cs: 'CONFIRMED' },
  { ts: 1444, svc: '검색서비스', code: 'SRC', pv: 'IDC', cs: 'NO_REQUEST' },
];

/**
 * TargetSourceInfo.description — the owner's own line about what the target source
 * holds. Keyed by target source, not by service: one service can register several.
 * Unlisted ids return undefined, which is the honest shape of an optional field.
 */
export const TS_DESCRIPTION: Record<number, string> = {
  1031: '주문/결제 원장 Oracle · MySQL 운영 DB. 개인정보 스캔 대상 등록 건',
  2113: '결제 승인 이력 Aurora 클러스터 (PCI 범위)',
  2044: '포인트 적립·소멸 이력 Cloud SQL',
  2051: '알림 발송 로그 Azure SQL',
  1861: '정산 마감 배치 RDS',
  1583: '재고 실시간 동기화 DB (IDC)',
  1980: '회원 프로필·동의 이력 Cloud SQL',
  1430: '미디어 업로드 메타데이터 Aurora',
  1520: '추천 피처 스토어 Cloud SQL',
  1799: '배송 추적 이벤트 Azure SQL',
  1462: '인증 토큰 발급 이력 Azure SQL',
  // 운영 알림 네 버킷을 채우는 나머지 — 설명 열이 '—' 로 비면 그 행이 무엇인지
  // Target 번호로만 판단해야 한다.
  1388: '과금 청구 원장·수납 이력 RDS',
  1322: '예약 이력·좌석 배정 Azure SQL',
  1255: '메일 발송 수신자 목록 RDS',
  1642: '쿠폰 발급·사용 이력 RDS',
};

/**
 * 큐가 보여줄 수 있는 대상 하나 — id 와, 큐가 그 id 를 두고 하는 말.
 *
 * `cs` 는 큐의 confirmStatus(REQUESTS_* 의 값)고, 이력에만 있는 id 는 `null` 이다.
 * `pv` 는 wire 표기('AZURE')다 — 내부 casing 으로 접는 것은 읽는 쪽의 일이다.
 * `at` 은 그 대상에 마지막으로 무슨 일이 있었던 시각(이력의 최신 행, 없으면 반려 시각).
 */
export interface ApprovalQueueTarget {
  ts: number;
  svc: string;
  code: string;
  pv: string;
  cs: string | null;
  description?: string;
  at?: string;
}

/**
 * 연동 요청 큐의 세 뷰(대기 / 반려 / 이력)가 보여줄 수 있는 **모든** 대상.
 *
 * 명단을 손으로 옮겨 적지 않고 픽스처에서 뽑는 이유: 이건 큐 화면이 거는 링크의 목적지
 * 명단이기도 하다 — `lib/mock-data.ts` 가 여기 있는 id 마다 타겟 소스를 시드해서,
 * 큐의 어떤 행을 눌러도 실재하는 대상에 닿게 한다. 손복사본은 다음에 큐 행을 한 줄 더
 * 넣는 순간 조용히 어긋나고, 그 결과는 새 행 하나만 404 로 떨어지는 링크다.
 *
 * 같은 id 가 여러 픽스처에 나오면 먼저 만난 쪽을 쓴다 — REQUESTS_* 가 이력보다 앞이다.
 * 이력은 지난 요청의 기록이라 그 시점의 이름을 들고 있을 수 있고, 지금 큐가 그 대상을
 * 뭐라 부르는지는 REQUESTS_* 가 답한다.
 */
export const APPROVAL_QUEUE_TARGETS: readonly ApprovalQueueTarget[] = (() => {
  // 이력은 최신순이라 ts 를 처음 만난 행이 그 대상의 마지막 사건이다.
  const latestAt = new Map<number, string>();
  for (const h of APPROVAL_HISTORY) {
    if (!latestAt.has(h.targetSourceId)) latestAt.set(h.targetSourceId, h.createdAt);
  }

  const byId = new Map<number, ApprovalQueueTarget>();
  const add = (t: ApprovalQueueTarget) => {
    if (!byId.has(t.ts)) byId.set(t.ts, t);
  };
  for (const r of [...REQUESTS_PENDING, ...REQUESTS_REJECTED, ...REQUESTS_ALL]) {
    add({
      ts: r.ts,
      svc: r.svc,
      code: r.code,
      pv: r.pv,
      cs: r.cs,
      description: TS_DESCRIPTION[r.ts],
      at: latestAt.get(r.ts) ?? r.at,
    });
  }
  for (const h of APPROVAL_HISTORY) {
    add({
      ts: h.targetSourceId,
      svc: h.serviceName,
      code: h.serviceCode,
      pv: h.cloudProvider,
      cs: null,
      description: TS_DESCRIPTION[h.targetSourceId],
      at: latestAt.get(h.targetSourceId),
    });
  }
  return [...byId.values()].sort((a, b) => a.ts - b.ts);
})();

/**
 * 큐 대상의 CSP 계정 식별자 — 소유한 provider 의 필드 하나만 차고 나머지는 null 이다.
 * 값은 ts 에서 결정적으로 만들어 새로고침해도 같은 계정이 나온다.
 *
 * 중국 리전은 마지막 한 자리로 가른다. 전부 false 로 두면 화면의 `중국` 태그와 라우트의
 * `aws_region_type: 'china'` 분기가 목에서 한 번도 안 돈다.
 *
 * 큐 응답(task-queue.ts)과 카탈로그 시드(mock-data.ts)가 **같은** 함수를 쓴다. 서비스
 * 운영 목록은 한 대상을 두 경로 중 아무 쪽에서나 받을 수 있어서, 두 곳이 각자 계정을
 * 지어내면 어느 경로로 왔는지에 따라 계정 줄이 바뀌거나 통째로 빈다.
 */
export interface ApprovalQueueAccount {
  tenantId: string | null;
  subscriptionId: string | null;
  gcpProjectId: string | null;
  awsAccountId: string | null;
  isSduType: boolean;
  isChinaRegion: boolean;
}

export const approvalQueueAccount = (ts: number, pv: string): ApprovalQueueAccount => {
  const digits = String(ts).padStart(4, '0');
  const isAws = pv === 'AWS';
  return {
    tenantId: pv === 'AZURE' ? `t-${digits}-0000-0000-0000-000000000000` : null,
    subscriptionId: pv === 'AZURE' ? `s-${digits}-1111-2222-3333-444444444444` : null,
    gcpProjectId: pv === 'GCP' ? `gcp-demo-${digits}` : null,
    awsAccountId: isAws ? `9${digits}`.padEnd(12, '0') : null,
    isSduType: pv === 'SDU',
    isChinaRegion: isAws && ts % 2 === 1,
  };
};
