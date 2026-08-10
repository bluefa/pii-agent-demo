'use client';

/**
 * Terraform 설치 현황 modal — the per-task evidence behind the head's one state pill.
 *
 * This used to be an inline disclosure under the head. Collapsed it said nothing;
 * expanded it pushed 현재 작업 (the tab's hero) below the fold, so the tab's third
 * job — "what is applied right now" — was either invisible or in the way. A modal
 * makes it a lookup: the head keeps one always-visible pill, and the detail opens
 * on demand at full width without moving anything underneath.
 *
 * Grammar borrowed from the existing modals: ModalShell `task` (600px, body
 * scrolls) + pipelineStyles.modal.title/desc/foot, and CredentialAssignModal's
 * resource-table reading — hairline row dividers, no fill, mono for the value you
 * compare rather than read.
 *
 * `overall_state` and `checked_at` are rendered here for the first time; both are
 * published contract fields the UI had never surfaced anywhere.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { fmtDateTime } from '@/lib/pipeline/format';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  SIDE_LABEL,
  TONE,
  metaOf,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import type { TerraformStatusResponse } from '@/app/lib/api';

const TITLE_ID = 'ops-terraform-status-title';

/** One label over one value — the modal's head facts, in the credModal target grammar. */
function Fact({ label, children }: { label: string; children: ReactElement | string }): ReactElement {
  return (
    <div className="min-w-0">
      <dt className={opsStyles.credModal.targetLabel}>{label}</dt>
      <dd className="mt-1 text-[14px] font-semibold tabular-nums text-[var(--pl-text-strong)]">
        {children}
      </dd>
    </div>
  );
}

export interface TerraformStatusModalProps {
  status: TerraformStatusResponse;
  onClose: () => void;
}

export function TerraformStatusModal({ status, onClose }: TerraformStatusModalProps): ReactElement {
  const tasks = status.tasks ?? [];
  const overall = metaOf(status.overall_state);
  const { table } = opsStyles;

  return (
    <ModalShell open onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        Terraform 설치 현황
      </h3>
      {/* break-keep: Korean must wrap between words, not mid-word (…설치 상/태와). */}
      <p className={cn(pipelineStyles.modal.desc, 'break-keep')}>
        InfraManager에서 조회한 Terraform Job 결과값입니다. Cloud SDK를 조회하지 않아서 실제 인프라
        설치 상태와 다를 수 있습니다.
      </p>

      <dl className="grid grid-cols-3 gap-4 rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-4 py-3">
        <Fact label="적용 상태">
          <span
            className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, TONE[overall.tone].pill)}
          >
            <Icon
              name={overall.icon}
              size="sm"
              className={overall.icon === 'loader' ? 'animate-spin' : undefined}
            />
            {overall.label}
          </span>
        </Fact>
        <Fact label="최근 확정">
          {status.latest_confirmed_at ? fmtDateTime(status.latest_confirmed_at) : '—'}
        </Fact>
        <Fact label="조회 시각">
          {status.checked_at ? fmtDateTime(status.checked_at) : '—'}
        </Fact>
      </dl>

      <div className={cn(pipelineStyles.modal.body, 'mt-4')}>
        {tasks.length === 0 ? (
          <PlEmptyState icon="inbox" message="Terraform 작업 기록이 없습니다." />
        ) : (
          <table className={table.base}>
            <colgroup>
              <col />
              <col className="w-[92px]" />
              <col className="w-[128px]" />
            </colgroup>
            <thead>
              <tr>
                <th className={table.headCell}>작업</th>
                <th className={table.headCell}>실행 주체</th>
                <th className={table.headCell}>상태</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {tasks.map((task, index) => {
                const { tone, icon, label } = metaOf(task.state);
                return (
                  <tr key={task.terraform_task_name ?? index}>
                    {/* Mono: a task name is compared against the recipe, not read as prose. */}
                    <td
                      className={cn(
                        table.cell,
                        'break-all font-semibold [font-family:var(--pl-font-mono)]',
                      )}
                    >
                      {task.terraform_task_name ?? '-'}
                    </td>
                    <td className={table.cell}>
                      <span className={opsStyles.regionTag}>
                        {SIDE_LABEL[task.terraform_execution_side ?? ''] ??
                          task.terraform_execution_side ??
                          '-'}
                      </span>
                    </td>
                    <td className={table.cell}>
                      <span
                        className={cn(
                          pipelineStyles.pill.base,
                          pipelineStyles.pill.md,
                          TONE[tone].pill,
                        )}
                      >
                        <Icon
                          name={icon}
                          size="sm"
                          className={icon === 'loader' ? 'animate-spin' : undefined}
                        />
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
