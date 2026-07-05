'use client';

/**
 * TaskDetailModal — the 600px task-detail dialog (design-inventory §TaskDetailModal).
 * Header (display name + KindChip + StatusPill + close) then three hairline-topped
 * dgroups: 정의 / 실행 계약 / 진행 기록, with a kind-gated record tail
 * (CONDITION_CHECK → 폴 관찰; TERRAFORM_JOB → attempts table). Reuses the TaskDetail
 * loaded by the page (no refetch). When the detail failed to load, a degraded view
 * from the TaskSummary + a 재시도 button is shown instead.
 *
 * `TaskDetailBody` is exported separately (no router hooks) so the dgroup rendering
 * is unit-testable via renderToStaticMarkup.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/integration/admin/pipelines/_components/ModalShell';
import { StatusPill } from '@/app/integration/admin/pipelines/_components/StatusPill';
import { KindChip } from '@/app/integration/admin/pipelines/_components/KindChip';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import {
  PlTable,
  PlTh,
  PlRow,
  PlTd,
} from '@/app/integration/admin/pipelines/_components/PlTable';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import { fmtDateTime, fmtDuration, KIND_POLICY } from '@/lib/pipeline/format';
import type { TaskDetail, TaskSummary } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-task-detail-title';
const EFF_TOOLTIP = 'effective_* — task 오버라이드 + 전역 설정이 반영된 실효값';

function EffTag(): ReactElement {
  return (
    <span className={detailStyles.dgroup.effTag} title={EFF_TOOLTIP}>
      {' '}
      effective
    </span>
  );
}

function Kv({ children, task }: { children: ReactNode; task?: boolean }): ReactElement {
  return <div className={task ? detailStyles.kv.task : detailStyles.kv.wide}>{children}</div>;
}

function KvKey({ children }: { children: ReactNode }): ReactElement {
  return <div className={detailStyles.kv.k}>{children}</div>;
}

function KvVal({ children, mono, className }: { children: ReactNode; mono?: boolean; className?: string }): ReactElement {
  return <div className={cn(mono ? detailStyles.kv.vMono : detailStyles.kv.v, className)}>{children}</div>;
}

/** Kind-gated record tail: 폴 관찰 (CONDITION_CHECK) or attempts table (TERRAFORM_JOB). */
function RecordTail({ detail }: { detail: TaskDetail }): ReactElement {
  const s = detailStyles;
  if (detail.kind === 'CONDITION_CHECK') {
    // Take the last attempt's poll summary (most recent observation).
    const check = [...detail.attempts].reverse().find((a) => a.check)?.check ?? null;
    if (!check) return <div className={s.dgroup.captionAlone}>아직 폴링 기록 없음</div>;
    return (
      <>
        <div className={s.dgroup.caption}>폴 관찰 (task_check)</div>
        <Kv task>
          <KvKey>call / not_met</KvKey>
          <KvVal>
            {check.call_count} / {check.not_met_count}
          </KvVal>
          <KvKey>api_error / timeout</KvKey>
          <KvVal>
            {check.api_error_count} / {check.call_timeout_count}
          </KvVal>
          <KvKey>last_external_status</KvKey>
          <KvVal>{check.last_external_status ?? '-'}</KvVal>
          <KvKey>last_checked_at</KvKey>
          <KvVal>{fmtDateTime(check.last_checked_at)}</KvVal>
        </Kv>
      </>
    );
  }

  if (detail.attempts.length === 0) {
    return <div className={s.dgroup.captionAlone}>아직 시도 없음 (BLOCKED)</div>;
  }
  return (
    <>
      <div className={s.dgroup.caption}>attempts — 시도별 기록 (response는 외부 응답 원문)</div>
      <PlTable
        head={
          <>
            <PlTh>#</PlTh>
            <PlTh>상태</PlTh>
            <PlTh>error_code</PlTh>
            <PlTh>시각</PlTh>
            <PlTh>response</PlTh>
          </>
        }
      >
        {detail.attempts.map((a) => (
          <PlRow key={a.attempt_number}>
            <PlTd>{a.attempt_number}</PlTd>
            <PlTd>
              <StatusPill status={a.status} />
            </PlTd>
            <PlTd>{a.error_code ? a.error_code : '-'}</PlTd>
            <PlTd muted>{fmtDateTime(a.started_at)}</PlTd>
            <td className={cn(pipelineStyles.table.td, s.taskModal.respCell)} title={a.response ?? ''}>
              {a.response ?? ''}
            </td>
          </PlRow>
        ))}
      </PlTable>
    </>
  );
}

export interface TaskDetailBodyProps {
  task: TaskSummary;
  detail: TaskDetail | null;
  /**
   * Whether this task's detail fetch has settled. `false` = still in flight
   * (show loading); `true` + `detail === null` = genuinely failed (degraded +
   * 재시도). Defaults true so a caller passing `detail` explicitly needn't set it.
   */
  detailLoaded?: boolean;
  displayName: string;
  onClose: () => void;
  onRetry?: () => void;
}

/** Full dialog content (header + dgroups); no router hooks — testable statically. */
export function TaskDetailBody({
  task,
  detail,
  detailLoaded = true,
  displayName,
  onClose,
  onRetry,
}: TaskDetailBodyProps): ReactElement {
  const s = detailStyles;
  const { text, modal } = pipelineStyles;
  const cond = task.kind === 'CONDITION_CHECK';

  return (
    <>
      <div className={s.taskModal.head}>
        <div className="min-w-0">
          <h3 id={TITLE_ID} className={text.modalTitle}>
            {displayName}
          </h3>
          <div className={s.taskModal.headMeta}>
            <KindChip kind={task.kind} />
            <StatusPill status={task.status} />
          </div>
        </div>
        <PlButton
          variant="ghost"
          size="sm"
          round
          onClick={onClose}
          title="닫기"
          aria-label="Task 상세 닫기"
          className="ml-auto flex-none"
        >
          <Icon name="x" size="sm" />
        </PlButton>
      </div>

      {detail?.definition?.description && <div className={s.taskModal.note}>{detail.definition.description}</div>}

      <div className={modal.body}>
        {detail ? (
          <>
            <div className={s.dgroup.group}>
              <div className={s.dgroup.title}>정의</div>
              <Kv task>
                <KvKey>순서 (seq)</KvKey>
                <KvVal>{detail.sequence}</KvVal>
                <KvKey>task_definition</KvKey>
                <KvVal mono>{detail.task_definition}</KvVal>
                <KvKey>operation</KvKey>
                {detail.operation ? <KvVal mono>{detail.operation}</KvVal> : <KvVal>{displayName}</KvVal>}
              </Kv>
            </div>

            <div className={s.dgroup.group}>
              <div className={s.dgroup.title}>실행 계약</div>
              <Kv task>
                <KvKey>실행 방식</KvKey>
                <KvVal>{cond ? '조건 확인 — 디스패치 없이 폴링' : '테라폼 잡 — 디스패치 후 폴링'}</KvVal>
                {cond ? (
                  <>
                    <KvKey>
                      polling<EffTag />
                    </KvKey>
                    <KvVal>{fmtDuration(detail.effective_polling_interval)}</KvVal>
                    <KvKey>
                      재시도 예산<EffTag />
                    </KvKey>
                    <KvVal>{detail.effective_max_fail_count}회</KvVal>
                  </>
                ) : (
                  <>
                    <KvKey>
                      실행 타임아웃<EffTag />
                    </KvKey>
                    <KvVal>{fmtDuration(detail.effective_execution_timeout)}</KvVal>
                    <KvKey>
                      재시도 예산<EffTag />
                    </KvKey>
                    <KvVal>{detail.effective_max_fail_count}회</KvVal>
                    {detail.consumes_terraform_slot && (
                      <>
                        <KvKey>TF 슬롯</KvKey>
                        <KvVal className="cursor-help">
                          <span title="consumes_terraform_slot — 동시 실행 상한(slot cap)을 차감하는 task">사용</span>
                        </KvVal>
                      </>
                    )}
                  </>
                )}
              </Kv>
              <div className={s.dgroup.formula}>판정: {KIND_POLICY[task.kind]}</div>
            </div>

            <div className={s.dgroup.group}>
              <div className={s.dgroup.title}>진행 기록</div>
              <Kv task>
                <KvKey>started / finished</KvKey>
                <KvVal>
                  {fmtDateTime(detail.started_at)} / {fmtDateTime(detail.finished_at)}
                </KvVal>
                <KvKey>실패 누적</KvKey>
                <KvVal>
                  {detail.fail_count} / {detail.effective_max_fail_count}
                  {detail.error_code && (
                    <>
                      {' · '}
                      <span className={s.kv.errCode}>{detail.error_code}</span>
                    </>
                  )}
                </KvVal>
              </Kv>
              <RecordTail detail={detail} />
            </div>
          </>
        ) : !detailLoaded ? (
          // Detail fetch still in flight — layout-stable placeholder, NOT an error.
          <div className={s.dgroup.group}>
            <div className={s.dgroup.title}>정의</div>
            <div className={cn(detailStyles.skeleton, 'h-24')} aria-hidden="true" />
          </div>
        ) : (
          // Detail settled but null — genuinely failed to load.
          <div className={s.dgroup.group}>
            <div className={s.dgroup.title}>정의</div>
            <Kv task>
              <KvKey>순서 (seq)</KvKey>
              <KvVal>{task.sequence}</KvVal>
              <KvKey>operation</KvKey>
              <KvVal mono>{task.operation ?? task.task_definition}</KvVal>
            </Kv>
            <div className={s.taskModal.degraded}>상세를 불러오지 못했습니다</div>
            {onRetry && (
              <PlButton variant="secondary" size="sm" onClick={onRetry} className="mt-2">
                재시도
              </PlButton>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export interface TaskDetailModalProps extends TaskDetailBodyProps {
  open: boolean;
}

export function TaskDetailModal({ open, onClose, ...body }: TaskDetailModalProps): ReactElement | null {
  return (
    <ModalShell open={open} onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <TaskDetailBody onClose={onClose} {...body} />
    </ModalShell>
  );
}
