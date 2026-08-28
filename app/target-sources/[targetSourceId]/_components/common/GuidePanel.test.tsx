// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => <div data-testid="guide-card" />,
}));

import { GuidePanel } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';
import { railStyles } from '@/lib/theme';

/**
 * The channel zone's one sentence, and the marker the fold tests use for "this zone
 * rendered". It took that job from 「도움이 필요하신가요?」, which was deleted for being a
 * second 16px heading directly under 「협업 채널」 (오너 지시 2026-08-23).
 *
 * It is a SHORT sentence on purpose. 「진행 중 막히는 부분은 협업 채널에서 바로 문의할 수
 * 있어요.」 wrapped to two lines at the rail's 271px column — 34px of ink, the largest area
 * in a 101px card and the least information in it — and it said 협업 채널 for the second of
 * three times in one card. Measured after the cut: the `<p>` is 17px, one line.
 */
const CHANNEL_LINE = '막히는 부분을 바로 문의할 수 있어요.';

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
    expect(screen.getByText(CHANNEL_LINE)).toBeTruthy();
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
  it('gives the channel row no surface of its own, and scopes the anchor to the key', () => {
    render(
      <GuidePanel
        {...baseProps}
        jiraTicket={{ issueKey: 'PII-42', browseUrl: 'https://jira.example.com/browse/PII-42' }}
      />,
    );
    const link = screen.getByTitle('협업 채널 — Jira에서 논의하기');

    // ⛔ An allowlist of what MAY NOT appear, by prefix — not three literal tokens. The
    // previous form named `bg-white`, `rounded-lg` and a bare `border`, so
    // `rounded-md border-2 bg-[#F2F4F6] p-3 shadow-sm` walked straight through it and put
    // back the card-inside-a-card this test exists to forbid.
    const surfaceOf = (el: Element) =>
      (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c) => /^(bg-|border|rounded|shadow|ring|p-|px-|py-)/.test(c));
    expect(surfaceOf(link)).toEqual([]);

    // The key carries the AA-safe blue. #0064FF measures 4.33:1 on #E8F1FF; it was only
    // ever legal because a white row sat under it. The ink is on the ANCHOR, which the icon
    // inherits through `currentColor`; the span under it owns only the underline.
    const key = screen.getByText('PII-42');
    expect(key.className).toContain('underline');
    expect(link.className).toContain('text-[#0050D6]');
    expect(link.className).not.toContain('text-[#0064FF]');

    // ⛔ The anchor is the VALUE's box, and there are now TWO ways it could stop being one.
    //
    // Content: it once wrapped the row's label too, so the clickable rectangle was
    // 271.46 × 36 where the underline was 271.46 × 20 — a hit area 16px taller and ~186px
    // wider than the thing it underlined. The label is gone entirely, so the claim is that
    // the anchor's TEXT is the key and nothing else, and that its elements are exactly the
    // underlined key and the external-link icon — no third thing smuggled in.
    expect(link.textContent).toBe('PII-42');
    expect(link.children).toHaveLength(2);
    expect(link.children[0].textContent).toBe('PII-42');
    expect(link.children[1].tagName.toLowerCase()).toBe('svg');

    // Geometry: jsdom measures nothing, so the box is guarded by what it may not DECLARE.
    // The anchor is shrink-to-fit only while it neither grows nor stretches — measured
    // 84.41 × 17 against the row's 271 before the icon, and still far short of the row with
    // it. Any of these hands the column's full width back and puts the 36px-tall hit area
    // straight into a card that no longer has a label to blame for it.
    //
    // ⚠️ `inline-flex` is NOT on the list, and it is the one exception. The list exists to
    // stop a FULL-WIDTH anchor — the original defect was `block` — and `inline-flex` is
    // shrink-to-fit, which is exactly the invariant. It is what lets the icon sit beside the
    // key without the underline running under it. `flex` stays banned: on this row it would
    // behave the same, but it is a block-level declaration and would take the row's width
    // the moment the anchor is rendered anywhere else.
    const takesTheRow = (el: Element) =>
      (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c) => /^(block|flex|w-full|flex-1|grow|basis-full|self-stretch)$/.test(c));
    expect(takesTheRow(link)).toEqual([]);
    expect(link.className).toContain('inline-flex');
    expect(link.parentElement?.className).toContain('flex');

    // ⛔ The underline is on the KEY's span, not on the anchor: anchor-level text-decoration
    // draws through inline children, so it would strike through the icon too.
    expect(link.className).not.toContain('underline');

    // A leading per ROLE (오너 2026-08-24): the key is a one-line machine value (14/17) and
    // the sentence above it is read (12/17). It was a flat 1.5 for both, i.e. 18 and 21:
    // line boxes off the grid, on a ramp where the bigger the type the more air it took.
    expect(link.className).toContain('text-[14px]');
    expect(screen.getByText(CHANNEL_LINE).className).toContain('leading-[17px]');

    // ⛔ No label row. It was 「협업 채널 링크」, then 「이슈 키」, and then nothing: a single
    // self-describing link is not a key-value pair, and the label spent 20.5px of a 101px
    // card saying what `font-mono` + #0050D6 + `BDCDIP-` already said. The `title` is what
    // names the destination now, which is why it is asserted above and not here.
    expect(screen.queryByText('이슈 키')).toBeNull();
    expect(screen.queryByText('협업 채널 링크')).toBeNull();

    // ⛔ The tracking gradient, and it has to run this way. `letter-spacing` inherits as a
    // computed LENGTH, so `body`'s single −0.288px lands on 12px text as −0.024em and on
    // 16px as −0.018em — tightest exactly where Carbon and Material are loosest. Every
    // tier declares its own now: T3 normal → T2 −0.01em → T1 −0.02em.
    expect(link.className).toContain('tracking-[-0.01em]');
    expect(screen.getByText(CHANNEL_LINE).className).toContain('tracking-normal');
    expect(railStyles.zoneLabel).toContain('tracking-[-0.02em]');
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
    expect(screen.getByText(CHANNEL_LINE)).toBeTruthy();
  });

  // The fold control belongs to the RAIL, not to a zone (오너 2026-08-24: 「우측으로 접기
  // 버튼이 협업채널의 일부처럼 보여」). It used to ride the 협업 채널 card's title line, so
  // the control that folds the whole panel was a child of the panel's first zone — and it
  // read as one, because a card is exactly the thing that says "this belongs to me".
  //
  // ⛔ This is not a licence to give the head a band of its own with a title in it. It is
  // 32px of control and nothing else; the zones are still what name the rail.
  it('opens as a head that owns the fold control, then two zones', async () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const body = container.querySelector('aside > div') as HTMLElement;
    expect(body.children).toHaveLength(3);

    const [head, ...zones] = Array.from(body.children) as HTMLElement[];
    const toggle = screen.getByRole('button', { name: '가이드 접기' });
    expect(head.contains(toggle)).toBe(true);
    // ⛔ And in NEITHER zone. `head.contains` alone would still pass if the control were
    // duplicated, and the head is the first child either way.
    for (const zone of zones) expect(zone.contains(toggle)).toBe(false);

    // The head is chrome, not a third zone: no fill, no radius, no title of its own.
    expect(head.className).not.toContain('bg-white');
    expect(head.className).not.toContain('rounded');
    expect(head.textContent).toBe('');

    // ⛔ No negative margin. The old call site pulled the box 8px past the card's padding
    // to land the glyph on it; on the rail's own gutter the box needs no correction, and a
    // `-mr-*` here is the tell that it was moved back inside something.
    expect(toggle.parentElement?.className ?? '').not.toMatch(/(?:^|\s)-m[btlrxy]?-/);
  });

  // 시안 A (오너 지시 2026-08-23: 「2단계 가이드」 아래 실제 가이드는 카드 그룹으로).
  //
  // This REPLACES 시안 E's "not one fill anywhere in the rail", which this test used to
  // assert. A white card on a white rail is not a card, so grouping the guide is what
  // forced the rail down onto the left rail's plane. ⛔ The two halves move together: a
  // rail back on `bg-white` with the zones still cards is the state where the grouping
  // the owner asked for is invisible.
  it('drops the rail to the left rail’s plane and floats each zone as a card', async () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const aside = container.querySelector('aside') as HTMLElement;
    // Wiring only — that the token reaches the element. It cannot fail on a VALUE change,
    // and deliberately does not try: what the plane's value has to satisfy is a set of
    // relationships this file cannot see (it must stay one plane with the service rail,
    // and it must let `rowCurrent`'s tint out-separate its own hover). Those live in
    // `lib/design-guard.test.ts` › "the rail ranks its own fills", which is where a hex
    // pinned here would have been the weaker half anyway.
    expect(aside.className).toContain(railStyles.surface);
    expect(aside.className).not.toContain('bg-white');

    // Zones only — `children[0]` is the rail's head, which owns the fold control.
    const zones = Array.from(
      (container.querySelector('aside > div') as HTMLElement).children,
    ).slice(1) as HTMLElement[];
    expect(zones).toHaveLength(2);
    for (const zone of zones) {
      expect(zone.className).toContain('bg-white');
      expect(zone.className).toContain('rounded-xl');
    }

    // The cards separate the zones; the labels say which is which.
    expect(screen.getByText('협업 채널')).toBeTruthy();
    expect(screen.getByText('가이드')).toBeTruthy();
  });

  // ⛔ 「도움이 필요하신가요?」 does not come back. It was 16px bold sitting 8px under
  // 「협업 채널」 at 16px semibold — two headings of the same size, told apart by weight
  // alone, saying the same thing twice (오너 지시 2026-08-23).
  it('leaves the channel zone one heading, not two of the same size', async () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    expect(screen.queryByText(/도움이 필요하신가요/)).toBeNull();
    expect(screen.getByText('협업 채널')).toBeTruthy();
  });

  // 오너 지시 2026-08-23: the 가이드 mark is the owner's Figma 전구
  // (slrqFgziqlHznBZ1VMPtcq, 6:11) and it shows in BOTH fold states — folding changes how
  // much of the guide you see, not what it looks like.
  it('marks the guide zone with the Figma 전구 in both fold states', async () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const open = container.querySelector('aside svg.text-\\[\\#F59E0B\\]');
    expect(open).toBeTruthy();
    // Stroked at a 14 viewBox, per the node. ⛔ Rescaling into the 24 box every other
    // icon uses would have to thin the stroke and stop being the spec.
    expect(open?.getAttribute('viewBox')).toBe('0 0 14 14');
    expect(open?.getAttribute('stroke')).toBe('currentColor');
    expect(open?.getAttribute('fill')).toBe('none');

    // ⛔ ONE mark, and the folded one is the standard: same 20px, bare, both states. The
    // Figma node's 28px #FFF8E1 plate was on the open head for one commit and is gone —
    // a mark that changes shape when the rail folds is two marks.
    // `getAttribute`, not `.className` — on an SVGElement that is an SVGAnimatedString.
    expect(open?.getAttribute('class')).toContain('h-5');
    expect(container.querySelector('aside .bg-\\[\\#FFF8E1\\]')).toBeNull();

    // ⛔ The whole mark, compared as markup — not `h-5` and a missing plate.
    //
    // This test used to check viewBox/stroke/fill on the OPEN glyph and then, once
    // folded, only that SOMETHING amber with `h-5` was present. Swapping the strip's
    // 전구 for the ChatIcon kept every one of those assertions true: same selector, same
    // size, still no plate, wrong shape. That is the channel-mark bug again, on the other
    // mark — so it gets the same answer, one `.toBe()` over identical markup.
    const openMark = guideMark(container as HTMLElement)?.outerHTML;
    expect(openMark).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '가이드 펼치기' })).toBeTruthy());

    expect(guideMark(container as HTMLElement)?.outerHTML).toBe(openMark);
    expect(container.querySelector('aside .bg-\\[\\#FFF8E1\\]')).toBeNull();
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
    const strip = await waitFor(() =>
      screen.getByRole('button', { name: '4단계 가이드 — 펼치기' }),
    );

    // ⛔ The VISIBLE label, not just the accessible one. Both are read off the same slot,
    // so `label={guideZoneLabel}` is a one-word change that keeps this test green — and
    // 「4단계 가이드」 does not fit a 56px strip. The two names differ on purpose: the strip
    // has room for one word, the tooltip has room for the sentence.
    expect(strip.textContent).toBe('가이드');
    expect(strip.textContent).not.toContain('단계');
  });

  /**
   * ⛔ The two fold controls live in the two halves of the rail, and a press unmounts the
   * half it was pressed in — so the button that was just activated is destroyed by its own
   * click. Without a hand-off the focus ring lands on `<body>` and a keyboard reader has
   * to tab from the top of the page to fold the rail back.
   *
   * This was introduced by this PR: the old rail had no press-driven toggle at all, only
   * `hidden … min-[1360px]:flex`.
   */
  it('hands focus to the surviving toggle, both ways', async () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    const expand = await waitFor(() => screen.getByRole('button', { name: '가이드 펼치기' }));
    expect(document.activeElement).toBe(expand);

    fireEvent.click(expand);
    const collapse = await waitFor(() => screen.getByRole('button', { name: '가이드 접기' }));
    expect(document.activeElement).toBe(collapse);
  });

  // ⛔ And nothing steals focus before a press. The rail resolves its own width on mount,
  // which is a render the reader did not ask for — grabbing focus there would yank the
  // caret out of whatever they were actually doing.
  it('does not take focus on the first paint', async () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();
    expect(document.activeElement).toBe(document.body);
  });

  // The name says what the press DOES (「가이드 접기」); `aria-expanded` says where the rail
  // IS. A control that only ever renames itself leaves AT with no state to report, and
  // `aria-controls` is what ties the button to the region it folds.
  it('reports its expanded state and names the region it controls', async () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const railId = container.querySelector('aside')?.id;
    expect(railId).toBeTruthy();

    const collapse = screen.getByRole('button', { name: '가이드 접기' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(collapse.getAttribute('aria-controls')).toBe(railId);

    fireEvent.click(collapse);
    const expand = await waitFor(() => screen.getByRole('button', { name: '가이드 펼치기' }));
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    // ⛔ It must still point at something that exists — the rail survives the fold, only
    // its contents change, so a dangling `aria-controls` here would be a silent one.
    expect(expand.getAttribute('aria-controls')).toBe(railId);
    expect(container.querySelector(`#${railId}`)).toBeTruthy();
  });

  it('folds and unfolds on press, taking the rail body with it', async () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    await waitFor(() => expect(screen.queryByText(CHANNEL_LINE)).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: '가이드 펼치기' }));
    await waitFor(() => expect(screen.getByText(CHANNEL_LINE)).toBeTruthy());
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
    expect(screen.queryByText(CHANNEL_LINE)).toBeNull();
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
    expect(screen.getByText(CHANNEL_LINE)).toBeTruthy();
  });

  it('still arbitrates with the media query when no cookie was sent', () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    const aside = container.querySelector('aside');
    const classes = aside?.className.split(/\s+/) ?? [];
    // Honest "not known yet": the server had nothing to go on, so the breakpoint paints
    // the frame and the effect resolves to the same answer. Nothing moves either way.
    expect(classes.some((c) => c.startsWith('min-[1360px]:'))).toBe(true);

    // ⛔ The rail's own width is not the whole flash. Both halves MOUNT while the answer
    // is `null`, so the media query has to hide exactly one of them — and that lives on
    // the halves, not on the aside. Reading only the aside let `stripShown = 'flex'`
    // through, which stacks the folded strip on top of the open rail for one frame at
    // every load ≥1360px: the flash this whole cookie exists to prevent, by another door.
    const halves = Array.from(aside?.children ?? []).map((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/),
    );
    expect(halves).toHaveLength(2);
    const shownAt = (cs: string[]) => ({
      base: cs.includes('flex') ? 'flex' : cs.includes('hidden') ? 'hidden' : '?',
      wide: cs.find((c) => c.startsWith('min-[1360px]:')) ?? '',
    });
    // One shows narrow and hides wide; the other does the opposite. Never both, never neither.
    expect(halves.map(shownAt)).toEqual(
      expect.arrayContaining([
        { base: 'flex', wide: 'min-[1360px]:hidden' },
        { base: 'hidden', wide: 'min-[1360px]:flex' },
      ]),
    );
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

/**
 * A zone's `RailMark` — its glyph, plus the state dot when it has one — found by the GLYPH
 * inside it.
 *
 * ⛔ Not by index. These used to be `marks()[0]` = 채널 and `[1]` = 가이드, which held only
 * while both zones rendered a `RailMark` in both fold states. The 협업 채널 head stopped
 * rendering one when the card itself became the bubble (오너 지시 2026-08-27), so the open
 * rail now has exactly ONE mark and an index would quietly hand back the other zone's.
 * The viewBox is the identity: `GuideIcon` is the owner's Figma node at 14, and every
 * other icon in the app is drawn at 24.
 */
const markWithGlyph = (root: HTMLElement, viewBox: string) =>
  Array.from(root.querySelectorAll('aside span.relative')).find(
    (m) => m.querySelector('svg')?.getAttribute('viewBox') === viewBox,
  );

/** ⛔ Only the folded strip has one of these now. See `channelHead` for the open rail. */
const channelMark = (root: HTMLElement) => markWithGlyph(root, '0 0 24 24');
const guideMark = (root: HTMLElement) => markWithGlyph(root, '0 0 14 14');

/**
 * The open rail's zone cards, in DOM order: 협업 채널 then 가이드. `children[0]` of the body
 * is the rail's own head, which owns nothing but the fold control.
 */
const openZones = (root: HTMLElement) =>
  Array.from((root.querySelector('aside > div') as HTMLElement).children).slice(
    1,
  ) as HTMLElement[];

/**
 * The 협업 채널 card's head, read off the CARD rather than off its label.
 *
 * `getByText('협업 채널')` cannot do this job: the sentence under the head prints the same
 * two words, so the query is ambiguous.
 */
const channelHead = (root: HTMLElement) => openZones(root)[0].firstElementChild as HTMLElement;

/**
 * Every state dot in the open card — there must be exactly one, and it must be on the head
 * (오너 지시 2026-08-28). It searches the whole card on purpose: the dot has been on the
 * head's corner, leading the value row, trailing it, and absent, so a query aimed at any one
 * of those would miss a stray copy in another. Counting is what catches two. The strip's dot
 * lives outside `openZones` and is not in scope here — see `channelMark`.
 */
const cardDots = (root: HTMLElement) =>
  Array.from(
    openZones(root)[0].querySelectorAll('span[aria-hidden].rounded-full'),
  ) as HTMLElement[];

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

  /**
   * 오너 지시 2026-08-27: 「펼친 상태의 협업 채널 카드는 접었을 때의 말풍선을 키운 것」.
   *
   * ⚠️ This REPLACES 오너 지시 2026-08-23 and the three tests that guarded it, which asserted
   * that the open head and the folded strip drew ONE identical mark — glyph + dot + ink —
   * and compared the two as markup because comparing the SVGs alone had let a missing dot
   * through. The dot survived that rule; the glyph did not. The card is the enlarged icon
   * now, and an enlarged icon cannot also contain a small copy of itself.
   *
   * ⛔ Assert on the head's own CHILDREN. This file has already been burnt by the other
   * shape of this test: 「takes the ChatIcon off the link row」 stayed green when the head's
   * mark was deleted outright, because it only ever proved something was ABSENT somewhere.
   * "No glyph anywhere in the rail" would fail the same way from the other side — the
   * folded strip's ChatIcon lives in a subtree this claim is not about.
   */
  it('leaves the open zone head its label and its state dot — no glyph', async () => {
    const { container } = render(
      <GuidePanel
        {...baseProps}
        jiraTicket={{ issueKey: 'PII-42', browseUrl: 'https://jira.example.com/browse/PII-42' }}
      />,
    );
    await settled();

    const head = channelHead(container as HTMLElement);
    // Two children and no more: the label, then the state dot.
    expect(head.textContent).toBe('협업 채널');
    expect(head.children).toHaveLength(2);
    expect(head.children[0].textContent).toBe('협업 채널');
    // ⛔ Still no GLYPH. The 2026-08-23 `RailMark` (전구-style mark, glyph + dot + ink) died
    // when the CARD became the enlarged `ChatIcon`; only the dot half of that mark came
    // back (오너 지시 2026-08-28). An enlarged icon may not contain a small copy of itself.
    expect(head.querySelector('svg')).toBeNull();
    // ⛔ `justify-between` is what puts the dot on the card's own padding edge with no second
    // measurement, so it is part of the instruction, not a styling detail.
    expect(head.className).toContain('justify-between');

    // 16/20, and BOTH heads wear the same token — the card's and the guide zone's.
    // ⚠️ This head was 20/24 through a `channelZoneLabel` of its own for one commit (오너
    // 지시 2026-08-27) and came back on 2026-08-28; the token went with the size, because at
    // 16 it was byte-identical to `zoneLabel`. The benchmark's five narrow-rail references
    // all treat every section head alike whatever the section's size.
    // ⛔ Nobody may open the gap under this head by growing its line box instead: 20 is the
    // design guide's 120% for a 제목, and both ink gaps around the head are measured off it.
    expect(head.children[0].className).toContain(railStyles.zoneLabel);
    expect(railStyles.zoneLabel).toContain('text-[16px]');
    expect(railStyles.zoneLabel).toContain('leading-[20px]');
    const guideHead = screen.getByText('가이드');
    expect(guideHead.className).toContain(railStyles.zoneLabel);
    // …and no `RailMark` anywhere on the open rail but the 가이드 zone's 전구.
    expect(channelMark(container as HTMLElement)).toBeUndefined();
    expect(guideMark(container as HTMLElement)).toBeTruthy();
  });

  /**
   * The tail is what makes the card a 말풍선 rather than a card with a dot on it, so it is
   * the load-bearing half of 오너 지시 2026-08-27.
   *
   * Two of its numbers are decisions and not taste, and both are pinned here because the
   * class string is the only place they exist:
   *   · 8px, because the zones sit in a `gap-3` column — at 12 the tail would touch the
   *     guide card below, and clearance is a gap, not a contact.
   *   · down-and-LEFT, because that is the direction `ChatIcon`'s own path drops its tail
   *     (`…H7l-4 4V5…`), and this card is that icon enlarged.
   */
  it('draws the channel zone as a speech bubble — tail included', async () => {
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const [channelZone, guideZone] = openZones(container as HTMLElement);
    expect(channelZone.className).toContain(railStyles.bubbleTail);
    // ⛔ On that zone only. A tail on the guide card would make the rail two bubbles.
    expect(guideZone.className).not.toContain(railStyles.bubbleTail);

    // The 8 is only right relative to the 12 the zones are spaced by, so read both.
    expect((container.querySelector('aside > div') as HTMLElement).className).toContain('gap-3');
    expect(railStyles.bubbleTail).toContain('after:h-2');
    expect(railStyles.bubbleTail).toContain('polygon(0_0,100%_0,0_100%)');
  });

  /**
   * ⛔ The card's two gaps may NOT be equal, and the section gap has to be the larger by at
   * least 2× (`/design-guide` §3). This is the tripwire on a measured failure, not on taste:
   * the gaps were once 8.5 / 11.5 / 6.5 — monotonic, max/min 1.77× — and at that spread the
   * eye reads them as uniform, so the four lines formed no groups at all and the card read
   * as one lump. Monotonicity is not hierarchy; asymmetry is.
   *
   * 12.5 and 28 (오너 지시 2026-08-28: 「타이틀과 보조 텍스트가 너무 붙어있다」, which moved
   * the pair up from 8.5 and 20). ⛔ Both by MARGIN — the ratio is what the second number is
   * for, since holding it at 20 would put this at 1.6×.
   *
   * The assertion is the INK arithmetic, derived from the box margins, because the ink is
   * what a reader sees: half-leadings are 2 below the head's 16/20, 2.5 either side of the
   * sentence's 12/17, and 1.5 above the key's 14/17.
   *
   * ⚠️ 20 exceeds the 12px `gap-3` between the two zone cards, which an earlier round
   * forbade. That rule died with its premise: the cards are told apart by a SURFACE (white
   * `railStyles.card` on the #E2E7EA plane), and containment separates more strongly than
   * any gap, so the outer boundary owes the inner one no margin of victory.
   */
  it('spaces the card as two groups — the section gap is 2× the internal one, in ink', async () => {
    const { container } = render(
      <GuidePanel
        {...baseProps}
        jiraTicket={{ issueKey: 'PII-42', browseUrl: 'https://jira.example.com/browse/PII-42' }}
      />,
    );
    await settled();

    const boxMargin = (el: HTMLElement) => Number(el.className.match(/\bmt-(\d+)\b/)?.[1] ?? 0) * 4;
    // The card's children: the head, then the body. The body's `mt-1` is the internal gap.
    const body = openZones(container as HTMLElement)[0].children[1] as HTMLElement;
    // ⛔ Off the ANCHOR's parent, not the key's: the key is now a span inside the anchor
    // (the underline had to stop running under the external-link icon), so `getByText`'s
    // parent is the anchor itself and would have measured a margin that is not there.
    const valueRow = screen.getByTitle('협업 채널 — Jira에서 논의하기')
      .parentElement as HTMLElement;

    const internalInk = 2 + boxMargin(body) + 2.5;
    const sectionInk = 2.5 + boxMargin(valueRow) + 1.5;
    expect(internalInk).toBe(12.5);
    expect(sectionInk).toBe(28);
    expect(sectionInk / internalInk).toBeGreaterThanOrEqual(2);

    // ⛔ And nothing between them carries a third margin — two gaps, two groups.
    expect(screen.getByText(CHANNEL_LINE).className).not.toMatch(/\bmt-\d/);
  });

  /**
   * ⛔ The card draws EXACTLY ONE state dot, on the head row, and ⛔ the folded strip still
   * draws its own. Both halves are the claim; either alone is worthless.
   *
   * The dot has been on this corner, leading the value row, trailing it, and gone
   * altogether (시안 E) — 오너 지시 2026-08-28 puts it back here. What every round agreed on
   * is that there is ONE of it and that its fill is the state: those are what this test
   * pins, plus the place, because the place is what kept changing.
   *
   * ⛔ The rows still have to say each state in WORDS. That is not a leftover from the
   * dotless round — it is the only reason the dot may be `aria-hidden`, so it is asserted
   * here beside the dot rather than in a test of its own.
   *
   * ⛔ The strip half is the tripwire that matters most. Deleting the strip's dot would
   * satisfy everything above and take the only state signal a 56px strip has: there are no
   * rows out there to carry the words.
   */
  it('puts one state dot on the card’s head, and keeps the strip’s own', async () => {
    const fillOf = (dot: Element) => dot.className.split(/\s+/).find((c) => c.startsWith('bg-'));
    const fills: Array<string | undefined> = [];

    for (const [ticket, says] of [
      [{ issueKey: 'PII-42', browseUrl: 'https://jira.example.com/browse/PII-42' }, 'PII-42'],
      [null, '아직 연결된 협업 채널이 없어요'],
      ['error', '협업 채널 정보를 불러오지 못했어요'],
    ] as const) {
      const open = render(<GuidePanel {...baseProps} jiraTicket={ticket} />);
      await settled();
      const root = open.container as HTMLElement;

      const dots = cardDots(root);
      expect(dots).toHaveLength(1);
      const [dot] = dots;
      expect(channelHead(root).contains(dot)).toBe(true);
      expect(dot.getAttribute('aria-hidden')).toBe('true');
      expect(dot.className).toContain('rounded-full');
      // …and the words the `aria-hidden` depends on are still in the rows below.
      expect(openZones(root)[0].textContent).toContain(says);
      fills.push(fillOf(dot));
      open.unmount();

      const strip = await folded(ticket);
      const stripDot = channelMark(strip.container as HTMLElement)?.querySelector(
        'span[aria-hidden].rounded-full',
      );
      expect(stripDot).toBeTruthy();
      strip.unmount();
    }

    // Three states, three fills — compared to each other, not to literals.
    expect(fills.every(Boolean)).toBe(true);
    expect(new Set(fills).size).toBe(3);
  });

  // ⛔ No ChatIcon on the rows, and the reason has grown rather than gone: the head displaced
  // it in 2026-08-23, and since 2026-08-27 the CARD is the bubble — so a 24px ChatIcon on a
  // row would be a small copy of the bubble it is sitting inside.
  //
  // ⚠️ It can no longer be "no svg in the link", because the link legitimately carries one
  // now (`OpenExternalIcon`, 오너 지시 2026-08-28). The bubble is identified by its PATH, the
  // same way `draws the channel zone as a speech bubble` identifies the tail's direction —
  // both ChatIcon and OpenExternalIcon draw at viewBox 24, so size cannot tell them apart.
  it('keeps the ChatIcon off the link row — the card is the bubble', async () => {
    const { container } = render(
      <GuidePanel
        {...baseProps}
        jiraTicket={{ issueKey: 'PII-42', browseUrl: 'https://jira.example.com/browse/PII-42' }}
      />,
    );
    await settled();

    const card = openZones(container as HTMLElement)[0];
    const paths = [...card.querySelectorAll('path')].map((el) => el.getAttribute('d') ?? '');
    expect(paths.some((d) => d.startsWith('M21 15a2 2 0 0 1-2 2H7l-4 4V5'))).toBe(false);

    // …and the one glyph the card DOES carry is the link's own, inside the anchor.
    const link = screen.getByTitle('협업 채널 — Jira에서 논의하기');
    expect(card.querySelectorAll('svg')).toHaveLength(1);
    expect(link.querySelectorAll('svg')).toHaveLength(1);
  });

  // Same rule on the strip: three states, three fills, and ⛔ none of them answers by
  // omission (오너 지시 2026-08-27). The strip's dot used to be dropped for 미연결.
  it('gives each channel state its own dot fill, so colour is not dead weight', async () => {
    const dotOf = (container: HTMLElement) =>
      container.querySelector('aside span[aria-hidden].rounded-full')?.className ?? '';

    const linked = await folded({ issueKey: 'PII-1', browseUrl: null });
    const okFill = dotOf(linked.container as HTMLElement);
    linked.unmount();

    const none = await folded(null);
    const noneFill = dotOf(none.container as HTMLElement);
    none.unmount();

    const failed = await folded('error');
    const errFill = dotOf(failed.container as HTMLElement);

    for (const fill of [okFill, noneFill, errFill]) expect(fill).not.toBe('');
    expect(new Set([okFill, noneFill, errFill]).size).toBe(3);
  });

  // 오너 지시 2026-08-23: 「JiraTicket 없는 경우엔 접었을 때 적절히 다른 표현으로」. The three
  // states used to differ by dot fill alone, so the zone with nothing behind it advertised
  // itself exactly like the one you can reach.
  //
  // ⚠️ 미연결 used to withdraw the promise on three channels, the third being that it drew
  // no dot at all. 오너 지시 2026-08-27 gave it a grey one, so TWO channels are left doing
  // that work and both are asserted here — the quiet ink, and a fill that is not the
  // reachable state's. Dropping either one puts the empty channel back to advertising
  // itself like a live one.
  it('withdraws the channel entry’s promise when no ticket is mapped', async () => {
    const channelBtn = () => screen.getByRole('button', { name: /^협업 채널/ });
    const dotIn = (btn: HTMLElement) => btn.querySelector('span[aria-hidden].rounded-full');

    // The two token pairs have to actually differ, or every assertion below passes on a
    // distinction that is not being drawn.
    expect(railStyles.entryQuiet).not.toBe(railStyles.entry);
    expect(railStyles.entryLabelQuiet).not.toBe(railStyles.entryLabel);

    const linked = await folded({ issueKey: 'PII-7', browseUrl: null });
    const reachableFill = dotIn(channelBtn())?.className;
    expect(reachableFill).toBeTruthy();
    linked.unmount();

    const none = await folded(null);
    const quiet = channelBtn();
    expect(quiet.className).toBe(railStyles.entryQuiet);
    // Blue promises somewhere to go. #4E5968 withdraws that and still clears AA on the
    // rail plane (5.71) — ⛔ gray-400 (1.9) and gray-500 (3.88) do not.
    expect(screen.getByText('채널').className).toContain('text-[#4E5968]');
    // Channel two: a dot, but not the reachable one's. ⛔ It may not be dropped — 미연결 is
    // an answer, not a missing answer — and it may not be the green either.
    expect(dotIn(quiet)).toBeTruthy();
    expect(dotIn(quiet)?.className).not.toBe(reachableFill);
    none.unmount();

    // ⛔ A failed fetch is NOT an empty channel — it keeps full ink and its dot, or the
    // strip says "there is nothing here" about something it simply could not read.
    await folded('error');
    const loud = channelBtn();
    expect(loud.className).toBe(railStyles.entry);
    expect(screen.getByText('채널').className).toContain('text-[#0050D6]');
    expect(dotIn(loud)).toBeTruthy();
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
    expect(screen.queryByText(CHANNEL_LINE)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^협업 채널 — / }));

    expect(screen.getByText(CHANNEL_LINE)).toBeTruthy();
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

    // The link's accessible name is the issue key itself. It used to be 「협업 채널 링크
    // BDCDIP-1007」, because the anchor wrapped the label as well as the value — and an
    // anchor named after its own label is the widened hit area, spelled out loud.
    const link = () => screen.queryByRole('link', { name: 'BDCDIP-1007' });
    // ⛔ The tip is portaled to <body>, so an "outside" test that only checks the trigger
    // counts this as outside and unmounts the box on pointerdown — before the click can
    // ever reach the link. Pinning exists so the reader can move INTO the content.
    fireEvent.pointerDown(link() as HTMLElement);
    expect(link()).toBeTruthy();

    // …and a press genuinely outside still dismisses it.
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(link()).toBeNull());
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
