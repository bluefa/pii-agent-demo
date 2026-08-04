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
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';

import { RequestDetailHeader } from '@/app/admin/pipelines/queue/requests/_components/RequestDetailHeader';
import { RequestVerdictNotice } from '@/app/admin/pipelines/queue/requests/_components/RequestVerdictNotice';
import { ResourceSection } from '@/app/admin/pipelines/queue/requests/_components/ResourceSection';
import { NlbListenerModal } from '@/app/admin/pipelines/queue/requests/_components/NlbListenerModal';
import { NlbAssignModal } from '@/app/admin/pipelines/queue/requests/_components/NlbAssignModal';
import { ServiceAssignmentModal } from '@/app/admin/pipelines/queue/requests/_components/ServiceAssignmentModal';
import { ApproveModal } from '@/app/admin/pipelines/queue/requests/_components/ApproveModal';
import { RejectModal } from '@/app/admin/pipelines/queue/requests/_components/RejectModal';
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

/** 접힌 기록 요약의 인라인 라벨-값 쌍 (Step 2 MetaField inline 문법). */
function RecordCount({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[12px] font-normal text-[var(--pl-text-weak)]">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]">
        {value}건
      </span>
    </span>
  );
}

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
  // null = the per-service NLB mappings fetch failed, so ServiceAssignmentModal says so
  // rather than showing a false "배정 없음".
  const [nlbMappings, setNlbMappings] = useState<ResourceNlbMappings[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  const [modal, setModal] = useState<ModalKind>(null);
  // The resource whose NLB assignment modal is open — keyed per resource so reopening
  // for another row seeds from THAT row's index (fresh mount via key prop).
  const [assigning, setAssigning] = useState<RequestResourceRow | null>(null);
  // The resource whose 서비스별 NLB 배정 list is open (read-only, never locked).
  const [showingServices, setShowingServices] = useState<RequestResourceRow | null>(null);

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

  const closeAssign = useCallback((): void => setAssigning(null), []);
  const nlb = useNlbAssignment({
    targetSourceId,
    onSaved: onNlbSaved,
    onNlbTable: setNlbTable,
    showToast: toast.show,
    onSuccess: closeAssign,
  });

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return Promise.all([
        getRequestHeader(targetSourceId, { signal }),
        getApprovalRequestLatest(targetSourceId, { signal }),
        getNlbTable({ signal }),
        // Feeds ServiceAssignmentModal only — its failure must not break the detail, so
        // it resolves to null on its own.
        getNlbIndexMappings(targetSourceId, { signal }).catch(() => null),
      ])
        .then(([headerRow, detailData, nlbRows, mappings]) => {
          if (signal.aborted) return;
          setHeader(headerRow);
          setDetail(detailData);
          setNlbTable(nlbRows);
          setNlbMappings(mappings);
          setAssigning(null);
          setShowingServices(null);
          resetList();
          setLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err);
          setLoading(false);
        });
    },
    [targetSourceId, retry, resetList],
  );

  const provider = header?.cloudProvider ?? '';
  const isIdc = provider.toUpperCase() === 'IDC';
  const serviceName = header?.serviceName ?? `#${targetSourceId}`;
  const resources = detail?.resources ?? [];
  const selectedCount =
    detail?.request.resourceSelectedCount ?? resources.filter((r) => r.selected).length;
  // 이미 처리된 요청 — 반려 목록에서 들어온 경로가 여기다. 상태를 wire 의 result
  // 유무가 아니라 request.status 로 판정한다: result 는 결정을 '설명'하는 필드고,
  // 결정 여부 자체는 요청 상태가 말한다.
  const decided = detail != null && detail.request.status !== 'PENDING';
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
            description={header?.description ?? null}
            provider={provider}
            serviceCode={header?.serviceCode ?? null}
            requestedBy={detail.request.requestedBy}
            requestedAt={detail.request.requestedAt}
            // 결정이 끝난 요청에는 CTA 를 넘기지 않는다 — 아래 verdict 가 상태를
            // 말하고, 재처리는 계약상 불가능하다.
            onApprove={decided ? undefined : () => setModal('approve')}
            onReject={decided ? undefined : () => setModal('reject')}
          />

          {/* 관리자가 이미 답을 준 요청이면, 서비스 담당자가 Step 2 에서 읽는
              그 문장을 여기서도 같은 문법(3px 룰 인용)으로 먼저 보여준다. */}
          {detail.verdict != null && <RequestVerdictNotice verdict={detail.verdict} />}

          {/* One title for both providers: what the section holds is the request, and
              naming its IDC-only parts made the heading grow a clause per provider.
              The provider split moves to the desc, where a sentence can carry it —
              only IDC has an NLB Index the admin can still change here. */}
          {decided ? (
            /* 결정이 끝난 요청의 대상은 worklist 가 아니라 기록이다 — Step 2 의
               RejectedTargetRecord 와 같은 판단으로, 판정 아래에 800px 짜리
               '조작 가능해 보이는' 표를 펼쳐두지 않고 접는다. 상태를 들 필요가
               없는 native <details>. 요약줄은 어차피 목록에서 확인할 것(몇 건인지)을
               미리 답한다. */
            <details className="group border-t border-[var(--pl-border)] pt-4">
              <summary className="flex cursor-pointer list-none flex-col gap-2.5 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[14px] font-semibold text-[var(--pl-text-medium)]">
                    이 요청에 포함된 연동 대상
                  </span>
                  <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--pl-primary)]">
                    <span className="group-open:hidden">목록 보기</span>
                    <span className="hidden group-open:inline">접기</span>
                    {/* 아래를 가리키는 셰브론 — 아이콘 세트에 chev-d 가 없어 chev-r 을
                        돌려 쓴다(열리면 위로). */}
                    <Icon
                      name="chev-r"
                      size="sm"
                      className="rotate-90 transition-transform group-open:-rotate-90"
                    />
                  </span>
                </div>
                {/* 열면 사라진다 — 아래 타일이 같은 세 숫자를 들고 있어 중복이 된다.
                    요청 시각·요청자는 헤더가 이미 말하므로 여기서 반복하지 않는다. */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 group-open:hidden">
                  <RecordCount label="전체" value={resources.length} />
                  <RecordCount label="연동 대상" value={selectedCount} />
                  <RecordCount label="제외" value={resources.length - selectedCount} />
                </div>
              </summary>
              <div className="mt-4">
                <ResourceSection
                  resources={resources}
                  isIdc={isIdc}
                  list={list}
                  nlbLocked
                  onAssignNlb={setAssigning}
                  onShowServices={setShowingServices}
                  onOpenNlbListeners={() => setModal('nlb')}
                />
              </div>
            </details>
          ) : (
            <>
              <SectionHeader
                first
                title="연동 요청 조회"
                desc={
                  isIdc ? (
                    <>
                      서비스 담당자가 요청한 연동 대상을 확인하고 승인해요.{' '}
                      {/* Primary, because this clause is the one thing on the page that is
                          still editable and it expires at 승인 — the rest of the sentence
                          describes what the section shows. The cloud variant gets no
                          highlight: nothing there can be changed. */}
                      <span className="font-medium text-[var(--pl-primary)]">
                        승인 전에는 접속 주소마다 NLB Index를 바꿀 수 있어요.
                      </span>
                    </>
                  ) : (
                    '서비스 담당자가 요청한 연동 대상을 확인하고 승인해요. 제외된 리소스는 사유와 함께 표시돼요.'
                  )
                }
              />
              {/* No card around it. The tiles are cards and the toolbar·table·pager carry
                  their own connected frame, so an outer surface only nested a card in a card
                  and spent 48px of table width on doubled padding. */}
              <ResourceSection
                resources={resources}
                isIdc={isIdc}
                list={list}
                nlbLocked={false}
                onAssignNlb={setAssigning}
                onShowServices={setShowingServices}
                onOpenNlbListeners={() => setModal('nlb')}
              />
            </>
          )}

          <NlbListenerModal
            open={modal === 'nlb'}
            onClose={() => setModal(null)}
            rows={nlbTable}
          />
          {assigning != null && (
            <NlbAssignModal
              key={assigning.resourceId ?? 'nlb-assign'}
              open
              onClose={closeAssign}
              resource={assigning}
              rows={nlbTable}
              saving={nlb.savingResourceId != null}
              onSave={(nlbIndex) =>
                assigning.resourceId != null &&
                nlb.save(assigning.resourceId, assigning.nlbIndex, nlbIndex)
              }
            />
          )}
          {showingServices != null && (
            <ServiceAssignmentModal
              key={showingServices.resourceId ?? 'services'}
              open
              onClose={() => setShowingServices(null)}
              resource={showingServices}
              mappings={nlbMappings}
              nlbRows={nlbTable}
            />
          )}
          <ApproveModal
            key={`approve-${modal === 'approve'}`}
            open={modal === 'approve'}
            onClose={() => setModal(null)}
            serviceName={serviceName}
            selectedCount={selectedCount}
            onSubmit={onApprove}
          />
          <RejectModal
            key={`reject-${modal === 'reject'}`}
            open={modal === 'reject'}
            onClose={() => setModal(null)}
            serviceName={serviceName}
            onSubmit={onReject}
          />
        </>
      )}
    </div>
  );
}
