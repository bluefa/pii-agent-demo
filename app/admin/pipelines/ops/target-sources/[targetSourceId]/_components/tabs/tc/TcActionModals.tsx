/**
 * Test Connection action modals (design-spec §6):
 *  - TcRerunModal   연결 테스트 재실행 요청 — 요청 사유(필수, maxLength 512) → POST reject.
 *  - TcApproveModal 연동 승인 — am-stats 3 tiles (리소스/연동 대상/연동 제외) → POST confirm.
 * Each owns only its form chrome; the parent owns the mutation + refetch.
 */
'use client';

import { useState, type ReactElement } from 'react';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { CharCount } from '@/app/admin/pipelines/queue/_components/bits';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import type { TcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const REASON_MAX = 512;

export interface TcRerunModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  onSubmit: (reason: string) => void;
  submitting: boolean;
}

export function TcRerunModal({
  open,
  onClose,
  targetSourceId,
  onSubmit,
  submitting,
}: TcRerunModalProps): ReactElement {
  const { modal } = tqStyles;
  // Parent keys this modal by open-state, so each open remounts with a blank
  // reason — no reset effect needed.
  const [reason, setReason] = useState('');

  const trimmed = reason.trim();
  const disabled = trimmed.length === 0 || submitting;

  return (
    <TqModal
      open={open}
      onClose={onClose}
      eyebrowCtx="연결 테스트"
      eyebrowId={`#${targetSourceId}`}
      title="연결 테스트 재실행 요청"
      sub="서비스에 연결 테스트를 다시 실행해 달라고 요청해요. 사유는 서비스 오너에게 그대로 전달돼요."
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton variant="dangerSolid" onClick={() => onSubmit(trimmed)} disabled={disabled}>
            재실행 요청
          </PlButton>
        </>
      }
    >
      <label className={modal.label} htmlFor="tc-rerun-reason">
        요청 사유 · 필수
      </label>
      <textarea
        id="tc-rerun-reason"
        className={modal.textarea}
        value={reason}
        maxLength={REASON_MAX}
        onChange={(event) => setReason(event.target.value.slice(0, REASON_MAX))}
        placeholder="재실행이 필요한 사유를 입력해 주세요"
      />
      <CharCount count={reason.length} max={REASON_MAX} />
    </TqModal>
  );
}

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
