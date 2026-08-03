/**
 * StepPill — "n단계 · label" dot pill for process statuses (Figma 4:91 grammar).
 * Tone maps the Figma per-step hues onto semantic tokens: waiting states read
 * warn, in-flight states read primary, terminal reads ok, initial reads off.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';

type Tone = 'off' | 'warn' | 'primary' | 'ok';

const STATUS_TONE: Record<ProcessStatus, Tone> = {
  IDLE: 'off',
  PENDING: 'warn',
  CONFIRMING: 'primary',
  CONFIRMED: 'primary',
  INSTALLED: 'primary',
  CONNECTED: 'warn',
  COMPLETED: 'ok',
};

const TONE_CLASS: Record<Tone, { pill: string; dot: string }> = {
  off: { pill: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', dot: 'bg-[var(--pl-gray-300)]' },
  warn: { pill: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]', dot: 'bg-[var(--pl-warn)]' },
  primary: { pill: 'bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]', dot: 'bg-[var(--pl-primary)]' },
  ok: { pill: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', dot: 'bg-[var(--pl-ok)]' },
};

export interface StepPillProps {
  status: ProcessStatus;
  className?: string;
}

export function StepPill({ status, className }: StepPillProps): ReactElement {
  const step = STEP[status];
  const tone = TONE_CLASS[STATUS_TONE[status]];
  const { pill } = pipelineStyles;
  return (
    <span className={cn(pill.base, pill.md, tone.pill, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-none', tone.dot)} aria-hidden />
      {step.n}단계 · {step.label}
    </span>
  );
}
