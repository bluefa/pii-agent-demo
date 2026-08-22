'use client';

import { primaryColors } from '@/lib/theme';
import { ConfirmStepModal, type ConfirmStepResult } from '@/app/components/ui/ConfirmStepModal';
import { approvalFailureCopy } from '@/app/components/ui/confirm-failures';
import type { ConfirmSubmitPhase } from '@/app/hooks/useConfirmSubmit';
import { StatTile } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcResourceView } from '@/app/lib/api/idc';
import type { UnitTcStatus } from '@/lib/test-connection-summary';
import type { AppErrorCode } from '@/lib/errors';

interface IdcReqApprovalModalProps {
  isOpen: boolean;
  resources: readonly IdcResourceView[];
  /** 최근 실행의 리소스별 판정 — 5단계 표가 읽는 것과 같은 맵(IdcResourceTable 참고). */
  connectionStatus: ReadonlyMap<string, UnitTcStatus>;
  connectionLoading: boolean;
  connectionHasRun: boolean | null;
  /** 지금 그릴 프레임 (useConfirmSubmit). */
  phase: ConfirmSubmitPhase;
  pending: boolean;
  errorCode?: AppErrorCode;
  onSubmit: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const RESULTS: Record<'success' | 'error', ConfirmStepResult> = {
  success: {
    kind: 'success',
    title: '승인 요청을 보냈어요',
    description: '잠시 후 관리자 승인 대기 단계로 이동해요.',
  },
  error: {
    kind: 'error',
    title: '승인 요청을 보내지 못했어요',
    description: '연결 테스트 결과와 논리 DB 설정은 그대로 남아 있어요.',
  },
};

/**
 * IDC 완료 승인 요청 — 클라우드(CloudReqApprovalModal)·1단계 승인 요청과 같은 확인 문법이다.
 *
 * 표는 5단계가 쓰는 `IdcResourceTable` 그대로다. 손으로 뜬 표를 따로 두었더니 같은 판정을
 * 두 어휘로 말했다 — 모달은 Success/Fail, 두 줄 위의 5단계 표는 성공/실패였다.
 */
export const IdcReqApprovalModal = ({
  isOpen,
  resources,
  connectionStatus,
  connectionLoading,
  connectionHasRun,
  phase,
  pending,
  errorCode,
  onSubmit,
  onRetry,
  onClose,
}: IdcReqApprovalModalProps) => {
  const live = resources.filter((r) => !r.excluded);
  const total = live.length;
  const ok = live.filter((r) => !!r.credentialId && r.connection === 'SUCCESS').length;
  const waiting = total - ok;
  const failure = approvalFailureCopy(errorCode);

  return (
    <ConfirmStepModal
      open={isOpen}
      onClose={onClose}
      onConfirm={onSubmit}
      isPending={pending}
      // 카드의 CTA 가 이미 막지만, 모달이 스스로도 막는다 — 열려 있는 사이에 자격 증명이
      // 바뀌면 카드의 게이트는 다음 렌더에나 반영된다.
      confirmDisabled={waiting > 0}
      result={
        phase === 'success'
          ? RESULTS.success
          : phase === 'error'
            ? { ...RESULTS.error, reason: failure.reason }
            : null
      }
      onRetry={failure.retry ? onRetry : undefined}
      title="연동 완료 승인을 요청할까요?"
      description={
        <>
          <span className={primaryColors.text}>
            수동 등록한 연동 대상 {total}건의 연결 테스트 결과로 완료 승인을 요청해요
          </span>
          . 요청 후에는 관리자 검토가 시작되고, 변경하려면 요청을 취소하고 다시 제출해야 해요.
        </>
      }
      confirmLabel="요청하기"
      size="lg"
    >
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="연동 대상" value={total} unit="건" />
        <StatTile label="연결 성공" value={ok} unit="건" swatch="target" />
        <StatTile label="연결 대기" value={waiting} unit="건" swatch="exclude" />
      </div>

      <div className="mt-4">
        <IdcResourceTable
          resources={live}
          // 자격 증명은 고치는 칸이고 출발지는 참고값이다 — 확인 화면에는 승인의 근거인
          // 판정만 세운다.
          cols={['conn']}
          connectionStatusByResource={connectionStatus}
          connectionLoading={connectionLoading}
          connectionHasRun={connectionHasRun}
        />
      </div>
    </ConfirmStepModal>
  );
};
