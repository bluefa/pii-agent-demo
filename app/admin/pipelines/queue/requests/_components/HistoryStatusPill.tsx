/**
 * HistoryStatusPill — the 상태 badge for the 전체 History 확인 section
 * (approval-history list). Same `.pill` grammar as ConfirmStatusPill, but a
 * distinct approval-history vocabulary: it keeps its own labels/tones so it can
 * differ from the P3 header pill (연동 불가 reads as an error here, and unknown
 * enum values fall back to their raw string on a gray pill).
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';

type Tone = 'off' | 'warn' | 'ok' | 'err';

interface ToneSpec {
  label: string;
  /** Full wording when the label is an abbreviation — surfaced as the title. */
  title?: string;
  tone: Tone;
}

/**
 * Approval-history status enum → Korean label + tone.
 *
 * `title` carries the long form when the label had to be short enough to fit a
 * table cell. UNAVAILABLE_ACKNOWLEDGED's old label ran 25 characters (~285px at
 * 12px) — wider than any column this pill appears in, so it was hard-cut
 * mid-word with no way to recover the text (a pill is an atomic inline-flex box,
 * so `text-overflow: ellipsis` never applies to it). Who confirmed it moves to
 * the hover title; the label keeps what the row is.
 */
const HISTORY_TONE: Record<string, ToneSpec> = {
  PENDING: { label: '승인 대기', tone: 'warn' },
  APPROVED: { label: '승인', tone: 'ok' },
  AUTO_APPROVED: { label: '자동 승인', tone: 'ok' },
  REJECTED: { label: '반려', tone: 'err' },
  CANCELLED: { label: '취소', tone: 'off' },
  UNAVAILABLE: { label: '연동 불가', tone: 'err' },
  UNAVAILABLE_ACKNOWLEDGED: {
    label: '연동 불가 확인',
    title: '연동 불가 확인 (서비스 측 담당자 확인)',
    tone: 'off',
  },
};

const TONE_CLASS: Record<Tone, { pill: string; dot: string }> = {
  off: { pill: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', dot: 'bg-[var(--pl-gray-300)]' },
  warn: { pill: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]', dot: 'bg-[var(--pl-warn)]' },
  ok: { pill: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', dot: 'bg-[var(--pl-ok)]' },
  err: { pill: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', dot: 'bg-[var(--pl-err)]' },
};

export interface HistoryStatusPillProps {
  status: string | null;
  className?: string;
}

export function HistoryStatusPill({ status, className }: HistoryStatusPillProps): ReactElement {
  // Unknown value → gray pill carrying the raw string (honest fallback).
  const spec = (status && HISTORY_TONE[status]) || { label: status ?? '—', tone: 'off' as const };
  const tone = TONE_CLASS[spec.tone];
  return (
    <span
      title={spec.title}
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
