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

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
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
const CollabChannelCard = ({
  jiraTicket,
  onCollapse,
}: {
  jiraTicket: JiraTicketState;
  /**
   * Supplied only where this card IS the panel's top band. It then drops its own card
   * chrome — the band owns the tint, the padding and the seam — and carries the panel's
   * fold control on its title line.
   *
   * The two travel together on purpose. A panel-level control may not sit inside a
   * discrete card, because a control inside an object belongs to that object; so when
   * the card takes the control, it stops being a card. Omitted by the folded rail's tip,
   * where this floats as a card on the tooltip's surface and folds nothing.
   */
  onCollapse?: () => void;
}) => {
  /**
   * The channel row, in all four states: a mark, then the text. No surface of its own —
   * ⛔ do not give it back the white fill and border it used to have (오너 지시
   * 2026-08-23). The card is already a surface inside a panel; a third one inside that
   * was a box in a box in a box.
   *
   * Losing the fill is what makes the row FIT. The folded rail renders this card in a
   * fixed 280px tip: 280 − 2 border − 28 padding = 250, − 2 − 32 = 216 inside the card.
   * The old row spent 26 of that on its own border and padding and had 190 left; its
   * fixed parts (glyph + 3 × 8 gap + 11 ↗) took 49, leaving 141 for a 78px label beside
   * a 79px key. 16px short — so 한글 wrapped mid-phrase and the row read as two
   * accidental lines. Stacking is the deliberate version of that break: what it is, then
   * which one. At 24/12/14 the widest tier is the 14px key, 92px inside 173 of room.
   *
   * ⛔ Measure against the tip's 216, never the open rail's 288. The tip is the tighter
   * of the two surfaces this card renders on, and it is the one that broke.
   */
  const rowBase = 'mt-3 flex items-center gap-2 text-[12px]';
  const channelMark = 'h-6 w-6 shrink-0';
  const channelLabel = 'block text-[12px] font-semibold leading-[1.45]';
  const channelKey = 'block font-mono text-[14px] leading-[1.35]';
  const href =
    jiraTicket && jiraTicket !== 'error' ? safeBrowseUrl(jiraTicket.browseUrl) : null;

  return (
    <div
      className={
        onCollapse
          ? undefined
          : cn('rounded-xl border p-4', primaryColors.bgLight, primaryColors.borderLight)
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-[16px] font-bold leading-[1.4]', textColors.primary)}>
          도움이 필요하신가요?
        </p>
        {/* Measured: the 32px hit box centres a 16px glyph, so pulling the box 8px past the
            band's 16px inset lands the GLYPH's edge exactly on it. Align the ink, not the box. */}
        {onCollapse && (
          <span className="-mr-2 shrink-0">
            <RailToggle direction="right" label="가이드 접기" onTint onClick={onCollapse} />
          </span>
        )}
      </div>
      {/* secondary, not tertiary: gray-500 is calibrated against white (4.83:1) and drops
          to 4.25:1 on the primary tint — under AA at this size. gray-700 holds 9.06:1. */}
      <p className={cn('mt-1 text-[12px] leading-[1.55]', textColors.secondary)}>
        진행 중 막히는 부분은 협업 채널에서 담당자에게 바로 문의할 수 있어요.
      </p>
      {/* ⚠️ secondary, not tertiary — the same trap the sentence above documents. gray-500
          was measured against the white row that used to sit under this text; with the row
          gone it stands on the #E8F1FF tint at 4.25:1, under AA. */}
      {jiraTicket === 'error' ? (
        <div className={cn(rowBase, 'font-medium', textColors.secondary)}>
          <ChatIcon className={channelMark} />
          협업 채널 정보를 불러오지 못했어요
        </div>
      ) : jiraTicket === null ? (
        <div className={cn(rowBase, 'font-medium', textColors.secondary)}>
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
                ⛔ `textOnLight`, never `text`. Measured: #0064FF is 4.33:1 on #E8F1FF, under
                AA at 14px; #0050D6 is 5.92:1. The white row this key used to sit on was what
                made the brighter blue legal, and that row is gone. */}
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
          <RailEntry
            icon={<GuideIcon className="h-5 w-5" />}
            label="가이드"
            hint="가이드 — 이 단계의 안내 펼치기"
            onClick={toggle}
          />
        </div>
      )}

      {/* Open. A flex column of its own, so every zone below still measures against the
          rail's height exactly as it did when these were the aside's own children. */}
      {collapsed !== true && (
        <div className={cn(bodyShown, 'min-h-0 flex-1 flex-col')}>
          {/* TWO zones, not three. The fold control used to hold a band of its own — 48px
              and a seam spent on one 32px button — which read as a third axis beside 협업
              채널 and 가이드 (오너 지시 2026-08-23). It rides this band's title line now,
              and the card's tint came out here with it: full-bleed, so the control sits on
              a REGION of the panel instead of inside a discrete card.

              The channel is still first. It is the escape hatch for every step, so it holds
              the top of the rail and the guide scrolls underneath it. */}
          <div
            className={cn(
              'shrink-0 border-b px-4 py-3.5',
              primaryColors.bgLight,
              borderColors.light,
            )}
          >
            <CollabChannelCard jiraTicket={jiraTicket} onCollapse={toggle} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {slotKey ? (
              <GuideCardContainer slotKey={slotKey} bare />
            ) : (
              <p className={cn('py-4 text-center text-[12px]', textColors.tertiary)}>
                이 단계에는 표시할 가이드가 없습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
