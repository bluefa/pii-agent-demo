'use client';

/**
 * P3 연동 요청 상세 (/admin/pipelines/queue/requests/[targetSourceId]) — design-spec §3.
 *
 * Header identity comes from the P2 wire (getRequestHeader — service name/code/
 * provider/confirmStatus); the request summary + resources come from
 * getApprovalRequestLatest. The list itself lives in ResourceSection and the IDC NLB
 * editing in useNlbAssignment; this page owns the fetch, the approval actions and the
 * modals. 승인/반려 post to the approval endpoints, then return to the list.
 */
import { useCallback, useState, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { passRoutes } from '@/lib/routes';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { SectionHeader } from '@/app/admin/pipelines/_components/SectionHeader';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';

import { RequestDetailHeader } from '@/app/admin/pipelines/queue/requests/_components/RequestDetailHeader';
import { ResourceSection } from '@/app/admin/pipelines/queue/requests/_components/ResourceSection';
import { NlbListenerModal } from '@/app/admin/pipelines/queue/requests/_components/NlbListenerModal';
import { NlbMappingModal } from '@/app/admin/pipelines/queue/requests/_components/NlbMappingModal';
import { ApproveModal } from '@/app/admin/pipelines/queue/requests/_components/ApproveModal';
import { RejectModal } from '@/app/admin/pipelines/queue/requests/_components/RejectModal';
import { dirtyCount } from '@/app/admin/pipelines/queue/requests/_logic';
import { useResourceListState } from '@/app/admin/pipelines/queue/requests/_resourceQuery';
import { useNlbAssignment } from '@/app/admin/pipelines/queue/requests/_useNlbAssignment';
import {
  approveRequest,
  getApprovalRequestLatest,
  getNlbIndexMappings,
  getNlbTable,
  getRequestHeader,
  rejectRequest,
  type ApprovalRequestDetail,
  type NlbTableRow,
  type RequestResourceRow,
  type ResourceNlbMappings,
} from '@/app/lib/api/task-queue-requests';
import type { RequestListRow } from '@/lib/types/task-queue';

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
  // null = the per-resource NLB mappings fetch failed (modal shows a fallback, not a
  // false "배정 없음"). Resolved before `loading` clears, so a row's "NLB 정보" control
  // never opens onto a still-loading state.
  const [nlbMappings, setNlbMappings] = useState<ResourceNlbMappings[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  const [modal, setModal] = useState<ModalKind>(null);
  // The resource whose "현재 배정된 NLB" modal is open — keyed per resource so
  // reopening for another row shows that row's data (fresh mount via key prop).
  const [nlbInfoResource, setNlbInfoResource] = useState<RequestResourceRow | null>(null);

  const list = useResourceListState();
  const { reset: resetList } = list;

  // Rebase the saved row's index so the select stops reading as dirty.
  const onNlbSaved = useCallback((resourceId: string, nlbIndex: number): void => {
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            resources: prev.resources.map((r) =>
              r.resourceId === resourceId ? { ...r, nlbIndex } : r,
            ),
          }
        : prev,
    );
  }, []);

  const nlb = useNlbAssignment({
    targetSourceId,
    onSaved: onNlbSaved,
    onNlbTable: setNlbTable,
    showToast: toast.show,
  });
  const { reset: resetNlbDraft } = nlb;

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return Promise.all([
        getRequestHeader(targetSourceId, { signal }),
        getApprovalRequestLatest(targetSourceId, { signal }),
        getNlbTable({ signal }),
        // Consumed only by the IDC "NLB 정보" modal — its failure must not break the
        // detail, so it resolves to null (→ modal fallback) on its own.
        getNlbIndexMappings(targetSourceId, { signal }).catch(() => null),
      ])
        .then(([headerRow, detailData, nlbRows, mappings]) => {
          if (signal.aborted) return;
          setHeader(headerRow);
          setDetail(detailData);
          setNlbTable(nlbRows);
          setNlbMappings(mappings);
          resetNlbDraft();
          resetList();
          setLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err);
          setLoading(false);
        });
    },
    [targetSourceId, retry, resetList, resetNlbDraft],
  );

  const provider = header?.cloudProvider ?? '';
  const isIdc = provider.toUpperCase() === 'IDC';
  const serviceName = header?.serviceName ?? `#${targetSourceId}`;
  const resources = detail?.resources ?? [];
  const selectedCount =
    detail?.request.resourceSelectedCount ?? resources.filter((r) => r.selected).length;
  // Cheap filter over the (small) resource set — recomputed each render on purpose.
  const unsavedNlbCount = dirtyCount(resources, nlb.draft);

  const backToList = (): void => router.push(passRoutes.pipelines.queue.requests);

  // A failed submit keeps the modal open (it resets its own submitting flag) and
  // surfaces the reason via the section toast — the same grammar as the NLB save.
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
            onApprove={() => setModal('approve')}
            onReject={() => setModal('reject')}
          />

          <SectionHeader
            first
            title={isIdc ? '연동 대상 리소스 · NLB 배정' : '연동 대상 리소스'}
          />
          <Card>
            <ResourceSection
              resources={resources}
              isIdc={isIdc}
              list={list}
              nlbTable={nlbTable}
              nlb={nlb}
              nlbLocked={detail.request.status !== 'PENDING'}
              onShowNlbInfo={setNlbInfoResource}
              onOpenNlbListeners={() => setModal('nlb')}
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
