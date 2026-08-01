'use client';

import { useEffect, useState } from 'react';
import { cardStyles, cn, primaryColors, statusColors, textColors } from '@/lib/theme';
import { ErrorState } from '@/app/components/ui/state';
import { Pagination } from '@/app/components/ui/Pagination';
import { formatDate } from '@/lib/utils/date';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalCancelButton } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';
import { WaitingApprovalStats } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { ApprovalUnavailableCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApprovalUnavailableCard';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { useIdcApprovalTable } from '@/app/target-sources/[targetSourceId]/_components/idc/approval-table';
import {
  IDC_FILTER_EMPTY_MESSAGE,
  IDC_SEARCH_PLACEHOLDER,
} from '@/app/target-sources/[targetSourceId]/_components/idc/steps/step-copy';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import type { IdcResourceView } from '@/app/lib/api/idc';
import { AppError } from '@/lib/errors';
import { getApprovalRequestLatest, getProject } from '@/app/lib/api';
import { getIdcApprovalRequestResources } from '@/app/lib/api/idc';
import { useIdcResources } from '@/app/hooks/useIdcResources';

const EMPTY_RESOURCES: readonly IdcResourceView[] = [];

interface RequestSummary {
  requestedAt: string;
  requestedBy: string;
}

/** The verdict + the submission meta, both from approval-requests/latest. */
interface LatestView {
  unavailable: { reason: string } | null;
  summary: RequestSummary | null;
}

const EMPTY_LATEST: LatestView = { unavailable: null, summary: null };

/**
 * IDC Step 2 — 연동 대상 승인 대기 (read-only).
 *
 * Same card as the cloud sibling (WaitingApprovalCard): step tag → title + state badge →
 * guidance copy → submission meta in the header, then the stats filter, the search toolbar,
 * the connected-skin table and its pager in the body. The green/blue StepBanner is gone —
 * it repeated the guidance sentence directly above it.
 *
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7):
 * AbortController cleanup + stale-id guard, never module-level state.
 */
export const IdcStep2WaitingApproval = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const { targetSourceId } = project;

  // Step 2 source: the requested list via approved-integration, not previous-request.
  const { state } = useIdcResources(targetSourceId, getIdcApprovalRequestResources);

  // The table source (approved-integration) carries neither the verdict nor who requested it,
  // so approval-requests/latest is read separately for both.
  const [latest, setLatest] = useState<{ targetSourceId: number; view: LatestView }>({
    targetSourceId,
    view: EMPTY_LATEST,
  });
  useEffect(() => {
    const controller = new AbortController();
    void getApprovalRequestLatest(targetSourceId, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const requestedAt = res.request?.requested_at;
        const requestedBy = res.request?.requested_by?.user_id;
        setLatest({
          targetSourceId,
          view: {
            unavailable:
              res.result?.status === 'UNAVAILABLE' ? { reason: res.result?.reason ?? '' } : null,
            summary: requestedAt && requestedBy ? { requestedAt, requestedBy } : null,
          },
        });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && (error.code === 'ABORTED' || error.code === 'NOT_FOUND')) return;
        // Non-fatal: leave the verdict unset and let the normal waiting card render.
      });
    return () => controller.abort();
  }, [targetSourceId]);
  // Stamped with the id it was fetched for — a stale verdict would replace the whole card for the
  // wrong target on a switch.
  const { unavailable, summary } = latest.targetSourceId === targetSourceId ? latest.view : EMPTY_LATEST;

  const resources = state.status === 'ready' ? state.resources : EMPTY_RESOURCES;
  const { table, visibleResources } = useIdcApprovalTable(resources);

  const refreshProject = async () => onProjectUpdate(await getProject(targetSourceId));

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      {unavailable ? (
        <ApprovalUnavailableCard
          targetSourceId={targetSourceId}
          reason={unavailable.reason}
          onReselected={refreshProject}
        />
      ) : (
        <section className={cn(cardStyles.base, 'overflow-hidden')}>
          <header className={cardStyles.header}>
            <span className={cardStyles.stepTag}>2번째 단계</span>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className={cardStyles.cardTitle}>연동 대상 승인 대기</h2>
                <span
                  className={cn(
                    cardStyles.stepBadge,
                    statusColors.warning.bg,
                    statusColors.warning.textDark,
                  )}
                >
                  승인 대기
                </span>
              </div>
              {/* Card CTA sits beside the title — in a bottom dock the user only meets it past
                  the whole table. */}
              <div className="shrink-0">
                <WaitingApprovalCancelButton
                  targetSourceId={targetSourceId}
                  onSuccess={refreshProject}
                />
              </div>
            </div>
            {/* Blue marks the status sentence only; the rest drops to the secondary tone. */}
            <p className={cn('mt-3', cardStyles.guidance)}>
              <strong className={cn('font-semibold', primaryColors.text)}>
                관리자 승인을 기다리고 있어요.
              </strong>{' '}
              평균 1영업일 내 검토되며, 결과는 이 화면에서 확인할 수 있어요.
            </p>
            {/* No top margin — the 1.55 leading is the paragraph break (cloud step-2 grammar). */}
            <p className={cardStyles.guidance}>
              연동 대상을 다시 고르고 싶다면 우측 상단{' '}
              <strong className={cn('font-semibold', textColors.secondary)}>다시 요청하기</strong>를
              눌러주세요.
            </p>
            {summary && (
              // 24px above it — the widest gap in the header, marking the boundary between
              // "what happened / what to do" and reference facts.
              <div className="mt-6 flex flex-wrap gap-8">
                <MetaField label="요청일시" value={formatDate(summary.requestedAt, 'datetime')} />
                <MetaField label="요청자" value={summary.requestedBy} />
              </div>
            )}
          </header>
          <div className={cardStyles.body}>
            {state.status === 'loading' && <ResourceTableSkeleton />}
            {state.status === 'error' && <ErrorState message="연동 대상을 불러오지 못했습니다." />}
            {state.status === 'ready' && (
              <>
                {/* Tiles carry the all/target/excluded counts and double as that filter. */}
                <WaitingApprovalStats
                  totalCount={table.countsByFilter.all}
                  selectedCount={table.countsByFilter.target}
                  excludedCount={table.countsByFilter.excluded}
                  filter={table.filter}
                  onFilterChange={table.onFilterChange}
                />
                {/* Toolbar (top-rounded) + table + pagination (bottom-rounded): one card, no gaps. */}
                <WaitingApprovalToolbar
                  searchValue={table.searchValue}
                  onSearchChange={table.onSearchChange}
                  dbType={table.dbType}
                  onDbTypeChange={table.onDbTypeChange}
                  region={table.region}
                  onRegionChange={table.onRegionChange}
                  dbTypeOptions={table.dbTypeOptions}
                  regionOptions={table.regionOptions}
                  searchPlaceholder={IDC_SEARCH_PLACEHOLDER}
                />
                <IdcResourceTable
                  resources={visibleResources}
                  cols={['src', 'excl']}
                  connected
                  emptyMessage={IDC_FILTER_EMPTY_MESSAGE}
                />
                {table.filteredCount > 0 && (
                  <Pagination
                    page={table.safePage}
                    pageSize={table.pageSize}
                    totalCount={table.filteredCount}
                    onPageChange={table.onPageChange}
                    onPageSizeChange={table.onPageSizeChange}
                    pageSizeOptions={[10, 20, 50, 100]}
                  />
                )}
              </>
            )}
          </div>
        </section>
      )}
      <RejectionAlert project={project} />
    </>
  );
};
