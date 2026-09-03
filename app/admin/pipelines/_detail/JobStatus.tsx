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

/**
 * The head clause of a failure reason. A terraform error classifies itself first and
 * details itself after the colon: `Error acquiring the state lock: Conditional…` wrapped
 * to three lines in this column and got cut mid-word, while its first clause already said
 * which kind of failure it was. The whole reason is in the log viewer's header.
 * A leading `Error: ` is a prefix, not a clause, so it comes off first.
 */
export function failHead(reason: string): string {
  const body = reason.replace(/^Error:\s*/, '');
  // Only a top-level colon separates class from detail. A parenthetical carries its
  // own — `…to become 'available' (last state: 'creating', timeout: 20m0s)` cut to
  // "…'available' (last state", which reads as nothing at all.
  let depth = 0;
  for (let i = 0; i < body.length - 1; i += 1) {
    const c = body[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth = Math.max(0, depth - 1);
    // i > 0: a reason that OPENS with ": " has no class before the colon, and
    // cutting there would render an empty red line.
    else if (i > 0 && c === ':' && body[i + 1] === ' ' && depth === 0) return body.slice(0, i);
  }
  return body || reason;
}

/**
 * 실패 한 줄을 접었다 펴는 폴드. 접힌 상태는 `head` 한 줄(넘치면 말줄임), 편 상태는
 * `full` 전문을 줄바꿈해 싣는다.
 *
 * terraform 사유는 `head` 가 앞 절(`failHead`)이라 접힌 줄이 실패의 종류를 말하고,
 * 폴 호출 실패는 앞 절이 늘 같아 자를 것이 없으므로 `head`·`full` 이 같은 문자열이다
 * (접힘 = 그 한 줄, 펴짐 = 전문).
 *
 * 전문은 `summary` 밖 형제 요소다(같은 파일의 `respFold` 들과 같은 모양). 안에 두면
 * 상태 코드·URL 을 드래그로 긁는 순간 그 클릭이 폴드를 도로 닫고, 스크린 리더에는
 * "펼침"이 빈 영역에 대고 announce 된다. 접혔을 때는 `head` 만 남기고 폈을 때는
 * `head` 를 감춰, 같은 문장이 두 번 나오지 않게 한다.
 */
function ErrorFold({ head, full, mono }: { head: string; full: string; mono?: boolean }): ReactElement {
  return (
    <details className={cn(j.errFold, mono && j.errMono)}>
      <summary className={j.errSummary}>
        <span className={j.errTri} aria-hidden="true">
          ▼
        </span>
        <span className={j.errHead}>{head}</span>
      </summary>
      <div className={j.errFull}>{full}</div>
    </details>
  );
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
  // 두 실패는 종류가 다르다. `last_fail_reason` 은 job 자신의 실패라 terraform 이
  // 앞머리에서 종류를 밝히고 뒤에 상세를 붙이므로 앞 절만 남겨도 뜻이 산다.
  // `last_error` 는 우리 폴 호출이 실패한 것이라 앞머리("infra-manager call
  // failed")가 늘 같고, 상태 코드·메서드·URL 이 붙는 뒤쪽이 내용 전부다 —
  // 여기에 failHead 를 걸면 남는 게 없다(오너 2026-09-03).
  const failReason = row.state?.last_fail_reason ?? null;
  // 사유 줄이 실제로 그려질 때만 호출 오류를 접는다 — `failReason` 이 있는데 판정이
  // 실패로 서지 않은 job(진행 중 result 등)에서 두 줄이 한꺼번에 사라지던 구멍.
  const showsFailReason = verdict === 'failed' && Boolean(failReason);
  const callError = showsFailReason ? null : row.state?.last_error ?? null;
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
      {/* 접힌 채로는 한 줄, 펴면 전문 — 목록이 오류 문단으로 밀리지 않으면서도
          원문이 이 화면 밖으로 나가지 않는다(오너 2026-09-03). */}
      {showsFailReason && failReason && (
        <ErrorFold head={failHead(failReason)} full={failReason} />
      )}
      {/* 판정과 무관하게 그린다: 폴이 못 닿은 job 은 상태를 못 읽어 verdict 가
          failed 가 아니라 none/running 이고, 실패 판정에 걸어 두면 정작 호출이
          실패한 그 job 에서만 이 줄이 안 나온다. */}
      {callError && <ErrorFold head={callError} full={callError} mono />}
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
  // 실패 버킷으로 바로 여는 것이 기본이지만, 폴이 못 닿아 판정이 서지 않은 job 이
  // 섞여 있으면 전체로 연다 — 그런 job 은 verdict 가 failed 가 아니라 실패 버킷에서
  // 걸러지고, 정작 호출 오류를 들고 있는 행이 필터 뒤에 숨는다(오너 2026-09-03).
  const hasHiddenCallError = graded.some(
    (g) => g.verdict !== 'failed' && Boolean(g.row.state?.last_error),
  );
  const auto: JobFilter =
    counts.failed > 0 && !hasHiddenCallError ? 'failed' : options[0];
  // A poll can empty the bucket the operator picked (a running job settles) —
  // fall back rather than leaving an empty list under a button that is gone.
  const active = picked !== null && options.includes(picked) ? picked : auto;
  const shown = active === 'all' ? sorted : sorted.filter((g) => g.verdict === active);

  // The count rides the label so it shows on the closed trigger too — it is the
  // number the operator came for, and a dropdown that hides it would be a step
  // back from the segments it replaces. With ONE bucket there is no trigger and
  // the header's 총 N건 is already that number, so the word stands alone rather
  // than printing "총 21건  성공 21".
  const single = options.length === 1;
  const picks = options.map((option) => ({
    key: option,
    tone: option === 'all' ? undefined : option,
    label:
      option === 'all'
        ? `전체 ${rows.length}`
        : single
          ? j.verdictLabel[option]
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
              align="right"
              onPick={setPicked}
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
        <div className={j.jobList}>
          {shown.map((g) => (
            <JobItem key={g.row.job_id} row={g.row} verdict={g.verdict} onOpen={() => onOpenJob(g.row.job_id)} />
          ))}
        </div>
      </div>
    </Section>
  );
}
