'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getApprovalRequestLatest,
  type ApprovalRequestLatestResponse,
} from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import { formatDate } from '@/lib/utils/date';
import { ChevronDownIcon } from '@/app/components/ui/icons';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  WaitingApprovalStats,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { WaitingApprovalReselectButton } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalReselectButton';
import { ApprovalUnavailableCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApprovalUnavailableCard';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  ErrorRow,
  ResourceTableSkeleton,
} from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import {
  bgColors,
  borderColors,
  cardStyles,
  cn,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

interface WaitingApprovalCardProps {
  targetSourceId: number;
  cancelSlot?: ReactNode;
  reselectSlot?: ReactNode;
  // Called after the integration-unavailable verdict is acknowledged (go-back → Step 1)
  // so the parent re-fetches the project and re-renders the new step.
  onReselected?: () => Promise<void> | void;
}

// The admin's answer to the request. Both verdicts come from approval-requests/latest.result —
// the project payload has no rejection fields, so this response is the only source for either.
type Verdict =
  | { kind: 'unavailable'; reason: string }
  | { kind: 'rejected'; reason: string; processedAt: string; processedBy: string };

const toVerdict = (response: ApprovalRequestLatestResponse): Verdict | null => {
  const result = response.result;
  if (result?.status === 'UNAVAILABLE') return { kind: 'unavailable', reason: result.reason ?? '' };
  if (result?.status === 'REJECTED') {
    return {
      kind: 'rejected',
      reason: result.reason ?? '',
      processedAt: result.processed_at ?? '',
      processedBy: result.processed_by?.user_id ?? '',
    };
  }
  return null;
};

const FETCH_ERROR_MESSAGE = '승인 요청 정보를 불러오지 못했습니다.';
const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

// Step 2 sources its table from approval-requests/latest.resources (which the BFF
// already returns alongside the request meta), split by `selected` — so the separate
// approved-integration GET is no longer needed here (that endpoint stays on step 3).
type LatestResourceItem = NonNullable<ApprovalRequestLatestResponse['resources']>[number];

const toResourceRow = (item: LatestResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  resourceType: item.resource_type ?? item.metadata?.database_type ?? '',
  region: item.metadata?.region ?? '',
  resourceName: item.resource_name ?? '',
  selected: item.selected ?? false,
  displayDbType: item.metadata?.database_type ?? item.resource_type ?? undefined,
  exclusionReason: item.exclusion_reason ?? undefined,
});

interface RequestSummary {
  requestedAt: string;
  requestedBy: string;
}

const toRequestSummary = (response: ApprovalRequestLatestResponse): RequestSummary | null => {
  const requestedAt = response.request?.requested_at;
  const requestedBy = response.request?.requested_by?.user_id;
  if (!requestedAt || !requestedBy) return null;
  return { requestedAt, requestedBy };
};

export const WaitingApprovalCard = ({
  targetSourceId,
  cancelSlot,
  reselectSlot,
  onReselected,
}: WaitingApprovalCardProps) => {
  const [state, setState] = useState<AsyncState<WaitingApprovalResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);
  const [requestSummary, setRequestSummary] = useState<RequestSummary | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void getApprovalRequestLatest(targetSourceId, { signal: controller.signal })
      .then((response) => {
        const rows = (response.resources ?? []).map(toResourceRow);
        setState({ status: 'ready', data: rows });
        setRequestSummary(toRequestSummary(response));
        setVerdict(toVerdict(response));
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (error instanceof AppError && error.code === 'NOT_FOUND') {
          setState({ status: 'ready', data: [] });
          setRequestSummary(null);
          setVerdict(null);
          return;
        }
        setState({ status: 'error', message: FETCH_ERROR_MESSAGE });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  const resources = useMemo<readonly WaitingApprovalResource[]>(
    () => (state.status === 'ready' ? state.data : []),
    [state],
  );

  const table = useApprovalTableState(resources);

  const showFilterEmpty =
    state.status === 'ready' && resources.length > 0 && table.filteredCount === 0;

  // Integration-unavailable verdict — replace the whole waiting card with the distinct
  // unavailable notice + go-back action (the normal table / cancel no longer apply).
  if (state.status === 'ready' && verdict?.kind === 'unavailable') {
    return (
      <ApprovalUnavailableCard
        targetSourceId={targetSourceId}
        reason={verdict.reason}
        onReselected={onReselected}
      />
    );
  }

  // Rejected keeps the table: the reason names a resource ("RDS_CLUSTER …"), so the list of what
  // was requested is what the user needs to act on. Only the header switches state.
  const rejected = verdict?.kind === 'rejected' ? verdict : null;
  const resolved = state.status === 'ready';

  // Labelled MetaField pairs, not a bare "누가 · 언제" byline: an unlabelled line leaves the reader
  // to infer which date it is (반려일시? 요청일시?) on a screen that carries both. Two fields at
  // 32px is the pending header's row — safe stacked, unlike the five-field record row below.
  const verdictMeta = rejected && (
    <div className="flex flex-wrap gap-8">
      {rejected.processedAt && (
        <MetaField label="반려일시" value={formatDate(rejected.processedAt, 'datetime')} />
      )}
      {rejected.processedBy && <MetaField label="처리자" value={rejected.processedBy} />}
    </div>
  );

  const reselect = (
    <WaitingApprovalReselectButton
      targetSourceId={targetSourceId}
      onSuccess={() => onReselected?.()}
    />
  );

  // Same list in both states — pending shows it outright, rejected tucks it behind a disclosure.
  const listBlock = (
    <>
      <WaitingApprovalStats
        totalCount={table.countsByFilter.all}
        selectedCount={table.countsByFilter.target}
        excludedCount={table.countsByFilter.excluded}
        filter={table.filter}
        onFilterChange={table.onFilterChange}
      />
      {/* Toolbar (top-rounded) + table + pagination (bottom-rounded) join as one card, no gaps. */}
      <WaitingApprovalToolbar
        searchValue={table.searchValue}
        onSearchChange={table.onSearchChange}
        dbType={table.dbType}
        onDbTypeChange={table.onDbTypeChange}
        region={table.region}
        onRegionChange={table.onRegionChange}
        dbTypeOptions={table.dbTypeOptions}
        regionOptions={table.regionOptions}
      />
      <WaitingApprovalTable
        resources={table.visibleResources}
        connected
        emptyMessage={showFilterEmpty ? FILTER_EMPTY_MESSAGE : undefined}
      />
      {table.filteredCount > 0 && (
        <Pagination
          page={table.safePage}
          pageSize={table.pageSize}
          totalCount={table.filteredCount}
          onPageChange={table.onPageChange}
          onPageSizeChange={table.onPageSizeChange}
        />
      )}
    </>
  );

  return (
    // No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar.
    <section className={cardStyles.base}>
      {/* Left-aligned single stack: title + status, guidance copy, request meta.
          Secondary tiers differ by weight and color, not by a new font size. */}
      <div className={cardStyles.header}>
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* Step position, matching INSTALL_STEPS order in InstallationProcessProgressBar. */}
            <span
              className={cn(
                'mb-1.5 inline-flex items-center rounded-[6px] px-2 py-0.5 text-[12px] font-bold',
                primaryColors.bgLight,
                primaryColors.textOnLight,
              )}
            >
              2번째 단계
            </span>
            <div className="flex items-center gap-2">
            {/* The verdict arrives with the fetch, so title and badge stay unresolved until then —
                rendering the pending copy first makes every rejected load flash 승인 대기 → 반려. */}
            {resolved ? (
              <>
                {/* Fixed step name, matching the progress bar — the badge alone carries state. */}
                <h2 className={cn(cardStyles.cardTitle)}>연동 대상 승인 대기</h2>
                <span
                  className={cn(
                    'inline-flex items-center font-medium',
                    // Rejected matches the 반려 사유 tag in the quote below, so the two marks read
                    // as one pair on this screen; pending keeps the rounded-full state badge.
                    rejected
                      ? 'rounded-md px-1.5 py-0.5 text-[12px]'
                      : 'rounded-full px-2.5 py-1 text-xs',
                    statusColors.warning.bg,
                    statusColors.warning.textDark,
                  )}
                >
                  {rejected ? '반려' : '승인 대기'}
                </span>
              </>
            ) : (
              <>
                <div className={cn(idcStyles.skeletonBar, 'h-[26px] w-[220px] rounded-[6px]')} />
                <div className={cn(idcStyles.skeletonBar, 'h-[26px] w-[68px] rounded-full')} />
              </>
            )}
            </div>
          </div>
          {/* Card CTA sits beside the title — in the bottom dock the user only meets it past the whole table.
              Rejected renders NO corner button: its single primary action lives in the verdict block
              below, where the reading flow ends (one screen, one primary CTA). */}
          {!resolved || rejected ? null : cancelSlot}
        </div>
        {/* Blue marks the status sentence only; the rest drops to the secondary tone.
            `cn` is a plain join, so stacking a size over the subtitle token leaves the winner to CSS
            order — declare the size here instead. */}
        {!resolved ? (
          <div className="mt-3 flex flex-col gap-2">
            <div className={cn(idcStyles.skeletonBar, 'h-4 w-[420px] rounded')} />
            <div className={cn(idcStyles.skeletonBar, 'h-4 w-[300px] rounded')} />
          </div>
        ) : rejected ? (
          // The reason used to sit in a tinted well. A filled, rounded block at the card's own
          // inner width reads as a second card rather than a subsection, and its meta+action
          // footer made a third nesting level — so the block floated instead of belonging.
          // It becomes a quote instead: the admin's words hang off a 3px rule, no fill, no box.
          // role="status" because the verdict only resolves after the fetch.
          <div className="mt-4" role="status">
            {rejected.reason ? (
              // #EA580C, not the well's orange-50 fill: the same state now costs ~800px² of hue
              // instead of ~99,000px², and 3.56:1 on white clears the 3:1 non-text floor
              // (orange-500 is 2.80:1 and would not).
              <div className="border-l-[3px] border-[#EA580C] pl-4">
                {/* A tag, not a heading. The old label was 16px semibold over a 14px reason — it
                    outsized the very thing it labelled, which is what flattened the hierarchy.
                    12px keeps it below its payload while still naming the block. */}
                <p
                  className={cn(
                    'text-[12px] font-bold tracking-[0.02em]',
                    statusColors.warning.textDark,
                  )}
                >
                  반려 사유
                </p>
                {/* The payload is now the largest text in the block and, after the title, the
                    darkest tone on the card — it stops being the smallest thing on the screen. */}
                <p
                  className={cn(
                    'mt-1.5 text-[17px] font-semibold leading-[1.5]',
                    textColors.primary,
                  )}
                >
                  {rejected.reason}
                </p>
                {/* Signature row: verdict meta left, the one way out right. Keeping the exit
                    inside the rule makes the verdict a self-contained unit — a standalone button
                    under it read as a second block, which is what the well was doing wrong. */}
                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                  {verdictMeta}
                  {reselect}
                </div>
              </div>
            ) : (
              // No reason → nothing to quote, so the sentence carries the verdict on its own.
              <>
                <p className={cn('text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
                  관리자가 승인 요청을 반려했어요. 연동 대상을 다시 선택한 뒤 승인을 다시
                  요청해주세요.
                </p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                  {verdictMeta}
                  {reselect}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <p className={cn('mt-3 text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
              <strong className={cn('font-semibold', primaryColors.text)}>
                관리자 승인을 기다리고 있어요.
              </strong>{' '}
              평균 1영업일 내 검토되며, 결과는 이 화면에서 확인할 수 있어요.
            </p>
            {/* mt 없음 — 행간 여백(leading 1.55)만으로 문단을 가른다 (기존 mt-1에서 −4px). */}
            <p className={cn('text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
              연동 대상을 다시 고르고 싶다면 우측 상단{' '}
              <strong className={cn('font-semibold', textColors.secondary)}>다시 요청하기</strong>를
              눌러주세요.
            </p>
          </>
        )}
        {requestSummary && !rejected && (
          // Label over value, one row. This tier sits well below the guidance copy, so it
          // declares 12px + muted color instead of identityBarStyles (13px, near-black), which the
          // page-level identity bar keeps. 24px above it — the widest gap in the header, marking
          // the boundary between "what happened / what to do" and reference facts.
          // Rejected does not repeat it here: the submission meta moves into the record block's
          // summary line below, where it belongs to the list it describes.
          <div className="mt-6 flex flex-wrap gap-8">
            <MetaField label="요청일시" value={formatDate(requestSummary.requestedAt, 'datetime')} />
            <MetaField label="요청자" value={requestSummary.requestedBy} />
          </div>
        )}
      </div>

      {/* No body top padding, so the header's 12px bottom padding IS the meta-to-table gap. */}
      <div className="px-6 pb-6">
        {state.status === 'loading' ? (
          <ResourceTableSkeleton />
        ) : state.status === 'error' ? (
          <ErrorRow message={state.message} onRetry={handleRetry} />
        ) : rejected ? (
          // A closed request's targets are a record, not a worklist: the verdict is already made,
          // so leading with tiles-as-filters + search + a 9-row table put ~800px of interactive-
          // looking surface after the one decision the screen asks for. It collapses instead —
          // native <details>, so no state to hold — and the summary line answers what the list
          // would have been scanned for anyway: how many, from whom, when.
          // mx-1: the body runs at px-6 while the header runs at px-[28px]. The bordered tiles
          // hid that 4px, but this block opens with plain text directly under the header's, so
          // the two text edges have to line up.
          <details className={cn('group mx-1 mt-4 border-t pt-4', borderColors.light)}>
            {/* Three tiers, one per line: what this block is (14/600), the reference facts
                (MetaField, 12), and the way in (brand blue). Counts and request meta share one
                MetaField row because they are the same kind of fact — a number you read off,
                not copy the pending header's grammar for one half and invent another for the
                other half. */}
            <summary className="flex cursor-pointer list-none flex-col gap-2.5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-4">
                <span className={cn('text-[14px] font-semibold', textColors.secondary)}>
                  이 요청에 포함된 연동 대상
                </span>
                {/* Blue: this is the only action in the block, and the neutral gray it used to
                    carry read as another label rather than something to click. */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[13px] font-semibold',
                    primaryColors.text,
                  )}
                >
                  <span className="group-open:hidden">목록 보기</span>
                  <span className="hidden group-open:inline">접기</span>
                  <ChevronDownIcon className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </span>
              </div>
              {/* Inline pairs, not stacked: five stacked label-over-value columns in one row read
                  as a run — "요청자 / 관리자 / 요청일시 / …" binds the wrong way. Beside its value,
                  each label owns exactly one thing. The two kinds are then split by a rule rather
                  than by gap alone. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* Dropped once open: the stat tiles below carry the same three numbers, and
                    showing them twice is what made the old screen read as duplicated. */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 group-open:hidden">
                  <MetaField inline label="전체" value={`${table.countsByFilter.all}건`} />
                  <MetaField inline label="연동 대상" value={`${table.countsByFilter.target}건`} />
                  <MetaField inline label="제외" value={`${table.countsByFilter.excluded}건`} />
                </div>
                {requestSummary && (
                  <>
                    <span
                      aria-hidden
                      className={cn('h-3 w-px shrink-0 group-open:hidden', bgColors.divider)}
                    />
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      <MetaField inline label="요청자" value={requestSummary.requestedBy} />
                      <MetaField
                        inline
                        label="요청일시"
                        value={formatDate(requestSummary.requestedAt, 'datetime')}
                      />
                    </div>
                  </>
                )}
              </div>
            </summary>
            <div className="mt-4">{listBlock}</div>
          </details>
        ) : (
          <div className="mt-4">{listBlock}</div>
        )}
      </div>
      {/* C-2 action zone: reselect dock (sticky) at the card bottom. cancelSlot moved to the header. */}
      {reselectSlot && <CardActionBar>{reselectSlot}</CardActionBar>}
    </section>
  );
};
