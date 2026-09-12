/**
 * Test Connection action modal (design-spec §6):
 *  - TcApproveModal 연동 승인 — am-stats 3 tiles (리소스/연동 대상/연동 제외) → POST confirm.
 *  - TcRequestApprovalModal 승인 요청 — 관리자가 서비스 담당자를 대신해 5단계 승인 요청을
 *    보낸다 (PUT …/test-connection-acknowledgment, confirmed:true). 단계가 넘어가는 쓰기라
 *    한 겹 확인을 둔다.
 * It owns only its form chrome; the parent owns the mutation + refetch.
 */
'use client';

import type { ReactElement } from 'react';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import type { TcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

export interface TcApproveModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  serviceName: string;
  stats: TcResultStats;
  onSubmit: () => void;
  submitting: boolean;
}

export function TcApproveModal({
  open,
  onClose,
  targetSourceId,
  serviceName,
  stats,
  onSubmit,
  submitting,
}: TcApproveModalProps): ReactElement {
  const { modal } = tqStyles;
  const tiles: ReadonlyArray<{ label: string; value: number; unit: string }> = [
    { label: '리소스', value: stats.resourceCount, unit: '건' },
    { label: '연동 대상 논리 DB', value: stats.includedTotal, unit: '개' },
    { label: '연동 제외', value: stats.excludedTotal, unit: '개' },
  ];

  return (
    <TqModal
      open={open}
      onClose={onClose}
      eyebrowCtx="연결 테스트"
      eyebrowId={`#${targetSourceId}`}
      title="연동 승인"
      sub={`${serviceName}의 PII Agent 설치를 확정해요. 승인하면 연동이 완료되고 모니터링이 시작돼요.`}
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton variant="primary" onClick={onSubmit} disabled={submitting}>
            승인
          </PlButton>
        </>
      }
    >
      <div className={modal.stats.grid}>
        {tiles.map((tile) => (
          <div key={tile.label} className={modal.stats.tile}>
            <span className={modal.stats.label}>{tile.label}</span>
            <span className={modal.stats.value}>
              {tile.value}
              <span className={modal.stats.unit}>{tile.unit}</span>
            </span>
          </div>
        ))}
      </div>
    </TqModal>
  );
}

export interface TcRequestApprovalModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  onSubmit: () => void;
  submitting: boolean;
}

export function TcRequestApprovalModal({
  open,
  onClose,
  targetSourceId,
  onSubmit,
  submitting,
}: TcRequestApprovalModalProps): ReactElement {
  return (
    <TqModal
      open={open}
      onClose={onClose}
      eyebrowCtx="연결 테스트"
      eyebrowId={`#${targetSourceId}`}
      title="승인 요청"
      sub="서비스 담당자를 대신해 완료 승인을 요청합니다. 요청하면 이 대상은 6단계(관리자 승인 대기)로 넘어갑니다."
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton variant="primary" onClick={onSubmit} disabled={submitting}>
            요청
          </PlButton>
        </>
      }
    >
      <p className="text-[14px] leading-[1.6] text-[var(--pl-text-medium)]">
        승인 요청은 서비스 담당자가 5단계에서 누르는 버튼과 같은 동작입니다. 서비스 담당자가
        직접 누를 수 없을 때만 대신 보내세요.
      </p>
    </TqModal>
  );
}
