'use client';

/**
 * 인프라 작업 tab head — the tab said in one sentence, then the facts that
 * sentence promises.
 *
 * The tab does three jobs: run install/delete, read what Terraform has applied,
 * and look up past runs. None of them were stated anywhere. Each section carried
 * its own 12px caption instead, which put three explanations on screen while the
 * tab itself stayed unnamed. The captions are gone; this states it once, above
 * everything, and the sections below are left as plain 16px names.
 *
 * Order is fixed: statement → state → sections. The strip is never collapsible.
 *
 * Two slots, and the second one is a list:
 *   - 연동 정보 — the precondition every run depends on, 확정됨 / 미확정. When it
 *     is 미확정 the sub-line names the step the target is actually sitting at, so
 *     the head says WHERE the work is rather than only that something is absent.
 *     확정됨 carries a link into the 확정 정보 tab instead of a date: the confirmed
 *     detail — including WHEN it was confirmed — is that tab's whole subject, and
 *     a lone timestamp under the verdict answered a question nobody asked here.
 *   - Terraform 작업 — one row per task, with that task's own state. The combined
 *     `overall_state` pill is gone by owner call ("각 작업이 어떤 상태인지 보여주도록
 *     하자. 조합 상태는 필요없음"): a single rolled-up word cannot say WHICH of the
 *     three tasks failed, which is the only question this slot is asked.
 *
 * The rows ARE the per-task table that used to live in TerraformStatusModal, so
 * that modal is deleted — this overrides the #675 decision "Terraform 설치 현황은
 * 모달로", whose premise (one pill in the head, detail on demand) no longer holds
 * once the head shows every task. The GATE banner is gone too: it repeated the
 * 연동 정보 slot at banner volume, and its next step now belongs to the 현재 작업
 * card, which states it once (see gateStage.ts).
 *
 * The head carries no 작업 시작 (owner call): starting a run belongs to the
 * 현재 작업 card, so the head reads as state only and the tab keeps one place to
 * act from.
 *
 * Data comes from GET …/terraform-status via the parent (PipelineTab owns the
 * fetch because the start-CTA gate reads the same response). InfraManager's own
 * job records; no Cloud SDK call is made, so this can legitimately disagree with
 * the real infrastructure.
 */
import { type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { fmtDateTime } from '@/lib/pipeline/format';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  SIDE_LABEL,
  TONE,
  metaOf,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { OPS_TAB_SLUGS, type OpsTargetTabLabel } from '@/lib/routes';
import type { TerraformStatusResponse } from '@/app/lib/api';

/** The three jobs, named by weight inside the intro sentence. */
const JOB = 'font-semibold text-[var(--pl-text-strong)]';

/** 16px/700 — one step over the slot's 12px label. */
const SLOT_VALUE = 'text-[16px] font-bold leading-[1.3] text-[var(--pl-text-strong)]';

/** 실행 주체 — a neutral bordered tag, never competing with the state pill beside it. */
const SIDE_TAG =
  'inline-flex flex-none items-center rounded-[4px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--pl-text-weak)]';

/** One fact: name, value, and the line that qualifies it. */
function Slot({
  label,
  labelEnd,
  children,
  sub,
}: {
  label: ReactNode;
  /** Pushed to the far end of the LABEL row — for a qualifier that belongs to the
   *  whole slot rather than to the last row in it, and so cannot sit below the
   *  value without reading as a footnote to that row. */
  labelEnd?: ReactNode;
  children: ReactNode;
  sub?: ReactNode;
}): ReactElement {
  return (
    <div className="min-w-0 px-5 py-3.5">
      {/* A <dt> takes flow content, so the label row itself may be a flex
          container — the <dl> restriction is on the <dl>'s own children, which
          stay <dt>/<dd>. */}
      {/* h-5: the row is 17px of text on its own but 20px once it holds a control,
          which pushed one slot's value 2px below its neighbour's first task row.
          Pinning the label row makes the two slots share one baseline whatever
          each of them happens to carry. */}
      <dt className="flex h-5 items-baseline justify-between gap-2 text-[12px] font-medium text-[var(--pl-text-weak)]">
        <span className="min-w-0 truncate">{label}</span>
        {labelEnd != null && <span className="flex-none">{labelEnd}</span>}
      </dt>
      {/* The qualifying line lives INSIDE the <dd>: a <dl>'s div wrapper may hold
          only <dt>/<dd>, and a sibling <p> would also drop out of the term's
          description in the a11y tree. */}
      <dd className="mt-1.5 min-w-0">
        {/* flex-col: the value is either one line (연동 정보) or a stack of task
            rows, and both sit on the same 26px floor. */}
        <span className="flex min-h-[26px] min-w-0 flex-col justify-center">{children}</span>
        {sub != null && (
          <span className="mt-1.5 block text-[12px] text-[var(--pl-text-faint)]">{sub}</span>
        )}
      </dd>
    </div>
  );
}

/** One Terraform task: what it is, who runs it, what state it is in. */
function TaskRow({
  name,
  side,
  state,
  first,
}: {
  name: string;
  side: string;
  state: string | null | undefined;
  first: boolean;
}): ReactElement {
  const { tone, icon, label } = metaOf(state);
  return (
    <span
      className={cn(
        'flex min-h-[30px] items-center gap-2',
        !first && 'border-t border-[var(--pl-border)]',
      )}
    >
      {/* Mono: a task name is compared against the recipe, not read as prose. */}
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]">
        {name}
      </span>
      <span className={SIDE_TAG}>{side}</span>
      <span
        className={cn(
          pipelineStyles.pill.base,
          pipelineStyles.pill.md,
          TONE[tone].pill,
          'flex-none',
        )}
      >
        <Icon name={icon} size="sm" className={icon === 'loader' ? 'animate-spin' : undefined} />
        {label}
      </span>
    </span>
  );
}

export interface InfraStatusHeadProps {
  status: TerraformStatusResponse | null;
  loading: boolean;
  /** True when the status lookup failed — the strip degrades to one line. */
  failed: boolean;
  /** Names the step the target is at while 연동 정보 is still 미확정. */
  processStatus: ProcessStatus | null;
  /** Opens another tab — 확정됨 offers the 확정 정보 tab as its detail. */
  onSelectTab: (tab: OpsTargetTabLabel) => void;
}

export function InfraStatusHead({
  status,
  loading,
  failed,
  processStatus,
  onSelectTab,
}: InfraStatusHeadProps): ReactElement {
  const confirmed = status?.has_confirmed_infra === true;
  const tasks = status?.tasks ?? [];
  const step = processStatus ? STEP[processStatus] : null;

  return (
    <div>
      {/* The tab in its own words, as an info card. As bare 18px/14px text it had
          no container while everything under it did, so it floated instead of
          reading as a level. Contained and quieted, it sits UNDER the sections it
          introduces — reference material, not the page's loudest line. The three
          jobs are named by weight inside one sentence rather than as a list; the
          slot strip and the two cards below already carry them as structure. */}
      <div className="flex items-start gap-3 rounded-[10px] border border-[var(--pl-info-border)] bg-[var(--pl-info-bg)] px-5 py-4">
        <span className="mt-px flex-none text-[var(--pl-info-text)]">
          <Icon name="info" size="md" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--pl-info-text)]">이 탭에서 하는 일</p>
          <h2 className="mt-1 break-keep text-[14px] font-normal leading-[1.6] text-[var(--pl-text-medium)]">
            Terraform으로 이 대상의 인프라를 <b className={JOB}>설치·삭제</b>하고, 현재{' '}
            <b className={JOB}>Terraform 적용 상태</b>와 지금까지 실행한{' '}
            <b className={JOB}>작업 이력</b>을 확인합니다.
          </h2>
        </div>
      </div>

      {loading ? (
        /* 146px measured in the browser on a three-task (AWS) target, which is
           the contract's tallest strip — see the task-row note below. A two- or
           one-task provider settles 30/60px upward when it lands; reserving the
           maximum is the side that never covers the cards below. */
        <div className="mt-4 h-[146px]" aria-busy />
      ) : failed || !status ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-4 py-3 text-left')}>
          Terraform 상태를 불러오지 못했습니다.
        </p>
      ) : (
        /* 1fr : 2fr — the left slot is one word plus a date, the right one holds a
           mono task name, a tag and a pill on every line. Equal columns would
           truncate the names, which are the part you compare. */
        <dl className="mt-4 grid grid-cols-[1fr_2fr] divide-x divide-[var(--pl-border)] overflow-hidden rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-gray-50)]">
          <Slot
            label="연동 정보"
            /* Same position as the sibling slot's 조회 line, so the two label rows
               share one rhythm. Only when 확정됨: with nothing confirmed there is
               no confirmed detail to open. A button, not an anchor — the tab strip
               is client state on this screen, not a route. */
            labelEnd={
              confirmed ? (
                <button
                  type="button"
                  onClick={() => onSelectTab(OPS_TAB_SLUGS.confirm)}
                  className={cn(opsStyles.detailLink, 'text-[12px] font-normal')}
                  aria-label={`${OPS_TAB_SLUGS.confirm} 상세정보 보기`}
                >
                  상세정보 보기
                  <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
                </button>
              ) : undefined
            }
            sub={!confirmed && step ? `${step.n}단계 · ${step.label}` : undefined}
          >
            {/* The VALUE wears the warning colour, not the cell: 미확정 is a stage
                of normal work, and an amber panel would read as a failure. */}
            <span className={cn(SLOT_VALUE, !confirmed && 'text-[var(--pl-warn-text)]')}>
              {confirmed ? '확정됨' : '미확정'}
            </span>
          </Slot>

          <Slot
            label={
              <>
                {/* The count is demoted by WEIGHT, not colour: `--pl-text-faint`
                    is 2.58:1 on this surface and the design guard rejects it. */}
                Terraform 작업 <span className="font-normal tabular-nums">· {tasks.length}</span>
              </>
            }
            /* 조회 rides the LABEL row, not a sub-line: it qualifies the whole
               list, and under the rows it read as a footnote to the last task.
               Quietest thing in the slot by WEIGHT — `--pl-text-faint` is the
               token this asks for, but it is 2.58:1 on white and the design guard
               rejects it, so the demotion is font-normal against the label's
               font-medium. */
            labelEnd={
              status.checked_at ? (
                <span className="font-normal tabular-nums">
                  조회 {fmtDateTime(status.checked_at)}
                </span>
              ) : undefined
            }
          >
            {/* No cap and no scroll: every provider's task list in the contract is
                at most three rows (AWS 3, GCP/IDC/SDU 2, Azure 1), so the whole
                list always fits and a "+N개 더" affordance would never fire. */}
            {tasks.length === 0 ? (
              <span className="text-[12px] text-[var(--pl-text-weak)]">작업 정보가 없습니다.</span>
            ) : (
              tasks.map((task, index) => (
                <TaskRow
                  key={task.terraform_task_name ?? index}
                  name={task.terraform_task_name ?? '-'}
                  side={
                    SIDE_LABEL[task.terraform_execution_side ?? ''] ??
                    task.terraform_execution_side ??
                    '-'
                  }
                  state={task.state}
                  first={index === 0}
                />
              ))
            )}
          </Slot>
        </dl>
      )}
    </div>
  );
}
