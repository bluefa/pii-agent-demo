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

  /**
   * 판정이 하나도 없는 국면도 줄의 문법은 같다. 평문 `대상 리소스 6개` 는 점도 굵은 수도
   * 없어서 같은 자리에 다른 종족이 서고, 국면이 바뀔 때마다 줄이 통째로 갈아끼워지는 것처럼
   * 읽혔다. 중립 점은 `남음` 의 선례 — 판정이 아니라 "아직 답이 없다" 를 가리키는 자리다.
   */
  it('counts the targets in the same segment grammar when nothing is adjudicated', () => {
    const noVerdict: { state: TcCardState; over: Partial<TcBuckets> }[] = [
      { state: 'idle', over: {} },
      { state: 'queued', over: { waiting: 6 } },
      { state: 'success', over: { unreported: 6 } },
      { state: 'confirmed', over: {} },
    ];
    for (const { state, over } of noVerdict) {
      const { container } = renderCard(state, over);
      // 중립 점(`countDotColor.rest`)의 부모가 세그먼트 — 점이 없으면 평문으로 되돌아간 것이다.
      const seg = container.querySelector('[class*="bg-[#8B95A1]"]')?.parentElement;
      expect(seg?.textContent, state).toBe('대상 리소스6');
    }
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

  /** 트랙의 빈 바닥 — 채움도 행진 무늬도 이 위에 올라간다. */
  const TRACK = '[class*="bg-[#E4E7EC]"]';

  it('marches the unadjudicated remainder of the track while running', () => {
    const { container } = renderCard('running', { ok: 2, waiting: 4 });
    // 트랙부터 잰다. 무늬만 재면 셀렉터가 틀려도 아래 정착 케이스가 통과해 버린다.
    expect(container.querySelector(TRACK)).not.toBeNull();
    expect(container.querySelector('[class*="tc-track-march"]')).not.toBeNull();
  });

  /**
   * 무늬는 "아직 답이 없다"만 말한다. 채움이 덮어 주기를 기대할 수 없는 이유는 채움이
   * ok·fail 뿐인데 `reported` 에는 `unknown` 도 들기 때문 — 계약 밖 값으로만 보고된
   * 실행이면 문장은 `결과를 집계하고 있어요` 인데 트랙은 전부 흐르는, 한 카드가 두 말을
   * 하는 상태가 된다. 미확인은 답이 없는 게 아니라 읽을 수 없는 답이다.
   */
  it('stops marching once everything has reported, even when the answers are unreadable', () => {
    const { container } = renderCard('running', { unknown: 6 });
    expect(container.querySelector(TRACK)).not.toBeNull();
    expect(container.querySelector('[class*="tc-track-march"]')).toBeNull();
  });

  /** 반대쪽 — 미확인이 섞여도 아직 답을 못 받은 유닛이 남아 있으면 흐른다. */
  it('keeps marching while any unit still owes an answer', () => {
    const { container } = renderCard('running', { ok: 2, unknown: 1, waiting: 3 });
    expect(container.querySelector('[class*="tc-track-march"]')).not.toBeNull();
  });

  /**
   * 바는 진행이지 결과가 아니다 — 정착하면 무늬만이 아니라 트랙째 물러난다. 판정 둘은
   * 9px 아래 카운트 줄이 이미 수로 말하고 있어서, 꽉 찬 두 색 띠는 같은 두 값을 형태로
   * 한 번 더 그리는 것뿐이다. Figma(H2kRxFxOqqeTrPceFU4zMM)의 정착 프레임 넷이 전부
   * track 을 hidden 으로 둔 것이 이 규칙이다.
   */
  it('retires the whole track once the run settles, not just the march', () => {
    const settled: { state: TcCardState; over: Partial<TcBuckets> }[] = [
      { state: 'success', over: { ok: 6 } },
      { state: 'success', over: { ok: 4, unreported: 2 } },
      { state: 'fail', over: { ok: 5, fail: 1 } },
      { state: 'fail', over: { ok: 3, fail: 2, unknown: 1 } },
    ];
    for (const { state, over } of settled) {
      const { container } = renderCard(state, over);
      expect(container.querySelector(TRACK), `${state} ${JSON.stringify(over)}`).toBeNull();
    }
  });
});

/**
 * 슬롯 CTA 의 어휘. 첫 회차와 재실행은 같은 버튼·같은 글리프·같은 핸들러라 언어가 갈릴 이유가
 * 없다 — 앱의 나머지도 이 동작을 `실행` 하나로 부른다(토스트 `연결 테스트 실행을 요청했습니다`).
 */
describe('TcSummaryCard CTA vocabulary', () => {
  const buttons = (state: TcCardState, over: Partial<TcBuckets>): string[] => {
    const { container } = renderCard(state, over);
    return [...container.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');
  };

  it('names the first run 실행 — the verb 다시 실행 already uses', () => {
    expect(buttons('idle', {})).toEqual(['실행']);
    expect(buttons('fail', { ok: 5, fail: 1 })).toEqual(['다시 실행']);
  });

  /** 관리자 화면(ApprovalTab)이 이 라벨을 그대로 인용한다 — 둘이 어긋나면 서로 다른 버튼을 찾는다. */
  it('asks for 승인 요청, not 완료 승인 요청', () => {
    expect(buttons('success', { ok: 6 })).toEqual(['다시 실행', '승인 요청']);
  });
});

/**
 * 성공 정착에만 서는 안내 줄. 이 국면만 다음 행동이 열려 있어서다 — 나머지는 제목이 곧 다음
 * 행동이다(실패=고쳐서 다시, 정책 변경=다시 실행, 확정=끝).
 */
describe('TcSummaryCard success guidance', () => {
  const line = (state: TcCardState, over: Partial<TcBuckets>): string | null => {
    const { container } = renderCard(state, over);
    return container.querySelector('[class*="pl-[26px]"]')?.textContent ?? null;
  };

  it('tells the success card what to do next, and in which order', () => {
    const text = line('success', { ok: 6 }) ?? '';
    expect(text).toContain('관리자에게 승인을 요청하면');
    // 순서가 빠지면 승인 요청이 헛걸음이 된다 — 논리 DB 제외를 저장하는 순간 그 실행은
    // 뒤처진 것이 되어 카드가 policy-changed 로 넘어가고 테스트를 다시 돌려야 한다.
    expect(text).toContain('요청 전에 정리해');
  });

  it('leaves every other phase to its own title', () => {
    const others: { state: TcCardState; over: Partial<TcBuckets> }[] = [
      { state: 'idle', over: {} },
      { state: 'queued', over: { waiting: 6 } },
      { state: 'running', over: { ok: 2, waiting: 4 } },
      { state: 'fail', over: { ok: 5, fail: 1 } },
      { state: 'policy-changed', over: { ok: 6 } },
      { state: 'confirmed', over: { ok: 6 } },
    ];
    for (const { state, over } of others) expect(line(state, over), state).toBeNull();
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
  // Lucide `circle-x` 의 획 하나. Heroicons `StatusErrorIcon` 은 한 path 로 원과 X 를 함께
  // 그리므로 이 마디가 없다 — 기하가 되돌아가면 여기서 걸린다.
  const X_CIRCLE = 'm15 9-6 6';
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
