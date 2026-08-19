import { describe, it, expect } from 'vitest';
import { toTcResultRow, type TcResultRow } from '@/app/lib/api/task-queue-tc';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import {
  isRunOpen,
  ldbCount,
  runDurationSeconds,
  runFailReason,
  runProgress,
  runStatus,
  tcFactsByResource,
  tcResultStats,
  verdictByResource,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import {
  resourceIdTail,
  shortResourceId,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

const row = (over: Partial<TcResultRow> = {}): TcResultRow => ({
  resourceId: 'r-1',
  includedCount: 5,
  excludedCount: 2,
  ...over,
});

/** latest_version 응답 — agent 결과는 [resource_id, connection_status] 쌍으로 준다. */
const version = (
  agents: readonly (readonly [string, string])[],
  over: Partial<TestConnectionVersionResult> = {},
): TestConnectionVersionResult => ({
  target_source_id: 1,
  test_connection_version: 4,
  connection_status: 'SUCCESS',
  test_connection_agent_results: agents.map(([resource_id, connection_status]) => ({
    agent_id: `agent-${resource_id}`,
    resource_id,
    connection_status,
  })),
  ...over,
});

describe('toTcResultRow', () => {
  it('reads the contract fields — resource id and the two logical-DB counts', () => {
    expect(
      toTcResultRow({
        resource_id: 'idc-r-1',
        logical_database_count: 6,
        excluded_logical_database_count: 1,
      }),
    ).toEqual({ resourceId: 'idc-r-1', includedCount: 6, excludedCount: 1 });
  });

  it('coalesces absent counts to null (never a false 0) and an absent id to empty', () => {
    expect(toTcResultRow({})).toEqual({
      resourceId: '',
      includedCount: null,
      excludedCount: null,
    });
  });
});

describe('verdictByResource', () => {
  it('folds one agent per resource straight through', () => {
    const verdicts = verdictByResource(version([['r-1', 'SUCCESS'], ['r-2', 'FAIL']]));
    expect(verdicts.get('r-1')).toBe('SUCCESS');
    expect(verdicts.get('r-2')).toBe('FAIL');
  });

  it('calls a resource SUCCESS only when every one of its agents succeeded', () => {
    expect(
      verdictByResource(version([['r-1', 'SUCCESS'], ['r-1', 'SUCCESS']])).get('r-1'),
    ).toBe('SUCCESS');
  });

  it('lets a single FAIL decide — 부분 성공을 성공으로 올리지 않는다', () => {
    expect(
      verdictByResource(version([['r-1', 'SUCCESS'], ['r-1', 'FAIL']])).get('r-1'),
    ).toBe('FAIL');
  });

  it('folds with the shared FAIL-first priority — Step 5 와 같은 한 벌 (foldAgentStatuses)', () => {
    // FAIL → UNKNOWN → RUNNING → PENDING → SUCCESS.
    expect(
      verdictByResource(version([['r-1', 'RUNNING'], ['r-1', 'FAIL']])).get('r-1'),
    ).toBe('FAIL');
    expect(
      verdictByResource(version([['r-1', 'SUCCESS'], ['r-1', 'RUNNING']])).get('r-1'),
    ).toBe('RUNNING');
    // 대기는 agent 가 보고한 사실 — 표의 연결 상태 열이 "대기"로 그린다.
    expect(
      verdictByResource(version([['r-1', 'SUCCESS'], ['r-1', 'PENDING']])).get('r-1'),
    ).toBe('PENDING');
    expect(verdictByResource(version([['r-1', 'PENDING']])).get('r-1')).toBe('PENDING');
  });

  it('maps a value outside the contract enum to UNKNOWN, never to success', () => {
    expect(verdictByResource(version([['r-1', 'WEIRD']])).get('r-1')).toBe('UNKNOWN');
    expect(
      verdictByResource(version([['r-1', 'SUCCESS'], ['r-1', 'WEIRD']])).get('r-1'),
    ).toBe('UNKNOWN');
  });

  it('is empty when there is no run at all (404) or no agent results', () => {
    expect(verdictByResource(null).size).toBe(0);
    expect(verdictByResource(version([])).size).toBe(0);
  });

  it('skips an agent row with no resource_id instead of keying it on ""', () => {
    expect(verdictByResource(version([['', 'SUCCESS']])).size).toBe(0);
  });
});

describe('tcFactsByResource', () => {
  it('reads the DRAFT-CONTRACT pod_id/fail_reason off the passthrough object', () => {
    const latest = version([['r-1', 'FAIL']]);
    const [agent] = latest.test_connection_agent_results ?? [];
    const facts = tcFactsByResource({
      ...latest,
      test_connection_agent_results: [
        { ...agent, pod_id: 'tc-1-4-ab12z', fail_reason: 'SECRET_NOT_FOUND' },
      ],
    });
    expect(facts.get('r-1')).toEqual({
      verdict: 'FAIL',
      podId: 'tc-1-4-ab12z',
      failReason: 'SECRET_NOT_FOUND',
    });
  });

  it('treats an absent, empty, or non-string pod_id/fail_reason as 없음', () => {
    const latest = version([['r-1', 'SUCCESS'], ['r-2', 'FAIL'], ['r-3', 'RUNNING']]);
    const agents = latest.test_connection_agent_results ?? [];
    const facts = tcFactsByResource({
      ...latest,
      test_connection_agent_results: [
        agents[0],
        { ...agents[1], pod_id: '', fail_reason: '' },
        { ...agents[2], pod_id: 7, fail_reason: 9 },
      ],
    });
    expect([...facts.values()].map((f) => [f.podId, f.failReason])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it('takes pod and reason from the agent that made the verdict — 실패 행의 로그 링크는 실패한 pod 를 연다', () => {
    const latest = version([['r-1', 'SUCCESS'], ['r-1', 'FAIL']]);
    const [ok, fail] = latest.test_connection_agent_results ?? [];
    const facts = tcFactsByResource({
      ...latest,
      test_connection_agent_results: [
        { ...ok, pod_id: 'tc-ok' },
        { ...fail, pod_id: 'tc-fail', fail_reason: 'CLUSTER_TEST_FAILED' },
      ],
    });
    expect(facts.get('r-1')).toEqual({
      verdict: 'FAIL',
      podId: 'tc-fail',
      failReason: 'CLUSTER_TEST_FAILED',
    });
  });

  it('is empty for no run', () => {
    expect(tcFactsByResource(null).size).toBe(0);
  });
});

describe('runFailReason', () => {
  it('reads the DRAFT-CONTRACT run-level fail_reason off the passthrough object', () => {
    const latest = version([], { connection_status: 'FAIL' });
    expect(runFailReason({ ...latest, fail_reason: 'TERRAFORM_NOT_APPLIED' })).toBe(
      'TERRAFORM_NOT_APPLIED',
    );
  });

  it('is null for no run, an absent value, or an empty string — 사유 줄 자체가 없다', () => {
    expect(runFailReason(null)).toBeNull();
    expect(runFailReason(version([]))).toBeNull();
    expect(runFailReason({ ...version([]), fail_reason: '' })).toBeNull();
  });
});

describe('runProgress', () => {
  const latest = version([['r-1', 'SUCCESS'], ['r-2', 'FAIL']]);

  it('counts settled agents against the confirmed resource count, not the rows received', () => {
    // 3건짜리 실행에서 2건만 보고된 상태 — 분모가 받은 행 수면 "2/2 완료"(100%)가 된다.
    expect(runProgress(latest, 3)).toEqual({ done: 2, total: 3 });
  });

  it('never lets the denominator fall below the rows already received', () => {
    // 한 리소스를 여러 agent 가 맡으면 행이 확정 리소스 수보다 많아진다.
    expect(runProgress(latest, 1)).toEqual({ done: 2, total: 2 });
  });

  it('does not count an unsettled agent as done', () => {
    expect(runProgress(version([['r-1', 'RUNNING'], ['r-2', 'SUCCESS']]), 2).done).toBe(1);
  });
});

describe('runStatus / isRunOpen', () => {
  it('passes the four contract states through', () => {
    expect(runStatus(version([], { connection_status: 'RUNNING' }))).toBe('RUNNING');
    expect(runStatus(version([], { connection_status: 'FAIL' }))).toBe('FAIL');
  });

  it('is UNKNOWN for no run or a value outside the enum', () => {
    expect(runStatus(null)).toBe('UNKNOWN');
    expect(runStatus(version([], { connection_status: 'WEIRD' }))).toBe('UNKNOWN');
  });

  it('treats PENDING and RUNNING as open, everything else as settled', () => {
    expect(isRunOpen(version([], { connection_status: 'PENDING' }))).toBe(true);
    expect(isRunOpen(version([], { connection_status: 'RUNNING' }))).toBe(true);
    expect(isRunOpen(version([], { connection_status: 'SUCCESS' }))).toBe(false);
    expect(isRunOpen(null)).toBe(false);
  });
});

describe('tcResultStats', () => {
  it('sums 논리 DB from latest-results and counts verdicts from latest_version', () => {
    expect(
      tcResultStats(
        [
          row({ resourceId: 'r-1', includedCount: 5, excludedCount: 2 }),
          row({ resourceId: 'r-2', includedCount: 3, excludedCount: 1 }),
        ],
        version([['r-1', 'SUCCESS'], ['r-2', 'SUCCESS']]),
      ),
    ).toEqual({
      resourceCount: 2,
      includedTotal: 8,
      excludedTotal: 3,
      successCount: 2,
      failedCount: 0,
      runningCount: 0,
      unknownCount: 0,
    });
  });

  it('is empty with no rows and no run', () => {
    expect(tcResultStats([], null)).toEqual({
      resourceCount: 0,
      includedTotal: 0,
      excludedTotal: 0,
      successCount: 0,
      failedCount: 0,
      runningCount: 0,
      unknownCount: 0,
    });
  });

  it('counts each verdict separately — 미판정은 성공도 실패도 아니다', () => {
    const stats = tcResultStats(
      [],
      version([
        ['r-1', 'SUCCESS'],
        ['r-2', 'FAIL'],
        ['r-3', 'RUNNING'],
        ['r-4', 'WEIRD'],
        ['r-5', 'PENDING'],
      ]),
    );
    expect(stats).toMatchObject({
      resourceCount: 5,
      successCount: 1,
      failedCount: 1,
      // RUNNING 과 PENDING 은 둘 다 "아직 판정 전" — 카드 요약의 같은 통에 든다.
      runningCount: 2,
      unknownCount: 1,
    });
  });

  it('totals 논리 DB only for resources the run judged SUCCESS — the table cell gate', () => {
    const stats = tcResultStats(
      [
        row({ resourceId: 'r-1', includedCount: 12, excludedCount: 3 }),
        row({ resourceId: 'r-2', includedCount: 8, excludedCount: 1 }),
      ],
      version([['r-1', 'FAIL'], ['r-2', 'SUCCESS']]),
    );
    expect(stats.includedTotal).toBe(8);
    expect(stats.excludedTotal).toBe(1);
  });

  it('totals nothing when the run reported no per-resource verdicts', () => {
    const stats = tcResultStats([row({ includedCount: 4, excludedCount: 1 })], version([]));
    expect(stats.includedTotal).toBe(0);
    expect(stats.resourceCount).toBe(0);
  });
});

describe('runDurationSeconds', () => {
  it('measures the gap between request and completion', () => {
    expect(runDurationSeconds('2026-08-02T09:30:00.000Z', '2026-08-02T09:30:36.000Z')).toBe(36);
  });

  it('is null while the run is still open (no completion time)', () => {
    expect(runDurationSeconds('2026-08-02T09:30:00.000Z', null)).toBeNull();
  });

  it('is null for an unparsable or reversed pair — never a negative duration', () => {
    expect(runDurationSeconds('nonsense', '2026-08-02T09:30:36.000Z')).toBeNull();
    expect(runDurationSeconds('2026-08-02T09:30:36.000Z', '2026-08-02T09:30:00.000Z')).toBeNull();
  });
});

describe('ldbCount', () => {
  it('returns the tab count when the resource verdict is SUCCESS', () => {
    expect(ldbCount(row(), 'inc', 'SUCCESS')).toBe(5);
    expect(ldbCount(row(), 'exc', 'SUCCESS')).toBe(2);
  });

  it('returns null (renders "—", no link) for any non-success verdict', () => {
    expect(ldbCount(row(), 'inc', 'FAIL')).toBeNull();
    expect(ldbCount(row(), 'inc', 'RUNNING')).toBeNull();
    expect(ldbCount(row(), 'inc', 'UNKNOWN')).toBeNull();
  });

  it('returns null when the run said nothing about this resource', () => {
    expect(ldbCount(row(), 'inc', undefined)).toBeNull();
  });

  it('returns null when there is no results row for the resource', () => {
    expect(ldbCount(undefined, 'inc', 'SUCCESS')).toBeNull();
  });

  it('returns null for a SUCCESS resource whose count the wire omitted', () => {
    expect(ldbCount(row({ includedCount: null }), 'inc', 'SUCCESS')).toBeNull();
    expect(ldbCount(row({ excludedCount: null }), 'exc', 'SUCCESS')).toBeNull();
  });
});

describe('resourceIdTail', () => {
  it('keeps only the last segment of a path id — the part 30 rows differ by', () => {
    expect(
      resourceIdTail(
        '/subscriptions/b1d4e77c/resourceGroups/rg-lgs-order/providers/Microsoft.DBforMySQL/servers/mysql-lgs-order-01',
      ),
    ).toBe('mysql-lgs-order-01');
    expect(resourceIdTail('projects/sea-rvw-prd/instances/cloudsql-rvw-main')).toBe(
      'cloudsql-rvw-main',
    );
  });

  it('leaves a non-path id (AWS/IDC) alone — it is already its own last segment', () => {
    expect(resourceIdTail('rds-cpn-main')).toBe('rds-cpn-main');
    expect(resourceIdTail('idc-ivt-9a01')).toBe('idc-ivt-9a01');
  });

  it('does not collapse an empty id to something that looks like a value', () => {
    expect(resourceIdTail('')).toBe('');
  });
});

describe('shortResourceId', () => {
  it('leaves a short id untouched', () => {
    expect(shortResourceId('idc-ivt-9a01')).toBe('idc-ivt-9a01');
  });

  it('keeps the last two segments of a long path id', () => {
    expect(
      shortResourceId(
        '/subscriptions/2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforMySQL/servers/mysql-dlv-01',
      ),
    ).toBe('…/servers/mysql-dlv-01');
  });

  it('elides the middle of a long id that has no path segments', () => {
    const value = 'arn'.padEnd(60, 'x');
    const short = shortResourceId(value);
    expect(short).toContain('…');
    expect(short.length).toBeLessThan(value.length);
    expect(short.endsWith(value.slice(-16))).toBe(true);
  });
});
