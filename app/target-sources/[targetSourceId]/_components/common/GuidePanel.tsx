'use client';

import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { ChatIcon, GuideIcon, OpenExternalIcon } from '@/app/components/ui/icons';
import {
  RailEntry,
  RailToggle,
  useRailCollapse,
  type RailCollapsed,
} from '@/app/components/ui/RailCollapse';
import {
  bgColors,
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

/**
 * Top-of-rail help card — the collab-channel entry point, mirroring
 * GET /target-sources/{id}/jira-ticket: mapped ticket → Jira link row (or a
 * plain key row when the response carries no browseUrl); 404 → explicit 미연결
 * row instead of a fake sample key; fetch error → its own row, so an outage
 * is not misread as "no channel".
 */
const CollabChannelCard = ({ jiraTicket }: { jiraTicket: JiraTicketState }) => {
  /**
   * The channel zone's content, and nothing else — no fill, no border, no radius, in
   * either place it renders (시안 E, 오너 지시 2026-08-23). Containment is the caller's:
   * on the open rail a hairline and a zone label separate it, and in the folded rail's
   * tip the tooltip's own white box already is the card.
   *
   * ⛔ Do not give the row back the white fill it used to have. That surface is also
   * what broke it: the tip is a fixed 280px box, so 280 − 2 border − 28 padding = 250,
   * and the row's own border and padding spent 26 of that before the old card's 34 —
   * leaving 190. Its fixed parts (glyph + 3 × 8 gap + 11 ↗) take 51, so 139 was left
   * for a 68px label beside an 85px key, and 한글 wrapped mid-phrase.
   *
   * The tiers stay stacked even though one line would now fit (68 + 8 + 85 = 161 inside
   * 199): the key is user data and a longer one puts the collision straight back.
   */
  const rowBase = 'mt-3 flex items-center gap-2 text-[12px]';
  const channelMark = 'h-6 w-6 shrink-0';
  const channelLabel = 'block text-[12px] font-semibold leading-[1.45]';
  const channelKey = 'block font-mono text-[14px] leading-[1.35]';
  const href =
    jiraTicket && jiraTicket !== 'error' ? safeBrowseUrl(jiraTicket.browseUrl) : null;

  return (
    <div>
      <p className={cn('text-[16px] font-bold leading-[1.4]', textColors.primary)}>
        도움이 필요하신가요?
      </p>
      <p className={cn('mt-1 text-[12px] leading-[1.55]', textColors.secondary)}>
        진행 중 막히는 부분은 협업 채널에서 바로 문의할 수 있어요.
      </p>
      {/* The two empty states are back on `tertiary`. They were moved up to `secondary`
          only because a #E8F1FF band stood under them, where gray-500 is 4.25:1; 시안 E
          took that band away and on white it is 4.83:1 again. Quiet is the right register
          for a placeholder — it must not out-weigh the real link. */}
      {jiraTicket === 'error' ? (
        <div className={cn(rowBase, 'font-medium', textColors.tertiary)}>
          <ChatIcon className={channelMark} />
          협업 채널 정보를 불러오지 못했어요
        </div>
      ) : jiraTicket === null ? (
        <div className={cn(rowBase, 'font-medium', textColors.tertiary)}>
          <ChatIcon className={channelMark} />
          아직 연결된 협업 채널이 없어요
        </div>
      ) : href ? (
        <a
          // v5 계약 — BFF 가 조립한 browseUrl 을 그대로 연다. 프론트 파싱·조립 없음.
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title="협업 채널 — Jira에서 논의하기"
          className={cn(
            rowBase,
            'no-underline transition-colors',
            textColors.secondary,
            primaryColors.textHover,
          )}
        >
          <ChatIcon className={channelMark} />
          <span className="min-w-0 flex-1">
            <span className={channelLabel}>협업 채널 링크</span>
            {/* Owner ask: the issue key reads as a classic hyperlink — blue + underline.
                `textOnLight` (#0050D6), not `text` (#0064FF), even though the brighter blue
                is legal again now that the ground is white (4.92:1). 시안 E leaves the rail
                almost colourless, and the one blue it keeps should be a single blue —
                `guideStyles.accent` already paints the guide body's `<em>` #0050D6. */}
            <span className={cn(channelKey, 'underline', primaryColors.textOnLight)}>
              {jiraTicket.issueKey}
            </span>
          </span>
          <OpenExternalIcon className="h-[11px] w-[11px] shrink-0 opacity-50" />
        </a>
      ) : (
        // browseUrl 이 없으면(또는 http 가 아니면) 링크를 지어내지 않고 키만 보여준다.
        <div className={cn(rowBase, textColors.secondary)}>
          <ChatIcon className={channelMark} />
          <span className="min-w-0 flex-1">
            <span className={channelLabel}>협업 채널</span>
            <span className={channelKey}>{jiraTicket.issueKey}</span>
          </span>
        </div>
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
 * Full-height right rail for the step screens — mirrors the left ServiceListPanel:
 * flat surface, left border, the collab-channel card, then the step's guide in a
 * scrollable body. Deliberately quiet (auxiliary) chrome so the working column keeps
 * the visual weight. Replaces the inline amber guide card (UX report P2/P3).
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
  const { collapsed, toggle } = useRailCollapse(initialCollapsed);

  /**
   * What the folded rail says about the collab channel. The card itself is the escape
   * hatch for every step, and folding used to take it off the screen entirely — dot and
   * all three of its states, including the one where the fetch failed. The dot carries
   * the state in colour and `hint` carries the same thing in words, because the dot is
   * `aria-hidden` and colour alone is not a channel.
   */
  const collab =
    jiraTicket === 'error'
      ? { dot: statusColors.error.dot, hint: '협업 채널 — 정보를 불러오지 못했어요' }
      : jiraTicket === null
        ? { dot: statusColors.pending.dot, hint: '협업 채널 — 아직 연결되지 않았어요' }
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
      /* One name for the panel, and it is the one on the strip. It used to be called
         three things — this label, 「가이드 펼치기」 on the button, and 「가이드 / 진행
         내역」 on the tabs — which is fine until the folded rail has to carry ONE word. */
      aria-label="가이드"
      className={cn(
        railWidth,
        'flex shrink-0 flex-col border-l',
        borderColors.light,
        bgColors.surface,
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
          <RailToggle direction="left" label="가이드 펼치기" onClick={toggle} />
          <span aria-hidden className={railStyles.divider} />
          <RailEntry
            icon={<ChatIcon className="h-5 w-5" />}
            label="채널"
            hint={collab.hint}
            dot={collab.dot}
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
        <div className={cn(bodyShown, 'min-h-0 flex-1 flex-col')}>
          {/* 시안 E — 무채색 + 잉크만. Not one fill anywhere in the rail: the two zones are
              separated by a hairline and a zone label and nothing else, which is why the
              label is load-bearing rather than decoration. The #E8F1FF band that used to
              open this rail was the app's most overloaded tint (`cardStyles.stepTag` paints
              the 「N단계」 chip on the same screen with it), and it sat above the guide's own
              grey 안내박스 — two tinted blocks in one 320px column, which is the thing
              GitHub's alert guidance names outright: limit them, never consecutively.
              The 안내박스 is now the rail's ONLY tint, so it means something again.

              Both zones are inset 20px. They used to be 16 and 20, i.e. two text columns
              4px apart inside one panel.

              The channel is still first — it is the escape hatch for every step, so it
              holds the top of the rail and the guide scrolls underneath it. */}
          {/* ⛔ `default`, not `light`. With every fill gone this hairline is one of only two
              things separating the zones, and gray-100 measures 1.101 against white — the
              same step the service rail's comment calls out as leaving the border doing all
              the work unaided. gray-200 is 1.238, near the 1.439 that rail's own divider
              holds against its plane. */}
          <div className={cn('shrink-0 border-b px-5 pb-5 pt-3', borderColors.default)}>
            <div className="flex items-center justify-between gap-2">
              <span className={railStyles.zoneLabel}>협업 채널</span>
              {/* The 32px hit box centres a 16px glyph, so pulling the box 8px past the
                  zone's 20px inset lands the GLYPH's edge on it. Align the ink, not the box. */}
              <span className="-mr-2 shrink-0">
                <RailToggle direction="right" label="가이드 접기" onClick={toggle} />
              </span>
            </div>
            <div className="mt-1">
              <CollabChannelCard jiraTicket={jiraTicket} />
            </div>
          </div>

          {/* The zone head sits OUTSIDE the scroller. A label that scrolls away stops
              labelling, and this one is load-bearing — 시안 E has no fill to fall back on.
              Padding is split so the scrollbar still runs at the rail's edge while the
              prose keeps the same 20px column as the zone above. */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* ⛔ One mark, and the FOLDED one is the standard (오너 지시 2026-08-23): a bare
                20px 전구, same size and no plate, in both states. The Figma node's 28px
                #FFF8E1 container was rendered here for one commit and is gone — the strip
                had no room for it, and a mark that changes shape when you fold the rail is
                two marks. Dropping it also puts the 안내박스 back to being the rail's only
                fill, which is the whole of 시안 E. */}
            <div className="flex shrink-0 items-center gap-2 px-5 pb-2 pt-3">
              <GuideIcon className={cn('h-5 w-5 shrink-0', railStyles.zoneMark)} />
              <span className={railStyles.zoneLabel}>{guideZoneLabel}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
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
