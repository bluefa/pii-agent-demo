'use client';

/**
 * 인프라 작업 tab head — what the infrastructure IS, above the run that changes it.
 *
 * Replaces the former TerraformStatusCard, which carried the same data as a
 * full card with its own tinted hero band. Two heroes on one screen (that band
 * and the 현재 작업 card) competed for the same attention while saying nothing
 * about how they relate, so the status side is demoted to a single-line strip
 * and the per-task evidence moves behind a disclosure. The run card below is
 * now the tab's only hero.
 *
 * Two renders, one decision:
 *   - has_confirmed_infra === false → GATE banner. Terraform has nothing to
 *     build from until the integration is confirmed, so the tab leads with why
 *     and what to do next instead of a status nobody can act on.
 *   - otherwise → the strip (+ optional task lines).
 *
 * Data comes from GET …/terraform-status via the parent (PipelineTab owns the
 * fetch because the start-CTA gate reads the same response). InfraManager's own
 * job records; no Cloud SDK call is made, so this can legitimately disagree
 * with the real infrastructure — the strip's caption says so.
 *
 * The published TerraformTaskStatusResponse carries only execution side, task
 * name, and state — the formerly ASSUMED fields (terraform_target,
 * destroy_required, completed_at) did not land in the real spec.
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { fmtDateTime } from '@/lib/pipeline/format';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { TerraformStatusResponse, TerraformTaskStatus } from '@/app/lib/api';

/* Monochrome status ladder — the same rule as theme.ts PILL_* : all states share
   one neutral family and separate by weight, with red kept only for failure.
   Classes are written out in full because Tailwind only sees literal strings, so
   a `bg-[var(--pl-${tone}-bg)]` template would never be generated. */
const TONE = {
  off: {
    dot: 'bg-[var(--pl-gray-400)]',
    text: 'text-[var(--pl-text-weak)]',
    pill: 'bg-[var(--pl-gray-50)] text-[var(--pl-text-weak)] border border-[var(--pl-border)]',
  },
  info: {
    dot: 'bg-[var(--pl-text-strong)]',
    text: 'text-[var(--pl-text-strong)]',
    pill: 'bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] border border-[var(--pl-text-strong)]',
  },
  ok: {
    dot: 'bg-[var(--pl-text-medium)]',
    text: 'text-[var(--pl-text-strong)]',
    pill: 'bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)] border border-[var(--pl-border-strong)]',
  },
  err: {
    dot: 'bg-[var(--pl-err)]',
    text: 'text-[var(--pl-err-text)]',
    pill: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)] border border-[var(--pl-err-border)]',
  },
} as const;

/** Wire state → tone + icon + 한국어 label. UNKNOWN covers unseen values. */
const STATE_META: Record<string, { tone: keyof typeof TONE; icon: IconName; label: string }> = {
  NEVER_APPLIED: { tone: 'off', icon: 'clock', label: '미적용' },
  APPLYING: { tone: 'info', icon: 'loader', label: '적용 중' },
  APPLIED: { tone: 'ok', icon: 'check', label: '적용 완료' },
  APPLY_FAILED: { tone: 'err', icon: 'x-circle', label: '적용 실패' },
  DESTROYING: { tone: 'info', icon: 'loader', label: '삭제 중' },
  DESTROYED: { tone: 'off', icon: 'ban', label: '삭제됨' },
  DESTROY_FAILED: { tone: 'err', icon: 'x-circle', label: '삭제 실패' },
  UNKNOWN: { tone: 'off', icon: 'ban', label: '알 수 없음' },
};

const metaOf = (state: string | null | undefined) => STATE_META[state ?? ''] ?? STATE_META.UNKNOWN;

/** BDC/SERVICE 실행 주체 — neutral tag, never competing with the state. */
const SIDE_LABEL: Record<string, string> = { SERVICE: '서비스', BDC: 'BDC' };

/** One Terraform task, one line (was a tile in a 3-column grid). */
function TaskLine({ task }: { task: TerraformTaskStatus }): ReactElement {
  const { tone, icon, label } = metaOf(task.state);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-[var(--pl-gray-200)] px-1 py-2.5 text-[12px]">
      <span className={cn('flex-none', TONE[tone].text)}>
        <Icon name={icon} size="sm" className={icon === 'loader' ? 'animate-spin' : undefined} />
      </span>
      {/* Colors are stated, never inherited — an unstyled cell picks up whatever
          the surrounding container sets and the task name renders fainter than
          its own target. */}
      <span className="min-w-[178px] font-semibold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]">
        {task.terraform_task_name ?? '-'}
      </span>
      <span className={opsStyles.regionTag}>
        {SIDE_LABEL[task.terraform_execution_side ?? ''] ?? task.terraform_execution_side ?? '-'}
      </span>
      <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, TONE[tone].pill)}>
        {label}
      </span>
    </div>
  );
}

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
      className="flex items-start gap-5 rounded-[12px] border-[1.5px] border-l-[5px] border-[var(--pl-warn-border)] border-l-[var(--pl-warn)] bg-[var(--pl-warn-bg)] px-[26px] py-6"
      role="status"
    >
      <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-[1.5px] border-[var(--pl-warn-border)] bg-[var(--pl-bg-card)] text-[var(--pl-warn-text)]">
        <Icon name="warn-tri" size="xl" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="mt-0.5 text-[22px] font-bold leading-[1.25] tracking-[-0.018em] text-[var(--pl-warn-text)]">
          확정된 연동 정보가 없습니다
        </h2>
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
  const [open, setOpen] = useState(false);

  if (loading) return <div className="h-[42px]" aria-busy />;

  if (failed || !status) {
    return (
      <p className={cn(pipelineStyles.empty.base, 'py-3 text-left')}>
        Terraform 상태를 불러오지 못했습니다.
      </p>
    );
  }

  if (!status.has_confirmed_infra) return <GateBanner onOpenRequest={onOpenRequest} />;

  const tasks = status.tasks ?? [];

  return (
    <div>
      {/* One left edge, two type sizes. Everything hangs off the same margin and
          reads top-down: precondition tag → 16px section name → 12px supporting
          detail. The earlier version spread three groups across the full width,
          which gave the eye three competing starting points and no hierarchy at
          all. Color does the same work as size here: the tag and the caption sit
          back, the name and the date come forward. */}
      <div className="border-b border-[var(--pl-border)] px-1 pb-4 pt-1">
        {/* The precondition, stated before the thing it gates. Its false case is
            the GateBanner above, so this branch only ever reads 있음. */}
        <span className="inline-flex items-center rounded-[5px] border border-[var(--pl-border-strong)] bg-[var(--pl-gray-100)] px-2 py-[3px] text-[12px] font-semibold text-[var(--pl-text-medium)]">
          확정 정보 있음
        </span>

        <h2 className="mt-2 text-[16px] font-bold tracking-[-0.015em] text-[var(--pl-text-strong)]">
          Terraform 설치 현황
        </h2>

        {/* break-keep: Korean must wrap between words, not mid-word (…설치 상/태와). */}
        <p className="mt-1 max-w-[68ch] break-keep text-[12px] leading-[1.55] text-[var(--pl-text-faint)]">
          InfraManager에서 조회한 Terraform Job 결과값입니다. Cloud SDK를 조회하지 않아서 실제 인프라
          설치 상태와 다를 수 있습니다.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          {status.latest_confirmed_at && (
            <span>
              <span className="text-[var(--pl-text-weak)]">최근 확정</span>
              <span className="ml-1.5 font-semibold tabular-nums text-[var(--pl-text-strong)]">
                {fmtDateTime(status.latest_confirmed_at)}
              </span>
            </span>
          )}
          {/* The only control in the head, so it has to read as one. A neutral
              border left it looking like another static chip in a row of them —
              and a 1px primary hairline alone still read grey at 100% zoom, so
              the label carries the hue too and the stroke goes to 1.5px. */}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-[6px] border-[1.5px] border-[var(--pl-primary)] px-2.5 py-1 text-[12px] font-semibold text-[var(--pl-primary)] hover:bg-[var(--pl-primary-bg)]"
          >
            Terraform 작업 {tasks.length}개 상세
            <span aria-hidden>{open ? '▴' : '▾'}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-b border-[var(--pl-border)]">
          {tasks.length === 0 ? (
            <p className="border-t border-dashed border-[var(--pl-gray-200)] px-1 py-3 text-[12px] text-[var(--pl-text-faint)]">
              Terraform 작업 기록이 없습니다.
            </p>
          ) : (
            tasks.map((task, index) => (
              <TaskLine key={task.terraform_task_name ?? index} task={task} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
