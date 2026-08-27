'use client';

import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { ChatIcon, GuideIcon } from '@/app/components/ui/icons';
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
  const channelKey = 'font-mono text-[14px] leading-[17px] tracking-[-0.01em]';
  const href =
    jiraTicket && jiraTicket !== 'error' ? safeBrowseUrl(jiraTicket.browseUrl) : null;

  /**
   * ⛔ NO state dot on this card — 시안 E, 오너 지시 2026-08-27 (which reverses that same
   * day's earlier instruction that every state must draw one).
   *
   * Its placement was settled twice before it was removed, and both rounds are why: the
   * head's far corner first (it rides the folded glyph's corner, and the CARD is that glyph
   * enlarged), then trailing the value (the corner made a failed fetch look like the whole
   * zone had failed, while a leading dot indented the value and broke the card's one left
   * edge). Neither round ever answered what the dot ADDED. It never carried information the
   * row did not already carry: 미연결 and 실패 say it in words on that very line, and
   * 연결됨 says it by having a clickable key at all. What it did carry was 8px after a
   * variable-length string, 183px from the card's right edge — floating, by measurement.
   *
   * ⛔ The FOLDED STRIP keeps its dot, and the asymmetry is the point. On a 56px strip the
   * rows do not exist: `RailEntry`'s dot is the only thing that says whether the channel is
   * reachable, which is why `collab.dot` and `collab.hint` stay in `GuidePanel`. The card
   * drops the dot because its rows already speak; the strip keeps it because they are not
   * there to.
   */
  // Two gaps, and they are deliberately UNEQUAL — measured in INK, half-leadings included:
  //    8.5  zone head → 문장   (2 + mt-1 4 + 2.5)   the name and what it is for
  //   20    문장 → 값 줄       (2.5 + mt-4 16 + 1.5) the value
  // 2.35×, which is what makes two groups out of four lines. ⛔ It replaces a ladder of
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
  // Measured after: the card is 98px tall where it was 125, and the two gaps come out 8.5
  // and 20 off the rendered rects — 21 in the empty states, whose row is 12/17 rather than
  // 14/17, so its half-leading is 1px deeper.
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
      <p className={cn(sentence, textColors.secondary)}>
        막히는 부분을 바로 문의할 수 있어요.
      </p>
      {/* The two empty states are back on `tertiary`. They were moved up to `secondary`
          only because a #E8F1FF band stood under them, where gray-500 is 4.25:1. No band
          survives here: 시안 A puts this row inside the zone's white card, where it is
          4.83:1 again. Quiet is the right register for a placeholder — it must not
          out-weigh the real link. */}
      {jiraTicket === 'error' ? (
        <div className={cn('mt-4', sentence, 'font-medium', textColors.tertiary)}>
          협업 채널 정보를 불러오지 못했어요
        </div>
      ) : jiraTicket === null ? (
        <div className={cn('mt-4', sentence, 'font-medium', textColors.tertiary)}>
          아직 연결된 협업 채널이 없어요
        </div>
      ) : (
        <>
          {/* One child now that the dot has gone, and still `flex`: the row must have no
              strut of its own, or an inline anchor would sit in a line box sized by whatever
              leading the card inherits and the 20px ink gap above would be measured off the
              wrong box. `flex` also keeps the anchor shrink-to-fit. The row holds no type —
              the value carries it. */}
          <div className="mt-4 flex">
            {href ? (
              /* Owner ask: the issue key reads as a classic hyperlink — blue + underline.
                 `textOnLight` (#0050D6), not `text` (#0064FF), even though the brighter
                 blue is legal on white (4.92:1). The rail keeps ONE blue —
                 `guideStyles.accent` already paints the guide body's `<em>` #0050D6.

                 ⛔ The anchor is the VALUE's box, not the row's. It used to wrap the row's
                 label as well — the label this card no longer has at all — so the clickable
                 rectangle measured 271.46 × 36 where the underline measured 271.46 × 20:
                 underline, hit area and hover were three different shapes, and the widest of
                 them was the whole column. As a flex item that neither grows nor stretches
                 it is shrink-to-fit: measured at 1440, the anchor's box is 84.41 × 17 at the
                 same origin as the underlined run's 84.41 × 16 — one width, one left edge,
                 and the 1px is the line box over the text run inside it. Nothing may put it
                 back to the column's width: no `w-full`, no `flex-1`, no `grow`.

                 ⛔ No `hover:` ink on it. `primaryColors.textHover` IS `textOnLight` — the
                 rail keeps one blue, so the hover state it used to declare changed no pixel
                 once the anchor stopped covering the grey label. A second blue, or a
                 thicker underline, is an owner's call rather than a tidy-up. */
              <a
                // v5 계약 — BFF 가 조립한 browseUrl 을 그대로 연다. 프론트 파싱·조립 없음.
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title="협업 채널 — Jira에서 논의하기"
                className={cn(channelKey, 'underline', primaryColors.textOnLight)}
              >
                {jiraTicket.issueKey}
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
      ? { dot: statusColors.error.dot, hint: '협업 채널 — 정보를 불러오지 못했어요' }
      : jiraTicket === null
        ? {
            dot: statusColors.pending.dot,
            quiet: true,
            hint: '협업 채널 — 아직 연결되지 않았어요',
          }
        : { dot: statusColors.success.dot, hint: `협업 채널 — ${jiraTicket.issueKey}` };

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
    placement?.kind === 'process-step' ? `${placement.step}단계 가이드` : '가이드';


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
      aria-label="가이드"
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
            label="가이드 펼치기"
            expanded={false}
            controls={RAIL_ID}
            presses={presses}
            onClick={toggle}
          />
          <span aria-hidden className={railStyles.divider} />
          <RailEntry
            icon={<ChatIcon className="h-5 w-5" />}
            label="채널"
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
            label="가이드"
            hint={`${guideZoneLabel} — 펼치기`}
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
              label="가이드 접기"
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
          <div className={cn(railStyles.card, railStyles.bubbleTail, 'shrink-0 p-3')}>
            {/* The zone head: the zone's name, and nothing else. No glyph, no control, no
                dot — 20px (오너 지시 2026-08-27: 「협업 채널은 20픽셀로 선언해볼래?」).

                `railStyles.channelZoneLabel`, this head's own token. ⛔ Not `zoneLabel`,
                which also draws the guide card's 「N단계 가이드」 — the ask was about this
                head, and growing the shared token would have moved one nobody looked at.

                오너 지시 2026-08-27 — the CARD is the 말풍선 the folded strip draws as a 20px
                `ChatIcon`, enlarged (`railStyles.bubbleTail` carries the tail). That is what
                took the glyph off this head: an enlarged icon cannot also contain a small
                copy of itself.

                ⚠️ The state dot was here too, on that same argument: it rides the glyph's
                top-right corner, so `justify-between` put it on the CARD's corner. It then
                moved onto the value row, and has since come off the card altogether (시안 E,
                same owner, same day — see `CollabChannelCard`, which records why). The three
                rounds all REVERSE 오너 지시 2026-08-23, which put `RailMark` here precisely so
                the head and the strip drew one identical mark, glyph + dot + ink. That rule
                was right that the state had to move with the data; what it could not survive
                is the card itself becoming the mark, and then the rows saying in words what
                the dot was saying in colour. `railStyles.zoneMarkChannel`/`…Quiet`, the ink
                pair that existed only to colour that glyph, went with the glyph.

                `block`, so the label's own 24px line box is the head's box. As a bare inline
                span it would sit in a line box sized by the card's inherited leading, and
                both ink gaps around it are measured off that 24: `p-3` + (24 − 20) / 2 = 14
                above, and 2 + `mt-1` + 2.5 = 8.5 below. ⛔ Above > below, deliberately
                (`/design-guide` 여백 7원칙 #2): a head belongs to the text it introduces, and
                at equal margins it floats between the padding and the sentence. The head
                grew 4px and neither gap moved, because 20/24 keeps 16/20's 2px half-leading. */}
            <span className={cn('block', railStyles.channelZoneLabel)}>협업 채널</span>
            {/* Still 4, and the ink it buys is 8.5. The head's 20px ink sits in a 24px line
                box, leaving 2 below; the sentence's 12px ink sits in a 17px box, leaving 2.5
                above; 4 between the boxes puts 8.5 between the INK. Align what is seen, not
                what is boxed. This is the card's INTERNAL gap — the name and the sentence
                are one group — and the card's own `mt-4` puts 20 before the value, i.e.
                2.35× this. ⛔ Do not even them out: equal gaps here made the four lines read
                as one lump, which is exactly what `/design-guide` §3 warns about. */}
            <div className="mt-1">
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
                  이 단계에는 표시할 가이드가 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
