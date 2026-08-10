'use client';

/**
 * 인프라 작업 tab head — the tab said in one sentence, then the three facts and
 * the one control that sentence promises.
 *
 * The tab does three jobs: run install/delete, read what Terraform has applied,
 * and look up past runs. None of them were stated anywhere. Each section carried
 * its own 12px caption instead, which put three explanations on screen while the
 * tab itself stayed unnamed. The captions are gone; this states it once, above
 * everything, and the sections below are left as plain 16px names.
 *
 * Order is fixed: statement → state → sections. The state strip is never
 * collapsible — one pill (`overall_state`), the 확정 정보 precondition, and the
 * date, always visible. Per-task evidence moved into TerraformStatusModal, so
 * detail costs a click instead of pushing 현재 작업 off the fold.
 *
 * The head carries no 작업 시작 (owner call): starting a run belongs to the
 * 현재 작업 card, so the head reads as state only and the tab keeps one place to
 * act from.
 *
 * Two renders, one decision:
 *   - has_confirmed_infra === false → GATE banner. Terraform has nothing to
 *     build from until the integration is confirmed, so the tab leads with why
 *     and what to do next instead of a status nobody can act on.
 *   - otherwise → the state strip.
 *
 * Data comes from GET …/terraform-status via the parent (PipelineTab owns the
 * fetch because the start-CTA gate reads the same response). InfraManager's own
 * job records; no Cloud SDK call is made, so this can legitimately disagree
 * with the real infrastructure — the modal says so.
 */
import { type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { useModal } from '@/app/hooks/useModal';
import { fmtDateTime } from '@/lib/pipeline/format';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TerraformStatusModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/TerraformStatusModal';
import {
  TONE,
  metaOf,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import type { TerraformStatusResponse } from '@/app/lib/api';

/**
 * 확정 정보 없음 — the tab's blocking state.
 *
 * Amber, not red: nothing has gone wrong, the work simply cannot start yet.
 * Red stays reserved for real failures (APPLY_FAILED, DESTROY warnings) so the
 * two never read as the same severity.
 */
function GateBanner({ onOpenRequest }: { onOpenRequest: () => void }): ReactElement {
  return (
    <div
      className="mt-4 flex items-start gap-5 rounded-[12px] border-[1.5px] border-l-[5px] border-[var(--pl-warn-border)] border-l-[var(--pl-warn)] bg-[var(--pl-warn-bg)] px-[26px] py-6"
      role="status"
    >
      <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-[1.5px] border-[var(--pl-warn-border)] bg-[var(--pl-bg-card)] text-[var(--pl-warn-text)]">
        <Icon name="warn-tri" size="xl" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="mt-0.5 text-[22px] font-bold leading-[1.25] tracking-[-0.018em] text-[var(--pl-warn-text)]">
          확정된 연동 정보가 없습니다
        </h3>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--pl-text-medium)]">
          연동 요청이 승인되고 확정되어야 인프라 작업을 시작할 수 있습니다. 확정 정보가 없으면
          Terraform이 무엇을 만들어야 하는지 알 수 없습니다.
        </p>
        <div className="mt-4">
          <PlButton variant="primary" onClick={onOpenRequest}>
            연동 요청 정보 보기
            <Icon name="arrow-right" size="sm" />
          </PlButton>
        </div>
      </div>
    </div>
  );
}

/** The three jobs, named by weight inside the intro sentence. */
const JOB = 'font-semibold text-[var(--pl-text-strong)]';

/** 16px/700 — one step over the slot's 12px label. */
const SLOT_VALUE = 'text-[16px] font-bold leading-[1.3] text-[var(--pl-text-strong)]';

/** One fact: name, value, and the line that qualifies it. */
function Slot({
  label,
  children,
  sub,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
}): ReactElement {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <dt className="text-[12px] font-medium text-[var(--pl-text-weak)]">{label}</dt>
      {/* The qualifying line lives INSIDE the <dd>: a <dl>'s div wrapper may hold
          only <dt>/<dd>, and a sibling <p> would also drop out of the term's
          description in the a11y tree. */}
      <dd className="mt-1.5 min-w-0">
        <span className="flex min-h-[26px] items-center">{children}</span>
        {sub != null && (
          <span className="mt-1.5 block text-[12px] text-[var(--pl-text-faint)]">{sub}</span>
        )}
      </dd>
    </div>
  );
}

export interface InfraStatusHeadProps {
  status: TerraformStatusResponse | null;
  loading: boolean;
  /** True when the status lookup failed — the strip degrades, the gate does not fire. */
  failed: boolean;
  /** Moves to the 연동 요청 정보 tab (the gate's only next step). */
  onOpenRequest: () => void;
}

export function InfraStatusHead({
  status,
  loading,
  failed,
  onOpenRequest,
}: InfraStatusHeadProps): ReactElement {
  const detailModal = useModal();
  const confirmed = status != null && !failed && status.has_confirmed_infra === true;
  const overall = metaOf(status?.overall_state);
  const taskCount = status?.tasks?.length ?? 0;

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
        /* Measured against the loaded strip, so nothing jumps when it arrives. */
        <div className="mt-4 h-[104px]" aria-busy />
      ) : failed || !status ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-4 py-3 text-left')}>
          Terraform 상태를 불러오지 못했습니다.
        </p>
      ) : !confirmed ? (
        <GateBanner onOpenRequest={onOpenRequest} />
      ) : (
        /* Three slots, one per fact the tab is asked about. A single 12px line of
           tag·pill·date read as one grey run at a glance; giving each fact a name,
           a value and its own cell is what makes them scannable. Nothing here
           collapses. */
        <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--pl-border)] overflow-hidden rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-gray-50)]">
          <Slot label="적용 상태">
            <span
              className={cn(
                pipelineStyles.pill.base,
                pipelineStyles.pill.lg,
                TONE[overall.tone].pill,
              )}
            >
              <Icon
                name={overall.icon}
                size="sm"
                className={overall.icon === 'loader' ? 'animate-spin' : undefined}
              />
              {overall.label}
            </span>
          </Slot>

          {/* The precondition, stated next to the thing it gates. Its false case is
              the GateBanner above, so this branch only ever reads 확정됨. */}
          <Slot
            label="연동 정보"
            sub={
              status.latest_confirmed_at
                ? `최근 확정 ${fmtDateTime(status.latest_confirmed_at)}`
                : undefined
            }
          >
            <span className={SLOT_VALUE}>확정됨</span>
          </Slot>

          <Slot
            label="Terraform 작업"
            sub={
              /* Text button, not a bordered one: the slot's own box is already the
                 frame, and a button inside it would read as a second card. */
              <button
                type="button"
                onClick={() => detailModal.open()}
                className={cn(opsStyles.detailLink, 'text-[12px]')}
              >
                설치 현황 보기
                <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
              </button>
            }
          >
            <span className={cn(SLOT_VALUE, 'tabular-nums')}>{taskCount}개</span>
          </Slot>
        </dl>
      )}

      {detailModal.isOpen && status && (
        <TerraformStatusModal status={status} onClose={detailModal.close} />
      )}
    </div>
  );
}
