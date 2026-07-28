'use client';

/**
 * Terraform 상태 card (인프라 작업 tab head) — GET …/terraform-status.
 *
 * InfraManager's own Terraform job records; no Cloud SDK call is made, so this
 * can legitimately disagree with the real infrastructure. The card says so
 * rather than reconciling the two.
 *
 * Layout: a state-tinted hero BAND carrying the conclusion (overall_state + a
 * task tally + the confirmed/destroy facts) over a grid of per-task tiles
 * carrying the evidence. Two surface levels only — the band is a tint with no
 * border of its own, so the card does not read as boxes inside boxes. Tiles are
 * a 3-column grid rather than full-width rows: a long `AWS_BDC_SERVICE_COMMON`
 * wraps inside its tile instead of stretching a row across the whole page.
 *
 * `scripts[]` from the wire DTO is not rendered — the TerraformTaskScriptResponse
 * schema has not been published yet, so it is absent from install-v1.yaml.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { fmtDateTime } from '@/lib/pipeline/format';
import {
  getTerraformStatus,
  type TerraformStatusResponse,
  type TerraformTaskStatus,
} from '@/app/lib/api';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/* Tone classes are written out in full — Tailwind only sees literal strings, so
   a `bg-[var(--pl-${tone}-bg)]` template would never be generated. */
const TONE = {
  off: {
    pill: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)] border border-[var(--pl-off-border)]',
    band: 'bg-[var(--pl-off-bg)]',
    disc: 'bg-[var(--pl-bg-card)] text-[var(--pl-off-text)] border-[var(--pl-off-border)]',
    bar: 'bg-[var(--pl-off-border)]',
    text: 'text-[var(--pl-off-text)]',
  },
  info: {
    pill: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)] border border-[var(--pl-info-border)]',
    band: 'bg-[var(--pl-info-bg)]',
    disc: 'bg-[var(--pl-bg-card)] text-[var(--pl-info-text)] border-[var(--pl-info-border)]',
    bar: 'bg-[var(--pl-info-text)]',
    text: 'text-[var(--pl-info-text)]',
  },
  ok: {
    pill: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)] border border-[var(--pl-ok-border)]',
    band: 'bg-[var(--pl-ok-bg)]',
    disc: 'bg-[var(--pl-bg-card)] text-[var(--pl-ok-text)] border-[var(--pl-ok-border)]',
    bar: 'bg-[var(--pl-ok-text)]',
    text: 'text-[var(--pl-ok-text)]',
  },
  err: {
    pill: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)] border border-[var(--pl-err-border)]',
    band: 'bg-[var(--pl-err-bg)]',
    disc: 'bg-[var(--pl-bg-card)] text-[var(--pl-err-text)] border-[var(--pl-err-border)]',
    bar: 'bg-[var(--pl-err-text)]',
    text: 'text-[var(--pl-err-text)]',
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

/**
 * The hero's second line — what the overall label alone cannot say: how many of
 * the tasks are behind it. Failures outrank in-flight work outrank the rest.
 */
function tally(tasks: readonly TerraformTaskStatus[]): string {
  const total = tasks.length;
  if (total === 0) return 'Terraform 작업 기록 없음';
  const count = (tone: keyof typeof TONE) =>
    tasks.filter((task) => metaOf(task.state).tone === tone).length;
  const failed = count('err');
  if (failed > 0) return `작업 ${total}개 중 ${failed}개 실패`;
  const running = count('info');
  if (running > 0) return `작업 ${total}개 중 ${running}개 진행 중`;
  const applied = tasks.filter((task) => task.state === 'APPLIED').length;
  if (applied === total) return `작업 ${total}개 모두 적용 완료`;
  if (applied === 0) return `작업 ${total}개 미적용`;
  return `작업 ${total}개 중 ${applied}개 적용 완료`;
}

/** Evidence tile — one Terraform task. */
function TaskTile({ task }: { task: TerraformTaskStatus }): ReactElement {
  const { tone, icon, label } = metaOf(task.state);
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] py-4 pl-[19px] pr-4">
      {/* Full-height tone bar — the tile's state is readable before any text. */}
      <span className={cn('absolute inset-y-0 left-0 w-1', TONE[tone].bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex h-7 w-7 flex-none items-center justify-center rounded-full border',
            TONE[tone].disc,
          )}
        >
          <Icon name={icon} size="sm" className={icon === 'loader' ? 'animate-spin' : undefined} />
        </span>
        <span className={cn(opsStyles.regionTag, 'flex-none')}>
          {SIDE_LABEL[task.terraform_execution_side ?? ''] ?? task.terraform_execution_side ?? '-'}
        </span>
      </div>
      <p className="mt-3 break-all text-[13px] font-semibold leading-[1.45] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]">
        {task.terraform_task_name ?? '-'}
      </p>
      <p className="mt-1 break-all text-[12px] leading-[1.45] text-[var(--pl-text-weak)]">
        {task.terraform_target ?? '-'}
      </p>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, TONE[tone].pill)}>
          {label}
        </span>
        {task.destroy_required && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--pl-err-text)]">
            <Icon name="warn-tri" size="sm" />
            삭제 필요
          </span>
        )}
      </div>
    </div>
  );
}

export interface TerraformStatusCardProps {
  targetSourceId: number;
}

export function TerraformStatusCard({ targetSourceId }: TerraformStatusCardProps): ReactElement {
  const [status, setStatus] = useState<TerraformStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Latest-request-wins (StatusHistoryCard pattern): a response for a previous
  // target source must not commit over the current one.
  const loadSeq = useRef(0);
  const load = useCallback(async (): Promise<void> => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setFailed(false);
    try {
      const data = await getTerraformStatus(targetSourceId);
      if (seq !== loadSeq.current) return;
      setStatus(data);
    } catch {
      if (seq !== loadSeq.current) return;
      setFailed(true);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tasks = status?.tasks ?? [];
  const overall = metaOf(status?.overall_state);

  return (
    <section className={pipelineStyles.card.base} aria-label="Terraform 상태">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={opsStyles.cardTitle}>Terraform 상태</h2>
          <p className={opsStyles.cardDesc}>
            InfraManager에서 조회한 Terraform Job 결과값입니다. Cloud SDK를 조회하지 않아서 실제 인프라
            설치 상태와 다를 수 있습니다.
          </p>
        </div>
        {status?.checked_at && (
          <span className="flex-none text-[11px] text-[var(--pl-text-faint)] tabular-nums">
            조회 {fmtDateTime(status.checked_at)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="min-h-[180px]" aria-busy />
      ) : failed || !status ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-3')}>Terraform 상태를 불러오지 못했습니다.</p>
      ) : (
        <>
          {/* 결론 — a tint, not a box: the band carries the state without adding
              another framed surface inside the card. */}
          <div
            className={cn(
              'mt-4 flex flex-wrap items-center justify-between gap-x-10 gap-y-4 rounded-[10px] px-5 py-4',
              TONE[overall.tone].band,
            )}
          >
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full border',
                  TONE[overall.tone].disc,
                )}
              >
                <Icon
                  name={overall.icon}
                  size="xl"
                  strokeWidth={2.2}
                  className={overall.icon === 'loader' ? 'animate-spin' : undefined}
                />
              </span>
              <span>
                <span
                  className={cn(
                    'block text-[20px] font-bold leading-tight tracking-[-0.01em]',
                    TONE[overall.tone].text,
                  )}
                >
                  {overall.label}
                </span>
                <span className="mt-1 block text-[13px] text-[var(--pl-text-medium)]">
                  {tally(tasks)}
                </span>
              </span>
            </div>

            <dl className="flex items-start gap-10">
              <div>
                <dt className="text-[12px] text-[var(--pl-text-weak)]">확정 인프라</dt>
                <dd className="mt-1 text-[13.5px] font-semibold text-[var(--pl-text-strong)]">
                  {status.has_confirmed_infra ? '있음' : '없음'}
                  {status.latest_confirmed_at && (
                    <span className="ml-1.5 text-[12px] font-normal text-[var(--pl-text-weak)] tabular-nums">
                      {fmtDateTime(status.latest_confirmed_at)}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--pl-text-weak)]">삭제 필요</dt>
                <dd
                  className={cn(
                    'mt-1 inline-flex items-center gap-1 text-[13.5px] font-semibold',
                    status.destroy_required
                      ? 'text-[var(--pl-err-text)]'
                      : 'text-[var(--pl-text-strong)]',
                  )}
                >
                  {status.destroy_required && <Icon name="warn-tri" size="sm" />}
                  {status.destroy_required ? '필요' : '불필요'}
                </dd>
              </div>
            </dl>
          </div>

          {/* 근거 — one tile per Terraform task. */}
          {tasks.length === 0 ? (
            <PlEmptyState icon="install" message="Terraform 작업 기록이 없습니다." className="mt-3" />
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {tasks.map((task, index) => (
                <TaskTile key={task.terraform_task_name ?? index} task={task} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
