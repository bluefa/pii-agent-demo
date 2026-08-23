// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => <div data-testid="guide-card" />,
}));

import { GuidePanel } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';

const baseProps = {
  slotKey: null,
  /** No stored preference — the width default decides. Tests that care pass their own. */
  initialCollapsed: null,
} as const;

/**
 * The preference is a COOKIE, read by the server and handed down as `initialCollapsed`.
 * jsdom implements `document.cookie` properly, so unlike the `localStorage` version this
 * needs no stub — reading the cookie back is the same thing the server would do.
 */
const readRailCookie = (): string | null =>
  document.cookie.match(/(?:^|;\s*)pii-rail-guide=([^;]*)/)?.[1] ?? null;

const clearRailCookie = () => {
  document.cookie = 'pii-rail-guide=; path=/; max-age=0';
};

/** jsdom reports 1024, i.e. under RAIL_OPEN_MIN_WIDTH — set it per test rather than
 *  inheriting whichever side of the default a given machine happens to land on. */
const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
};

/**
 * With no cookie the fold resolves on a `setTimeout(0)` after mount. Until it does, BOTH
 * halves are mounted and the media query arbitrates — so "settled" is exactly when one
 * fold control is left instead of two.
 */
const settled = () =>
  waitFor(() =>
    expect(screen.getAllByRole('button', { name: /가이드 (접기|펼치기)/ })).toHaveLength(1),
  );

beforeEach(() => {
  clearRailCookie();
  setViewportWidth(1440);
});

describe('GuidePanel — collab-channel card states', () => {
  it('renders the explicit 미연결 state when no Jira ticket is mapped (404 → null)', () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy();
    expect(screen.getByText('아직 연결된 협업 채널이 없어요')).toBeTruthy();
    expect(screen.queryByTitle('협업 채널 — Jira에서 논의하기')).toBeNull();
  });

  it('renders a distinct error row on fetch failure — never the 미연결 state', () => {
    render(<GuidePanel {...baseProps} jiraTicket="error" />);
    expect(screen.getByText('협업 채널 정보를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('아직 연결된 협업 채널이 없어요')).toBeNull();
  });

  it('links the mapped issue key (owner ask: blue underlined hyperlink)', () => {
    render(
      <GuidePanel
        {...baseProps}
        jiraTicket={{ issueKey: 'PII-42', browseUrl: 'https://jira.example.com/browse/PII-42' }}
      />,
    );
    const link = screen.getByTitle('협업 채널 — Jira에서 논의하기') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://jira.example.com/browse/PII-42');
    expect(link.getAttribute('target')).toBe('_blank');
    const key = screen.getByText('PII-42');
    expect(key.className).toContain('underline');
  });

  it('browseUrl 이 없으면 링크를 지어내지 않고 키만 보여준다', () => {
    render(<GuidePanel {...baseProps} jiraTicket={{ issueKey: 'PII-42', browseUrl: null }} />);
    expect(screen.queryByTitle('협업 채널 — Jira에서 논의하기')).toBeNull();
    expect(screen.getByText('PII-42')).toBeTruthy();
  });

  // 오너 지시 2026-08-23: no white card inside the card. Its fill and border were also the
  // 26px that made the label and the key collide in the folded rail's fixed 280px tip.
  it('gives the channel row no surface of its own, and stacks its two tiers', () => {
    render(
      <GuidePanel
        {...baseProps}
        jiraTicket={{ issueKey: 'PII-42', browseUrl: 'https://jira.example.com/browse/PII-42' }}
      />,
    );
    const link = screen.getByTitle('협업 채널 — Jira에서 논의하기');
    expect(link.className).not.toMatch(/bg-white|rounded-lg|(^|\s)border(\s|$)/);

    // Stacked, not side by side — and the key carries the AA-safe blue. #0064FF measures
    // 4.33:1 on #E8F1FF; it was only ever legal because a white row sat under it.
    const key = screen.getByText('PII-42');
    expect(key.className).toContain('block');
    expect(key.className).toContain('text-[#0050D6]');
    expect(key.className).not.toContain('text-[#0064FF]');
  });
});

describe('GuidePanel — the rail folds, it does not vanish', () => {
  // The defect this replaces: `hidden … min-[1360px]:flex` meant the viewport decided
  // whether the rail EXISTED, and this file is the only render site for the guide and
  // the Jira channel. `hidden` is `display:none`, so below 1360px both left the
  // accessibility tree with no way back.
  it('mounts at a narrow viewport instead of being display:none', async () => {
    setViewportWidth(1280);
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const aside = container.querySelector('aside');
    expect(aside).toBeTruthy();
    const classes = aside?.className.split(/\s+/) ?? [];
    // ⛔ Neither of these may come back: `hidden` removes the rail outright and the
    // breakpoint variant is what used to make the viewport the authority.
    expect(classes).not.toContain('hidden');
    expect(classes.some((c) => c.startsWith('min-[1360px]:'))).toBe(false);
    // Narrow ⇒ folded by default, and the control that unfolds it is on screen.
    expect(screen.getByRole('button', { name: '가이드 펼치기' })).toBeTruthy();
  });

  it('starts open at 1360px and above', async () => {
    setViewportWidth(1360);
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();
    expect(screen.getByRole('button', { name: '가이드 접기' })).toBeTruthy();
    expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy();
  });

  // 오너 지시 2026-08-23: the open rail read as THREE axes — a chevron, 협업 채널, 가이드.
  // The chevron's band cost 48px and a seam for one button; it rides the channel band's
  // title line now, so the panel is two zones with one seam between them.
  it('opens as two zones, with the fold control inside the first', async () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const body = container.querySelector('aside > div');
    expect(body?.children).toHaveLength(2);

    // ⛔ The control may not take a band back. It has to sit inside zone 1.
    const channel = body?.children[0] as HTMLElement;
    const toggle = screen.getByRole('button', { name: '가이드 접기' });
    expect(channel.contains(toggle)).toBe(true);
  });

  // 시안 E (오너 지시 2026-08-23): 무채색 + 잉크만. The zones are told apart by a hairline
  // and a label, so ⛔ NO element in the open rail may carry a background fill — the guide's
  // own 안내박스 is the single exception, and it renders inside the mocked guide card here.
  it('paints no fill anywhere in the open rail, and names each zone', async () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const filled = Array.from(container.querySelectorAll<HTMLElement>('aside *')).filter((el) =>
      /(^|\s)bg-(?!transparent)/.test(el.className),
    );
    expect(filled.map((el) => el.className)).toEqual([]);

    // The labels are load-bearing: with no fill and no card they are the only thing that
    // says where one zone ends and the next begins.
    expect(screen.getByText('협업 채널')).toBeTruthy();
    expect(screen.getByText('가이드')).toBeTruthy();
  });

  // 오너 지시 2026-08-23: the 가이드 mark is a filled yellow 전구, and it shows in BOTH fold
  // states — folding changes how much of the guide you see, not what it looks like.
  it('marks the guide zone with the filled yellow 전구 in both fold states', async () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const open = container.querySelector('aside svg.text-\\[\\#CA8A04\\]');
    expect(open).toBeTruthy();
    // Filled, not stroked — a stroke has nowhere to put a colour at 16px.
    expect(open?.getAttribute('fill')).toBe('currentColor');
    expect(open?.getAttribute('stroke')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    await waitFor(() =>
      expect(container.querySelector('aside svg.text-\\[\\#CA8A04\\]')).toBeTruthy(),
    );
  });

  // 오너 지시 2026-08-23: 「N단계 가이드」, not 「가이드」 — the rail is docked beside a
  // seven-step process, so the number is what says which guide this is.
  it('numbers the guide zone from the slot registry, in both fold states', async () => {
    render(<GuidePanel {...baseProps} slotKey="process.aws.manual.4" jiraTicket={null} />);
    await settled();
    expect(screen.getByText('4단계 가이드')).toBeTruthy();

    // Folded, the strip's one-word label stays 「가이드」 (56px), but the accessible name
    // carries the number — the entry is a 20px glyph and the tooltip is its only channel.
    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '4단계 가이드 — 펼치기' })).toBeTruthy(),
    );
  });

  it('folds and unfolds on press, taking the rail body with it', async () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    await waitFor(() => expect(screen.queryByText('도움이 필요하신가요?')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: '가이드 펼치기' }));
    await waitFor(() => expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy());
  });

  it('writes the fold to a cookie, and the press beats the width default', async () => {
    // Wide, so the default is open — then fold it and prove the preference is on the
    // request the next paint will ride, not in storage the server cannot see.
    const first = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();
    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    await waitFor(() => expect(readRailCookie()).toBe('1'));
    first.unmount();

    // What the server does on the next request: read the cookie, hand it down.
    render(<GuidePanel {...baseProps} jiraTicket={null} initialCollapsed />);
    expect(screen.getByRole('button', { name: '가이드 펼치기' })).toBeTruthy();
  });
});

describe('GuidePanel — the fold does not flash on reload', () => {
  // The bug: the server could not see `localStorage`, so a folded rail painted OPEN at
  // 320px and snapped to the strip once hydration delivered the real answer.
  it('paints the strip on the FIRST render when the server says folded', () => {
    const { container } = render(
      <GuidePanel {...baseProps} jiraTicket={null} initialCollapsed />,
    );
    const classes = container.querySelector('aside')?.className.split(/\s+/) ?? [];

    // ⛔ No breakpoint class at all. `min-[1360px]:w-[320px]` is the signature of the
    // unresolved frame — the one that painted 320px before correcting itself.
    expect(classes.some((c) => c.startsWith('min-[1360px]:'))).toBe(false);
    expect(classes).toContain('w-14');
    // …and the body was never mounted, so nothing had to be torn down.
    expect(screen.queryByText('도움이 필요하신가요?')).toBeNull();
    expect(screen.getByRole('button', { name: '가이드 펼치기' })).toBeTruthy();
  });

  it('paints the open rail on the FIRST render when the server says open', () => {
    setViewportWidth(1024); // ⛔ narrow: the width default would fold it. The cookie wins.
    const { container } = render(
      <GuidePanel {...baseProps} jiraTicket={null} initialCollapsed={false} />,
    );
    const classes = container.querySelector('aside')?.className.split(/\s+/) ?? [];
    expect(classes.some((c) => c.startsWith('min-[1360px]:'))).toBe(false);
    expect(classes).toContain('w-[320px]');
    expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy();
  });

  it('still arbitrates with the media query when no cookie was sent', () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    const classes = container.querySelector('aside')?.className.split(/\s+/) ?? [];
    // Honest "not known yet": the server had nothing to go on, so the breakpoint paints
    // the frame and the effect resolves to the same answer. Nothing moves either way.
    expect(classes.some((c) => c.startsWith('min-[1360px]:'))).toBe(true);
  });
});

/**
 * Folds the rail and waits for the strip. Every test below starts here.
 *
 * The `clear()` is load-bearing: folding WRITES the preference, so a second call inside
 * one test would mount already-collapsed and find no 「가이드 접기」 to press.
 */
const folded = async (jiraTicket: Parameters<typeof GuidePanel>[0]['jiraTicket']) => {
  clearRailCookie();
  const view = render(<GuidePanel {...baseProps} jiraTicket={jiraTicket} />);
  await settled();
  fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '가이드 펼치기' })).toBeTruthy());
  return view;
};

describe('GuidePanel — the folded strip says what it is', () => {
  it('names the panel in words, not just a direction chevron', async () => {
    await folded(null);
    // ⛔ Deleting either label puts the strip back to "one chevron, no idea what it opens".
    expect(screen.getByText('가이드')).toBeTruthy();
    expect(screen.getByText('채널')).toBeTruthy();
  });

  it('is 56px wide — not 48, and ⛔ not 64', async () => {
    // 64 would push the confirmed table's fit threshold to 1444px and cost 1440px
    // laptops a horizontal scrollbar by 4px. This is the tripwire on that arithmetic.
    const { container } = await folded(null);
    const classes = container.querySelector('aside')?.className.split(/\s+/) ?? [];
    expect(classes).toContain('w-14');
    expect(classes).not.toContain('w-16');
  });

  it('carries the collab channel through the fold — all three states, in words', async () => {
    const linked = await folded({ issueKey: 'BDCDIP-1353', browseUrl: 'https://jira.example.com/browse/BDCDIP-1353' });
    // The ticket key survives folding. It used to disappear with the whole card.
    expect(screen.getByRole('button', { name: '협업 채널 — BDCDIP-1353' })).toBeTruthy();
    linked.unmount();

    const none = await folded(null);
    expect(screen.getByRole('button', { name: '협업 채널 — 아직 연결되지 않았어요' })).toBeTruthy();
    none.unmount();

    // ⛔ A failed fetch must not read as "no channel" on the strip either.
    await folded('error');
    expect(screen.getByRole('button', { name: '협업 채널 — 정보를 불러오지 못했어요' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /아직 연결되지 않았어요/ })).toBeNull();
  });

  it('gives each channel state its own dot fill, so colour is not dead weight', async () => {
    const dotOf = (container: HTMLElement) =>
      container.querySelector('aside span[aria-hidden].rounded-full')?.className ?? '';

    const linked = await folded({ issueKey: 'PII-1', browseUrl: null });
    const okFill = dotOf(linked.container as HTMLElement);
    linked.unmount();

    const failed = await folded('error');
    const errFill = dotOf(failed.container as HTMLElement);

    expect(okFill).not.toBe('');
    expect(errFill).not.toBe('');
    expect(okFill).not.toBe(errFill);
  });

  it('puts 채널 above 가이드 — the order the open rail already teaches', async () => {
    // ⛔ Do not reorder to "guide first". The collab card sits above the tabs when the rail
    // is open; a strip that ranked them the other way would teach a layout the open rail
    // then contradicts.
    const { container } = await folded(null);
    const order = [...(container.querySelector('aside')?.querySelectorAll('button') ?? [])].map(
      (b) => b.getAttribute('aria-label') ?? '',
    );
    const channel = order.findIndex((l) => l.startsWith('협업 채널'));
    const guide = order.findIndex((l) => l.startsWith('가이드 —'));
    expect(channel).toBeGreaterThan(-1);
    expect(guide).toBeGreaterThan(-1);
    expect(channel).toBeLessThan(guide);
  });

  it('shows the collab card itself in the tip, without unfolding the rail', async () => {
    await folded({ issueKey: 'BDCDIP-1007', browseUrl: 'https://jira.example.com/browse/BDCDIP-1007' });
    // Folded, so the card is gone from the rail body — whatever appears next came from the tip.
    expect(screen.queryByText('도움이 필요하신가요?')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^협업 채널 — / }));

    expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy();
    expect(
      screen.getByText('진행 중 막히는 부분은 협업 채널에서 담당자에게 바로 문의할 수 있어요.'),
    ).toBeTruthy();
    expect(screen.getByText('BDCDIP-1007')).toBeTruthy();
    // ⛔ And the rail did NOT unfold. Reading the channel must not cost the width back.
    expect(screen.getByRole('button', { name: '가이드 펼치기' })).toBeTruthy();
  });

  it('paints the tip as the white surface, not the dark status box', async () => {
    await folded(null);
    fireEvent.click(screen.getByRole('button', { name: /^협업 채널 — / }));

    const box = [...document.body.querySelectorAll('div')].find(
      (el) => el.style.position === 'fixed' && el.style.boxShadow !== '',
    );
    expect(box).toBeTruthy();
    expect(box?.style.background).toMatch(/rgb\(255,\s*255,\s*255\)|#fff/i);
    expect(box?.style.border).toMatch(/1px solid/);
    expect(box?.style.boxShadow).not.toBe('');
  });

  it('survives a press inside the pinned tip — the Jira link has to be reachable', async () => {
    await folded({ issueKey: 'BDCDIP-1007', browseUrl: 'https://jira.example.com/browse/BDCDIP-1007' });
    fireEvent.click(screen.getByRole('button', { name: /^협업 채널 — / }));

    const link = screen.getByRole('link', { name: /협업 채널 링크/ });
    // ⛔ The tip is portaled to <body>, so an "outside" test that only checks the trigger
    // counts this as outside and unmounts the box on pointerdown — before the click can
    // ever reach the link. Pinning exists so the reader can move INTO the content.
    fireEvent.pointerDown(link);
    expect(screen.getByRole('link', { name: /협업 채널 링크/ })).toBeTruthy();

    // …and a press genuinely outside still dismisses it.
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('link', { name: /협업 채널 링크/ })).toBeNull());
  });

  it('shows the guide alone — no 가이드/진행 내역 tabs to choose between', () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} initialCollapsed={false} />);

    // ⛔ The split is gone (오너 지시 2026-08-23). 진행 내역 was twelve hardcoded rows behind
    // a tab that promised a second thing worth choosing; putting either back fails here.
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByText('진행 내역')).toBeNull();
    expect(screen.queryByText('관리자 승인 완료')).toBeNull();

    // …and the guide itself is still the body.
    expect(screen.getByText('이 단계에는 표시할 가이드가 없습니다.')).toBeTruthy();
  });
});
