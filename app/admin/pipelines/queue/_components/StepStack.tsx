/**
 * StepStack — the monitor "프로세스 상태" cell (`.stx`): a mono "Step n" caption
 * over a single neutral gray tag with the Korean step label. Per owner feedback
 * the process status is NEVER color-coded by state — one gray badge + the Step
 * prefix carry the meaning (design spec §8). The 7-step mapping is the storyboard
 * §1 ProcessStatus → Step lattice; `STEP` is exported for reuse (Step select,
 * detail headers).
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

/** Target Source process status (storyboard §1) — one status per pipeline step. */
export type ProcessStatus =
  | 'IDLE'
  | 'PENDING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'INSTALLED'
  | 'CONNECTED'
  | 'COMPLETED';

export interface StepInfo {
  /** 1-based step number. */
  n: number;
  /** Korean step label. */
  label: string;
}

/** ProcessStatus → { step number, Korean label }. */
export const STEP: Record<ProcessStatus, StepInfo> = {
  IDLE: { n: 1, label: '연동 대상 DB 선택' },
  PENDING: { n: 2, label: '연동 대상 승인 대기' },
  CONFIRMING: { n: 3, label: '연동 대상 반영중' },
  CONFIRMED: { n: 4, label: 'Agent 설치' },
  INSTALLED: { n: 5, label: '연결 테스트' },
  CONNECTED: { n: 6, label: '관리자 승인 대기' },
  COMPLETED: { n: 7, label: '완료' },
};

export interface StepStackProps {
  status: ProcessStatus;
  className?: string;
}

export function StepStack({ status, className }: StepStackProps): ReactElement {
  const { stepStack } = tqStyles;
  const step = STEP[status];
  return (
    <span className={cn(stepStack.wrap, className)}>
      <span className={stepStack.step}>Step {step.n}</span>
      <span className={stepStack.label}>{step.label}</span>
    </span>
  );
}
