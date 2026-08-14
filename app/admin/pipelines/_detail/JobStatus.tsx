/**
 * Job 현황 — one attempt's terraform jobs as a rollup line plus failure-first
 * rows (design-benchmark 2026-08-14 시안 B). Rendered at the drawer root for the
 * LATEST attempt, so "which job failed, and why" needs no click; the attempt
 * drill-down reuses it for an older attempt.
 *
 * Successes fold behind a toggle instead of paging: 21 jobs used to scatter over
 * 5 pages (`JOBS_PER_PAGE`), so a single failure could sit four clicks away and
 * no line anywhere said how many of them failed. The fold borrows the
 * poll-history toggle's grammar, leaving the panel a single overflow rule.
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { jobRows, jobVerdict, type JobRow, type JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import { j, MiniPill, Section } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TaskAttemptView, TaskOperation } from '@/lib/pipeline/types';

/** Failure first, then whatever is still moving, then the settled successes. */
const VERDICT_RANK: Record<JobVerdict, number> = { failed: 0, running: 1, none: 2, success: 3 };

/** Rollup buckets in reading order; zero-count buckets are dropped. */
const ROLLUP_ORDER: readonly JobVerdict[] = ['failed', 'running', 'none', 'success'];

/** Above this many jobs the successes start folded — the threshold the pager used. */
const FOLD_ABOVE = 5;

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
  return (
    <div className={j.jobItem}>
      <div className={j.jobRow}>
        <MiniPill tone={verdict}>{j.verdictLabel[verdict]}</MiniPill>
        <span className={j.jobId}>{row.job_id}</span>
        <button
          type="button"
          className={j.logBtn}
          onClick={onOpen}
          aria-label={`TerraformJob ${row.job_id} 로그 열기`}
        >
          로그 보기
        </button>
      </div>
      {verdict === 'failed' && reason && <p className={j.jobFailReason}>{reason}</p>}
    </div>
  );
}

export function JobStatus({
  attempt,
  operation,
  hint,
  onOpenJob,
}: {
  attempt: TaskAttemptView;
  operation: TaskOperation | null;
  /** Which attempt these jobs belong to — set when the panel holds more than one. */
  hint?: string;
  onOpenJob: (jobId: string) => void;
}): ReactElement | null {
  const [showAll, setShowAll] = useState(false);
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
  const foldable = rows.length > FOLD_ABOVE && counts.success > 0;
  const shown = foldable && !showAll ? sorted.filter((g) => g.verdict !== 'success') : sorted;

  return (
    <Section label="Job 현황" hint={hint}>
      <div className={j.rollup}>
        {ROLLUP_ORDER.filter((v) => counts[v] > 0).map((v) => (
          <span key={v} className={j.rollupItem}>
            <b className={cn(j.rollupNum, j.verdictTextTone[v])}>{counts[v]}</b>
            {j.verdictLabel[v]}
          </span>
        ))}
        <span className={j.rollupTotal}>총 {rows.length}개</span>
      </div>
      {/* An all-green attempt folds to nothing — the rollup already answered it,
          so skip the list wrapper rather than leaving its margin behind. */}
      {shown.length > 0 && (
        <div className={j.jobList}>
          {shown.map((g) => (
            <JobItem key={g.row.job_id} row={g.row} verdict={g.verdict} onOpen={() => onOpenJob(g.row.job_id)} />
          ))}
        </div>
      )}
      {foldable && (
        <button type="button" className={j.moreBtn} onClick={() => setShowAll((x) => !x)}>
          {showAll ? '접기' : `성공 ${counts.success}개 펼치기`}
        </button>
      )}
    </Section>
  );
}
