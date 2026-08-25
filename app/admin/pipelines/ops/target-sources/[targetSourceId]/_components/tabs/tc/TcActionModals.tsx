/**
 * Test Connection action modal (design-spec §6):
 *  - TcApproveModal 연동 승인 — am-stats 3 tiles (리소스/연동 대상/연동 제외) → POST confirm.
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
