'use client';

/**
 * Shared grammar for the Test Connection tab family — the run-status pill and
 * the stat tile. Same vocabulary as the scan tab (dot-free tinted pill, label
 * over number tile), so the two operator tabs read as one system; `TimeField`
 * and `fmtDuration` are imported from scanShared rather than restated here.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import type { TcExecutionStatus } from '@/app/lib/api/task-queue-tc';
import {
  TC_TONE_FILL,
  type TcTone,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

/** 실행 상태(회차) — PENDING/RUNNING are both "아직 안 끝남". */
const RUN_META: Record<TcExecutionStatus, { tone: TcTone; label: string }> = {
  SUCCESS: { tone: 'ok', label: '성공' },
  FAIL: { tone: 'err', label: '실패' },
  RUNNING: { tone: 'warn', label: '진행 중' },
  PENDING: { tone: 'warn', label: '대기' },
  UNKNOWN: { tone: 'off', label: 'Unknown' },
};

export function TcRunPill({ status }: { status: TcExecutionStatus }): ReactElement {
  const meta = RUN_META[status];
  return (
    <span
      className={cn(
        pipelineStyles.pill.base,
        pipelineStyles.pill.md,
        // The run table lives in a half-width card — without this the two-syllable
        // labels wrap to two lines inside the pill.
        'whitespace-nowrap',
        TC_TONE_FILL[meta.tone],
      )}
    >
      {meta.label}
    </span>
  );
}

/**
 * Stat tile — label (12/500 weak) over number (16/500 strong), the scan tab's
 * ResourceTypeTile grammar. A zero count keeps the dashed, faint treatment so
 * "없음" stays visible instead of vanishing from the grid.
 */
export function TcStatTile({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  /** Colors the number only — the tile chrome stays neutral. */
  tone?: 'ok' | 'err';
}): ReactElement {
  const empty = count === 0;
  return (
    <div
      className={cn(
        'min-w-0 rounded-[6px] border bg-[var(--pl-bg-card)] px-3 py-2 shadow-[var(--pl-shadow-sm)]',
        empty ? 'border-dashed border-[var(--pl-border)]' : 'border-[var(--pl-border)]',
      )}
    >
      <p
        className={cn(
          'truncate text-[12px] font-medium',
          empty ? 'text-[var(--pl-text-faint)]' : 'text-[var(--pl-text-weak)]',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-[16px] font-medium tabular-nums',
          empty
            ? 'text-[var(--pl-text-faint)]'
            : tone === 'ok'
              ? 'text-[var(--pl-ok-text)]'
              : tone === 'err'
                ? 'text-[var(--pl-err-text)]'
                : 'text-[var(--pl-text-strong)]',
        )}
      >
        {count.toLocaleString('ko-KR')}
      </p>
    </div>
  );
}
