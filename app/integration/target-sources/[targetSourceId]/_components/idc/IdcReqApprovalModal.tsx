'use client';

import { useEffect } from 'react';
import { cn, idcStyles, interactiveColors, modalStyles } from '@/lib/theme';
import { StatTile } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcResourceView } from '@/app/lib/api/idc';

interface IdcReqApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: readonly IdcResourceView[];
  onSubmit: () => void;
}

/**
 * IDC 완료 승인 요청 modal — v16 `#idcReqApprovalModal` (820px). Summary stats +
 * read-only target table + a red warn when any live target is not yet connected.
 * Submit is gated: every live target must have a credential AND a Success connection.
 */
export const IdcReqApprovalModal = ({ isOpen, onClose, resources, onSubmit }: IdcReqApprovalModalProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const live = resources.filter((r) => !r.excluded);
  const total = live.length;
  const ok = live.filter((r) => !!r.credentialId && r.connection === 'SUCCESS').length;
  const waiting = total - ok;
  const blocked = waiting > 0;

  return (
    <div
      className={modalStyles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn('mx-4 w-full max-w-[820px] overflow-hidden bg-white', modalStyles.toss.container)}
        role="dialog"
        aria-modal="true"
        aria-label="완료 승인 요청"
      >
        <div className={cn(modalStyles.toss.header, 'flex items-start justify-between')}>
          <div>
            <span className={idcStyles.reqModal.eyebrow}>
              <span className={idcStyles.reqModal.eyebrowDot} />
              Step 5 · IDC 연결 테스트
            </span>
            <h2 className={idcStyles.reqModal.title}>완료 승인 요청</h2>
            <p className={idcStyles.reqModal.sub}>
              수동 등록한 연동 대상에 대해 완료 승인을 요청합니다. 모든 대상의 자격 증명이 등록되고 연결 상태가
              정상이어야 요청할 수 있어요. 요청 후 관리자 검토가 시작됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className={cn('rounded-lg p-2 transition-colors', interactiveColors.closeButton)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={modalStyles.toss.body}>
          <div className="mb-[18px] grid grid-cols-3 gap-3">
            <StatTile label="전체 연동 대상" value={total} unit="건" />
            <StatTile label="연결 성공" value={ok} unit="건" swatch="target" />
            <StatTile label="연결 대기" value={waiting} unit="건" swatch="exclude" />
          </div>
          <div className={idcStyles.table.frame}>
            <IdcResourceTable resources={resources} cols={['conn']} />
          </div>
          {blocked && (
            <div className={idcStyles.reqModal.warn}>
              연결 미완료 {waiting}건이 있어요 — 자격 증명을 선택하고 Run Test를 실행해 모든 대상이 Success가 되어야
              요청할 수 있어요.
            </div>
          )}
        </div>

        <div className={modalStyles.toss.footer}>
          <button type="button" onClick={onClose} className={idcStyles.modalBtn.gray}>
            취소
          </button>
          <button type="button" onClick={onSubmit} disabled={blocked} className={idcStyles.modalBtn.primary}>
            요청하기
          </button>
        </div>
      </div>
    </div>
  );
};
