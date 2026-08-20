/**
 * dagBoard 파생 로직 — 보드 행 펼치기·필터·문제 우선 정렬·에이전트 요약·셀 판정.
 * allowlist 가 계약 밖의 값을 아는 상태로 위장시키지 않는지가 축이다:
 * 미지의 day status 는 'unknown' 셀(부재 아님), 미지의 connectionStatus 는
 * '미확인' 라벨(raw 없음 — wire 어휘는 라벨 금지, 툴팁 채널만).
 */
import { describe, expect, it } from 'vitest';
import type { DagDatabaseStatus, DagStatusResponse } from '@/lib/types/dag-status';
import {
  abbrevDagName,
  agentDisplayName,
  connPill,
  countBuckets,
  dayCellKind,
  dayCellTip,
  dayLabel,
  flattenDagRows,
  isTodayKst,
  scopeBoardRows,
  sortBoardRows,
  summarizeAgents,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

const day = (status: string, successTime: string | null = null) => ({
  day: '2026-08-15',
  status,
  successTime,
});

const db = (
  uri: string,
  name: string | null,
  succeededThisWeek: boolean,
  dayStatuses: string[],
  // 이름과 다른 값이어야 검색이 정말 schemaName 을 보는지 알 수 있다.
  schema?: string | null,
): DagDatabaseStatus => ({
  databaseUri: uri,
  databaseName: name,
  schemaName: schema !== undefined ? schema : name,
  dagName: name ? `pii_scan_${name}` : null,
  namespace: name ? 'composer-prod' : null,
  succeededThisWeek,
  lastSuccessAt: null,
  days: dayStatuses.map((s) => day(s)),
});

const RESPONSE: DagStatusResponse = {
  targetSourceId: 1,
  connectionStatus: 'SUCCESS',
  healthStatus: 'UNHEALTHY',
  timezone: 'KST',
  agents: [
    {
      agentId: 'agent-1',
      resourceId: 'projects/p/instances/db-1',
      gcpRegion: 'asia-northeast3',
      connectionStatus: 'SUCCESS',
      databaseStatuses: [
        db('mysql://10.0.0.1:3306/orders', 'orders', true, ['SUCCESS'], 'analytics'),
        db('mysql://10.0.0.1:3306/billing', 'billing', false, ['FAILED']),
        db('mysql://10.0.0.1:3306/legacy', null, false, ['NOT_SCHEDULED']),
      ],
    },
    {
      agentId: 'agent-2',
      resourceId: 'projects/p/instances/db-2',
      gcpRegion: 'asia-northeast3',
      connectionStatus: 'FAIL',
      databaseStatuses: [
        db('mysql://10.0.0.2:3306/ratings', 'ratings', false, ['RUNNING']),
        db('mysql://10.0.0.2:3306/weird', 'weird', false, ['SOMETHING_NEW']),
      ],
    },
  ],
};

describe('flattenDagRows / countBuckets', () => {
  it('agent 를 가로질러 행을 펼치고 bucket 을 붙인다', () => {
    const rows = flattenDagRows(RESPONSE);
    expect(rows).toHaveLength(5);
    const counts = countBuckets(rows);
    expect(counts).toEqual({ succeeded: 1, failed: 1, unscheduled: 1, running: 1, other: 1 });
  });
});

describe('scopeBoardRows', () => {
  const rows = flattenDagRows(RESPONSE);

  it('에이전트 스코프가 다른 agent 의 행을 걸러낸다', () => {
    const scoped = scopeBoardRows(rows, 'agent-2', '');
    expect(scoped.map((r) => r.agentId)).toEqual(['agent-2', 'agent-2']);
  });

  it('검색은 uri 와 이름을 대소문자 무시로 함께 본다', () => {
    expect(scopeBoardRows(rows, null, 'ORDERS')).toHaveLength(1);
    expect(scopeBoardRows(rows, null, '10.0.0.2')).toHaveLength(2);
    // 이름이 null 인 행은 uri 로만 잡힌다 — null 접근으로 죽지 않는다.
    expect(scopeBoardRows(rows, null, 'legacy')).toHaveLength(1);
  });

  it('행에 보이는 스키마·DAG 로도 찾을 수 있다', () => {
    // 이름(orders)과 다른 값이라 schemaName 을 보지 않으면 잡히지 않는다.
    const bySchema = scopeBoardRows(rows, null, 'ANALYTICS');
    expect(bySchema.map((r) => r.db.databaseName)).toEqual(['orders']);
    const byDag = scopeBoardRows(rows, null, 'pii_scan_billing');
    expect(byDag.map((r) => r.db.databaseName)).toEqual(['billing']);
  });
});

describe('sortBoardRows — 문제 우선', () => {
  it('실패 → 그 외 → 미스케줄 → 실행 시작 → 성공 순서로 세운다', () => {
    const sorted = sortBoardRows(flattenDagRows(RESPONSE));
    expect(sorted.map((r) => r.bucket)).toEqual([
      'failed',
      'other',
      'unscheduled',
      'running',
      'succeeded',
    ]);
  });
});

describe('isTodayKst — 오늘 칸은 자리가 아니라 날짜', () => {
  // 09:00 KST = 00:00 UTC 같은 날, 08:00 KST = 전날 23:00 UTC — 경계 양쪽을 다 본다.
  it('KST 달력 날짜로 판정한다 — UTC 자정을 넘긴 시각도 같은 KST 날짜', () => {
    expect(isTodayKst('2026-08-20', new Date('2026-08-19T15:30:00Z'))).toBe(true);
    expect(isTodayKst('2026-08-19', new Date('2026-08-19T14:30:00Z'))).toBe(true);
  });

  it('창이 어제 닫힌 응답에는 오늘 칸이 없다 — 마지막 칸을 오늘로 부르지 않는다', () => {
    const days = ['2026-08-13', '2026-08-14', '2026-08-15'];
    const now = new Date('2026-08-20T01:00:00Z');
    expect(days.filter((d) => isTodayKst(d, now))).toEqual([]);
  });
});

describe('summarizeAgents — 문제 우선 + 분수', () => {
  it('연결 실패 에이전트가 먼저 서고, 분수 필드가 bucket 합과 맞는다', () => {
    const agents = summarizeAgents(RESPONSE);
    expect(agents[0].agentId).toBe('agent-2');
    expect(agents[0].dbTotal).toBe(2);
    expect(agents[0].running).toBe(1);
    // 미지의 day status(SOMETHING_NEW) 행은 rest(부재 몫)로 — 성공으로 위장하지 않는다.
    expect(agents[0].rest).toBe(1);
    expect(agents[1]).toMatchObject({ agentId: 'agent-1', succeeded: 1, failed: 1, rest: 1 });
  });
});

describe('connPill — allowlist', () => {
  it('선언된 네 값은 제 라벨을 얻는다', () => {
    expect(connPill('SUCCESS')).toMatchObject({ tone: 'ok', label: '성공' });
    expect(connPill('FAIL')).toMatchObject({ tone: 'err', label: '실패' });
    expect(connPill('RUNNING')).toMatchObject({ tone: 'warn', label: '진행 중' });
    expect(connPill('PENDING')).toMatchObject({ tone: 'off', label: '대기' });
  });

  it('미지의 값은 미확인 — 라벨에 raw 를 싣지 않는다 (툴팁 채널만)', () => {
    const pill = connPill('HALF_OPEN');
    expect(pill.label).toBe('미확인');
    expect(pill.label).not.toContain('HALF_OPEN');
    expect(pill.raw).toBe('HALF_OPEN');
  });
});

describe('agentDisplayName', () => {
  it('경로형은 마지막 / 조각, ARN 은 마지막 : 조각, 평문은 그대로', () => {
    expect(agentDisplayName('projects/p/instances/review-db-1')).toBe('review-db-1');
    expect(agentDisplayName('arn:aws:rds:ap-northeast-2:1111:db:cpn-db-1')).toBe('cpn-db-1');
    expect(agentDisplayName('idc-ivt-9a01')).toBe('idc-ivt-9a01');
  });
});

describe('abbrevDagName', () => {
  it('짧은 이름은 그대로 둔다', () => {
    expect(abbrevDagName('pii_scan_orders')).toBe('pii_scan_orders');
  });

  it('긴 이름은 가운데를 접어 꼬리를 남긴다 — 접두사만 남으면 행이 구분되지 않는다', () => {
    const prefix = 'pii_scan__gcp__prod__cloudsql__review_db_1__';
    const a = abbrevDagName(`${prefix}review_media`);
    const b = abbrevDagName(`${prefix}review_reports`);
    expect(a).not.toBe(b);
    expect(a.endsWith('eview_media')).toBe(false);
    expect(a.endsWith('view_media')).toBe(true);
    expect(a.startsWith('pii_scan__gc')).toBe(true);
    expect(a).toHaveLength(23);
  });
});

describe('dayCellKind / dayCellTip', () => {
  it('미지의 day status 는 unknown — 부재(none)로 위장하지 않는다', () => {
    expect(dayCellKind('NOT_SCHEDULED')).toBe('none');
    expect(dayCellKind('SOMETHING_NEW')).toBe('unknown');
  });

  it('성공 셀 툴팁은 날짜·판정·시각, 실패엔 시각이 없다', () => {
    expect(dayLabel('2026-08-15')).toBe('8월 15일 (토)');
    expect(dayCellTip(day('SUCCESS', '2026-08-15T07:52:19+09:00'))).toBe(
      '8월 15일 (토) · 성공 · 07:52:19',
    );
    expect(dayCellTip(day('FAILED'))).toBe('8월 15일 (토) · 실패');
    expect(dayCellTip(day('NOT_SCHEDULED'))).toBe('8월 15일 (토) · 스케줄 없음');
    // 지난 날짜 칸에도 서는 값이라 "진행 중"이 아니다 — 시작했다는 사실까지만.
    expect(dayCellTip(day('RUNNING'))).toBe('8월 15일 (토) · 실행 시작');
  });

  it('미지의 값 툴팁은 판정 불가 문장 + raw (툴팁 채널)', () => {
    expect(dayCellTip(day('SOMETHING_NEW'))).toBe(
      '8월 15일 (토) · 판정할 수 없는 값 (status: SOMETHING_NEW)',
    );
  });
});
