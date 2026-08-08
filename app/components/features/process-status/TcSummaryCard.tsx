'use client';

import type { ReactNode } from 'react';
import { cn, idcStyles, statusColors } from '@/lib/theme';
import { CheckIcon, ClockIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import { fmtDateTime, fmtRelativeTime } from '@/lib/pipeline/format';
import {
  tcElapsedLabel,
  tcSummarySentence,
  type TcBuckets,
  type TcRunPhase,
} from '@/lib/test-connection-summary';

export interface TcSummaryRun {
  version: number | null;
  requestedAt: string | null;
  completedAt: string | null;
}

interface TcSummaryCardProps {
  phase: TcRunPhase;
  buckets: TcBuckets;
  /** Latest run meta from latest_version — null until a run exists. */
  run: TcSummaryRun | null;
  /** completion-status === LOGICAL_DATABASE_RECENTLY_UPDATED — 재실행해야 반영된다. */
  needsRerun?: boolean;
  /** Right-side slot of the counts row — the 이력 보기 link. */
  historyAction?: ReactNode;
}

/**
 * Step 5 run summary (시안 A) — replaces the fixed-sentence ConnProgressStrip with
 * the run's own facts: a phase sentence derived from the counts, the run ordinal and
 * timestamps ("이 성공이 언제 것인지"), phase-aware buckets that never fold 미보고
 * into 대기, and the completion-status rerun chip.
 */
export const TcSummaryCard = ({ phase, buckets, run, needsRerun, historyAction }: TcSummaryCardProps) => {
  const s = idcStyles.connProgress;
  const sentence = tcSummarySentence(phase, buckets);
  const elapsed = tcElapsedLabel(run?.requestedAt, run?.completedAt);
  const settled = phase === 'success' || phase === 'fail';

  const metaParts: string[] = [];
  if (run && run.version !== null) metaParts.push(`실행 #${run.version}`);
  if (settled && run?.completedAt) {
    metaParts.push(`${fmtDateTime(run.completedAt)} 완료 (${fmtRelativeTime(run.completedAt)})`);
    if (elapsed) metaParts.push(`소요 ${elapsed}`);
  } else if (phase === 'running' && run?.requestedAt) {
    metaParts.push(`${fmtDateTime(run.requestedAt)} 요청`);
  }

  // Non-zero buckets only — but on a settled run 미보고/미확인 are anomalies and must
  // surface even though a healthy settle never produces them.
  const countParts: { label: string; value: number; className?: string }[] = [
    { label: '성공', value: buckets.ok, className: statusColors.success.textDark },
    { label: '실패', value: buckets.fail, className: statusColors.error.textDark },
  ];
  if (buckets.running > 0) countParts.push({ label: '진행 중', value: buckets.running });
  if (buckets.waiting > 0) countParts.push({ label: '대기', value: buckets.waiting });
  if (buckets.unreported > 0) countParts.push({ label: '미보고', value: buckets.unreported });
  if (buckets.unknown > 0) countParts.push({ label: '미확인', value: buckets.unknown });

  const okPct = buckets.total > 0 ? (buckets.ok / buckets.total) * 100 : 0;
  const failPct = buckets.total > 0 ? (buckets.fail / buckets.total) * 100 : 0;

  return (
    <div className={cn(s.base, s.state[phase])}>
      <div className={s.head}>
        <div className={cn(s.title, s.titleColor[phase])}>
          <span className={cn(s.icon, s.accent[phase])}>
            {phase === 'success' ? (
              <CheckIcon className="h-[15px] w-[15px]" />
            ) : (
              <ClockIcon className={cn('h-[15px] w-[15px]', phase === 'running' && 'animate-spin')} />
            )}
          </span>
          {sentence}
        </div>
        {metaParts.length > 0 && (
          <span className={cn(s.counts, 'whitespace-nowrap')}>{metaParts.join(' · ')}</span>
        )}
      </div>
      <div className={s.track}>
        {/* Segmented, not single-color: the bar carries the verdict split itself. */}
        <div className="absolute inset-y-0 left-0 flex w-full">
          <div className={cn('h-full', s.fillColor.success)} style={{ width: `${okPct}%` }} />
          <div className={cn('h-full', s.fillColor.fail)} style={{ width: `${failPct}%` }} />
        </div>
      </div>
      <div className={cn('mt-[9px] flex items-center justify-between gap-3')}>
        <span className={s.counts}>
          {countParts.map((part, index) => (
            <span key={part.label}>
              {index > 0 && ' · '}
              {part.label} <b className={cn('font-bold', part.className)}>{part.value}</b>
            </span>
          ))}
          {phase === 'running' && <span> · {buckets.pct}%</span>}
        </span>
        {historyAction}
      </div>
      {needsRerun && (
        <div
          className={cn(
            'mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold',
            statusColors.warning.bgSoft,
            statusColors.warning.textDark,
          )}
        >
          <StatusWarningIcon className="h-3.5 w-3.5 shrink-0" />
          논리 DB 정책이 변경됐어요 — 연결 테스트를 다시 실행해야 반영돼요
        </div>
      )}
    </div>
  );
};
