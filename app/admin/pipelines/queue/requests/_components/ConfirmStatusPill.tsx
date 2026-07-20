/**
 * ConfirmStatusPill — the 요청 상태 badge for the P3 header (design-spec §3
 * head-sub). The shared `StatusPill` renders the pipeline/task enums; this pill
 * covers two overlapping-key vocabularies on the same `.pill` grammar
 * (design-inventory §3), colors via --pl-* tokens:
 *  - the approval-request axis (ApprovalRequestSummaryDto.status — the primary
 *    P3 source): PENDING / APPROVED / AUTO_APPROVED / REJECTED / CANCELLED /
 *    UNAVAILABLE / UNAVAILABLE_ACKNOWLEDGED;
 *  - the target-source confirmStatus axis (P2 fallback): NO_REQUEST / IDLE /
 *    CONFIRMING / CONFIRMED.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';

type Tone = 'off' | 'warn' | 'run' | 'ok' | 'err';

interface ToneSpec {
  label: string;
  tone: Tone;
}

/** Both axes' status keys → Korean label + tone (keys are distinct across the
 *  two vocabularies, so one map serves the request-axis primary and the
 *  confirmStatus fallback). */
const CONFIRM_TONE: Record<string, ToneSpec> = {
  // Target-source confirmStatus axis (P2 fallback).
  NO_REQUEST: { label: '요청 없음', tone: 'off' },
  IDLE: { label: '요청 없음', tone: 'off' },
  CONFIRMING: { label: '반영중', tone: 'run' },
  CONFIRMED: { label: '확정', tone: 'ok' },
  // Approval-request axis (ApprovalRequestSummaryDto.status — P3 primary).
  PENDING: { label: '승인 대기', tone: 'warn' },
  APPROVED: { label: '승인 완료', tone: 'ok' },
  AUTO_APPROVED: { label: '자동 승인', tone: 'ok' },
  REJECTED: { label: '반려', tone: 'err' },
  CANCELLED: { label: '요청 취소', tone: 'off' },
  UNAVAILABLE: { label: '연동 불가', tone: 'off' },
  UNAVAILABLE_ACKNOWLEDGED: { label: '연동 불가', tone: 'off' },
};

const TONE_CLASS: Record<Tone, { pill: string; dot: string }> = {
  off: { pill: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', dot: 'bg-[var(--pl-gray-300)]' },
  warn: { pill: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]', dot: 'bg-[var(--pl-warn)]' },
  run: { pill: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]', dot: 'bg-[var(--pl-info)]' },
  ok: { pill: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', dot: 'bg-[var(--pl-ok)]' },
  err: { pill: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', dot: 'bg-[var(--pl-err)]' },
};

export interface ConfirmStatusPillProps {
  status: string | null;
  className?: string;
}

export function ConfirmStatusPill({ status, className }: ConfirmStatusPillProps): ReactElement {
  const spec = (status && CONFIRM_TONE[status]) || CONFIRM_TONE.NO_REQUEST;
  const tone = TONE_CLASS[spec.tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-5 pr-[9px] pl-2 rounded-full text-[12px] font-semibold tracking-[0.02em]',
        tone.pill,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', tone.dot)} />
      {spec.label}
    </span>
  );
}
