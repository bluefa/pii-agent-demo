'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import {
  bgColors,
  borderColors,
  cn,
  numericFeatures,
  primaryColors,
  textColors,
} from '@/lib/theme';

interface IdcSubmitModalProps {
  isOpen: boolean;
  total: number;
  live: number;
  excluded: number;
  /** Disable the buttons while the mutation is in flight. */
  submitting: boolean;
  /** 요청하기 — parent runs createApprovalRequest + refreshProject. */
  onSubmit: () => void;
  /** 머무르기 / close. */
  onClose: () => void;
}

interface StatProps {
  label: string;
  value: number;
  valueClass?: string;
}

// Centered tile, 36px number: the three counts ARE the modal's payload, so they
// carry the display tier while the label stays quiet above them. No status dots —
// the blue number already marks the one count that matters.
const Stat = ({ label, value, valueClass }: StatProps) => (
  <div className={cn('rounded-xl border px-4 py-4 text-center', borderColors.default, bgColors.muted)}>
    <div className={cn('text-[14px] font-medium', textColors.tertiary)}>
      {label}
    </div>
    <div className={cn('mt-1 text-[36px] font-bold leading-[1.2]', numericFeatures.tabular, valueClass ?? textColors.primary)}>
      {value}
      <span className={cn('ml-1 text-[13px] font-medium', textColors.tertiary)}>건</span>
    </div>
  </div>
);

/**
 * Approval-request confirmation on the unified step-flow confirm grammar
 * (ConfirmStepModal): question title, one cause→effect sentence, compact
 * button pair, no close-X, no footer hairline. Body = the three counts.
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
  <ConfirmStepModal
    open={isOpen}
    onClose={onClose}
    onConfirm={onSubmit}
    isPending={submitting}
    title="연동 대상을 승인 요청할까요?"
    description="요청 후에는 관리자 검토가 시작되고, 변경하려면 취소 후 다시 요청해야 해요."
    confirmLabel="요청하기"
    wide
  >
    <div className="grid grid-cols-3 gap-3">
      <Stat label="전체 리소스" value={total} />
      <Stat label="연동 대상" value={live} valueClass={primaryColors.text} />
      <Stat label="미연동 대상" value={excluded} />
    </div>
  </ConfirmStepModal>
);
