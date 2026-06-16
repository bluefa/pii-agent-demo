'use client';

import { Modal } from '@/app/components/ui/Modal';
import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  numericFeatures,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

interface IdcSubmitModalProps {
  isOpen: boolean;
  total: number;
  live: number;
  excluded: number;
  /** Disable the submit button while the mutation is in flight. */
  submitting: boolean;
  /** 제출하기 — parent runs updateIdcResources + refreshProject. */
  onSubmit: () => void;
  /** 머무르기 / close. */
  onClose: () => void;
}

interface StatProps {
  label: string;
  value: number;
  dotClass?: string;
  valueClass?: string;
}

const Stat = ({ label, value, dotClass, valueClass }: StatProps) => (
  <div className={cn('rounded-xl border px-4 py-3.5', borderColors.default, bgColors.muted)}>
    <div className={cn('flex items-center gap-1.5 text-[12px] font-medium', textColors.tertiary)}>
      {dotClass && <span className={cn('h-2 w-2 rounded-full', dotClass)} />}
      {label}
    </div>
    <div className={cn('mt-1 text-[24px] font-bold', numericFeatures.tabular, valueClass ?? textColors.primary)}>
      {value}
      <span className={cn('ml-0.5 text-[13px] font-medium', textColors.tertiary)}>건</span>
    </div>
  </div>
);

/**
 * Approval-request confirmation. Three stats (전체/연동/미연동) +
 * 머무르기/제출하기 (v15 idcSubmitModal).
 */
export const IdcSubmitModal = ({
  isOpen,
  total,
  live,
  excluded,
  submitting,
  onSubmit,
  onClose,
}: IdcSubmitModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="연동 대상을 승인 요청할까요?"
    subtitle="요청 후에는 관리자 검토가 시작되며, 변경이 필요하면 요청을 취소하고 다시 제출해야 해요."
    size="xl"
    chrome="toss"
    footer={
      <>
        <button type="button" className={idcStyles.modalBtn.outline} onClick={onClose}>
          머무르기
        </button>
        <button type="button" className={idcStyles.modalBtn.primary} disabled={submitting} onClick={onSubmit}>
          제출하기
        </button>
      </>
    }
  >
    <div className="grid grid-cols-3 gap-3">
      <Stat label="전체 리소스" value={total} />
      <Stat label="연동 대상" value={live} dotClass={statusColors.info.dot} valueClass={primaryColors.text} />
      <Stat label="미연동 대상" value={excluded} dotClass={statusColors.pending.dot} />
    </div>
  </Modal>
);
