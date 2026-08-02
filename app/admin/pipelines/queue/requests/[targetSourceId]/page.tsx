'use client';

/**
 * P3 연동 요청 상세 (/admin/pipelines/queue/requests/[targetSourceId]) — design-spec §3.
 *
 * Header identity comes from the P2 wire (getRequestHeader — service name/code/
 * provider/confirmStatus); the request summary + resources come from
 * getApprovalRequestLatest. The IDC variant edits each resource's NLB index
 * (local draft → per-row PUT; a successful save refetches the NLB table so
 * occupancy moves), and its 배정 NLB 상태 / listener modal read the same NLB table.
 * The non-IDC variant is a read-only resource table. 승인/반려 post to the approval
 * endpoints, then return to the list.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { passRoutes } from '@/lib/routes';
import { pipelineStyles } from '@/lib/theme';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { SectionHeader } from '@/app/admin/pipelines/_components/SectionHeader';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import {
  ResourceStatTiles,
  ResourceToolbar,
} from '@/app/admin/pipelines/queue/requests/_components/ResourceFilterBar';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';

import { RequestDetailHeader } from '@/app/admin/pipelines/queue/requests/_components/RequestDetailHeader';
import { CloudResourceTable } from '@/app/admin/pipelines/queue/requests/_components/CloudResourceTable';
import { IdcResourceTable } from '@/app/admin/pipelines/queue/requests/_components/IdcResourceTable';
import { NlbListenerModal } from '@/app/admin/pipelines/queue/requests/_components/NlbListenerModal';
import { NlbMappingModal } from '@/app/admin/pipelines/queue/requests/_components/NlbMappingModal';
import { ApproveModal } from '@/app/admin/pipelines/queue/requests/_components/ApproveModal';
import { RejectModal } from '@/app/admin/pipelines/queue/requests/_components/RejectModal';
import {
  clearNlbDraft,
  dirtyCount,
  effectiveNlbIndex,
  setNlbDraft,
  type NlbDraft,
} from '@/app/admin/pipelines/queue/requests/_logic';
import {
  axisOptions,
  databaseTypeOptions,
  EMPTY_RESOURCE_QUERY,
  pageResources,
  queryResources,
  resourceCounts,
  type ResourceQuery,
} from '@/app/admin/pipelines/queue/requests/_resourceQuery';
import {
  approveRequest,
  getApprovalRequestLatest,
  getNlbIndexMappings,
  getNlbTable,
  getRequestHeader,
  putNlbIndex,
  rejectRequest,
  type ApprovalRequestDetail,
  type NlbTableRow,
  type RequestResourceRow,
  type ResourceNlbMappings,
} from '@/app/lib/api/task-queue-requests';
import type { RequestListRow } from '@/lib/types/task-queue';

const { text } = pipelineStyles;

type ModalKind = 'approve' | 'reject' | 'nlb' | null;

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export default function RequestDetailPage(): ReactElement {
  const router = useRouter();
  const params = useParams<{ targetSourceId: string }>();
  const targetSourceId = Number(params.targetSourceId);
  const toast = usePlToast();

  const [header, setHeader] = useState<RequestListRow | null>(null);
  const [detail, setDetail] = useState<ApprovalRequestDetail | null>(null);
  const [nlbTable, setNlbTable] = useState<NlbTableRow[]>([]);
  // null = the per-resource NLB mappings fetch failed (modal shows a fallback,
  // not a false "배정 없음"). Resolved before `loading` clears, so a row's "NLB
  // 정보" control never opens onto a still-loading state.
  const [nlbMappings, setNlbMappings] = useState<ResourceNlbMappings[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  const [draft, setDraft] = useState<NlbDraft>({});
  const [savingResourceId, setSavingResourceId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  // The resource whose "현재 배정된 NLB" modal is open — keyed per resource so
  // reopening for another row shows that row's data (fresh mount via key prop).
  const [nlbInfoResource, setNlbInfoResource] = useState<RequestResourceRow | null>(null);

  // 리소스 목록 질의 — 탭/검색/축 필터 + 10행 페이지. Every query change resets the
  // page: narrowing the result while on page 3 would otherwise land on an empty
  // table with no hint that the rows are simply elsewhere.
  const [query, setQuery] = useState<ResourceQuery>(EMPTY_RESOURCE_QUERY);
  const [resourcePage, setResourcePage] = useState(0);
  const patchQuery = (patch: Partial<ResourceQuery>): void => {
    setQuery((prev) => ({ ...prev, ...patch }));
    setResourcePage(0);
  };

  // Gates the post-save toast/refetch: the section-level toast provider outlives
  // this page, so a save resolving after navigation must not fire a toast there.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return Promise.all([
        getRequestHeader(targetSourceId, { signal }),
        getApprovalRequestLatest(targetSourceId, { signal }),
        getNlbTable({ signal }),
        // Consumed only by the IDC "NLB 정보" modal — its failure must not break
        // the detail, so it resolves to null (→ modal fallback) on its own.
        getNlbIndexMappings(targetSourceId, { signal }).catch(() => null),
      ])
        .then(([headerRow, detailData, nlb, mappings]) => {
          if (signal.aborted) return;
          setHeader(headerRow);
          setDetail(detailData);
          setNlbTable(nlb);
          setNlbMappings(mappings);
          setDraft({});
          setQuery(EMPTY_RESOURCE_QUERY);
          setResourcePage(0);
          setLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err);
          setLoading(false);
        });
    },
    [targetSourceId, retry],
  );

  const provider = header?.cloudProvider ?? '';
  const isIdc = provider.toUpperCase() === 'IDC';
  const serviceName = header?.serviceName ?? `#${targetSourceId}`;
  const resources = detail?.resources ?? [];
  const selectedCount =
    detail?.request.resourceSelectedCount ?? resources.filter((r) => r.selected).length;
  const totalCount = detail?.request.resourceTotalCount ?? resources.length;
  // Cheap filter over the (small) resource set — recomputed each render on purpose.
  const unsavedNlbCount = dirtyCount(resources, draft);
  // Counts stay whole-request (the tabs are the split); only the table pages.
  const counts = resourceCounts(resources);
  const dbTypeValues = databaseTypeOptions(resources);
  const axisValues = axisOptions(resources, isIdc);
  const filteredResources = queryResources(resources, query, isIdc);
  const pagedResources = pageResources(filteredResources, resourcePage);

  const onSelectNlb = (row: RequestResourceRow, nlbIndex: number): void => {
    setDraft((prev) => setNlbDraft(prev, row, nlbIndex));
  };

  const onSaveNlb = async (row: RequestResourceRow): Promise<void> => {
    if (row.resourceId == null) return;
    const nextIndex = effectiveNlbIndex(row, draft);
    if (nextIndex == null) return;
    const fromIndex = row.nlbIndex;
    setSavingResourceId(row.resourceId);
    try {
      await putNlbIndex(targetSourceId, row.resourceId, nextIndex);
      // Baseline the row's original index to the saved value, drop its draft, and
      // refetch occupancy (the save moved a listener across NLB rows).
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              resources: prev.resources.map((r) =>
                r.resourceId === row.resourceId ? { ...r, nlbIndex: nextIndex } : r,
              ),
            }
          : prev,
      );
      setDraft((prev) => clearNlbDraft(prev, row.resourceId as string));
      const nlb = await getNlbTable();
      if (!aliveRef.current) return;
      setNlbTable(nlb);
      toast.show(
        fromIndex != null && fromIndex !== nextIndex
          ? `NLB #${fromIndex} → #${nextIndex} 변경을 저장했어요`
          : `NLB #${nextIndex} 배정을 저장했어요`,
      );
    } catch (err) {
      if (aliveRef.current) toast.show(errorMessage(err));
    } finally {
      setSavingResourceId(null);
    }
  };

  const backToList = (): void => router.push(passRoutes.pipelines.queue.requests);

  // A failed submit keeps the modal open (it resets its own submitting flag) and
  // surfaces the reason via the section toast — the same grammar as onSaveNlb.
  const onApprove = async (comment: string): Promise<void> => {
    try {
      await approveRequest(targetSourceId, comment);
    } catch (err) {
      toast.show(errorMessage(err));
      return;
    }
    setModal(null);
    toast.show('승인했습니다. 연동 대상 반영이 시작됩니다.');
    backToList();
  };

  const onReject = async (reason: string): Promise<void> => {
    try {
      await rejectRequest(targetSourceId, reason);
    } catch (err) {
      toast.show(errorMessage(err));
      return;
    }
    setModal(null);
    toast.show('반려했습니다. 사유가 전달됐습니다.');
    backToList();
  };

  return (
    <div>
      <PlBreadcrumb
        crumbs={[
          { label: 'Task Queue', href: passRoutes.pipelines.queue.dashboard },
          { label: '연동 요청', href: passRoutes.pipelines.queue.requests },
          { label: `${serviceName} #${targetSourceId}` },
        ]}
      />

      {error != null ? (
        <Card>
          <PlEmptyState
            icon="inbox"
            message={errorMessage(error)}
            meta={
              <PlButton variant="secondary" size="sm" onClick={() => setRetry((n) => n + 1)}>
                재시도
              </PlButton>
            }
          />
        </Card>
      ) : loading || detail === null ? (
        <div className="min-h-[320px]" aria-busy="true" />
      ) : (
        <>
          <RequestDetailHeader
            serviceName={serviceName}
            targetSourceId={targetSourceId}
            provider={provider}
            serviceCode={header?.serviceCode ?? null}
            confirmStatus={detail.request.status ?? header?.confirmStatus ?? null}
            requestedBy={detail.request.requestedBy}
            requestedAt={detail.request.requestedAt}
            selectedCount={selectedCount}
            totalCount={totalCount}
            onApprove={() => setModal('approve')}
            onReject={() => setModal('reject')}
          />

          <SectionHeader
            first
            title={isIdc ? '연동 대상 리소스 · NLB 배정' : '연동 대상 리소스'}
          />
          <Card>
            {/* 대상/제외 카운트는 읽기 전용 문구가 아니라 필터 자체입니다 — 40건짜리
                요청에서 "제외 9건이 왜 빠졌는지"를 페이지를 넘겨가며 찾지 않도록. */}
            <ResourceStatTiles
              counts={counts}
              filter={query.filter}
              onFilterChange={(next) => patchQuery({ filter: next })}
            />

            <ResourceToolbar
              searchValue={query.search}
              onSearchChange={(next) => patchQuery({ search: next })}
              searchPlaceholder={
                isIdc ? '호스트 · IP · Oracle SID 검색' : 'Resource Name 또는 Resource ID 검색'
              }
              groups={[
                {
                  key: 'dbType',
                  label: 'Database Type',
                  value: query.databaseType,
                  onChange: (next) => patchQuery({ databaseType: next }),
                  options: dbTypeValues,
                },
                {
                  key: 'axis',
                  label: isIdc ? '구분' : 'Region',
                  value: query.axis,
                  onChange: (next) => patchQuery({ axis: next }),
                  options: axisValues,
                  formatOption: isIdc ? (value) => (value === 'HOST' ? 'Host' : 'IP') : undefined,
                },
              ]}
              actions={
                isIdc ? (
                  <PlButton variant="secondary" size="sm" onClick={() => setModal('nlb')}>
                    NLB 리스너 현황
                  </PlButton>
                ) : undefined
              }
            />

            {filteredResources.length === 0 ? (
              <PlEmptyState
                icon="inbox"
                message="조건에 맞는 리소스가 없어요."
                className="rounded-b-[10px] border border-t-0 border-[var(--pl-border)]"
              />
            ) : isIdc ? (
              <>
                <IdcResourceTable
                  rows={pagedResources.rows}
                  nlbTable={nlbTable}
                  draft={draft}
                  savingResourceId={savingResourceId}
                  disabled={detail.request.status !== 'PENDING'}
                  onSelect={onSelectNlb}
                  onSave={(row) => void onSaveNlb(row)}
                  onShowNlbInfo={setNlbInfoResource}
                  wrapClassName="rounded-t-none"
                />
                <p className={`${text.meta} mt-4`}>
                  점유 리스너가 30개를 넘으면 주의, 50개에 이르면 새로 배정할 수 없어요
                </p>
              </>
            ) : (
              <CloudResourceTable rows={pagedResources.rows} wrapClassName="rounded-t-none" />
            )}

            <OpsPagination
              page={pagedResources.page}
              totalPages={pagedResources.totalPages}
              onChange={setResourcePage}
            />
          </Card>

          <NlbListenerModal
            open={modal === 'nlb'}
            onClose={() => setModal(null)}
            targetSourceId={targetSourceId}
            rows={nlbTable}
          />
          {nlbInfoResource != null && (
            <NlbMappingModal
              key={nlbInfoResource.resourceId ?? 'nlb-info'}
              open
              onClose={() => setNlbInfoResource(null)}
              resource={nlbInfoResource}
              mappings={nlbMappings}
            />
          )}
          <ApproveModal
            key={`approve-${modal === 'approve'}`}
            open={modal === 'approve'}
            onClose={() => setModal(null)}
            targetSourceId={targetSourceId}
            serviceName={serviceName}
            selectedCount={selectedCount}
            unsavedNlbCount={unsavedNlbCount}
            onSubmit={onApprove}
          />
          <RejectModal
            key={`reject-${modal === 'reject'}`}
            open={modal === 'reject'}
            onClose={() => setModal(null)}
            targetSourceId={targetSourceId}
            serviceName={serviceName}
            onSubmit={onReject}
          />
        </>
      )}
    </div>
  );
}
