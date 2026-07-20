/**
 * TcStatePill — the P5 head-sub status badge (`.pill.t-ok` / `.pill.t-err`):
 * 연결 테스트 완료 (ok tone) vs 재실행 요청 (err tone). A local wrapper rather than the
 * shared StatusPill, whose tone map is keyed to pipeline/task statuses. Colors
 * resolve through --pl-* tokens (raw-color rule).
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export interface TcStatePillProps {
  /** 연결 테스트 완료 (ok) when true, else 재실행 요청 (err). */
  done: boolean;
}

export function TcStatePill({ done }: TcStatePillProps): ReactElement {
  const { pill } = pipelineStyles;
  const tone = done
    ? 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]'
    : 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]';
  const dotTone = done ? 'bg-[var(--pl-ok)]' : 'bg-[var(--pl-err)]';
  return (
    <span className={cn(pill.base, pill.md, tone)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dotTone)} />
      {done ? '연결 테스트 완료' : '재실행 요청'}
    </span>
  );
}
