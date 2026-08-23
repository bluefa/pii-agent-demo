'use client';

import { useState } from 'react';

import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { ChatIcon, GuideIcon, OpenExternalIcon } from '@/app/components/ui/icons';
import {
  RailEntry,
  RailToggle,
  RAIL_OPEN_MIN_WIDTH,
  useRailCollapse,
} from '@/app/components/ui/RailCollapse';
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  primaryColors,
  railStyles,
  segmentedControlStyles,
  statusColors,
  textColors,
} from '@/lib/theme';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import { safeBrowseUrl } from '@/lib/jira-ticket';

type PanelTab = 'guide' | 'history';

/**
 * Versioned, and NOT keyed by target source: how much of the screen a reader wants
 * spent on help is a workspace preference, not a fact about one resource. Bump the
 * version if the stored shape ever stops being `'1' | '0'`.
 */
const GUIDE_RAIL_STORAGE_KEY = 'pii:rail:v1:guide';

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

// ponytail: no history API exists yet, so this is a hardcoded mock — swap in
// the real data source when one lands.
const MOCK_HISTORY: ReadonlyArray<{
  title: string;
  detail: string;
  at: string;
  tone: keyof typeof statusColors;
}> = [
  { title: '관리자 승인 완료', detail: '승인자 김보안(kim.security)', at: '2024-01-19 오후 06:00', tone: 'success' },
  { title: '연동 대상 승인 요청', detail: '전체 3건 · 대상 2 · 비대상 1', at: '2024-01-18 오후 08:00', tone: 'info' },
  { title: '연동 대상 승인 반려', detail: '사유: 스테이징 DB는 제외하고 다시 요청해 주세요', at: '2024-01-17 오전 09:12', tone: 'error' },
  { title: '연동 대상 승인 요청', detail: '전체 4건 · 대상 3 · 비대상 1', at: '2024-01-16 오후 05:40', tone: 'info' },
  { title: 'Infra Scan 완료', detail: 'DB 리소스 10건 조회', at: '2024-01-15 오후 02:30', tone: 'pending' },
  { title: 'Infra Scan 실행', detail: '요청자 관리자', at: '2024-01-15 오후 02:26', tone: 'pending' },
  { title: 'DB Credential 등록', detail: 'Key2 (RDS 접근용)', at: '2024-01-15 오전 11:02', tone: 'info' },
  { title: 'Infra Scan 실패', detail: '사유: IAM Role 권한 부족 — 재시도됨', at: '2024-01-14 오후 07:18', tone: 'error' },
  { title: 'TF 실행 권한 확인', detail: 'AssumeRole 검증 통과', at: '2024-01-14 오후 07:02', tone: 'success' },
  { title: '협업 채널 연결', detail: 'BDCDIP-1353', at: '2024-01-14 오후 06:55', tone: 'pending' },
  { title: '인프라 등록', detail: 'AWS Account 123456789012', at: '2024-01-14 오후 06:50', tone: 'info' },
  { title: '연동 프로세스 시작', detail: '요청자 관리자', at: '2024-01-14 오후 06:48', tone: 'pending' },
];

const HISTORY_PAGE_SIZE = 5;

const HistoryTimeline = ({ items }: { items: typeof MOCK_HISTORY }) => (
  <ol>
    {items.map((item, index) => (
      <li key={item.at} className="relative flex gap-3 pb-5 last:pb-0">
        {index < items.length - 1 && (
          <span
            aria-hidden
            className={cn('absolute left-[3.5px] top-4 bottom-0 w-px', bgColors.divider)}
          />
        )}
        <span
          className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', statusColors[item.tone].dot)}
        />
        <div className="min-w-0">
          <p className={cn('text-[12.5px] font-semibold leading-[1.4]', textColors.secondary)}>
            {item.title}
          </p>
          <p className={cn('mt-0.5 text-[12px] leading-[1.5]', textColors.tertiary)}>
            {item.detail}
          </p>
          <p className={cn('mt-1 text-[11px]', textColors.tertiary)}>{item.at}</p>
        </div>
      </li>
    ))}
  </ol>
);

interface GuidePanelProps {
  slotKey: GuideSlotKey | null;
  jiraTicket: JiraTicketState;
}

/**
 * Full-height right rail for the step screens — mirrors the left ServiceListPanel:
 * flat surface, left border, [가이드 | 진행 내역] tab header, scrollable body,
 * bottom pager on the history tab. Deliberately quiet (auxiliary) chrome so the
 * working column keeps the visual weight. Replaces the inline amber guide card
 * (UX report P2/P3).
 *
 * The rail FOLDS; it no longer vanishes. It used to be `hidden … min-[1360px]:flex`,
 * which made the viewport decide whether it existed — and since this file was the only
 * render site for the guide, the history and the Jira channel, all three were
 * unreachable below 1360px, out of the accessibility tree and out of the tab
 * order, with no control anywhere that brought them back. 1360 survives as the
 * DEFAULT (`RAIL_OPEN_MIN_WIDTH`), and a press outranks it at every width.
 *
 * ⛔ Nothing destructive belongs on this rail. It is an auxiliary panel that folds
 * away on request, so the only copy of an irreversible action placed here would go
 * with it — exactly the defect above. Keep such an action on the content column.
 */
export const GuidePanel = ({
  slotKey,
  jiraTicket,
}: GuidePanelProps) => {
  const [tab, setTab] = useState<PanelTab>('guide');
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil(MOCK_HISTORY.length / HISTORY_PAGE_SIZE);
  const pageItems = MOCK_HISTORY.slice(
    page * HISTORY_PAGE_SIZE,
    (page + 1) * HISTORY_PAGE_SIZE,
  );

  const selectTab = (next: PanelTab) => {
    setTab(next);
    setPage(0);
  };

  const { collapsed, toggle } = useRailCollapse(GUIDE_RAIL_STORAGE_KEY, RAIL_OPEN_MIN_WIDTH);

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

  // The label promises 가이드, so the press has to deliver 가이드 — unfolding straight
  // back onto 진행 내역 because that is where the reader happened to be when they folded
  // would make the strip's one word a lie.
  const openGuide = () => {
    selectTab('guide');
    toggle();
  };

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

  const tabClass = (active: boolean) =>
    cn(
      segmentedControlStyles.item,
      'flex-1 justify-center',
      active && segmentedControlStyles.itemActive,
    );

  const pagerBtnClass = cn(
    'rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
    interactiveColors.underlineTab,
    'disabled:cursor-default disabled:opacity-40',
  );

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
          cannot: what panel is this, and is the collab channel still there. Chevron first
          (the size control), hairline, then the entries — the guide at the top, which is
          the order Cloudscape fixes for its own trigger bar: help always first. */}
      {collapsed !== false && (
        <div className={cn(stripShown, railStyles.strip)}>
          <RailToggle direction="left" label="가이드 펼치기" onClick={toggle} />
          <span aria-hidden className={railStyles.divider} />
          <RailEntry
            icon={<GuideIcon className="h-5 w-5" />}
            label="가이드"
            hint="가이드 — 단계 가이드와 진행 내역 펼치기"
            onClick={openGuide}
          />
          <RailEntry
            icon={<ChatIcon className="h-5 w-5" />}
            label="채널"
            hint={collab.hint}
            dot={collab.dot}
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

        <div className={cn('shrink-0 border-b p-3', borderColors.light)}>
          <div role="tablist" className={cn(segmentedControlStyles.container, 'w-full')}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'guide'}
              onClick={() => selectTab('guide')}
              className={tabClass(tab === 'guide')}
            >
              가이드
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              onClick={() => selectTab('history')}
              className={tabClass(tab === 'history')}
            >
              진행 내역
            </button>
          </div>
        </div>

        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'guide' ? (
            slotKey ? (
              <GuideCardContainer slotKey={slotKey} bare />
            ) : (
              /* 12, not 12.5 — the even-px rule. Only touched because wrapping the rail
                 body re-indented this line and the design hook judges changed lines. */
              <p className={cn('py-4 text-center text-[12px]', textColors.tertiary)}>
                이 단계에는 표시할 가이드가 없습니다.
              </p>
            )
          ) : (
            <HistoryTimeline items={pageItems} />
          )}
        </div>

        {tab === 'history' && pageCount > 1 && (
          <div
            className={cn(
              'flex shrink-0 items-center justify-between border-t px-4 py-2.5',
              borderColors.light,
            )}
          >
            <button
              type="button"
              className={pagerBtnClass}
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹ 이전
            </button>
            {/* 12, not 11.5 — same reason as the empty-state line above. */}
            <span className={cn('text-[12px] tabular-nums', textColors.tertiary)}>
              {page + 1} / {pageCount}
            </span>
            <button
              type="button"
              className={pagerBtnClass}
              disabled={page === pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              다음 ›
            </button>
          </div>
        )}
        </div>
      )}
    </aside>
  );
};
