/**
 * Test Connection 탭 공용 bits — tone palette + the two atoms every TC card needs.
 * Tones are the design HTML's `.pill.ok/.warn/.err/.off` pairs resolved through
 * --pl-* tokens; `TcPill` is the dotted pill, the same pairs serve the flat tag
 * (`opsStyles.statusTag`) used by the 이력 table.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export type TcTone = 'ok' | 'warn' | 'err' | 'off';

/** bg + text pair — shared by the dotted pill and the flat status tag. */
export const TC_TONE_FILL: Record<TcTone, string> = {
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-text-weak)]',
};

const TC_TONE_DOT: Record<TcTone, string> = {
  ok: 'bg-[var(--pl-ok)]',
  warn: 'bg-[var(--pl-warn)]',
  err: 'bg-[var(--pl-err)]',
  off: 'bg-[var(--pl-off)]',
};

export function TcPill({ tone, label }: { tone: TcTone; label: string }): ReactElement {
  const { pill } = pipelineStyles;
  return (
    <span className={cn(pill.base, pill.md, TC_TONE_FILL[tone])}>
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TC_TONE_DOT[tone])} />
      {label}
    </span>
  );
}

/** Absent value — never rendered as 0 or an assumed success. */
export const Dash = (): ReactElement => <span className="text-[var(--pl-text-faint)]">—</span>;
