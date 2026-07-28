'use client';

/**
 * Terraform 상태 card (인프라 작업 tab head) — GET …/terraform-status.
 *
 * This is a DB-only view: the BFF reads its own Terraform state rows without
 * calling the Cloud SDK, so it can legitimately disagree with the installation
 * status shown elsewhere. The card says so rather than reconciling the two.
 *
 * `scripts[]` from the wire DTO is not rendered — the TerraformTaskScriptResponse
 * schema has not been published yet, so it is absent from install-v1.yaml.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getTerraformStatus, type TerraformStatusResponse } from '@/app/lib/api';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/* Tone classes are written out in full — Tailwind only sees literal strings, so
   a `bg-[var(--pl-${tone}-bg)]` template would never be generated. */
const TONE = {
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)] border border-[var(--pl-off-border)]',
  info: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)] border border-[var(--pl-info-border)]',
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)] border border-[var(--pl-ok-border)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)] border border-[var(--pl-err-border)]',
} as const;

/** Wire state → pill tone + icon + 한국어 label. UNKNOWN covers unseen values. */
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

function StatePill({ state, size = 'md' }: { state: string | null; size?: 'md' | 'lg' }): ReactElement {
  const { tone, icon, label } = STATE_META[state ?? ''] ?? STATE_META.UNKNOWN;
  const { pill } = pipelineStyles;
  return (
    <span className={cn(pill.base, size === 'lg' ? pill.lg : pill.md, TONE[tone])}>
      <Icon name={icon} size="sm" className={icon === 'loader' ? 'animate-spin' : undefined} />
      {label}
    </span>
  );
}

/** BDC/SERVICE 실행 주체 — neutral tag, never competing with the state pill. */
const SIDE_LABEL: Record<string, string> = { SERVICE: '서비스', BDC: 'BDC' };

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

  const { table } = opsStyles;
  const tasks = status?.tasks ?? [];

  return (
    <section className={pipelineStyles.card.base} aria-label="Terraform 상태">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={opsStyles.cardTitle}>Terraform 상태</h2>
          <p className={opsStyles.cardDesc}>
            BFF DB에 기록된 상태입니다. Cloud SDK를 조회하지 않으므로 설치 상태와 다를 수 있어요.
          </p>
        </div>
        {status && (
          <div className="flex flex-col items-end gap-1">
            <StatePill state={status.overall_state ?? null} size="lg" />
            {status.checked_at && (
              <span className="text-[11px] text-[var(--pl-text-faint)] tabular-nums">
                조회 {fmtDateTime(status.checked_at)}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="min-h-[140px]" aria-busy />
      ) : failed || !status ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-3')}>Terraform 상태를 불러오지 못했습니다.</p>
      ) : (
        <>
          <dl className="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[8px] bg-[var(--pl-gray-50)] px-4 py-3 text-[13px]">
            <div className="flex items-center gap-2">
              <dt className="text-[var(--pl-text-weak)]">확정 인프라</dt>
              <dd className="font-medium text-[var(--pl-text-strong)]">
                {status.has_confirmed_infra ? '있음' : '없음'}
                {status.latest_confirmed_at && (
                  <span className="ml-1.5 text-[12px] font-normal text-[var(--pl-text-weak)] tabular-nums">
                    {fmtDateTime(status.latest_confirmed_at)}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-[var(--pl-text-weak)]">삭제 필요</dt>
              <dd
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
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

          {tasks.length === 0 ? (
            <PlEmptyState icon="install" message="Terraform 작업 기록이 없습니다." className="mt-3" />
          ) : (
            <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
              <table className={table.base}>
                <thead>
                  <tr>
                    <th className={table.headCell}>Terraform 작업</th>
                    <th className={table.headCell}>대상</th>
                    <th className={table.headCell}>실행 주체</th>
                    <th className={table.headCell}>상태</th>
                    <th className={table.headCell}>삭제 필요</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {tasks.map((task, index) => (
                    <tr key={task.terraform_task_name ?? index} className={table.rowHover}>
                      <td className={cn(table.cell, 'font-medium [font-family:var(--pl-font-mono)]')}>
                        {task.terraform_task_name ?? '-'}
                      </td>
                      <td className={cn(table.cell, 'text-[var(--pl-text-medium)]')}>
                        {task.terraform_target ?? '-'}
                      </td>
                      <td className={table.cell}>
                        <span className={opsStyles.regionTag}>
                          {SIDE_LABEL[task.terraform_execution_side ?? ''] ?? task.terraform_execution_side ?? '-'}
                        </span>
                      </td>
                      <td className={table.cell}>
                        <StatePill state={task.state ?? null} />
                      </td>
                      <td className={cn(table.cell, 'text-[var(--pl-text-weak)]')}>
                        {task.destroy_required ? (
                          <span className="inline-flex items-center gap-1 font-medium text-[var(--pl-err-text)]">
                            <Icon name="warn-tri" size="sm" />
                            필요
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
