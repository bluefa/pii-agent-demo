'use client';

import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { ChatIcon, GuideIcon, OpenExternalIcon } from '@/app/components/ui/icons';
import {
  RailEntry,
  RailMark,
  RailToggle,
  useRailCollapse,
  type RailCollapsed,
} from '@/app/components/ui/RailCollapse';
import {
  borderColors,
  cn,
  primaryColors,
  railStyles,
  statusColors,
  textColors,
} from '@/lib/theme';

import { GUIDE_SLOTS, type GuideSlotKey } from '@/lib/constants/guide-registry';
import { safeBrowseUrl } from '@/lib/jira-ticket';
import { useLocale } from '@/app/components/LocaleProvider';
import { TS_COPY } from '@/app/target-sources/[targetSourceId]/_components/copy';

/**
 * Collab-channel ticket state for the rail card, resolved server-side
 * (page.tsx): 'error' on non-404 failures, null = no ticket mapped (API 404).
 * v5 계약 — 열 주소는 `browseUrl` 이 싣는다. 프론트는 조립·파싱하지 않는다.
 */
export type JiraTicketState = { issueKey: string; browseUrl: string | null } | null | 'error';

/** The rail's region id — what both fold controls point `aria-controls` at. */
const RAIL_ID = 'guide-rail';

/**
 * Top-of-rail help card — the collab-channel entry point, mirroring
 * GET /target-sources/{id}/jira-ticket: mapped ticket → Jira link row (or a
 * plain key row when the response carries no browseUrl); 404 → explicit 미연결
 * row instead of a fake sample key; fetch error → its own row, so an outage
 * is not misread as "no channel".
 */
const CollabChannelCard = ({ jiraTicket }: { jiraTicket: JiraTicketState }) => {
  const { locale } = useLocale();
  const t = TS_COPY[locale].collab;
  /**
   * The channel zone's content, and nothing else — no fill, no border, no radius of its
   * own, in either place it renders. Containment is the CALLER's, and it differs: on the
   * open rail the zone's `railStyles.card` is the white box, and in the folded rail's tip
   * the tooltip's own white box already is one. Owning a surface here would nest a card
   * inside whichever of those it landed in.
   *
   * ⛔ Do not give the row back the white fill it used to have. That surface is also
   * what broke it: the tip is a fixed 280px box, so 280 − 2 border − 28 padding = 250,
   * and the row's own border and padding spent 26 of that before the old card's 34 —
   * leaving 190 for a 68px label beside an 85px key, and 한글 wrapped mid-phrase.
   *
   * ⛔ No trailing ↗ on the link row (오너 지시 2026-08-23). What says "link" is the key
   * itself: blue, underlined, with `title` naming the destination. The 11px glyph at 50%
   * opacity was the only new-tab cue, so re-adding it is an owner's call, not a tidy-up.
   *
   * ⛔ Still no ChatIcon on the rows, and now for a bigger reason. It came off when the
   * zone head took the glyph (오너 지시 2026-08-23, `zoneMarkChannel` — a token this change
   * deleted), and the head has since given the glyph up altogether: the CARD is the bubble
   * (오너 지시 2026-08-27, `railStyles.bubbleTail`). A 24px ChatIcon on a row would put a
   * small copy of that bubble inside it — the same defect the 2026-08-23 argument was
   * about, one level further out. Every row here is a plain text stack, and none of them
   * lays out a glyph.
   *
   * The tiers stay stacked even though one line now fits: the key is user data and a
   * longer one puts the collision straight back.
   */
  // ⛔ The key carries NO label. It had one — 「협업 채널 링크」, then 「이슈 키」 — and the
  // second rename is what showed the row did not need either.
  //
  // Cloudscape's key-value rule ("a descriptor … that identifies the corresponding value")
  // and GOV.UK's `<dl>` guidance answer what a label must SAY once you are presenting a
  // key-value pair. Neither says this should be one, and a single link is not a property
  // list. The value describes itself — `font-mono`, #0050D6, underlined, and a `BDCDIP-`
  // prefix — so the label spent 20.5 of the card's 101px of content adding nothing, and it
  // was a third 협업 채널-adjacent descriptor in a card that already had two. Jira's
  // Development panel presents its external artifact as one unlabelled line for the same
  // reason. What is left is the zone's name, one sentence, and the value.
  //
  // ⛔ The anchor's `title` therefore stays. With no label, that attribute is the only
  // prose naming the destination — load-bearing now, not decoration.
  //
  // The rail's tiers, T3 and T2 (오너 2026-08-24: 12 / 14 / 16, and a leading per group).
  //
  // Leading is set by ROLE, not by size. What is READ gets ~1.4; what is CALLED — a key,
  // a heading — gets 1.17–1.25. It used to be a flat 1.5 here and a flat 1.72 in the guide
  // body, i.e. the larger the type the more air it took, which is the opposite of what
  // Carbon, Atlassian, Material and Cloudscape all encode (12→16, 14→20, 16→20 for a head).
  // Per role, and one string each rather than one `meta` for all of them:
  //   문장     12/17 (141%) — it is read.
  //   키       14/17 (121%) — one line of machine value.
  //   빈 상태  12/17 (140%) — sentences, not labels, so they take the 문장 leading.
  //
  // ⛔ `tracking-normal` is not "no tracking" — it CANCELS the −0.288px that `body` hands
  // down. `letter-spacing` inherits as a computed LENGTH, so that one declaration lands on
  // 12px text as −0.024em and on 16px as −0.018em: tightest exactly where it should be
  // loosest. Every tier now declares its own, and the gradient runs 0 → −0.01 → −0.02.
  // `break-keep` because cancelling the tracking is what made it necessary: the sentence
  // grew ~8px, crossed the 271px column (320 rail − 1 border − 24 rail padding − 24 card
  // padding), and Korean's default break-anywhere left 「요.」 alone on line two. It breaks
  // between 어절 now, the way `DuplicateAddressNotice` and `accessStyles` already do it.
  const sentence = 'text-[12px] leading-[17px] tracking-normal break-keep';
  // ⛔ `font-semibold` (600) is the whole of 시안 A, and it is the payload's rank, not a
  // decoration. At 400 this key was byte-for-byte Carbon's `bodyCompact01` (14/400) — the
  // token for a VALUE INSIDE a component — while the head above it wore 16/700. Carbon's own
  // rule is that «a bold weight will always have more emphasis than a lighter weight font of
  // the same size», and that a lighter face outranks a bold one only when it is
  // «significantly larger»; 16/14 = 1.14x does not clear that, so the label won on BOTH
  // channels at once and the thing the user clicks was the quietest ink in the card.
  // 600 is `heading01`, Carbon's own compact section-header weight, and Atlassian arrives at
  // the same value from the other side: «don't use heading text in components, instead use
  // body text with a heavier font weight to create greater contrast».
  // ⛔ Raise the WEIGHT, not the size. 16 here would collide with the head's 16 and leave
  // weight as the only separator between a coordinate and a payload — and it would break the
  // 12/14/16 tier ladder the rail already runs on (오너 2026-08-24).
  //
  // ⚠️ `font-mono` is DEAD and is deliberately left standing: `--font-mono` is aliased to the
  // sans face in `globals.css`, so it changes no pixel (verified in-browser: the anchor's
  // resolved family is `pretendard`). `plStyles.typeTag` already deleted its own mono
  // declaration for exactly this reason, so the precedent for removing this one exists — it
  // was simply not part of 오너 지시 2026-08-28 (「A,C,E적용」), and a zero-pixel cleanup is
  // not something to smuggle into a design commit.
  const channelKey =
    'font-mono text-[14px] font-semibold leading-[17px] tracking-[-0.01em]';
  const href =
    jiraTicket && jiraTicket !== 'error' ? safeBrowseUrl(jiraTicket.browseUrl) : null;

  /**
   * ⛔ No state dot on any ROW here. The card has one again, but it belongs to the zone head
   * (`GuidePanel`, which owns `collab`) — see the history recorded there.
   *
   * What the rows must keep doing is saying each state in WORDS: 미연결 and 실패 in their own
   * sentence, 연결됨 by having a clickable key at all. That is not decoration — it is the
   * whole reason the head's dot is allowed to be `aria-hidden`, so a row that stops speaking
   * takes the dot's exemption down with it.
   *
   * ⛔ The FOLDED STRIP keeps its own dot as well, which is why `collab.dot` and
   * `collab.hint` both stay in `GuidePanel`. Out there the rows do not exist at all, so
   * `RailEntry`'s dot is not a second channel but the only one.
   */
  // Two gaps, and they are deliberately UNEQUAL — measured in INK, half-leadings included:
  //   12.5  zone head → 문장   (2 + mt-2 8 + 2.5)    the name and what it is for
  //   28    문장 → 값 줄       (2.5 + mt-6 24 + 1.5)  the value
  // 2.24×, which is what makes two groups out of three lines. They were 8.5 and 20 until
  // 오너 지시 2026-08-28 (「행간 거리 띄우자. 타이틀과 보조 텍스트가 너무 붙어있다」). ⛔ The
  // second gap grew even though only the first was named: at 20 the ratio would be 1.6×,
  // which is the uniform spread this card was already diagnosed for. If the result reads too
  // airy, the SECOND gap is the one to pull back — the first is the one the owner asked for.
  // ⛔ Both moved by margin. No leading was touched; see the head's own note.
  //
  // ⛔ It replaces a ladder of
  // 8.5 / 11.5 / 6.5 that was monotonic and therefore useless: max/min was 1.77×, close
  // enough that the eye read it as uniform and no group formed at all. `/design-guide` §3
  // asks for a section gap at 2× the internal one and says plainly that uniform spacing
  // makes everything read as one lump. Asymmetry is what makes hierarchy; monotonicity is
  // not, and the earlier note claiming otherwise was wrong.
  //
  // ⚠️ 20 also breaks the rule that no internal gap may exceed the 12px `gap-3` between
  // the two zone cards, and that rule does not survive its own premise: the cards are told
  // apart by a SURFACE — white `railStyles.card` on the #E2E7EA plane — not by whitespace.
  // Containment separates more strongly than any gap, so the outer boundary owes the inner
  // one no margin of victory. ⛔ `gap-3` itself does not move.
  //
  // Measured after: the two gaps come out 12.5 and 28 off the rendered rects — 29 in the
  // empty states, whose row is 12/17 rather than 14/17, so its half-leading is 1px deeper.
  // Card height has run 125 → 98 (two lines cut) → 102 (20px head) → 110 (this round).
  return (
    <div>
      {/* ⛔ No 「도움이 필요하신가요?」 heading above this sentence (오너 지시 2026-08-23).
          It was 16px bold sitting 8px under 「협업 채널」 at 16px semibold — two headings
          of the same size, separated by weight alone, saying the same thing twice. The
          zone label names the zone; this sentence says what it is for.

          ONE line, at the real 271px column. It was 「진행 중 막히는 부분은 협업 채널에서
          바로 문의할 수 있어요.」 — two lines and 34px of ink, the largest area in the card
          and the least information in it. 협업 채널 went because the head two lines up
          already says it (that was the second of three occurrences), and 진행 중 went
          because a step screen is where this rail lives. The 「…할 수 있어요」 register is
          the app's own and the guide-copy transcription round settled it, so that part does
          not move. Measured after the cut: the `<p>` is 17px tall, not 34. */}
      <p className={cn(sentence, textColors.secondary)}>{t.sentence}</p>
      {/* The two empty states are back on `tertiary`. They were moved up to `secondary`
          only because a #E8F1FF band stood under them, where gray-500 is 4.25:1. No band
          survives here: 시안 A puts this row inside the zone's white card, where it is
          4.83:1 again. Quiet is the right register for a placeholder — it must not
          out-weigh the real link. */}
      {jiraTicket === 'error' ? (
        <div className={cn('mt-6', sentence, 'font-medium', textColors.tertiary)}>
          {t.loadFailed}
        </div>
      ) : jiraTicket === null ? (
        <div className={cn('mt-6', sentence, 'font-medium', textColors.tertiary)}>
          {t.notConnected}
        </div>
      ) : (
        <>
          {/* One child, and still `flex`: the row must have no strut of its own, or an
              inline anchor would sit in a line box sized by whatever leading the card
              inherits and the 28px ink gap above would be measured off the wrong box. `flex`
              also keeps the anchor shrink-to-fit. The row holds no type — the value carries
              it. */}
          <div className="mt-6 flex">
            {href ? (
              /* Owner ask: the issue key reads as a classic hyperlink — blue + underline.
                 `textOnLight` (#0050D6), not `text` (#0064FF), even though the brighter
                 blue is legal on white (4.92:1). The rail keeps ONE blue —
                 `guideStyles.accent` already paints the guide body's `<em>` #0050D6.

                 ⛔ The anchor is the VALUE's box, not the row's. It used to wrap the row's
                 label as well — the label this card no longer has at all — so the clickable
                 rectangle measured 271.46 × 36 where the underline measured 271.46 × 20:
                 underline, hit area and hover were three different shapes, and the widest of
                 them was the whole column. `inline-flex` neither grows nor stretches, so the
                 box is still the value's own: key + `gap-1` + icon, and nothing of the 271px
                 column it sits in. ⛔ Nothing may hand that width back — no `w-full`, no
                 `flex-1`, no `grow`, no `block`.

                 `OpenExternalIcon`, 12px, `currentColor` (오너 지시 2026-08-28: 「BDCDIP-1002
                 에 우상향 화살표 넣어보자」). ⚠️ The owner named the SHAPE and this picks by
                 INTENT, which is the repo's rule and each icon's own doc comment:
                 `ArrowUpRightIcon` is «a forward jump to another in-app screen»,
                 `OpenExternalIcon` is «opens a link in a new tab / external destination
                 (Jira, docs, etc.)» — literally this case. Its glyph is an arrow leaving a
                 box, so it is still an up-right arrow. First usage in the app. 12 is the
                 component's native size; the 13px at `WaitingApprovalReselectButton` is that
                 screen's business, not a precedent.

                 ⛔ The underline is on a SPAN around the text, not on the anchor. Anchor-level
                 `text-decoration` draws through inline children, so it would strike through
                 the icon too; scoping it structurally is the only way that survives an icon
                 changing size. The anchor holds the type and the ink, the span holds the
                 line, the icon inherits the colour.

                 ⚠️ Underline AND icon now say "leaves this page" twice. Carbon drops the
                 underline on a standalone link precisely BECAUSE the icon carries it, so the
                 icon arrived first and the underline is the outstanding half of that pattern
                 — an owner's call, not a tidy-up.

                 ⛔ No `hover:` ink on it. `primaryColors.textHover` IS `textOnLight` — the
                 rail keeps one blue, so the hover state it used to declare changed no pixel
                 once the anchor stopped covering the grey label. A second blue, or a
                 thicker underline, is an owner's call rather than a tidy-up. */
              <a
                // v5 계약 — BFF 가 조립한 browseUrl 을 그대로 연다. 프론트 파싱·조립 없음.
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={t.linkTitle}
                className={cn(
                  channelKey,
                  'inline-flex items-center gap-1',
                  primaryColors.textOnLight,
                )}
              >
                <span className="underline">{jiraTicket.issueKey}</span>
                <OpenExternalIcon className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              // browseUrl 이 없으면(또는 http 가 아니면) 링크를 지어내지 않고 키만 보여준다.
              <span className={cn(channelKey, textColors.secondary)}>
                {jiraTicket.issueKey}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface GuidePanelProps {
  slotKey: GuideSlotKey | null;
  jiraTicket: JiraTicketState;
  /**
   * The fold preference the SERVER read off the request cookie. Not keyed by target
   * source — how much of the screen a reader wants spent on help is a workspace
   * preference, not a fact about one resource.
   *
   * ⛔ It has to arrive as a prop. Reading it in here would put the answer one frame
   * behind the paint, which is the flash this replaced.
   */
  initialCollapsed: RailCollapsed;
}

/**
 * Full-height right rail for the step screens — now literally the same plane as the left
 * ServiceListPanel (`railStyles.surface`), carrying two zone cards: the collab channel,
 * then the step's guide in a scrollable frame. Deliberately quiet (auxiliary) chrome so
 * the working column keeps the visual weight. Replaces the inline amber guide card
 * (UX report P2/P3).
 *
 * ONE thing, not two. The rail used to split into a [가이드 | 진행 내역] segmented
 * control, and 진행 내역 was twelve hardcoded rows — no history API exists, so every
 * target source showed the same fabricated timeline. A tab is a promise that there are
 * two things worth choosing between; there was one (오너 지시 2026-08-23). If a real
 * history endpoint lands, it comes back as its own decision, not as a revert.
 *
 * The rail FOLDS; it no longer vanishes. It used to be `hidden … min-[1360px]:flex`,
 * which made the viewport decide whether it existed — and since this file is the only
 * render site for the guide and the Jira channel, both were unreachable below 1360px,
 * out of the accessibility tree and out of the tab order, with no control anywhere
 * that brought them back. 1360 survives as the DEFAULT (`RAIL_OPEN_MIN_WIDTH`), and a
 * press outranks it at every width.
 *
 * ⛔ Nothing destructive belongs on this rail. It is an auxiliary panel that folds
 * away on request, so the only copy of an irreversible action placed here would go
 * with it — exactly the defect above. Keep such an action on the content column.
 */
export const GuidePanel = ({
  slotKey,
  jiraTicket,
  initialCollapsed,
}: GuidePanelProps) => {
  const { locale } = useLocale();
  const t = TS_COPY[locale].collab;
  const { collapsed, toggle, presses } = useRailCollapse(initialCollapsed);

  /**
   * What the rail says about the collab channel when it is FOLDED, and nothing else. The
   * open card used to take `dot` as a prop as well — the head's corner, then the value row
   * — and 시안 E took the dot off the card entirely (오너 지시 2026-08-27). ⛔ This mapping
   * stays regardless: on a 56px strip there are no rows to read, so the dot and `hint` are
   * the only state signal that exists. The card itself is the escape hatch for every
   * step, and folding used to take it off the screen entirely — dot and all three of its
   * states, including the one where the fetch failed. `hint` says in words whatever the
   * presentation says in colour, because the dot is `aria-hidden` and colour alone is not
   * a channel; on the open card the rows below do that job.
   *
   * 오너 지시 2026-08-23: 「JiraTicket 없는 경우엔 접었을 때 적절히 다른 표현으로」. The
   * three states used to differ by dot fill alone — same dark glyph, same blue 「채널」 —
   * so the one with nothing behind it advertised itself exactly like the one you can
   * reach. The presentations separate on two channels at once:
   *
   *   있음  진한 글리프 · 파란 라벨 · 초록 점    reachable
   *   없음  차분한 글리프 · 중립 라벨 · 회색 점  there is nothing here
   *   실패  진한 글리프 · 파란 라벨 · 빨간 점    we could not tell you
   *
   * ⚠️ 없음 now GREYS its dot, where this block used to record the opposite as a ⛔: green
   * means reachable and red means broken, so absence was neither and a dot on a stateless
   * zone was decoration. 오너 지시 2026-08-27 reversed it, and the reversal is the stronger
   * reading — 미연결 IS one of three answers this zone gives, so a reader scanning for the
   * dot should find one every time rather than having to notice a gap. gray-400
   * (`statusColors.pending.dot`) is the fill this app already uses for a slot with nothing
   * in it yet.
   * ⛔ `quiet` stays. The neutral label ink is what withdraws the promise of somewhere to
   * go; the grey dot is a second channel, not a replacement for the first.
   * ⛔ 실패 stays loud. A fetch that failed is not an empty channel, and quieting it would
   * be the same conflation the separate error row exists to prevent.
   *
   * `dot` is required, not optional: with 미연결 filled in there is no state left that
   * renders a dotless entry, and the type is where that stops being re-litigable.
   */
  const collab: { dot: string; quiet?: boolean; hint: string } =
    jiraTicket === 'error'
      ? { dot: statusColors.error.dot, hint: t.hintError }
      : jiraTicket === null
        ? {
            dot: statusColors.pending.dot,
            quiet: true,
            hint: t.hintNone,
          }
        : { dot: statusColors.success.dot, hint: t.hintKey(jiraTicket.issueKey) };

  /**
   * 「2단계 가이드」 rather than 「가이드」 (오너 지시 2026-08-23). The rail is docked beside
   * a screen that is itself a numbered process, so the number is what says WHICH guide
   * this is — without it the zone head is the same four words on all seven steps.
   *
   * The registry is the source: all 35 slots are `process-step` today, but `GuidePlacement`
   * is a union that reserves `side-panel`/`tooltip`/`faq`, and those carry no step. Narrow
   * rather than assert — a guide with no step number falls back to the bare word instead
   * of printing 「undefined단계」.
   */
  const placement = slotKey ? GUIDE_SLOTS[slotKey].placement : null;
  const guideZoneLabel =
    placement?.kind === 'process-step' ? t.guideStep(placement.step) : t.guide;


  // While `collapsed` is null the media query paints the default — the same markup the
  // server sent — so the first frame does not jump on the way to the stored preference.
  // Once it resolves the state owns the rail and the breakpoint stops mattering.
  const railWidth =
    collapsed === null
      ? cn(railStyles.collapsedWidth, 'min-[1360px]:w-[320px]')
      : collapsed
        ? railStyles.collapsedWidth
        : 'w-[320px]';
  // Both halves mount only while the answer is still `null` — that is the one frame the
  // media query has to arbitrate. Once it resolves, the losing half UNMOUNTS rather than
  // being class-hidden: a `hidden` sibling still holds a focusable fold button, so two
  // controls for the same gesture would sit in the tab order with one of them invisible.
  const stripShown = collapsed === null ? 'flex min-[1360px]:hidden' : 'flex';
  const bodyShown = collapsed === null ? 'hidden min-[1360px]:flex' : 'flex';


  return (
    <aside
      /* The region both toggles name in `aria-controls`. Static, because there is exactly
         one guide rail on the page — the panel that used to mount per step now mounts
         once, which is what made a single id possible. */
      id={RAIL_ID}
      /* One name for the panel, and it is the one on the strip. It used to be called
         three things — this label, 「가이드 펼치기」 on the button, and 「가이드 / 진행
         내역」 on the tabs — which is fine until the folded rail has to carry ONE word. */
      aria-label={t.guide}
      className={cn(
        railWidth,
        // `default`, matching the left rail's `border-r` — the two rails are the same
        // plane now, so they owe the canvas the same edge.
        'flex shrink-0 flex-col border-l',
        borderColors.default,
        railStyles.surface,
      )}
    >
      {/* Folded. The strip IS the rail, so it has to answer two questions a chevron alone
          cannot: what panel is this, and is the collab channel still there.

          채널 above 가이드, because the strip mirrors the panel's own vertical order — the
          channel band sits above the guide when the rail is open, and a strip that reordered
          the zones would teach a layout the open rail then contradicts. (Cloudscape puts
          help first in its trigger bar, but that bar ranks separate PANELS against each
          other; these are zones inside one panel, and the panel already has an order.)

          채널 does not unfold. Its tip carries the card itself, so the answer arrives
          without the rail moving — which is the whole point of having folded it. */}
      {collapsed !== false && (
        <div className={cn(stripShown, railStyles.strip)}>
          <RailToggle
            direction="left"
            label={t.expandGuide}
            expanded={false}
            controls={RAIL_ID}
            presses={presses}
            onClick={toggle}
          />
          <span aria-hidden className={railStyles.divider} />
          <RailEntry
            icon={<ChatIcon className="h-5 w-5" />}
            label={t.stripChannel}
            hint={collab.hint}
            dot={collab.dot}
            quiet={collab.quiet}
            tip={<CollabChannelCard jiraTicket={jiraTicket} />}
          />
          {/* Same mark, both states (오너 지시 2026-08-23) — the folded strip and the open
              rail's zone head show one 전구, so folding does not change what the guide
              looks like, only how much of it there is. */}
          <RailEntry
            icon={<GuideIcon className={cn('h-5 w-5', railStyles.zoneMark)} />}
            label={t.guide}
            hint={t.expandHint(guideZoneLabel)}
            onClick={toggle}
          />
        </div>
      )}

      {/* Open. A flex column of its own, so every zone below still measures against the
          rail's height exactly as it did when these were the aside's own children. */}
      {collapsed !== true && (
        <div className={cn(bodyShown, 'min-h-0 flex-1 flex-col gap-3 p-3 pt-2')}>
          {/* The rail's head: the fold control, and nothing else.

              It used to live inside the 협업 채널 card, in a `justify-between` row with that
              zone's label — so the control that folds the WHOLE panel was a child of the
              panel's first zone, and it read as one (오너 2026-08-24: 「우측으로 접기 버튼이
              협업채널의 일부처럼 보여」). It also landed somewhere else in each fold state.
              The rail is right-anchored, so its right edge is what the eye and the pointer
              measure from, and from there the glyph's centre sat at (28, 24) folded and
              (32, 40) open — a 16px drop and a 4px sidestep on a control that never changed
              what it does.

              `pt-2` + a 32px box puts the centre at y=24, and `p-3`'s 12px right padding
              puts it 28px in from the rail's right edge — the folded strip's own numbers
              (`railStyles.strip` is `px-1 py-2` on a 56px rail: 4 + 8 + 16 = 28). Measured
              after the move: Δ (0.5px, 0). The 0.5 is the rail's own `border-l`.

              ⛔ Not a header with a title in it. The rail is named once, by the zone heads;
              a third label here would be the 「도움이 필요하신가요?」 stutter again. JetBrains
              puts Hide on the tool window's header and Stripe Apps puts an app's top-level
              actions on the drawer's — neither puts them in the first section. */}
          <div className="flex shrink-0 justify-end">
            <RailToggle
              direction="right"
              label={t.collapseGuide}
              expanded
              controls={RAIL_ID}
              presses={presses}
              onClick={toggle}
            />
          </div>
          {/* 시안 A — 레일은 뒷판, 존은 그 위의 카드 (오너 지시 2026-08-23: 가이드를 카드
              그룹으로 묶을 것).

              This replaces 시안 E, which held the rail white and separated the two zones
              with a hairline and a label alone. E was the cheaper answer to the same
              complaint and it did close P2–P5; what it left open was P1 — the rail was the
              brightest surface on the page while the left rail had already been dropped to
              a back plane. Asking for a card forces that: a white card on a white rail is
              not a card, so the plane had to move for the card to exist at all.

              ONE number runs the whole layout: 12. Rail padding, card padding, the gap
              between the cards. The rail's own scale is now {8 (zone label → its content),
              12 (block → block)} and nothing else; the guide body keeps its own smaller
              rhythm, part of it in `.prose-guide` (shared with the admin post editor) and
              part in `.prose-guide-rail` / `guideStyles` (this rail only).

              The channel is still first — it is the escape hatch for every step, so it
              holds the top of the rail and the guide scrolls underneath it. */}
          <div className={cn(railStyles.card, railStyles.bubbleTail, 'shrink-0 p-4')}>
            {/* The zone head: the zone's name, and nothing else. No glyph, no control, no
                dot.

                `railStyles.zoneLabel`, 16/20 — the same token the guide card's head wears.
                ⚠️ It was 20/24 through a token of its own for one commit (오너 지시
                2026-08-27: 「협업 채널은 20픽셀로 선언해볼래?」) and came back the next day
                (오너 지시 2026-08-28: 「16픽셀로 바꿔」). ⛔ The token went with the size: at
                16 it was byte-identical to this one. Five of the benchmark's narrow-rail
                references treat every section head alike whatever the section's size, so
                sharing is the supported state and not just the smaller diff.

                오너 지시 2026-08-27 — the CARD is the 말풍선 the folded strip draws as a 20px
                `ChatIcon`, enlarged (`railStyles.bubbleTail` carries the tail). That is what
                took the glyph off this head: an enlarged icon cannot also contain a small
                copy of itself. `railStyles.zoneMarkChannel`/`…Quiet`, the ink pair that
                existed only to colour that glyph, went with it.

                The DOT, in one record rather than four. It arrived here with the glyph, on
                the same geometry: the dot rides the folded `ChatIcon`'s top-right corner, so
                `justify-between` puts it on the enlarged card's. It then spent three rounds
                elsewhere — leading the value row, then trailing it, then off the card
                entirely (시안 E) — and 오너 지시 2026-08-28 brings it back to this corner.
                What each move was arguing about was whether the dot describes the VALUE's
                reachability or the ZONE's state; the card reads as a 말풍선 for one channel,
                so the head is a fair place to hang that channel's state, and the corner is
                the only spot that needs no second measurement. The row placements each cost
                something the corner does not: leading indented the value and broke the
                card's single left edge, trailing floated 183px short of the right edge.

                `gap-1.5` (6px), so the dot rides the LABEL — 오너 지시 2026-08-28 (시안 C),
                which reverses the 「우측 끝에」 of the same day. ⛔ Not `justify-between`: that
                grammar is for two unrelated things at opposite ends, and this dot is not
                unrelated to 「협업 채널」 — it is that channel's state. Pinned to the far edge it
                measured 206px from the label it modifies, and nothing bridged the run, so it
                read as a loose mark rather than as the label's own status.

                The distance is a benchmark value, not a taste: Cloudscape's KeyValuePairs puts
                the indicator 0px under its label, Ant's Descriptions 8px after it, and Primer's
                ActionList in a leading column to its LEFT — three systems, no exception, and
                6px sits inside that band. What the same three reserve for the container's far
                edge is an ACTION (chevron, button, counter) or nothing at all; none of them
                pins a modifier there. 206 was 26x the widest of those distances.

                ⛔ The 209px to the right of the head is now deliberately EMPTY, and that is the
                supported state rather than a gap waiting to be filled: Cloudscape recommends
                exactly this — a flush-left stack with an unoccupied right field — and what
                carries the grouping there is vertical spacing, which this card already runs at
                12.5 / 28 (2.24x). Emptiness reads as margin once nothing is left hanging in it.

                `items-center` keeps the row 20px: the 8px dot is smaller than the label's line
                box, so both ink gaps around the head are unaffected by this move.

                ⛔ The dot is `aria-hidden`, and it is allowed to be ONLY because every state
                is stated in words in the rows below — the issue key itself, 「아직 연결된 협업
                채널이 없어요」, 「협업 채널 정보를 불러오지 못했어요」. Colour is a second
                channel on those, never the only one, which is the same exemption
                `railStyles.zoneMark` documents.

                ⚠️ All of this REVERSES 오너 지시 2026-08-23, which put `RailMark` here so the
                head and the strip drew one identical mark, glyph + dot + ink. That rule was
                right that the state had to move with the data; what it could not survive is
                the card itself becoming the mark.

                The row IS the label's 20px line box — `flex` gives it no strut of its own,
                so both ink gaps around the head are measured off that 20: `p-3` + (20 − 16)
                / 2 = 14 above, and 2 + `mt-2` + 2.5 = 12.5 below.

                Above > below is now 18 vs 12.5, a 5.5px margin on `/design-guide` 여백 7원칙 #2
                (제목의 위 여백 > 아래 여백). It was 14 vs 12.5 — 1.5px, satisfied and only just —
                until 오너 지시 2026-08-28 (시안 E) took the card to `p-4`. The earlier note here
                said to leave `p-3` alone «until they ask», and they have.

                ⛔ `p-4` is not a taste call; `p-3` was a 수치 위반. `/design-guide` §1 sets card
                padding at 상 20 · 좌우 24 · 하 24, and 여백 7원칙 #4 says the larger the radius the
                further in the content must sit for the grouping to close. This card is
                `rounded-xl`, so at `p-3` its padding EQUALLED its 12px corner radius and the
                content rode the curve — which is the 「조잡해 보인다」 the owner reported, and it
                is a different defect from the 강약 that 시안 A fixes. One lever cannot do both.

                ⚠️ COUPLED: `railStyles.bubbleTail` carries `after:left-4` so the tail still
                springs from the content edge. Those two numbers are one measurement split
                across two files — move one and you must move the other.

                ⚠️ The guide card below still runs `p-3`, so the two zones no longer share a
                padding. That pair break is deliberate and is the owner's open question (시안 E
                의 결정 3): raising the guide card too costs 8px of the rail's vertical budget
                and shortens its scroller by the same. ⛔ Do not «fix» the asymmetry by
                reverting this card. */}
            <div className="flex items-center gap-1.5">
              <span className={railStyles.zoneLabel}>{t.zoneLabel}</span>
              <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', collab.dot)} />
            </div>
            {/* 8, and the ink it buys is 12.5 (오너 지시 2026-08-28: 「타이틀과 보조 텍스트가
                너무 붙어있다」 — it was 4, i.e. 8.5 of ink). The head's 16px ink sits in a
                20px line box, leaving 2 below; the sentence's 12px ink sits in a 17px box,
                leaving 2.5 above; 8 between the boxes puts 12.5 between the INK. Align what
                is seen, not what is boxed.

                ⛔ The MARGIN opened, not the head's `leading`. Inflating a line box to
                manufacture space below it is the same "align what is boxed" error, and it
                would spend the head's own rhythm — 16/20 is the design guide's 120% for a
                제목 — on a gap that belongs to the box below.

                This is the card's INTERNAL gap: the name and the sentence are one group.
                The card's own `mt-6` puts 28 before the value, i.e. 2.24× this. ⛔ Do not
                even them out: equal gaps here made the lines read as one lump, which is
                exactly what `/design-guide` §3 warns about. */}
            <div className="mt-2">
              <CollabChannelCard jiraTicket={jiraTicket} />
            </div>
          </div>

          {/* The guide card is a FRAME: it takes the rail's remaining height and scrolls
              inside itself, with the zone head as its fixed head. ⛔ Do not move the head
              into the scroller — a label that scrolls away stops labelling. The scrollbar
              consequently runs at the card's inner edge rather than the rail's, which is
              the trade the frame buys. */}
          <div className={cn(railStyles.card, 'flex min-h-0 flex-1 flex-col')}>
            {/* ⛔ One mark, and the FOLDED one is the standard (오너 지시 2026-08-23): a bare
                20px 전구, same size and no plate, in both states. The Figma node's 28px
                #FFF8E1 container was rendered here for one commit and is gone — the strip
                had no room for it, and a mark that changes shape when you fold the rail is
                two marks. Dropping it also puts the 안내박스 back to being the rail's only
                fill, which is the whole of 시안 E. */}
            <div className="flex shrink-0 items-center gap-2 p-3 pb-2">
              {/* `RailMark`, and this zone is now the ONLY one that renders it on both
                  sides: the strip renders its 전구 through the same component, so passing
                  the icon bare here is what makes "one mark in both fold states" a
                  structural fact rather than two files agreeing by eye. (The 협업 채널 head
                  used to do the same; its glyph became the card itself, 오너 지시
                  2026-08-27.) It also supplies the `shrink-0` this used to carry itself,
                  which was the one class that stopped the two sides being identical
                  markup. */}
              <RailMark icon={<GuideIcon className={cn('h-5 w-5', railStyles.zoneMark)} />} />
              <span className={railStyles.zoneLabel}>{guideZoneLabel}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {slotKey ? (
                <GuideCardContainer slotKey={slotKey} bare />
              ) : (
                <p className={cn('py-4 text-center text-[12px]', textColors.tertiary)}>
                  {t.noGuide}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
