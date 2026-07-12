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
import { fmtDateTime } from '@/lib/pipeline/format';
import type { TaskAttemptView, TaskDetail } from '@/lib/pipeline/types';

export const d = improvedStyles.drawer;
export const j = jobStyles;

/** The (attempt, job) pair the log/state viewer is opened for. */
export type ViewerTarget = { attemptNumber: number; jobId: string };

/** "YYYY-MM-DD HH:MM" → "HH:MM" (Seoul tz, via fmtDateTime); null → "—". */
export const hm = (iso: string | null | undefined): string => {
  const s = fmtDateTime(iso);
  return s === '-' ? '—' : s.slice(11);
};

const SEOUL_HMS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** ISO instant → "HH:MM:SS" (Seoul tz); null/invalid → "—". Used for the
 *  observation timestamps the owner Figma renders to the second — external-check
 *  times, next-check, and the viewer's collection/last-poll stamps. */
export const hms = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return SEOUL_HMS.format(date);
};

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
  if (a.error_code === 'CONDITION_NOT_MET') return { label: '미충족', tone: 'none' };
  return { label: a.error_code === 'CALL_TIMEOUT' ? '타임아웃' : 'API 오류', tone: 'failed' };
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
 * 운영자 설명 — an operator-provided description distinct from the catalog
 * definition text (which lives in the drawer header). Rendered only when both
 * exist, e.g. custom tasks.
 */
export function OperatorDescription({ detail }: { detail: TaskDetail }): ReactElement | null {
  if (!detail.description || !detail.definition?.description) return null;
  return (
    <Section label="운영자 설명">
      <div className={d.descText}>{detail.description}</div>
    </Section>
  );
}
