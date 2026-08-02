'use client';

/**
 * 관리자 승인 tab — the process branch this target's Step 6 exists for.
 *
 * Its own tab rather than a card inside Test Connection because it is a STATE
 * TRANSITION, not test content: 재실행 요청 sends the target back to Step 5,
 * PII Agent 설치 완료 moves it to Step 7. The tab is always present, so the
 * operator can see what the decision is waiting on at any step — it is not
 * conditionally hidden.
 *
 * Flow: 서비스가 Target Source 상세에서 Test Connection 완료 확인(PUT
 * …/test-connection-acknowledgment)을 누르면 Step 5 → Step 6 으로 넘어오고, 관리자는
 * 결과를 보고 둘 중 하나를 고른다 —
 *   재실행 요청        POST …/test-connection/reject          (서비스 단계로 되돌림)
 *   PII Agent 설치 완료 POST …/pii-agent-installation/confirm  (연동 확정)
 *
 * Both are gated on the service's 완료 확인 (status = TEST_CONNECTION_COMPLETED);
 * before that there is nothing to decide, so the tab states what it is waiting
 * for instead of showing dead buttons.
 *
 * The result summary is carried here (counts + 완료 확인 시각) so the decision does
 * not require hopping back to Test Connection to recall what is being approved.
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import { useApiAction, useApiMutation } from '@/app/hooks/useApiMutation';
import { rejectTestConnection, confirmInstallation } from '@/app/lib/api/task-queue-tc';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  TcRerunModal,
  TcApproveModal,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcActionModals';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { TcStatTile } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/tcShared';
import type { TcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const COMPLETED = 'TEST_CONNECTION_COMPLETED';
const REJECTED = 'TEST_CONNECTION_REJECTED';

export interface ApprovalTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** Service acknowledgment row — the gate (fetched by the page). */
  status: TestConnectionStatusRow | null;
  /** Latest Test Connection counts, shown as the basis of the decision. */
  stats: TcResultStats;
  /** Both outcomes change the target's step, so the whole page reloads. */
  onDecided: () => void;
}

export function ApprovalTab({
  targetSourceId,
  detail,
  status,
  stats,
  onDecided,
}: ApprovalTabProps): ReactElement {
  const toast = usePlToast();
  const [rerunOpen, setRerunOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  // On failure the modal stays open and the error surfaces via the section toast.
  const rerun = useApiMutation((reason: string) => rejectTestConnection(targetSourceId, reason), {
    onSuccess: () => {
      setRerunOpen(false);
      toast.show('재실행을 요청했습니다.');
      onDecided();
    },
    onError: () => toast.show('재실행 요청에 실패했습니다.'),
  });

  const approve = useApiAction(() => confirmInstallation(targetSourceId), {
    onSuccess: () => {
      setApproveOpen(false);
      toast.show('PII Agent 설치를 완료 처리했습니다.');
      onDecided();
    },
    onError: () => toast.show('설치 완료 처리에 실패했습니다.'),
  });

  const decidable = status?.status === COMPLETED;
  const isRejected = status?.status === REJECTED;

  return (
    <section className={pipelineStyles.card.base} aria-label="관리자 승인">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="check" size={18} className="text-[var(--pl-primary)]" />
            관리자 승인
            {decidable ? (
              <TcPill tone="ok" label="처리 대기" />
            ) : isRejected ? (
              <TcPill tone="warn" label="재실행 요청됨" />
            ) : (
              <TcPill tone="off" label="대기 중" />
            )}
          </h2>
          <p className={opsStyles.cardDesc}>
            {decidable
              ? 'Test Connection 결과를 확인한 뒤 재실행을 요청하거나 설치를 완료 처리하세요.'
              : isRejected
                ? '재실행을 요청했습니다. 서비스가 다시 완료를 확인하면 처리할 수 있습니다.'
                : '서비스가 Test Connection 완료를 확인하면 처리할 수 있습니다.'}
          </p>
        </div>
        {decidable && (
          <div className="flex flex-none gap-2">
            <PlButton variant="secondary" onClick={() => setRerunOpen(true)}>
              재실행 요청
            </PlButton>
            <PlButton variant="primary" onClick={() => setApproveOpen(true)}>
              PII Agent 설치 완료
            </PlButton>
          </div>
        )}
      </div>

      {/* 무엇을 승인하는가 — Test Connection 탭으로 돌아가지 않아도 근거가 읽히도록
          같은 집계를 여기 둔다. */}
      <div className="mt-5">
        <p className="text-[16px] font-semibold text-[var(--pl-text-strong)]">승인 대상</p>
        <div className="mt-2.5 grid grid-cols-5 gap-2">
          <TcStatTile label="리소스" count={stats.resourceCount} />
          <TcStatTile label="연결 성공" count={stats.successCount} tone="ok" />
          <TcStatTile label="연결 실패" count={stats.failedCount} tone="err" />
          <TcStatTile label="연동 대상 논리 DB" count={stats.includedTotal} />
          <TcStatTile label="연동 제외 논리 DB" count={stats.excludedTotal} />
        </div>
      </div>

      {(decidable || isRejected) && (
        <div className="mt-4 rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[var(--pl-text-weak)]">
              {decidable ? '서비스 완료 확인' : '재실행 요청'}
            </span>
            <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
              {fmtDateTimeSec(decidable ? status?.completedAt : status?.rejectedAt)}
            </span>
          </div>
          {isRejected && status?.rejectReason && (
            <p className={cn(pipelineStyles.text.body, 'mt-2')}>{status.rejectReason}</p>
          )}
        </div>
      )}

      <TcRerunModal
        key={rerunOpen ? 'rerun-open' : 'rerun-closed'}
        open={rerunOpen}
        onClose={() => setRerunOpen(false)}
        targetSourceId={targetSourceId}
        onSubmit={(reason) => void rerun.mutate(reason)}
        submitting={rerun.loading}
      />

      <TcApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        targetSourceId={targetSourceId}
        serviceName={detail.service_name ?? '이 서비스'}
        stats={stats}
        onSubmit={() => void approve.execute()}
        submitting={approve.loading}
      />
    </section>
  );
}
