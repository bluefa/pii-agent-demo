/**
 * Task Queue leaf pieces (design spec §7/§8) — small stateless bits shared across
 * the NLB / reject-reason / modal surfaces. Grouped in one file since each is a
 * few lines; every color routes through tqStyles → --pl-* tokens.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

const NLB_CAPACITY = 50;
type OccTone = 'ok' | 'warn' | 'err';

/** NLB occupancy tone — <30 여유(ok) · ≥30 주의(warn) · ≥50 Hard Limit(err). */
function occTone(occupied: number, capacity: number): OccTone {
  if (occupied >= capacity) return 'err';
  if (occupied >= capacity * 0.6) return 'warn';
  return 'ok';
}

export interface OccBarProps {
  /** Occupied listener count. */
  occupied: number;
  /** Total capacity — default 50. */
  capacity?: number;
  className?: string;
}

/** 96×6 NLB occupancy bar (`.occbar`), fill tone by occupancy. */
export function OccBar({ occupied, capacity = NLB_CAPACITY, className }: OccBarProps): ReactElement {
  const { occ } = tqStyles;
  const tone = occTone(occupied, capacity);
  const pct = Math.min(100, Math.max(0, (occupied / capacity) * 100));
  return (
    <span className={cn(occ.bar, className)}>
      <i className={cn(occ.fill, occ.fillTone[tone])} style={{ width: `${pct}%` }} />
    </span>
  );
}

const FTAG_LABEL: Record<OccTone, string> = { ok: '여유', warn: '주의', err: 'Hard Limit' };
const FTAG_TONE: Record<OccTone, string> = {
  ok: tqStyles.ftag.na,
  warn: tqStyles.ftag.warn,
  err: tqStyles.ftag.err,
};

export interface FtagBadgeProps {
  occupied: number;
  capacity?: number;
  className?: string;
}

/** NLB free-capacity badge (`.ftag`) — 여유 / 주의 / Hard Limit by occupancy. */
export function FtagBadge({
  occupied,
  capacity = NLB_CAPACITY,
  className,
}: FtagBadgeProps): ReactElement {
  const tone = occTone(occupied, capacity);
  return <span className={cn(tqStyles.ftag.base, FTAG_TONE[tone], className)}>{FTAG_LABEL[tone]}</span>;
}

export interface RejectReasonCellProps {
  /** Full rejection reason — truncated inline, revealed on hover. */
  reason: string;
  className?: string;
}

/** 반려 사유 cell (`.rr`) — 260px truncated text + gray-900 hover tooltip. */
export function RejectReasonCell({ reason, className }: RejectReasonCellProps): ReactElement {
  const { rr } = tqStyles;
  return (
    <span className={cn(rr.wrap, className)}>
      <span className={rr.text}>{reason}</span>
      <span className={rr.tip}>{reason}</span>
    </span>
  );
}

export interface CharCountProps {
  /** Current character count. */
  count: number;
  /** Max allowed (e.g. 1024 / 512). */
  max: number;
  className?: string;
}

/** Textarea character counter (`.am-count`) — "n/1,024" right-aligned tabular. */
export function CharCount({ count, max, className }: CharCountProps): ReactElement {
  return (
    <div className={cn(tqStyles.modal.count, className)}>
      {count.toLocaleString()}/{max.toLocaleString()}
    </div>
  );
}

export interface TqEmptyStateProps {
  /** Primary line — 16/600 strong. */
  title: ReactNode;
  /** Secondary line — 14 weak. */
  caption?: ReactNode;
  className?: string;
}

/** Large empty state (`.empty-state`) — 44px inbox circle + title + caption.
 *  Distinct metrics from PlEmptyState (40 circle / 22 icon / left-message). */
export function TqEmptyState({ title, caption, className }: TqEmptyStateProps): ReactElement {
  const { empty } = tqStyles;
  return (
    <div className={cn(empty.wrap, className)}>
      <span className={empty.icon}>
        <Icon name="inbox" size="md" />
      </span>
      <span className={empty.title}>{title}</span>
      {caption != null && <span className={empty.caption}>{caption}</span>}
    </div>
  );
}
