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
 *   - the step rows — one per step in execution order: name · owner (weak text),
 *     then ONE fact: a 조치 필요 / 조회 실패 tag with the count while the step is
 *     the one to act on, plain 대기 or 「N건 모두 완료」 otherwise. Under the step to
 *     act on, the resources still open — address (or name) · DB · 조치 필요 / 조회
 *     도중 실패 · guide — so the card names WHICH database is left, not only how
 *     many (docs/ux/benchmark/idc-install-state-rows.md). Only steps this target
 *     actually has: a step that is SKIP on every resource is not drawn.
 *
 * The head carries no 작업 시작 (owner call): starting a run belongs to the
 * 현재 작업 card, so the 관리자 turn offers a link down to it instead.
 */
import { type ReactElement, type ReactNode } from 'react';
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
import type { InstallResourceIdentity } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installIdentity';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';
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

/**
 * 주체 태그 for the SDU task rows below — a neutral bordered tag. 48px floor,
 * centred, so the state tags beside it land on one x.
 */
const SIDE_TAG =
  'inline-flex min-w-[48px] flex-none items-center justify-center rounded-[4px] border bg-[var(--pl-bg-card)] px-1.5 py-0.5 text-[12px] font-medium';

/**
 * The tag is spent on the step to act on only; 대기 and 완료 are plain text (Carbon:
 * no status indicator where no action is possible). FAIL reads 조회 실패 — the
 * owner's word: the contract does not say what failed, only that the check did.
 */
const OPEN_TAG: Record<'now' | 'fail', { tone: TcTone; label: string }> = {
  now: { tone: 'warn', label: '조치 필요' },
  fail: { tone: 'err', label: '조회 실패' },
};

/** The count while the step is open: what is left, or what failed. */
const countOf = (step: InstallStateStep): string | null => {
  if (step.failed > 0) return `${step.total}건 중 ${step.failed}건 조회 실패`;
  if (step.done > 0) return `${step.total}건 중 ${step.total - step.done}건 남음`;
  return null;
};

const WEAK = 'text-[12px] text-[var(--pl-text-weak)]';

export const FAIL_NOTE = '조회 실패가 여러 번 이어지면 개발자에게 연락하세요.';

/** One install step: what it is, who does it, where it stands. */
function StepRow({
  step,
  first,
  identity,
  children,
}: {
  step: InstallStateStep;
  first: boolean;
  identity: ReadonlyMap<string, InstallResourceIdentity>;
  /** Reference drawn under the row (the GCP subnet commands). */
  children?: ReactNode;
}): ReactElement {
  const openTag = step.state === 'now' || step.state === 'fail' ? OPEN_TAG[step.state] : null;
  const count = openTag ? countOf(step) : null;
  return (
    <div className={cn(!first && 'border-t border-[var(--pl-border)]')}>
      <div className="flex min-h-[30px] items-center gap-2">
        {/* A FIXED 240px column (opsStyles.fmFold's column): the pieces cluster and
            the row reads left to right instead of the state drifting to the far edge. */}
        <span className="w-[240px] min-w-0 flex-none truncate text-[12px] font-semibold text-[var(--pl-text-strong)]">
          {step.title}
          <span className="ml-1 font-normal text-[var(--pl-text-weak)]">· {step.side}</span>
        </span>
        {openTag ? (
          <TcPill tone={openTag.tone} label={openTag.label} />
        ) : step.state === 'done' ? (
          <span className="text-[12px] tabular-nums text-[var(--pl-ok-text)]">{step.total}건 모두 완료</span>
        ) : (
          <span className={WEAK}>대기</span>
        )}
        {count && <span className={cn(WEAK, 'tabular-nums')}>{count}</span>}
      </div>
      {openTag && step.open.length > 0 && (
        <div className="mb-2 ml-3 border-l-2 border-[var(--pl-gray-200)] pl-3 text-[12px]">
          {step.listResources ? (
            <ul
              className="grid grid-cols-[minmax(200px,max-content)_72px_auto] gap-x-2"
              aria-label={`${step.title} 남은 리소스`}
            >
              {step.open.map((r) => {
                const who = identity.get(r.resourceId);
                const db = who?.databaseType ? getDatabaseShortLabel(who.databaseType) : null;
                return (
                  // `contents`: the cells sit in the list's grid, so the address column is as
                  // wide as the longest address (a host name can run long) and every row's
                  // DB and state land on one x. Nothing is truncated — the address IS the row.
                  <li key={r.resourceId} className="contents">
                    <span className="flex min-h-[26px] items-center break-all text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]">
                      {r.resourceName ?? who?.label ?? r.resourceId}
                    </span>
                    <span className={cn(WEAK, 'flex min-h-[26px] items-center truncate')}>{db}</span>
                    <span
                      className={cn(
                        'flex min-h-[26px] items-center',
                        r.failed ? 'text-[var(--pl-err-text)]' : 'text-[var(--pl-warn-text)]',
                      )}
                    >
                      {r.failed ? '조회 도중 실패' : '조치 필요'}
                    </span>
                    {r.guide && (
                      <p className="col-span-3 pb-1 text-[12px] leading-[1.5] text-[var(--pl-err-text)]">
                        {r.guide}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            // No rows for this step (AWS, IDC BDP): the guides still have to be read.
            [...new Set(step.open.flatMap((r) => (r.guide ? [r.guide] : [])))].map((guide) => (
              <p key={guide} className="py-1 text-[12px] leading-[1.5] text-[var(--pl-err-text)]">
                {guide}
              </p>
            ))
          )}
          {/* Owner 2026-09-14: a failed check is said out loud, and a check that keeps
              failing is the developer's, not the operator's. */}
          {step.failed > 0 && <p className={cn(WEAK, 'min-h-[26px] leading-[26px]')}>{FAIL_NOTE}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * SDU fallback — one terraform-status task per row, the rows the head drew before
 * the fold existed. SDU has no installation-status in this console (Crawler and
 * Athena, not Terraform cells), so the fold is `null` there; dropping the rows
 * would leave the card with nothing but the 연동 정보 line while terraform-status
 * still answers with two live tasks. The SDU tab set is its own design track
 * (PR #835), so this keeps what was there rather than inventing a state for it.
 */
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
      <span className="w-[240px] min-w-0 flex-none truncate text-[12px] font-semibold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]">
        {name}
      </span>
      <span className={SIDE_TAG}>{side}</span>
      <span
        className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, TONE[tone].pill, 'flex-none')}
      >
        <Icon name={icon} size="sm" className={icon === 'loader' ? 'animate-spin' : undefined} />
        {label}
      </span>
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
  /**
   * GCP only: the per-Region PSC proxy-subnet commands, drawn under the 「PSC용 Subnet
   * 생성」 row while that row is still open — the thing the operator hands to the
   * service owner when it is their move. `undefined` for every other provider.
   */
  subnetGuide?: ReactNode;
  /** resource id → address / name, joined from the confirmed integration (`installIdentity`). */
  identity?: ReadonlyMap<string, InstallResourceIdentity>;
  /** The 관리자 turn's one move — scrolls to the 현재 작업 card that owns 작업 시작. */
  onGoToCurrentWork: () => void;
}

const NO_IDENTITY: ReadonlyMap<string, InstallResourceIdentity> = new Map();

export function InfraStatusHead({
  status,
  loading,
  failed,
  processStatus,
  onSelectTab,
  install,
  installLoading,
  installLastCheck,
  subnetGuide,
  identity = NO_IDENTITY,
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
                    <StepRow key={s.id} step={s} first={index === 0} identity={identity}>
                      {s.id === 'subnet' && s.state !== 'done' && subnetGuide && (
                        <div className="pb-4 pt-1">{subnetGuide}</div>
                      )}
                    </StepRow>
                  ))}
                </div>
              )}
            </>
          )
        )}
        {install === null && !installLoading && status && status.tasks && status.tasks.length > 0 && (
          <div className="border-t border-[var(--pl-border)] px-6 py-2">
            {status.tasks.map((task, index) => (
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
