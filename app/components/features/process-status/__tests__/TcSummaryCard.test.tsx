// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TcSummaryCard, type TcSummaryRun } from '@/app/components/features/process-status/TcSummaryCard';
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

const renderCard = (state: TcCardState, over: Partial<TcBuckets>, run?: TcSummaryRun) =>
  render(
    <TcSummaryCard
      state={state}
      buckets={buckets(over)}
      run={run ?? { requestedAt: '2026-06-01T00:00:00Z', completedAt: null }}
      onRunTest={() => {}}
      runDisabled
      onRequestApproval={() => {}}
      approvalDisabled
    />,
  );

const countsRow = (state: TcCardState, over: Partial<TcBuckets>): string => {
  const { container } = renderCard(state, over);
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

/**
 * 진행 중 카드가 실제로 움직이는 두 채널. 폴이 4초라 값이 바뀌는 순간은 유닛이 정착할
 * 때뿐이고, 그 사이를 이 둘이 메운다 — 스스로 세는 경과(시안 B)와 미판정 구간의 행진
 * 무늬(시안 A).
 */
describe('TcSummaryCard liveness while running', () => {
  const metaLine = (container: HTMLElement): string => {
    const rows = [...container.querySelectorAll('.\\[font-variant-numeric\\:tabular-nums\\]')];
    return rows.find((row) => row.textContent?.includes('요청'))?.textContent ?? '';
  };

  it('counts elapsed time off the browser clock while a run is in flight', () => {
    const { container } = renderCard(
      'running',
      { ok: 2, waiting: 4 },
      { requestedAt: new Date(Date.now() - 72_000).toISOString(), completedAt: null },
    );
    expect(metaLine(container)).toMatch(/1분 1[12]초 경과/);
  });

  /** 시작 대기도 같은 질문을 받는다 — 트랙조차 없어 이 수가 유일하게 변하는 값이다. */
  it('counts elapsed while queued too', () => {
    const { container } = renderCard(
      'queued',
      { waiting: 6 },
      { requestedAt: new Date(Date.now() - 8_000).toISOString(), completedAt: null },
    );
    expect(metaLine(container)).toMatch(/[78]초 경과/);
  });

  /** 정착하면 계약이 준 completed_at 을 쓰고 시계는 멈춘다 — 소요이지 경과가 아니다. */
  it('a settled run states 소요 from the contract, never a live 경과', () => {
    const { container } = renderCard(
      'success',
      { ok: 6 },
      { requestedAt: '2026-06-01T00:00:00Z', completedAt: '2026-06-01T00:00:58Z' },
    );
    const meta = container.textContent ?? '';
    expect(meta).toContain('소요 58초');
    expect(meta).not.toContain('경과');
  });

  it('marches the unadjudicated remainder of the track while running', () => {
    const { container } = renderCard('running', { ok: 2, waiting: 4 });
    expect(container.querySelector('[class*="tc-track-march"]')).not.toBeNull();
  });

  /** 정착한 바는 전부 판정이다 — 행진할 미판정 구간이 없다. */
  it('drops the march once the run settles', () => {
    const { container } = renderCard('fail', { ok: 4, fail: 2 });
    expect(container.querySelector('[class*="tc-track-march"]')).toBeNull();
  });
});

/**
 * 문장 왼쪽 글리프. 삼항의 마지막 가지는 **폴백이지 기본값이 아니다** — `fail` 이 거기로
 * 떨어져 실패 카드가 미실행·시작 대기와 같은 시계를 달고 있었고, 표면과 문장만 붉을 뿐
 * 글리프는 아무 판정도 하지 않았다. Figma(H2kRxFxOqqeTrPceFU4zMM)가 지정한 대로 가른다.
 */
describe('TcSummaryCard title glyph', () => {
  // title 의 아이콘 슬롯이 카드에서 첫 `s.icon` — 메타 서브라인의 시계는 그 뒤에 온다.
  const glyph = (state: TcCardState, over: Partial<TcBuckets>): string =>
    renderCard(state, over).container.querySelector('.inline-grid svg')?.innerHTML ?? '';

  const CLOCK = 'polyline';
  const X_CIRCLE = 'M10 14l2-2';
  const HOURGLASS = 'M5 2h14M5 22h14';

  it('fail carries the x-circle, not the clock it used to fall through to', () => {
    const fail = glyph('fail', { ok: 5, fail: 1 });
    expect(fail).toContain(X_CIRCLE);
    expect(fail).not.toContain(CLOCK);
  });

  it('queued carries the hourglass — waiting to start is not the absence of a run', () => {
    const queued = glyph('queued', { waiting: 6 });
    expect(queued).toContain(HOURGLASS);
    expect(queued).not.toContain(CLOCK);
  });

  /** 폴백에 남는 상태는 idle 하나 — 실행이 없다는 사실만 말하므로 시계가 맞다. */
  it('idle keeps the clock', () => {
    expect(glyph('idle', {})).toContain(CLOCK);
  });

  /** 네 국면이 서로 다른 그림이어야 색 없이도 갈린다(WCAG 1.4.1). */
  it('gives idle, queued, running and fail four different glyphs', () => {
    const seen = [
      glyph('idle', {}),
      glyph('queued', { waiting: 6 }),
      glyph('running', { ok: 1, waiting: 5 }),
      glyph('fail', { ok: 5, fail: 1 }),
    ];
    expect(new Set(seen).size).toBe(4);
  });
});
