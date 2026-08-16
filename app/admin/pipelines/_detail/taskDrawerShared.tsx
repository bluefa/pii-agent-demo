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
  caption,
  sub = false,
  grow = false,
  children,
}: {
  label: string;
  /** One line under the label naming the frame the content belongs to. */
  caption?: string;
  /** Demoted tier — a section that supports the verdict instead of competing with it. */
  sub?: boolean;
  /** Takes the drawer body's leftover height so its own list scrolls, not the
   *  panel. The floor is explicit because neither automatic minimum works here:
   *  `min-h-0` let a short body squeeze the whole section to 0px, and `auto`
   *  counts the scrolling list's full content (21 rows), so nothing shrank at
   *  all. 226px = label 24 + caption 18 + filter 56 + three 43px job rows: the
   *  same three rows the 208px floor guaranteed, plus the caption 시안 C added.
   *
   *  NOT the 340px the benchmark proposed for 시안 B. Measured on the live panel:
   *  a floor above 278px makes the DRAWER scroll (340 → 61px of overflow), which
   *  is the one thing the owner ruled out ("패널 자체의 스크롤을 내리는 일은
   *  없었으면"). The reclaimed height reaches the list through `flex-1` anyway —
   *  the section takes 279px here, 165px of it list, up from 138px before the
   *  정의·계약 fold was evicted. The floor is a floor, not the allocation. */
  grow?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={cn('flex flex-col', grow && 'flex-1 min-h-[226px]')}>
      <div className={sub ? d.sectionLabelSub : d.sectionLabel}>{label}</div>
      {caption && <div className={d.sectionCaption}>{caption}</div>}
      {children}
    </div>
  );
}

/**
 * One attempt's window on a line — "시작 2026-08-14 17:58 · 완료 18:03 · 소요 5분".
 * Each value is named (owner 2026-08-16: "시작/완료/소요를 명확하게 구분"), in the
 * flow card's own label set. The end repeats its date only when the attempt
 * crosses midnight, and the duration takes `fmtElapsedMs`, the grammar the card
 * and the exec band already use. A value that does not exist yet drops out with
 * its label rather than printing "완료 -": a running attempt says only 시작.
 */
export function attemptWindow(attempt: TaskAttemptView): string {
  const start = fmtDateTime(attempt.started_at);
  const end = fmtDateTime(attempt.finished_at);
  const sameDay = start.slice(0, 10) === end.slice(0, 10);
  const elapsed =
    attempt.started_at && attempt.finished_at
      ? fmtElapsedMs(Date.parse(attempt.finished_at) - Date.parse(attempt.started_at))
      : '-';
  const parts = [`시작 ${start}`];
  if (end !== '-') parts.push(`완료 ${sameDay ? end.slice(11) : end}`);
  if (elapsed !== '-') parts.push(`소요 ${elapsed}`);
  return parts.join(' · ');
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
