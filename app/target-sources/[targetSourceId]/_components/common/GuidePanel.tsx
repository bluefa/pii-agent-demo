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
const CollabChannelCard = ({ jiraTicket }: { jiraTicket: JiraTicketState }) => {
  const rowBase = 'mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]';
  const href =
    jiraTicket && jiraTicket !== 'error' ? safeBrowseUrl(jiraTicket.browseUrl) : null;

  return (
    <div className={cn('rounded-xl border p-4', primaryColors.bgLight, primaryColors.borderLight)}>
      <p className={cn('text-[16px] font-bold leading-[1.4]', textColors.primary)}>
        도움이 필요하신가요?
      </p>
      {/* secondary, not tertiary: gray-500 is calibrated against white (4.83:1) and drops
          to 4.25:1 on the primary tint — under AA at this size. gray-700 holds 9.06:1. */}
      <p className={cn('mt-1 text-[12px] leading-[1.55]', textColors.secondary)}>
        진행 중 막히는 부분은 협업 채널에서 담당자에게 바로 문의할 수 있어요.
      </p>
      {jiraTicket === 'error' ? (
        <div
          className={cn(
            rowBase,
            'border-dashed font-medium',
            primaryColors.borderLight,
            bgColors.surface,
            textColors.tertiary,
          )}
        >
          <ChatIcon className="h-3.5 w-3.5 shrink-0" />
          협업 채널 정보를 불러오지 못했어요
        </div>
      ) : jiraTicket === null ? (
        <div
          className={cn(
            rowBase,
            'border-dashed font-medium',
            primaryColors.borderLight,
            bgColors.surface,
            textColors.tertiary,
          )}
        >
          <ChatIcon className="h-3.5 w-3.5 shrink-0" />
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
            'font-semibold no-underline transition-colors',
            primaryColors.borderLight,
            bgColors.surface,
            textColors.secondary,
            primaryColors.textHover,
          )}
        >
          <ChatIcon className="h-3.5 w-3.5 shrink-0" />
          협업 채널 링크
          {/* Owner ask: the issue key reads as a classic hyperlink — blue + underline. */}
          <span className={cn('ml-auto font-mono text-[12px] underline', primaryColors.text)}>
            {jiraTicket.issueKey}
          </span>
          <OpenExternalIcon className="h-[11px] w-[11px] shrink-0 opacity-50" />
        </a>
      ) : (
        // browseUrl 이 없으면(또는 http 가 아니면) 링크를 지어내지 않고 키만 보여준다.
        <div
          className={cn(
            rowBase,
            'font-semibold',
            primaryColors.borderLight,
            bgColors.surface,
            textColors.secondary,
          )}
        >
          <ChatIcon className="h-3.5 w-3.5 shrink-0" />
          협업 채널
          <span className={cn('ml-auto font-mono text-[12px]', textColors.secondary)}>
            {jiraTicket.issueKey}
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
          collab card sits above the tabs when the rail is open, and a strip that reordered
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
          {/* The fold control sits on the rail's INNER edge at the top — the same x and y
              the strip's button occupies, so the pointer does not have to move between the
              two states. */}
          <div className={cn('flex shrink-0 items-center border-b p-2', borderColors.light)}>
            <RailToggle direction="right" label="가이드 접기" onClick={toggle} />
          </div>

        {/* Jira ticket next — the collab channel is the escape hatch for every
            step, so it stays above the fold. */}
        <div className={cn('shrink-0 border-b p-4', borderColors.light)}>
          <CollabChannelCard jiraTicket={jiraTicket} />
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
