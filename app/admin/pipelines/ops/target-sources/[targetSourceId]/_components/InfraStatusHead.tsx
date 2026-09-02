'use client';

/**
 * 인프라 작업 tab head — the tab said in one sentence, then ONE card holding the
 * Terraform state.
 *
 * The tab does three jobs: run install/delete, read what Terraform has applied,
 * and look up past runs. None of them were stated anywhere. Each section carried
 * its own 12px caption instead, which put three explanations on screen while the
 * tab itself stayed unnamed. The captions are gone; this states it once, above
 * everything, and the sections below are left as plain names.
 *
 * Order is fixed: statement → state → sections. The card is never collapsible.
 *
 * The state used to be a full-width `1fr 2fr` grey strip with two slots, and the
 * measurements said the split was wrong twice over:
 *   - the 연동 정보 verdict was set at 16px/700, the loudest thing on the tab, so
 *     a precondition outranked the subject it is a precondition FOR (the sibling
 *     cards name themselves in a 12px tag);
 *   - a task row was 912px wide but only 241px of it was ink, leaving 793px of
 *     blank between a task name and its own status pill.
 *
 * So both facts live in one card whose subject is the Terraform state, and
 * 연동 정보 is a quiet qualifier inside it — a plain label/value line, 12px, with
 * no tag, no badge and no pill (owner call, not an oversight). A tag was the
 * alternative and was rejected: the label 연동 정보 already stands in front of the
 * value, so nothing about whose verdict it is needs a second device to say it.
 *
 * What the card holds, top to bottom:
 *   - the 카드 head — `Terraform 적용 상태` as plain 16px/700 text, and 조회 시각 at
 *     the far end of the same row. NOT the blue 12px tag the sibling 현재 작업 /
 *     작업 이력 cards wear (owner 2026-08-30): that tag exists to name a card and
 *     then defer to the card's own subject a row or two below, and 현재 작업 has a
 *     run name to defer to. This card has no second line — the title IS its
 *     subject, so it is set as one. No task count either: the rows underneath
 *     already are the count.
 *   - the 연동 정보 line — 확정됨 / 미확정, the precondition every run depends on.
 *     확정됨 carries a link into the 확정 정보 tab instead of a date: the confirmed
 *     detail — including WHEN it was confirmed — is that tab's whole subject, and
 *     a lone timestamp under the verdict answered a question nobody asked here.
 *     미확정 continues the same line with the step the target is actually sitting
 *     at, so the head says WHERE the work is rather than only that something is
 *     absent.
 *   - the task rows — one per task, with that task's own state. The combined
 *     `overall_state` pill is gone by owner call ("각 작업이 어떤 상태인지 보여주
 *     도록 하자. 조합 상태는 필요없음"): a single rolled-up word cannot say WHICH
 *     of the three tasks failed, which is the only question this list is asked.
 *
 * The rows ARE the per-task table that used to live in TerraformStatusModal, so
 * that modal is deleted — this overrides the #675 decision "Terraform 설치 현황은
 * 모달로", whose premise (one pill in the head, detail on demand) no longer holds
 * once the head shows every task. The GATE banner is gone too: it repeated the
 * 연동 정보 verdict at banner volume, and its next step now belongs to the 현재
 * 작업 card, which states it once (see gateStage.ts).
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
import { type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { fmtDateTime } from '@/lib/pipeline/format';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
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

/** 실행 주체 — a neutral bordered tag, never competing with the state pill beside it.
 *
 *  48px floor, centred: content width made the tag 44.5px for 서비스 and 37.6px for
 *  BDC, which moved the status pill 6.9px between rows and left the state column
 *  reading crooked — the counterpart of the benchmark's "가운데를 비우지 않는다"
 *  is that the right-hand pieces have to land on one x. 48px clears the widest
 *  label the contract can produce (SIDE_LABEL is SERVICE → 서비스, BDC → BDC).
 *  A floor rather than a fixed width: an unmapped wire value is passed through
 *  raw, and it should widen the tag rather than be clipped inside it. */
const SIDE_TAG =
  'inline-flex min-w-[48px] flex-none items-center justify-center rounded-[4px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--pl-text-weak)]';

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
    <div
      className={cn(
        'flex min-h-[30px] items-center gap-2',
        !first && 'border-t border-[var(--pl-border)]',
      )}
    >
      {/* A FIXED 240px column, not `flex-1`. flex-1 handed the name every pixel
          the row had spare and pushed the pill to the far edge — 912px of row for
          241px of ink. 240px is `opsStyles.fmFold`'s column, whose note on this
          same screen already records why a `1fr` track was abandoned there, so
          the three pieces cluster and the row reads left to right.
          Mono: a task name is compared against the recipe, not read as prose. */}
      <span className="w-[240px] min-w-0 flex-none truncate text-[12px] font-semibold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]">
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
    </div>
  );
}

export interface InfraStatusHeadProps {
  status: TerraformStatusResponse | null;
  loading: boolean;
  /** True when the status lookup failed — the card degrades to one line. */
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
          state card and the two cards below already carry them as structure. */}
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
        /* The settled card's own markup, so the reserved height is no longer a
           magic number that a row change silently invalidates (the 193px it
           replaces was measured once and never re-measured). Fixed strings the
           screen already knows — the title, 연동 정보 — are drawn for real; only
           the data is bars (`StatusCardSkeleton`'s rule).
           Three rows because the head cannot know the task count before the
           response lands, and three is the longest list the contract can produce
           (AWS 3 · GCP/IDC/SDU 2 · Azure 1). A shorter provider settles 30/60px
           upward, which is the side that never covers the cards below. */
        <section
          aria-label="Terraform 적용 상태"
          aria-busy
          className={cn(pipelineStyles.card.flush, 'mt-4')}
        >
          <span className="sr-only">Terraform 적용 상태를 불러오는 중</span>
          <div className={detailStyles.sectionCard.head}>
            <div className={detailStyles.sectionCard.titleRow}>
              <h3 className="text-[16px] font-bold leading-[1.3] text-[var(--pl-text-strong)]">
                Terraform 적용 상태
              </h3>
              {/* 조회 시각 is data. 16.8px is the settled meta's measured line box
                  (12px text at the card's leading); `self-center` keeps it OUT of
                  the row's baseline, since a bar's baseline is its bottom edge and
                  hanging that on the h3's baseline grows the row by 3px. */}
              <span
                className={cn(opsStyles.skeletonBar, 'h-[16.8px] w-[124px] flex-none self-center')}
                aria-hidden
              />
            </div>

            <dl className="mt-2 flex items-baseline gap-2 pb-4 text-[12px]">
              <dt className="flex-none font-medium text-[var(--pl-text-weak)]">연동 정보</dt>
              <dd className="flex min-w-0 items-center gap-2 self-center">
                {/* 확정됨/미확정 plus whatever follows it (the 확정 정보 link, or the
                    step) — both data, so one bar covers the whole value. 19.6px is
                    what the settled value measures: the link, not the 16.8px word,
                    is what sets that line's height. */}
                <span
                  className={cn(opsStyles.skeletonBar, 'block h-[19.6px] w-[132px]')}
                  aria-hidden
                />
              </dd>
            </dl>
          </div>

          <div className="border-t border-[var(--pl-border)] px-6 py-2" aria-hidden>
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className={cn(
                  'flex min-h-[30px] items-center gap-2',
                  index > 0 && 'border-t border-[var(--pl-border)]',
                )}
              >
                {/* Each bar is the footprint of the element it stands in for, so
                    nothing moves sideways on arrival: the name column's fixed 240px
                    (16.8px line box), the SIDE_TAG's 48px floor (22.8px = 16.8 line
                    + py-0.5 + border), and the pill's own h-5 from
                    `pipelineStyles.pill.md`. The 30px row holds all three. */}
                <span className={cn(opsStyles.skeletonBar, 'h-[16.8px] w-[240px] flex-none')} />
                <span
                  className={cn(
                    opsStyles.skeletonBar,
                    'h-[22.8px] w-[48px] flex-none rounded-[4px]',
                  )}
                />
                <span
                  className={cn(opsStyles.skeletonBar, 'h-5 w-[84px] flex-none rounded-full')}
                />
              </div>
            ))}
          </div>
        </section>
      ) : failed || !status ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-4 py-3 text-left')}>
          Terraform 상태를 불러오지 못했습니다.
        </p>
      ) : (
        /* `pipelineStyles.card.flush` — the shell 작업 이력 wears, so this and the
           two cards under it read as one family instead of a grey strip sitting
           on top of two white cards. */
        <section aria-label="Terraform 적용 상태" className={cn(pipelineStyles.card.flush, 'mt-4')}>
          <div className={detailStyles.sectionCard.head}>
            <div className={detailStyles.sectionCard.titleRow}>
              {/* Plain text at 16px/700, not the blue scopeTag the sibling cards
                  wear (owner 2026-08-30). The tag exists to declare what a card IS
                  and then get out of the way of the card's own subject — 현재 작업
                  has a run name two rows down to defer to. This card has no such
                  second line: the title IS its subject, so it is set as one. */}
              <h3 className="text-[16px] font-bold leading-[1.3] text-[var(--pl-text-strong)]">
                Terraform 적용 상태
              </h3>
              {/* 조회 qualifies the whole list, so it rides the title row; under
                  the rows it read as a footnote to whichever task was last. */}
              {status.checked_at && (
                <span className={detailStyles.sectionCard.meta}>
                  조회 {fmtDateTime(status.checked_at)}
                </span>
              )}
            </div>

            {/* A real <dl> for one pair: the label sits in front of the value, and
                that pairing is the reason there is no tag here — it survives into
                the a11y tree only if the markup keeps it. */}
            <dl className="mt-2 flex items-baseline gap-2 pb-4 text-[12px]">
              <dt className="flex-none font-medium text-[var(--pl-text-weak)]">연동 정보</dt>
              <dd className="flex min-w-0 items-baseline gap-2">
                {/* The VALUE wears the warning colour, not the cell and not the
                    card: 미확정 is a stage of normal work, so an amber panel would
                    read as a failure and red would say it is one. */}
                <span
                  className={cn(
                    'font-semibold',
                    confirmed ? 'text-[var(--pl-text-strong)]' : 'text-[var(--pl-warn-text)]',
                  )}
                >
                  {confirmed ? '확정됨' : '미확정'}
                </span>
                {confirmed ? (
                  /* Only when 확정됨: with nothing confirmed there is no confirmed
                     detail to open. A button, not an anchor — the tab strip is
                     client state on this screen, not a route. */
                  <button
                    type="button"
                    onClick={() => onSelectTab(OPS_TAB_SLUGS.confirm)}
                    className={cn(opsStyles.detailLink, 'text-[12px] font-normal')}
                    aria-label={`${OPS_TAB_SLUGS.confirm} 상세정보 보기`}
                  >
                    상세정보 보기
                    <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
                  </button>
                ) : (
                  /* The step continues the SAME line. Nothing is said about a step
                     the caller could not name. */
                  step && (
                    <span className="text-[var(--pl-text-weak)]">
                      · {step.n}단계 · {step.label}
                    </span>
                  )
                )}
              </dd>
            </dl>
          </div>

          {/* The hairline is the only internal separation — no nested container,
              and no column-header row: the card's own title already names the
              list, and the contract's longest list is three rows (AWS 3,
              GCP/IDC/SDU 2, Azure 1), so a header would cost a line and buy
              nothing. That same ceiling is why there is no cap and no scroll —
              a "+N개 더" affordance would never fire. */}
          <div className="border-t border-[var(--pl-border)] px-6 py-2">
            {tasks.length === 0 ? (
              <p className="flex min-h-[30px] items-center text-[12px] text-[var(--pl-text-weak)]">
                작업 정보가 없습니다.
              </p>
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
          </div>
        </section>
      )}
    </div>
  );
}
