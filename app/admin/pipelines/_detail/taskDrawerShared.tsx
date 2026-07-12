/**
 * Shared primitives for the task drawer surface (TaskDrawer + execTabs +
 * AttemptDetail + JobViewer): style handles, the viewer target type, time
 * helpers, and the two small presentational pieces (MiniPill / Section) reused
 * across the sub-modules.
 */
import { type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { improvedStyles } from '@/app/admin/pipelines/_detail/detailImprovedStyles';
import { jobStyles } from '@/app/admin/pipelines/_detail/detailJobStyles';
import type { JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import type { TaskAttemptView, TaskDetail } from '@/lib/pipeline/types';

export const d = improvedStyles.drawer;
export const j = jobStyles;

/** The (attempt, job) pair the log/state viewer is opened for. */
export type ViewerTarget = { attemptNumber: number; jobId: string };

/** Elapsed between two instants → "Xm Ys" / "Ys"; empty when either is missing. */
export const spanLabel = (start: string | null, end: string | null): string => {
  if (!start || !end) return '';
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (Number.isNaN(secs) || secs < 0) return '';
  return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
};

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

export function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <div className={d.sectionLabel}>{label}</div>
      {hint && <div className={j.labelHint}>{hint}</div>}
      {children}
    </div>
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
