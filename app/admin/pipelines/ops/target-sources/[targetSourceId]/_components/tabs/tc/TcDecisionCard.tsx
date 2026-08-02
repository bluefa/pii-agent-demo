'use client';

/**
 * 관리자 처리 card — the one decision this tab exists for.
 *
 * Flow: 서비스가 Target Source 상세에서 Test Connection 완료 확인(PUT
 * …/test-connection-acknowledgment)을 누르면 Step 5 → Step 6 으로 넘어오고, 관리자는
 * 결과를 보고 둘 중 하나를 고른다 —
 *   재실행 요청        POST …/test-connection/reject          (서비스 단계로 되돌림)
 *   PII Agent 설치 완료 POST …/pii-agent-installation/confirm  (연동 확정)
 *
 * Both are gated on the service's 완료 확인 (status = TEST_CONNECTION_COMPLETED);
 * before that there is nothing to decide, so the card states what it is waiting
 * for instead of showing dead buttons.
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
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
import type { TcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const COMPLETED = 'TEST_CONNECTION_COMPLETED';
const REJECTED = 'TEST_CONNECTION_REJECTED';

export interface TcDecisionCardProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  status: TestConnectionStatusRow | null;
  stats: TcResultStats;
  onReload: () => void;
}

export function TcDecisionCard({
  targetSourceId,
  detail,
  status,
  stats,
  onReload,
}: TcDecisionCardProps): ReactElement {
  const toast = usePlToast();
  const [rerunOpen, setRerunOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  // On failure the modal stays open and the error surfaces via the section toast.
  const rerun = useApiMutation((reason: string) => rejectTestConnection(targetSourceId, reason), {
    onSuccess: () => {
      setRerunOpen(false);
      toast.show('재실행을 요청했습니다.');
      onReload();
    },
    onError: () => toast.show('재실행 요청에 실패했습니다.'),
  });

  const approve = useApiAction(() => confirmInstallation(targetSourceId), {
    onSuccess: () => {
      setApproveOpen(false);
      toast.show('PII Agent 설치를 완료 처리했습니다.');
      onReload();
    },
    onError: () => toast.show('설치 완료 처리에 실패했습니다.'),
  });

  const decidable = status?.status === COMPLETED;
  const isRejected = status?.status === REJECTED;

  return (
    <section className={pipelineStyles.card.base} aria-label="관리자 처리">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="check" size={18} className="text-[var(--pl-primary)]" />
            관리자 처리
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
            <PlButton variant="danger" onClick={() => setRerunOpen(true)}>
              재실행 요청
            </PlButton>
            <PlButton variant="primary" onClick={() => setApproveOpen(true)}>
              PII Agent 설치 완료
            </PlButton>
          </div>
        )}
      </div>

      {decidable && (
        <p className={cn(pipelineStyles.text.meta, 'mt-3')}>
          연동 대상 논리 DB {stats.includedTotal}개 · 제외 논리 DB {stats.excludedTotal}개 ·
          리소스 {stats.resourceCount}건
        </p>
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
