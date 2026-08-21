/**
 * StepPill — "n단계 · label" pill for process statuses (Figma 4:91 grammar).
 * Tone maps the Figma per-step hues onto semantic tokens: waiting states read
 * warn, in-flight states read primary, terminal reads ok, initial reads off.
 *
 * 틴트 면과 글자색이 이미 계열을 말하므로 그 안에 색 점을 또 두지 않는다 (오너 08-20).
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

const TONE_CLASS: Record<Tone, string> = {
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  primary: 'bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
};

export interface StepPillProps {
  status: ProcessStatus;
  className?: string;
}

export function StepPill({ status, className }: StepPillProps): ReactElement {
  const step = STEP[status];
  const { pill } = pipelineStyles;
  return (
    <span className={cn(pill.base, pill.md, TONE_CLASS[STATUS_TONE[status]], className)}>
      {step.n}단계 · {step.label}
    </span>
  );
}
