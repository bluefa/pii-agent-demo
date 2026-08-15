/**
 * Shared primitives for the task drawer surface (TaskDrawer + execTabs +
 * AttemptDetail + JobStatus + JobViewer): style handles, the viewer target type,
 * time helpers, and the small presentational pieces (MiniPill / Section /
 * FailureCause / OperatorDescription) reused across the sub-modules.
 */
import { type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { fmtDateTime, fmtElapsedMs } from '@/lib/pipeline/format';
import { improvedStyles } from '@/app/admin/pipelines/_detail/detailImprovedStyles';
import { jobStyles } from '@/app/admin/pipelines/_detail/detailJobStyles';
import type { JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import type { TaskAttemptView, TaskDetail } from '@/lib/pipeline/types';

export const d = improvedStyles.drawer;
export const j = jobStyles;

/** The (attempt, job) pair the log/state viewer is opened for. */
export type ViewerTarget = { attemptNumber: number; jobId: string };

/** A CONDITION_CHECK attempt's verdict label + tone. */
export function conditionVerdict(a: TaskAttemptView): { label: string; tone: JobVerdict } {
  if (a.status === 'DONE') return { label: '충족', tone: 'success' };
  if (a.status === 'IN_PROGRESS') return { label: '확인 중', tone: 'running' };
  if (a.status === 'CANCELLED') return { label: '취소', tone: 'none' };
  if (a.error_code === 'CONDITION_NOT_MET') return { label: '미충족', tone: 'none' };
  if (a.error_code === 'CALL_TIMEOUT') return { label: '타임아웃', tone: 'failed' };
  // Any other settled attempt without a recognized code — an upstream API error.
  return { label: a.error_code ? 'API 오류' : '기록 없음', tone: a.error_code ? 'failed' : 'none' };
}

export function MiniPill({ tone, children }: { tone: JobVerdict; children: ReactNode }): ReactElement {
  return <span className={cn(j.miniBadge, j.verdictTone[tone])}>{children}</span>;
}

export function Section({
  label,
  hint,
  sub = false,
  children,
}: {
  label: string;
  hint?: string;
  /** Demoted tier — a section that supports the verdict instead of competing with it. */
  sub?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <div>
      <div className={sub ? d.sectionLabelSub : d.sectionLabel}>{label}</div>
      {hint && <div className={j.labelHint}>{hint}</div>}
      {children}
    </div>
  );
}

/**
 * One attempt's window on a line — "2026-08-14 17:58 → 18:03 · 5분". The end
 * repeats its date only when the attempt crosses midnight, and the duration
 * takes `fmtElapsedMs`, the grammar the card and the exec band already use.
 * Rendered in the verdict hero for the latest attempt (시안 C) and inside the
 * attempt fold for older ones.
 */
export function attemptWindow(attempt: TaskAttemptView): string {
  const start = fmtDateTime(attempt.started_at);
  const end = fmtDateTime(attempt.finished_at);
  const sameDay = start.slice(0, 10) === end.slice(0, 10);
  const elapsed =
    attempt.started_at && attempt.finished_at
      ? fmtElapsedMs(Date.parse(attempt.finished_at) - Date.parse(attempt.started_at))
      : '-';
  return `${start} → ${sameDay ? end.slice(11) : end}${elapsed === '-' ? '' : ` · ${elapsed}`}`;
}

/**
 * Terminal-failure cause of an attempt that has NO job rows (e.g. the terraform
 * dispatch call itself failed) — with no job row there is no log-viewer entry
 * point, so `failure_detail` is the only cause the client has. A long cause is
 * clamped to a preview that opens in FailureReasonModal. Rendered at the drawer
 * root for the latest attempt and inside the attempt drill-down.
 */
export function FailureCause({
  attempt,
  onOpenFailure,
}: {
  attempt: TaskAttemptView;
  onOpenFailure: (detail: string) => void;
}): ReactElement {
  const cause = attempt.failure_detail ?? attempt.error_code ?? '원인 미기록';
  // A dispatch-failure detail (Feign message) can run to ~512 chars.
  const isLong = (attempt.failure_detail?.length ?? 0) > 120;
  return (
    <Section label="실패 원인">
      <p className={isLong ? d.failReasonClamp : d.failReason}>{cause}</p>
      {isLong && (
        <button type="button" className={d.failReasonMore} onClick={() => onOpenFailure(cause)}>
          자세히
        </button>
      )}
    </Section>
  );
}

/**
 * Operator description — an operator-provided description distinct from the
 * catalog definition text (which lives in the drawer header). Rendered only when
 * both exist, e.g. custom tasks.
 */
export function OperatorDescription({ detail }: { detail: TaskDetail }): ReactElement | null {
  if (!detail.description || !detail.definition?.description) return null;
  return (
    <Section label="운영자 설명">
      <div className={d.descText}>{detail.description}</div>
    </Section>
  );
}
