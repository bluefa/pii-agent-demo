'use client';

import { useState, type CSSProperties } from 'react';

import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { ChatIcon, OpenExternalIcon, ShieldCheckIcon } from '@/app/components/ui/icons';
import { DeleteInfrastructureButton } from '@/app/target-sources/[targetSourceId]/_components/common/DeleteInfrastructureButton';
import {
  bgColors,
  borderColors,
  cn,
  identityBarStyles,
  interactiveColors,
  primaryColors,
  segmentedControlStyles,
  statusColors,
  textColors,
} from '@/lib/theme';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';

type PanelTab = 'guide' | 'history';

/**
 * Collab-channel ticket state for the rail card, resolved server-side
 * (page.tsx): 'error' on non-404 failures, null = no ticket mapped (API 404).
 */
export type JiraTicketState = { issueKey: string } | null | 'error';

/**
 * Jira base URL for ticket links — the wire (JiraTicketResponse) carries only
 * `issueKey`, no URL. Deployment overrides via NEXT_PUBLIC_JIRA_BROWSE_BASE;
 * the fallback keeps the key navigable in mock/demo (owner ask: the issue key
 * must render as a clickable link).
 */
const JIRA_BROWSE_BASE =
  process.env.NEXT_PUBLIC_JIRA_BROWSE_BASE ?? 'https://jira.example.com/browse/';

/**
 * Top-of-rail help card — the collab-channel entry point, mirroring
 * GET /target-sources/{id}/jira-ticket: mapped ticket → Jira link row (or a
 * plain key row when no Jira base URL is configured); 404 → explicit 미연결
 * row instead of a fake sample key; fetch error → its own row, so an outage
 * is not misread as "no channel".
 */
const CollabChannelCard = ({ jiraTicket }: { jiraTicket: JiraTicketState }) => {
  const rowBase = 'mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]';

  return (
    <div className={cn('rounded-xl border p-4', primaryColors.bgLight, primaryColors.borderLight)}>
      <p className={cn('text-[16px] font-bold leading-[1.4]', textColors.primary)}>
        도움이 필요하신가요?
      </p>
      <p className={cn('mt-1 text-[12px] leading-[1.55]', textColors.tertiary)}>
        진행 중 막히는 부분은 협업 채널에서 담당자에게 바로 문의할 수 있어요.
      </p>
      {jiraTicket === 'error' ? (
        <div
          className={cn(
            rowBase,
            'border-dashed font-medium',
            primaryColors.borderLight,
            bgColors.surface,
            textColors.quaternary,
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
            textColors.quaternary,
          )}
        >
          <ChatIcon className="h-3.5 w-3.5 shrink-0" />
          아직 연결된 협업 채널이 없어요
        </div>
      ) : (
        <a
          href={`${JIRA_BROWSE_BASE}${encodeURIComponent(jiraTicket.issueKey)}`}
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
          <p className={cn('mt-1 text-[11px]', textColors.quaternary)}>{item.at}</p>
        </div>
      </li>
    ))}
  </ol>
);

interface GuidePanelProps {
  slotKey: GuideSlotKey | null;
  jiraTicket: JiraTicketState;
  /** Monitoring-method pill in the management footer (e.g. "AWS Agent", "SDU"). */
  monitoringLabel: string;
  /** Provider accent hex driving the pill tint (see `providerAccent`). */
  monitoringAccent: string;
}

/**
 * Full-height right rail for the step screens — mirrors the left ServiceListPanel:
 * flat surface, left border, [가이드 | 진행 내역] tab header, scrollable body,
 * bottom pager on the history tab. Deliberately quiet (auxiliary) chrome so the
 * working column keeps the visual weight. Replaces the inline amber guide card
 * (UX report P2/P3).
 */
export const GuidePanel = ({
  slotKey,
  jiraTicket,
  monitoringLabel,
  monitoringAccent,
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
      aria-label="단계 가이드 및 진행 내역"
      className={cn(
        'hidden w-[320px] shrink-0 flex-col border-l min-[1360px]:flex',
        borderColors.light,
        bgColors.surface,
      )}
    >
      {/* Monitoring method leads the rail (owner ask) — identity-level fact,
          read before any step work. */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3',
          borderColors.light,
        )}
      >
        <span className={cn('text-[12px] font-medium', textColors.tertiary)}>모니터링</span>
        <span
          className={identityBarStyles.agent}
          style={{ ['--ib-accent']: monitoringAccent } as CSSProperties}
        >
          <ShieldCheckIcon className={identityBarStyles.agentIcon} />
          {monitoringLabel}
        </span>
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
            <p className={cn('py-4 text-center text-[12.5px]', textColors.tertiary)}>
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
          <span className={cn('text-[11.5px] tabular-nums', textColors.quaternary)}>
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

      {/* Danger zone — the destructive infra action stays pinned to the rail's
          bottom edge across both tabs: one predictable, visually isolated spot
          instead of competing with the page header's primary CTA. */}
      <div className={cn('shrink-0 border-t p-4', borderColors.light)}>
        <DeleteInfrastructureButton className="w-full justify-center" />
      </div>
    </aside>
  );
};
