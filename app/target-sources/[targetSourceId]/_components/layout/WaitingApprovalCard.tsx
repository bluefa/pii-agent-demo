'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getApprovalRequestLatest,
  type ApprovalRequestLatestResponse,
} from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import { readRdsInstanceMetadata } from '@/lib/rds-instances';
import { formatDate } from '@/lib/utils/date';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  WaitingApprovalStats,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import {
  useApprovalColumnResize,
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { WaitingApprovalReselectButton } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalReselectButton';
import { ApprovalUnavailableCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApprovalUnavailableCard';
import { RejectionVerdict } from '@/app/target-sources/[targetSourceId]/_components/layout/RejectionVerdict';
import { RejectedTargetRecord } from '@/app/target-sources/[targetSourceId]/_components/layout/RejectedTargetRecord';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  ErrorRow,
  ResourceTableSkeleton,
} from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import {
  cardStyles,
  cn,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';

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
  integrationCategory: item.integration_category ?? undefined,
  recommendFailReason: item.recommend_fail_reason ?? undefined,
  // Top-level type, no metadata fallback: this drives the RDS Cluster tag, and
  // `resourceType` above falls back to an engine name.
  declaredResourceType: item.resource_type ?? undefined,
  // An RDS cluster lists its member instances under the row and marks the one the agent
  // connects through. Any other resource gets neither key back and is unchanged.
  ...readRdsInstanceMetadata(item.metadata, item.resource_type),
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
  const { locale } = useLocale();
  const copy = LAYOUT_COPY[locale];
  const t = copy.waiting;
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
        setState({ status: 'error', message: t.fetchError });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce, t.fetchError]);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  const resources = useMemo<readonly WaitingApprovalResource[]>(
    () => (state.status === 'ready' ? state.data : []),
    [state],
  );

  const table = useApprovalTableState(resources);
  // Drag-resizable column widths, shared with step 3's applying card — see the hook.
  const columns = useApprovalColumnResize();

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
        raisedRows
        emptyMessage={showFilterEmpty ? copy.common.filterEmpty : undefined}
        // Any narrowing opens the groups. Closed by default, a search that matched only a
        // database inside one drew a shut group and none of the text that was typed.
        //
        // The 대상/제외 tiles are in the expression because `groupResourceRows` re-groups the
        // FILTERED rows: under 연동 대상 a three-database group prints "Database 총 2개", and a
        // line describing a subset has to be able to show which rows it means. The confirmed
        // table's version of this expression omits them only because that toolbar HAS no tiles —
        // it is not a divergence to harmonise away.
        expandFolds={
          !!table.searchValue.trim() || !!table.dbType || !!table.region || table.filter !== 'all'
        }
        columns={columns}
      />
      {table.filteredCount > 0 && (
        <Pagination
          size="md"
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
            <div className="flex items-center gap-2">
              {/* Outside the ternary: the step number is known before the fetch, so it renders
                  while the title is still a skeleton. */}
              <span className={cardStyles.stepTag}>{copy.common.step(2)}</span>
              {/* The verdict arrives with the fetch, so title and badge stay unresolved until then —
                  rendering the pending copy first makes every rejected load flash 승인 대기 → 반려. */}
              {resolved ? (
                <>
                  {/* Fixed step name, matching the progress bar — the badge alone carries state. */}
                  <h2 className={cn(cardStyles.cardTitle)}>{t.title}</h2>
                  <span
                    className={cn(
                      // Rejected matches the 반려 사유 tag in the quote below, so the two marks read
                      // as one pair on this screen; pending keeps the rounded-full state badge.
                      rejected
                        ? 'inline-flex items-center rounded-md px-1.5 py-0.5 text-[12px] font-medium'
                        : cardStyles.stepBadge,
                      statusColors.warning.bg,
                      statusColors.warning.textDark,
                    )}
                  >
                    {rejected ? t.badgeRejected : t.badgePending}
                  </span>
                </>
              ) : (
                <>
                  {/* 24px, not 26: the title's line box is 20 × 1.2 since the tag moved onto its
                      row. A skeleton taller than what replaces it makes the card settle downward. */}
                  <div className={cn(idcStyles.skeletonBar, 'h-[24px] w-[220px] rounded-[6px]')} />
                  <div className={cn(idcStyles.skeletonBar, 'h-[24px] w-[68px] rounded-full')} />
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
          /* 안내가 두 문단이니 스켈레톤도 두 줄이다 — 줄 사이 간격은 없다: 25px 는 guidance 의
             줄 상자(16px × 1.55)라 두 바가 맞닿아야 실제 높이(mt-3 + 50px)가 된다. 16px 바를
             8px 띄우던 앞 판은 40px 이라, resolve 때 아래 행이 10px 밀렸다. */
          <div className="mt-3 flex flex-col">
            <div className={cn(idcStyles.skeletonBar, 'h-[25px] w-[520px] max-w-full rounded')} />
            <div className={cn(idcStyles.skeletonBar, 'h-[25px] w-[300px] max-w-full rounded')} />
          </div>
        ) : rejected ? (
          <RejectionVerdict
            reason={rejected.reason}
            processedAt={rejected.processedAt}
            processedBy={rejected.processedBy}
            action={reselect}
          />
        ) : (
          <>
            <p className={cn('mt-3', cardStyles.guidance)}>
              <strong className={cn('font-semibold', primaryColors.text)}>
                {t.guidanceStrong}
              </strong>{' '}
              {t.guidanceTail}
            </p>
            {/* mt 없음 — 행간 여백(leading 1.55)만으로 문단을 가른다 (기존 mt-1에서 −4px). */}
            <p className={cardStyles.guidance}>
              {t.reRequestLead}
              <strong className={cn('font-semibold', textColors.secondary)}>{t.reRequest}</strong>
              {t.reRequestTail}
            </p>
          </>
        )}
        {requestSummary && !rejected && (
          // Label over value, one row. This tier sits well below the guidance copy, so it
          // declares 12px + muted color instead of the page header's kv tier (14px, near-black),
          // which names the target source. 24px above it — the widest gap in the header, marking
          // the boundary between "what happened / what to do" and reference facts.
          // Rejected does not repeat it here: the submission meta moves into the record block's
          // summary line below, where it belongs to the list it describes.
          <div className="mt-6 flex flex-wrap gap-8">
            <MetaField
              label={copy.common.requestedAt}
              value={formatDate(requestSummary.requestedAt, 'datetime', locale)}
            />
            <MetaField label={copy.common.requester} value={requestSummary.requestedBy} />
          </div>
        )}
      </div>

      <div className={cardStyles.body}>
        {state.status === 'loading' ? (
          <ResourceTableSkeleton />
        ) : state.status === 'error' ? (
          <ErrorRow message={state.message} onRetry={handleRetry} />
        ) : rejected ? (
          <RejectedTargetRecord
            totalCount={table.countsByFilter.all}
            selectedCount={table.countsByFilter.target}
            excludedCount={table.countsByFilter.excluded}
            request={requestSummary}
          >
            {listBlock}
          </RejectedTargetRecord>
        ) : (
          <div>{listBlock}</div>
        )}
      </div>
      {/* C-2 action zone: reselect dock (sticky) at the card bottom. cancelSlot moved to the header. */}
      {reselectSlot && <CardActionBar>{reselectSlot}</CardActionBar>}
    </section>
  );
};
