'use client';

/**
 * Shared grammar for the Test Connection tab family — the run-status pill.
 * Same vocabulary as the scan tab (dot-free tinted pill), so the two operator
 * tabs read as one system; `TimeField` and `fmtDuration` are imported from
 * scanShared rather than restated here. (TcStatTile lived here until the
 * approval tab replaced its tiles with an inline kv line — PR #743.)
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
  UNKNOWN: { tone: 'off', label: '미확인' },
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
