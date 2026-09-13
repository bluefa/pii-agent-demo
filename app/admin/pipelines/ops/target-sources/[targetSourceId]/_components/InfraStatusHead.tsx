'use client';

/**
 * 인프라 작업 tab head — the tab said in one sentence, then ONE card: 설치 상태.
 *
 * The card used to list InfraManager's Terraform job records (terraform-status):
 * wire enum names, 미적용/적용 중/적용 완료 per task. It said what we had run and
 * never who had to do what, so 미적용 could mean "the service has not applied
 * yet" or "the operator has not pressed 작업 시작" and the operator could not
 * tell (owner 2026-09-13: "관리자들이 똑똑한 사람들이 아니야. 누가 뭘 할 차례다 /
 * 완료됐다를 명확하게"). The rows now come from installation-status, folded by
 * `installStateView` into one verdict line and one row per step with its owner
 * (docs/ux/benchmark/infra-install-state.md). terraform-status still feeds the
 * 연동 정보 line (`has_confirmed_infra`) and the delete gate; its task rows are
 * gone from here. The run history the rows used to hint at is the 작업 이력 card.
 *
 * What the card holds, top to bottom:
 *   - the head — `설치 상태` as plain 16px/700 text (not the sibling cards' blue
 *     tag: this card has no second line to defer to), and 확인 시각 at the far end
 *     of the same row. The time is installation-status's `last_check`, the one
 *     clock the rows below actually run on.
 *   - the 연동 정보 line — 확정됨 / 미확정, the precondition every run depends on,
 *     as a label/value pair (no tag, owner call). 확정됨 links to the 확정 정보
 *     tab; 미확정 names the step the target sits at.
 *   - the verdict row (`InstallStateRow`) — whose move it is, in one sentence.
 *   - the step rows — one per step in execution order: name · owner tag · state
 *     tag, a count when resources are only partly through, the guide under a
 *     failed row. Only steps this target actually has: a step that is SKIP on
 *     every resource is not drawn.
 *
 * The head carries no 작업 시작 (owner call): starting a run belongs to the
 * 현재 작업 card, so the 관리자 turn offers a link down to it instead.
 */
import { type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { fmtDateTime } from '@/lib/pipeline/format';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { InstallStateRow } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallStateRow';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import type { TcTone } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import type {
  InstallStateStep,
  InstallStateView,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installState';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { OPS_TAB_SLUGS, type OpsTargetTabLabel } from '@/lib/routes';
import type { TerraformStatusResponse } from '@/app/lib/api';

/** The three jobs, named by weight inside the intro sentence. */
const JOB = 'font-semibold text-[var(--pl-text-strong)]';

/**
 * 주체 태그 — a neutral bordered tag for the service owner; the operator's own
 * steps take the warn stroke so the column says "you" at a glance.
 * 48px floor, centred, so the state tags beside it land on one x (the same
 * reasoning as the task rows this replaces).
 */
const SIDE_TAG =
  'inline-flex min-w-[48px] flex-none items-center justify-center rounded-[4px] border bg-[var(--pl-bg-card)] px-1.5 py-0.5 text-[12px] font-medium';
const SIDE_TONE: Record<InstallStateStep['side'], string> = {
  서비스: 'border-[var(--pl-border)] text-[var(--pl-text-weak)]',
  관리자: 'border-[var(--pl-warn-text)] text-[var(--pl-warn-text)]',
};

const STATE_TAG: Record<InstallStateStep['state'], { tone: TcTone; label: string }> = {
  done: { tone: 'ok', label: '완료' },
  now: { tone: 'warn', label: '조치 필요' },
  wait: { tone: 'off', label: '대기' },
  na: { tone: 'off', label: '해당 없음' },
  fail: { tone: 'err', label: '실패' },
};

/** The count only when it adds a fact: a step partly through, or partly failed. */
const countOf = (step: InstallStateStep): string | null => {
  if (step.failed > 0) return `${step.total}건 중 ${step.failed}건 실패`;
  if (step.state !== 'done' && step.done > 0) return `${step.total}건 중 ${step.total - step.done}건 남음`;
  return null;
};

/** One install step: what it is, who does it, where it stands. */
function StepRow({ step, first }: { step: InstallStateStep; first: boolean }): ReactElement {
  const tag = STATE_TAG[step.state];
  const count = countOf(step);
  return (
    <div className={cn(!first && 'border-t border-[var(--pl-border)]')}>
      <div className="flex min-h-[30px] items-center gap-2">
        {/* A FIXED 240px column (opsStyles.fmFold's column): the three pieces
            cluster and the row reads left to right instead of the state tag
            drifting to the far edge. */}
        <span className="w-[240px] min-w-0 flex-none truncate text-[12px] font-semibold text-[var(--pl-text-strong)]">
          {step.title}
        </span>
        <span className={cn(SIDE_TAG, SIDE_TONE[step.side])}>{step.side}</span>
        <TcPill tone={tag.tone} label={tag.label} />
        {count && (
          <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">{count}</span>
        )}
      </div>
      {step.guides.map((guide) => (
        <p key={guide} className="-mt-0.5 pb-1.5 text-[12px] leading-[1.5] text-[var(--pl-err-text)]">
          {guide}
        </p>
      ))}
    </div>
  );
}

export interface InfraStatusHeadProps {
  /** terraform-status — read here only for `has_confirmed_infra`. */
  status: TerraformStatusResponse | null;
  loading: boolean;
  /** True when the terraform-status lookup failed — the 연동 정보 value says so. */
  failed: boolean;
  /** Names the step the target is at while 연동 정보 is still 미확정. */
  processStatus: ProcessStatus | null;
  /** Opens another tab — 확정됨 offers the 확정 정보 tab as its detail. */
  onSelectTab: (tab: OpsTargetTabLabel) => void;
  /** The fold. `null` = this target has no install status here (SDU). */
  install: InstallStateView | null;
  installLoading: boolean;
  installLastCheck: InstallLastCheck | null;
  /** The 관리자 turn's one move — scrolls to the 현재 작업 card that owns 작업 시작. */
  onGoToCurrentWork: () => void;
}

export function InfraStatusHead({
  status,
  loading,
  failed,
  processStatus,
  onSelectTab,
  install,
  installLoading,
  installLastCheck,
  onGoToCurrentWork,
}: InfraStatusHeadProps): ReactElement {
  const confirmed = status?.has_confirmed_infra === true;
  const step = processStatus ? STEP[processStatus] : null;
  const installPending = installLoading && install === null;

  return (
    <div>
      <div className="flex items-start gap-3 rounded-[10px] border border-[var(--pl-info-border)] bg-[var(--pl-info-bg)] px-5 py-4">
        <span className="mt-px flex-none text-[var(--pl-info-text)]">
          <Icon name="info" size="md" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--pl-info-text)]">이 탭에서 하는 일</p>
          <h2 className="mt-1 break-keep text-[14px] font-normal leading-[1.6] text-[var(--pl-text-medium)]">
            Terraform으로 이 대상의 인프라를 <b className={JOB}>설치·삭제</b>하고, 현재{' '}
            <b className={JOB}>설치 상태</b>와 지금까지 실행한 <b className={JOB}>작업 이력</b>을
            확인합니다.
          </h2>
        </div>
      </div>

      <section
        aria-label="설치 상태"
        aria-busy={installPending || loading || undefined}
        className={cn(pipelineStyles.card.flush, 'mt-4')}
      >
        <div className={detailStyles.sectionCard.head}>
          <div className={detailStyles.sectionCard.titleRow}>
            <h3 className="text-[16px] font-bold leading-[1.3] text-[var(--pl-text-strong)]">
              설치 상태
            </h3>
            {installPending ? (
              <span
                className={cn(opsStyles.skeletonBar, 'h-[16.8px] w-[124px] flex-none self-center')}
                aria-hidden
              />
            ) : (
              installLastCheck?.checkedAt && (
                <span className={detailStyles.sectionCard.meta}>
                  확인 {fmtDateTime(installLastCheck.checkedAt)}
                </span>
              )
            )}
          </div>

          <dl className="mt-2 flex items-baseline gap-2 pb-4 text-[12px]">
            <dt className="flex-none font-medium text-[var(--pl-text-weak)]">연동 정보</dt>
            <dd className="flex min-w-0 items-baseline gap-2">
              {loading ? (
                <span
                  className={cn(opsStyles.skeletonBar, 'block h-[19.6px] w-[132px]')}
                  aria-hidden
                />
              ) : failed || !status ? (
                <span className="text-[var(--pl-text-weak)]">확인하지 못했습니다</span>
              ) : (
                <>
                  <span
                    className={cn(
                      'font-semibold',
                      confirmed ? 'text-[var(--pl-text-strong)]' : 'text-[var(--pl-warn-text)]',
                    )}
                  >
                    {confirmed ? '확정됨' : '미확정'}
                  </span>
                  {confirmed ? (
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
                    step && (
                      <span className="text-[var(--pl-text-weak)]">
                        · {step.n}단계 · {step.label}
                      </span>
                    )
                  )}
                </>
              )}
            </dd>
          </dl>
        </div>

        {installPending ? (
          <div className="px-6 pb-4" aria-hidden>
            <span className="sr-only">설치 상태를 불러오는 중</span>
            <span className={cn(opsStyles.skeletonBar, 'block h-[46px] w-full rounded-[10px]')} />
            <div className="mt-4 border-t border-[var(--pl-border)] pt-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex min-h-[30px] items-center gap-2',
                    index > 0 && 'border-t border-[var(--pl-border)]',
                  )}
                >
                  <span className={cn(opsStyles.skeletonBar, 'h-[16.8px] w-[240px] flex-none')} />
                  <span
                    className={cn(opsStyles.skeletonBar, 'h-[22.8px] w-[48px] flex-none rounded-[4px]')}
                  />
                  <span className={cn(opsStyles.skeletonBar, 'h-5 w-[84px] flex-none rounded-full')} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          install && (
            <>
              <InstallStateRow
                view={install}
                className="mx-6 mb-4"
                action={
                  install.kind === 'me' ? (
                    <button
                      type="button"
                      onClick={onGoToCurrentWork}
                      className={cn(opsStyles.detailLink, 'text-[12px]')}
                    >
                      현재 작업으로 이동
                      <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
                    </button>
                  ) : undefined
                }
              />
              {install.steps.length > 0 && (
                <div className="border-t border-[var(--pl-border)] px-6 py-2">
                  {install.steps.map((s, index) => (
                    <StepRow key={s.id} step={s} first={index === 0} />
                  ))}
                </div>
              )}
            </>
          )
        )}
      </section>
    </div>
  );
}
