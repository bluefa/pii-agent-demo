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
import { useState, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { integrationRoutes } from '@/lib/routes';
import { pipelineStyles } from '@/lib/theme';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { SectionHeader } from '@/app/admin/pipelines/_components/SectionHeader';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';

import { RequestDetailHeader } from '@/app/admin/pipelines/queue/requests/_components/RequestDetailHeader';
import { CloudResourceTable } from '@/app/admin/pipelines/queue/requests/_components/CloudResourceTable';
import { IdcResourceTable } from '@/app/admin/pipelines/queue/requests/_components/IdcResourceTable';
import { NlbListenerModal } from '@/app/admin/pipelines/queue/requests/_components/NlbListenerModal';
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
  approveRequest,
  getApprovalRequestLatest,
  getNlbTable,
  getRequestHeader,
  putNlbIndex,
  rejectRequest,
  type ApprovalRequestDetail,
  type NlbTableRow,
  type RequestResourceRow,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  const [draft, setDraft] = useState<NlbDraft>({});
  const [savingResourceId, setSavingResourceId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return Promise.all([
        getRequestHeader(targetSourceId, { signal }),
        getApprovalRequestLatest(targetSourceId, { signal }),
        getNlbTable({ signal }),
      ])
        .then(([headerRow, detailData, nlb]) => {
          if (signal.aborted) return;
          setHeader(headerRow);
          setDetail(detailData);
          setNlbTable(nlb);
          setDraft({});
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
  const excludedCount = Math.max(0, totalCount - selectedCount);
  // Cheap filter over the (small) resource set — recomputed each render on purpose.
  const unsavedNlbCount = dirtyCount(resources, draft);

  const onSelectNlb = (row: RequestResourceRow, nlbIndex: number): void => {
    setDraft((prev) => setNlbDraft(prev, row, nlbIndex));
  };

  const onSaveNlb = async (row: RequestResourceRow): Promise<void> => {
    if (row.resourceId == null) return;
    const nextIndex = effectiveNlbIndex(row, draft);
    if (nextIndex == null) return;
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
      setNlbTable(await getNlbTable());
      toast.show(`NLB #${nextIndex} 배정을 저장했어요`);
    } catch (err) {
      toast.show(errorMessage(err));
    } finally {
      setSavingResourceId(null);
    }
  };

  const backToList = (): void => router.push(integrationRoutes.pipelines.queue.requests);

  const onApprove = async (comment: string): Promise<void> => {
    await approveRequest(targetSourceId, comment);
    setModal(null);
    toast.show('승인했어요 — 연동 대상 반영이 시작돼요');
    backToList();
  };

  const onReject = async (reason: string): Promise<void> => {
    await rejectRequest(targetSourceId, reason);
    setModal(null);
    toast.show('반려했어요 — 사유가 전달됐어요');
    backToList();
  };

  return (
    <div>
      <PlBreadcrumb
        crumbs={[
          { label: 'Task Queue', href: integrationRoutes.pipelines.queue.dashboard },
          { label: '연동 요청', href: integrationRoutes.pipelines.queue.requests },
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
            confirmStatus={header?.confirmStatus ?? detail.request.status}
            requestedBy={detail.request.requestedBy}
            requestedAt={detail.request.requestedAt}
            selectedCount={selectedCount}
            totalCount={totalCount}
            onApprove={() => setModal('approve')}
            onReject={() => setModal('reject')}
          />

          <SectionHeader
            first
            title="연동 대상 리소스"
            desc={`연동 대상 ${selectedCount}개 · 제외 ${excludedCount}개`}
          />
          <Card>
            {isIdc ? (
              <>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={text.subsectionTitle}>리소스별 NLB Index</span>
                  <PlButton variant="secondary" size="sm" onClick={() => setModal('nlb')}>
                    NLB 리스너 현황
                  </PlButton>
                </div>
                <IdcResourceTable
                  rows={resources}
                  nlbTable={nlbTable}
                  draft={draft}
                  savingResourceId={savingResourceId}
                  onSelect={onSelectNlb}
                  onSave={(row) => void onSaveNlb(row)}
                />
                <p className={`${text.meta} mt-4`}>
                  점유 리스너가 30개를 넘으면 주의, 50개에 이르면 새로 배정할 수 없어요
                </p>
              </>
            ) : (
              <CloudResourceTable rows={resources} />
            )}
          </Card>

          <NlbListenerModal
            open={modal === 'nlb'}
            onClose={() => setModal(null)}
            targetSourceId={targetSourceId}
            rows={nlbTable}
          />
          <ApproveModal
            open={modal === 'approve'}
            onClose={() => setModal(null)}
            targetSourceId={targetSourceId}
            serviceName={serviceName}
            selectedCount={selectedCount}
            unsavedNlbCount={unsavedNlbCount}
            onSubmit={onApprove}
          />
          <RejectModal
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
