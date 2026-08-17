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
  grow = false,
  children,
}: {
  label: string;
  /** Names the frame the content belongs to — the run window, for Job 현황. */
  caption?: ReactNode;
  /** Takes the drawer body's leftover height so its own list scrolls, not the
   *  panel. The floor is explicit because neither automatic minimum works here:
   *  `min-h-0` let a short body squeeze the whole section to 0px, and `auto`
   *  counts the scrolling list's full content (21 rows), so nothing shrank at
   *  all. 208px = label 24 + filter 56 + three 43px job rows.
   *
   *  NOT the 340px the benchmark proposed for 시안 B, and not 226 either. This
   *  floor is what binds on a SHORT window, and there the only thing it can buy
   *  rows with is the drawer's own scrollbar — the one thing the owner ruled out
   *  ("패널 자체의 스크롤을 내리는 일은 없었으면"). Measured: at a 738px viewport
   *  208 → 0px of panel overflow, 226 → 15px, and 340 → 61px even at 861px.
   *  So the caption 시안 C added is paid for out of the leftover, not the floor:
   *  where there IS room the section takes 279px (165px of it list, up from 138
   *  before the 정의·계약 fold was evicted), and where there is not, the list
   *  gives up its third row rather than the panel giving up its fixed height.
   *  The floor is a floor, not the allocation. */
  grow?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={cn('flex flex-col', grow && 'flex-1 min-h-[208px]')}>
      <div className={d.sectionLabel}>{label}</div>
      {caption}
      {children}
    </div>
  );
}

/**
 * One attempt's window as labelled rows — 시작 / 완료 / 소요 (owner 2026-08-16:
 * "시작/완료/소요를 명확하게 구분", 2026-08-17: one row each). The labels are the
 * flow card's own set. The end repeats its date only when the attempt crosses
 * midnight, and the duration takes `fmtElapsedMs`, the grammar the card and the
 * exec band already use. A value that does not exist yet drops its row rather
 * than printing "완료 -": a running attempt says only 시작.
 */
export function attemptWindow(attempt: TaskAttemptView): Array<{ k: string; v: string }> {
  const start = fmtDateTime(attempt.started_at);
  const end = fmtDateTime(attempt.finished_at);
  const sameDay = start.slice(0, 10) === end.slice(0, 10);
  const elapsed =
    attempt.started_at && attempt.finished_at
      ? fmtElapsedMs(Date.parse(attempt.finished_at) - Date.parse(attempt.started_at))
      : '-';
  const rows = [{ k: '시작', v: start }];
  if (end !== '-') rows.push({ k: '완료', v: sameDay ? end.slice(11) : end });
  if (elapsed !== '-') rows.push({ k: '소요', v: elapsed });
  return rows;
}

/** The rows above, in the flow card's run-block grammar. */
export function RunWindow({ attempt }: { attempt: TaskAttemptView }): ReactElement {
  return (
    <div className={d.runWindow}>
      {attemptWindow(attempt).map((row) => (
        <div key={row.k} className={d.runWindowRow}>
          <span className={d.runWindowKey}>{row.k}</span>
          <span className={d.runWindowVal}>{row.v}</span>
        </div>
      ))}
    </div>
  );
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
