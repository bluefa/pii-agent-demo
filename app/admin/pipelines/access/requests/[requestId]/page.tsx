'use client';

/**
 * 권한 요청 상세 (/admin/pipelines/access/requests/[requestId]).
 *
 * 목록은 사유를 한 줄로 자르므로, 결정은 전문을 읽을 수 있는 이 화면에서 내린다.
 * 승인/반려는 모달에서 확정하고, 끝나면 목록으로 돌아가 토스트로 결과를 말한다.
 * 이미 처리된 요청은 판정 블록만 남고 CTA 는 사라진다 — 두 번 결정할 방법이 없어야 한다.
 */
import { useCallback, useState, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { SectionHeader } from '@/app/admin/pipelines/_components/SectionHeader';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import {
  ApproveAccessModal,
  RejectAccessModal,
} from '@/app/admin/pipelines/access/_components/AccessModals';
import { RequestStatusPill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import { errorMessage } from '@/app/admin/pipelines/access/_components/PagedCard';
import {
  approveAccessRequest,
  getAccessRequest,
  rejectAccessRequest,
  type PermissionRequestDetail,
} from '@/app/lib/api/access';

type ModalKind = 'approve' | 'reject' | null;

export default function AccessRequestDetailPage(): ReactElement {
  const router = useRouter();
  const params = useParams<{ requestId: string }>();
  const requestId = Number(params.requestId);
  const toast = usePlToast();

  const [request, setRequest] = useState<PermissionRequestDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);

  useAbortableEffect(
    (signal) => {
      setError(null);
      return getAccessRequest(requestId, { signal })
        .then((result) => {
          if (signal.aborted) return;
          setRequest(result);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err);
        });
    },
    [requestId, retry],
  );

  const back = useCallback(() => {
    router.push(passRoutes.pipelines.access.requests);
  }, [router]);

  const decide = useCallback(
    async (kind: 'approve' | 'reject', text: string): Promise<void> => {
      try {
        // 계약이 204 라 응답 본문이 없다 — 문구는 이미 화면이 들고 있는 요청으로 만든다.
        if (kind === 'approve') await approveAccessRequest(requestId, text);
        else await rejectAccessRequest(requestId, text);
        setModal(null);
        const who = request ? `${request.requester.knoxId}의 ${request.serviceName} 접근 요청` : '요청';
        toast.show(
          kind === 'approve' ? `${who}을 승인했어요 — 권한이 부여됐어요` : `${who}을 반려했어요`,
        );
        back();
      } catch (err) {
        // 모달은 열어 둔다 — 실패한 쓰기는 사라지면 안 되고, 사유도 그대로 남아야 한다.
        toast.show(errorMessage(err));
      }
    },
    [requestId, toast, back, request],
  );

  const crumbs = [
    { label: '권한 요청', href: passRoutes.pipelines.access.requests },
    { label: request ? `${request.requester.knoxId}의 요청` : `#${params.requestId}` },
  ];

  if (error != null) {
    return (
      <div>
        <PlBreadcrumb crumbs={crumbs} />
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
      </div>
    );
  }

  if (request == null) {
    return (
      <div>
        <PlBreadcrumb crumbs={crumbs} />
        <div className="min-h-[240px]" aria-busy="true" />
      </div>
    );
  }

  const pending = request.status === 'PENDING';
  const subject = `${request.requester.knoxId}의 ${request.serviceName} 접근 요청`;

  return (
    <div>
      <PlBreadcrumb crumbs={crumbs} />

      <div className={a.titleRow}>
        <h1 className={a.pageTitle}>{subject}</h1>
        <RequestStatusPill status={request.status} />
      </div>
      <p className={a.pageDesc}>요청자와 사유를 확인한 뒤 승인하거나 반려해 주세요</p>

      <Card className="mt-6">
        <SectionHeader first title="요청 정보" />
        <div className={a.factRow}>
          <span className={a.factLabel}>요청자</span>
          <span className={cn(a.mono, 'text-[var(--pl-text-strong)]')}>
            {request.requester.knoxId}
          </span>
          <span className="text-[var(--pl-text-weak)]">{request.requester.email}</span>
        </div>
        <div className={a.factRow}>
          <span className={a.factLabel}>서비스</span>
          <span className={a.nameStrong}>{request.serviceName}</span>
          <span className={cn(a.mono, 'text-[var(--pl-text-medium)]')}>{request.serviceCode}</span>
        </div>
        <div className={a.factRow}>
          <span className={a.factLabel}>요청 일시</span>
          <span className="tabular-nums">{fmtDateTime(request.requestedAt)}</span>
        </div>

        <SectionHeader title="요청 사유" />
        {/* 워크벤치와 같은 규칙 — 요청자가 한 말은 파란 면, 우리가 남긴 말은 회색. 같은
            요청이 딥링크로 열렸다고 사유 면이 달라지면 안 된다. */}
        <p className={a.quoteAsk}>{request.reason}</p>

        {!pending && (
          <>
            {/* 워크벤치와 같은 규칙 — 처리 이야기는 한 장에 담긴다. 누가·언제는 머리에
                딸린 한 줄이 아니라 위와 같은 사실 행이고, 이 화면의 구역 머리(20)보다 작은
                16 이지만 상자 안에 든다 — 계층은 등급이 아니라 포함이다. */}
            <div className={a.benchGroupTitle}>
              {request.status === 'APPROVED' ? '승인 결과' : '반려 결과'}
            </div>
            <div className={a.benchGroup}>
              <div className={a.factRow}>
                <span className={a.factLabel}>처리자</span>
                <span className={cn(a.mono, 'text-[var(--pl-text-strong)]')}>
                  {request.processedBy?.knoxId ?? '—'}
                </span>
              </div>
              <div className={a.factRow}>
                <span className={a.factLabel}>처리 일시</span>
                <span className="tabular-nums">{fmtDateTime(request.processedAt)}</span>
              </div>

              <div className={a.benchSection}>
                <div className={a.benchLabel}>
                  {request.status === 'APPROVED' ? '승인 메시지' : '반려 사유'}
                </div>
                <p className={a.benchGroupNote}>
                  {request.processedNote ??
                    (request.status === 'APPROVED' ? '메시지 없이 승인했어요' : '사유가 없어요')}
                </p>
              </div>
            </div>
          </>
        )}
      </Card>

      {pending && (
        <div className="mt-6 flex justify-end gap-2">
          <PlButton variant="danger" onClick={() => setModal('reject')}>
            반려
          </PlButton>
          <PlButton variant="primary" onClick={() => setModal('approve')}>
            승인
          </PlButton>
        </div>
      )}

      <ApproveAccessModal
        open={modal === 'approve'}
        onClose={() => setModal(null)}
        subject={subject}
        onSubmit={(message) => decide('approve', message)}
      />
      <RejectAccessModal
        open={modal === 'reject'}
        onClose={() => setModal(null)}
        subject={subject}
        onSubmit={(reason) => decide('reject', reason)}
      />
    </div>
  );
}
