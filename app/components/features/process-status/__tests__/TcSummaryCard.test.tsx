// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TcSummaryCard } from '@/app/components/features/process-status/TcSummaryCard';
import type { TcBuckets, TcCardState } from '@/lib/test-connection-summary';

const buckets = (over: Partial<TcBuckets>): TcBuckets => {
  const base: TcBuckets = {
    total: 6,
    ok: 0,
    fail: 0,
    running: 0,
    waiting: 0,
    unreported: 0,
    unknown: 0,
    reported: 0,
  };
  const merged = { ...base, ...over };
  return { ...merged, reported: merged.ok + merged.fail + merged.unknown };
};

const countsRow = (state: TcCardState, over: Partial<TcBuckets>): string => {
  const { container } = render(
    <TcSummaryCard
      state={state}
      buckets={buckets(over)}
      run={{ requestedAt: '2026-06-01T00:00:00Z', completedAt: null }}
      onRunTest={() => {}}
      runDisabled
      onRequestApproval={() => {}}
      approvalDisabled
    />,
  );
  // The meta subline shares the tabular-nums class, so pick the counts row by content.
  const rows = [...container.querySelectorAll('.\\[font-variant-numeric\\:tabular-nums\\]')];
  return rows.find((row) => row.textContent?.includes('성공'))?.textContent ?? '';
};

describe('TcSummaryCard counts row', () => {
  /**
   * 진행 중엔 진행 중·대기·미보고가 독자에게 한 사실(아직 답이 없다)이라 `남음`으로
   * 접힌다. 접고 나면 줄의 합이 총계와 같아져(미확인이 있으면 그것까지) 집계였던
   * `보고됨 N/M` 은 불필요해져 사라진다 — 같은 숫자가 한 줄에 두 번 나오던 원인이
   * 이것이었다.
   */
  it('folds running/waiting/unreported into 남음 and drops the aggregate while running', () => {
    const row = countsRow('running', { ok: 2, running: 1, waiting: 2, unreported: 1 });
    expect(row).toContain('남음4');
    expect(row).not.toContain('진행 중');
    expect(row).not.toContain('보고됨');
  });

  /**
   * 정착한 실행에서는 접지 않는다 — 그때 미보고는 실제 이상신호이고, 건강한 정착은
   * 애초에 미보고를 만들지 않는다.
   */
  it('keeps 미보고 on its own once the run has settled', () => {
    const row = countsRow('fail', { ok: 3, fail: 2, unreported: 1 });
    expect(row).toContain('미보고1');
    expect(row).not.toContain('남음');
  });

  /** 계약 밖 값은 보고는 됐는데 읽을 수 없다는 뜻이라, 진행 중에도 접지 않는다. */
  it('never folds 미확인, not even mid-run', () => {
    const row = countsRow('running', { ok: 1, unknown: 1, waiting: 4 });
    expect(row).toContain('미확인1');
    expect(row).toContain('남음4');
  });
});
