/**
 * Job 현황 — one attempt's terraform jobs as a status filter over failure-first
 * rows (design-benchmark 2026-08-15 시안 A·B). Rendered at the drawer root for the
 * LATEST attempt, so "which job failed, and why" needs no click; the attempt
 * drill-down reuses it for an older attempt.
 *
 * The counts used to be a 12px caption that could only be read — the panel's most
 * wanted number in the type set's smallest tier, with no way to narrow 21 jobs to
 * the two that are still running. They are now the control: one button per
 * non-empty verdict, opening on the failures when there are any (the default
 * Blue Ocean and Buildkite both take). The success fold is gone with it — a list
 * this size needs one narrowing grammar, not two.
 *
 * Rows carry `last_state · N회 폴링 · HH:mm` and are clickable end to end; the log
 * used to hang off a 51×17px text link repeated once per row.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { jobRows, jobVerdict, type JobRow, type JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import { fmtDateTime } from '@/lib/pipeline/format';
import { DrawerPicker } from '@/app/admin/pipelines/_detail/DrawerPicker';
import { j, Section } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TaskAttemptView, TaskOperation } from '@/lib/pipeline/types';

/** Failure first, then whatever is still moving, then the settled successes. */
const VERDICT_RANK: Record<JobVerdict, number> = { failed: 0, running: 1, none: 2, success: 3 };

/** Filter buttons in reading order; zero-count verdicts get no button. */
const FILTER_ORDER: readonly JobVerdict[] = ['failed', 'running', 'none', 'success'];

type JobFilter = JobVerdict | 'all';

/**
 * What this job last did — `COMPLETED · 2회 폴링 · 07:38`. All three values come
 * from `TerraformJobStateSummary`, which the panel parsed and then never showed;
 * without them 21 rows differ only by id. Missing pieces drop out instead of
 * printing a placeholder, and the time is clock-only because the attempt window
 * captioning this section already carries the date.
 */
function jobMeta(row: JobRow): string {
  const state = row.state;
  if (!state) return '';
  const polled = fmtDateTime(state.last_polled_at);
  return [
    state.last_state,
    `${state.poll_count}회 폴링`,
    polled === '-' ? null : polled.slice(11),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

function JobItem({
  row,
  verdict,
  onOpen,
}: {
  row: JobRow;
  verdict: JobVerdict;
  onOpen: () => void;
}): ReactElement {
  const reason = row.state?.last_fail_reason ?? row.state?.last_error;
  const meta = jobMeta(row);
  return (
    <div className={j.jobItem}>
      <button
        type="button"
        className={j.jobRow}
        onClick={onOpen}
        aria-label={`TerraformJob ${row.job_id} · ${j.verdictLabel[verdict]} · 로그 열기`}
      >
        <span className={cn(j.filterDot, j.verdictDot[verdict])} aria-hidden="true" />
        <span className={j.jobId}>{row.job_id}</span>
        {/* The meta owns the right edge; without it the chevron takes the slack. */}
        {meta ? <span className={j.jobMeta}>{meta}</span> : <span className="ml-auto" />}
        <Icon name="chev-r" size="sm" className={j.jobChev} />
      </button>
      {verdict === 'failed' && reason && <p className={j.jobFailReason}>{reason}</p>}
    </div>
  );
}

export function JobStatus({
  attempt,
  operation,
  caption,
  onOpenJob,
}: {
  attempt: TaskAttemptView;
  operation: TaskOperation | null;
  /** The attempt window these jobs ran in; null when it would repeat the flow card. */
  caption: ReactNode;
  onOpenJob: (jobId: string) => void;
}): ReactElement | null {
  const [picked, setPicked] = useState<JobFilter | null>(null);
  const rows = jobRows(attempt);
  if (rows.length === 0) return null;

  const graded = rows.map((row) => ({ row, verdict: jobVerdict(row, operation) }));
  // Stable sort (ES2019+) — equal verdicts keep the contract's job order.
  const sorted = [...graded].sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]);
  const counts = graded.reduce<Record<JobVerdict, number>>(
    (acc, g) => {
      acc[g.verdict] += 1;
      return acc;
    },
    { failed: 0, running: 0, none: 0, success: 0 },
  );

  // One verdict means nothing to filter — then the single button is just the
  // count, and "전체" next to it would say the same number twice.
  const buckets = FILTER_ORDER.filter((v) => counts[v] > 0);
  const options: JobFilter[] = buckets.length > 1 ? ['all', ...buckets] : buckets;
  const auto: JobFilter = counts.failed > 0 ? 'failed' : options[0];
  // A poll can empty the bucket the operator picked (a running job settles) —
  // fall back rather than leaving an empty list under a button that is gone.
  const active = picked !== null && options.includes(picked) ? picked : auto;
  const shown = active === 'all' ? sorted : sorted.filter((g) => g.verdict === active);

  // The count rides the label so it shows on the closed trigger too — it is the
  // number the operator came for, and a dropdown that hides it would be a step
  // back from the segments it replaces.
  const picks = options.map((option) => ({
    key: option,
    tone: option === 'all' ? undefined : option,
    label:
      option === 'all'
        ? `전체 ${rows.length}`
        : `${j.verdictLabel[option]} ${counts[option]}`,
  }));

  return (
    <Section label="Job 현황" caption={caption} grow>
      <div className={j.jobCard}>
        <div className={j.jobCardHead}>
          <span className={j.jobCardCount}>총 {rows.length}건</span>
          {picks.length > 1 ? (
            <DrawerPicker
              ariaLabel="Job 상태 필터"
              options={picks}
              value={active}
              onPick={(key) => setPicked(key as JobFilter)}
            />
          ) : (
            <span className={j.jobCardOne}>
              {picks[0].tone && (
                <span className={cn(j.filterDot, j.verdictDot[picks[0].tone])} aria-hidden="true" />
              )}
              {picks[0].label}
            </span>
          )}
        </div>
        {shown.length > 0 && (
          <div className={j.jobList}>
            {shown.map((g) => (
              <JobItem key={g.row.job_id} row={g.row} verdict={g.verdict} onOpen={() => onOpenJob(g.row.job_id)} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
