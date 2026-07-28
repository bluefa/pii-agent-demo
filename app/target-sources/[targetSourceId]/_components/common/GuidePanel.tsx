'use client';

import { useState } from 'react';

import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  primaryColors,
  segmentedControlStyles,
  statusColors,
  textColors,
} from '@/lib/theme';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';

type PanelTab = 'guide' | 'history';

const JIRA_KEY_PATTERN = /\/browse\/([A-Z][A-Z0-9]+-\d+)/;

/** v16 sample collab-channel ticket key, used when the project has no real Jira link yet. */
const COLLAB_CHANNEL_FALLBACK = 'BDCDIP-1353';

/**
 * Rail-footer help card — the collab-channel entry point, moved out of the page
 * header's action slot so the header keeps a single primary action and help
 * lives with the rest of the auxiliary rail content.
 */
const CollabChannelCard = ({ jiraLink }: { jiraLink?: string | null }) => {
  const ticket = jiraLink?.match(JIRA_KEY_PATTERN)?.[1] ?? COLLAB_CHANNEL_FALLBACK;

  return (
    <div className={cn('rounded-xl p-4', bgColors.muted)}>
      <p className={cn('text-[13px] font-bold leading-[1.4]', textColors.primary)}>
        도움이 필요하신가요?
      </p>
      <p className={cn('mt-1 text-[12px] leading-[1.55]', textColors.tertiary)}>
        진행 중 막히는 부분은 협업 채널에서 담당자에게 바로 문의할 수 있어요.
      </p>
      <a
        href={jiraLink ?? '#'}
        target={jiraLink ? '_blank' : undefined}
        rel={jiraLink ? 'noopener noreferrer' : undefined}
        title="협업 채널 — Jira에서 논의하기"
        className={cn(
          'mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold no-underline transition-colors',
          borderColors.light,
          bgColors.surface,
          textColors.secondary,
          primaryColors.textHover,
        )}
      >
        <svg
          className="shrink-0"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        협업 채널 링크
        <span className={cn('ml-auto font-mono text-[12px]', textColors.quaternary)}>{ticket}</span>
        <svg
          className="shrink-0 opacity-50"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 17L17 7" />
          <polyline points="9 7 17 7 17 15" />
        </svg>
      </a>
    </div>
  );
};

// ponytail: 진행 내역 API가 아직 없어 하드코딩 mock — 이력 데이터 소스가 생기면 교체.
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
  /** Jira ticket URL for the collab-channel card; falls back to the v16 sample key. */
  jiraLink?: string | null;
}

/**
 * Full-height right rail for the step screens — mirrors the left ServiceListPanel:
 * flat surface, left border, [가이드 | 진행 내역] tab header, scrollable body,
 * bottom pager on the history tab. Deliberately quiet (auxiliary) chrome so the
 * working column keeps the visual weight. Replaces the inline amber guide card
 * (UX report P2/P3).
 */
export const GuidePanel = ({ slotKey, jiraLink }: GuidePanelProps) => {
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

      <div className={cn('shrink-0 border-t p-4', borderColors.light)}>
        <CollabChannelCard jiraLink={jiraLink} />
      </div>
    </aside>
  );
};
