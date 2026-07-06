'use client';

/**
 * TaskDetailPanel — the task-detail surface, R18 §7-3: an inline 400px panel
 * that expands on the right INSIDE the flow card (was: 600px modal). Header
 * (display name + KindChip + StatusPill + close) then — R22 (F2, 오너 선택) —
 * 진행 기록 first (the operator's question is "무슨 일이 있었나"), with a
 * kind-gated record tail (CONDITION_CHECK → 폴 관찰; TERRAFORM_JOB → attempts
 * table); 정의·실행 계약 are demoted to a collapsed reference <details>
 * at the panel tail. Reuses the
 * TaskDetail loaded by the page (no refetch). When the detail failed to load, a
 * degraded view from the TaskSummary + a 재시도 button is shown instead.
 *
 * `TaskDetailBody` is exported separately (no router hooks) so the dgroup
 * rendering is unit-testable via renderToStaticMarkup.
 */
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { StatusPill } from '@/app/integration/admin/pipelines/_components/StatusPill';
import { KindChip } from '@/app/integration/admin/pipelines/_components/KindChip';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
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

// Panel is 400px (R18) — the 170px task-modal key column no longer fits, so
// every kv here uses the 150px `wide` grid (long values wrap at lh 1.4).
function Kv({ children }: { children: ReactNode }): ReactElement {
  return <div className={detailStyles.kv.wide}>{children}</div>;
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
        <Kv>
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
  // Local table, NOT PlTable/PlTh/PlTd — the shared primitives hard-code the
  // page-table row heights (th h34 / td h44). Inside the 400px panel the design
  // overrides padding only, so the compact geometry lives in
  // `detailStyles.attemptsTable`; the wrapper scrolls horizontally (panel < table).
  const at = s.attemptsTable;
  return (
    <>
      <div className={s.dgroup.caption}>attempts — 시도별 기록 (response는 외부 응답 원문)</div>
      <div className={pipelineStyles.card.tableWrap}>
      <table className={at.root}>
        <thead>
          <tr>
            <th className={at.th}>#</th>
            <th className={at.th}>상태</th>
            <th className={at.th}>error_code</th>
            <th className={at.th}>시각</th>
            <th className={at.th}>response</th>
          </tr>
        </thead>
        <tbody className={at.body}>
          {detail.attempts.map((a) => (
            <tr key={a.attempt_number}>
              <td className={cn(at.td, at.tdColor)}>{a.attempt_number}</td>
              <td className={cn(at.td, at.tdColor)}>
                <StatusPill status={a.status} />
              </td>
              <td className={cn(at.td, at.tdColor)}>{a.error_code ? a.error_code : '-'}</td>
              <td className={cn(at.td, at.muted)}>{fmtDateTime(a.started_at)}</td>
              <td className={cn(at.td, s.taskModal.respCell)} title={a.response ?? ''}>
                {a.response ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
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
            {/* R22 (F2, 오너 선택) — 진행 기록이 패널 본문의 주인공. */}
            <div className={s.dgroup.group}>
              <div className={s.dgroup.title}>진행 기록</div>
              <Kv>
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

            {/* 정의·실행 계약 = 접힌 참조 섹션 (ui-ux-pro-max §8 progressive
                disclosure). native <details> — 열림 상태는 브라우저 몫. */}
            <details className={s.dgroup.refDetails}>
              <summary className={s.dgroup.refSummary}>
                <Icon name="chev-r" size="sm" className={s.dgroup.refChevron} />
                정의 · 실행 계약
                <span className={s.dgroup.refSummaryNote}>— 참조 정보</span>
              </summary>
              <div className={s.dgroup.refBody}>
                <div className={s.dgroup.title}>정의</div>
                <Kv>
                  <KvKey>task_definition</KvKey>
                  <KvVal mono>{detail.task_definition}</KvVal>
                  <KvKey>operation</KvKey>
                  {detail.operation ? <KvVal mono>{detail.operation}</KvVal> : <KvVal>{displayName}</KvVal>}
                </Kv>
              </div>
              <div className={s.dgroup.refBodyNext}>
                <div className={s.dgroup.title}>실행 계약</div>
                <Kv>
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
            </details>
          </>
        ) : !detailLoaded ? (
          // Detail fetch still in flight — layout-stable placeholder, NOT an error.
          <div className={s.dgroup.group}>
            <div className={s.dgroup.title}>진행 기록</div>
            <div className={cn(detailStyles.skeleton, 'h-24')} aria-hidden="true" />
          </div>
        ) : (
          // Detail settled but null — genuinely failed to load.
          <div className={s.dgroup.group}>
            <div className={s.dgroup.title}>정의</div>
            <Kv>
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

/**
 * Inline right-hand panel inside the flow card (R18 §7-3). Not a modal — no
 * overlay/focus trap; Esc closes, the flow stays interactive alongside.
 */
export function TaskDetailPanel({ onClose, ...body }: TaskDetailBodyProps): ReactElement {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside
      role="complementary"
      aria-labelledby={TITLE_ID}
      className={detailStyles.flowCard.panel}
    >
      <TaskDetailBody onClose={onClose} {...body} />
    </aside>
  );
}
