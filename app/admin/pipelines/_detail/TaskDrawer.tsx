'use client';

/**
 * TaskDrawer — the redesigned right-docked task panel (Figma
 * "pipeline-detail-improved" node 70:35). A 420px light-gray drawer whose
 * header carries the task name + status badge, the description sentence, and a
 * 타입 chip; below it three sub-tabs:
 *   · 실행 정보  — 진행 기록, 시도 횟수 (FAILED → 실패 원인 callout first)
 *   · 시도 기록  — attempts table (TERRAFORM_JOB) / 폴 관찰 (CONDITION_CHECK)
 *   · 정의·계약  — task_definition / operation / 실행 방식 / polling / timeout /
 *                 retry_budget / judgment_policy
 *
 * All data comes from the TaskDetail already loaded by the page (no refetch);
 * a null detail degrades to a loading placeholder or a 재시도 affordance. The
 * parent remounts this per task (`key={task_id}`) so the sub-tab resets.
 */
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PipelineStatusBadge } from '@/app/admin/pipelines/_detail/PipelineStatusBadge';
import { improvedStyles } from '@/app/admin/pipelines/_detail/detailImprovedStyles';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { fmtDateTime, fmtDuration, KIND_POLICY } from '@/lib/pipeline/format';
import type { TaskDetail, TaskSummary } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-task-drawer-title';
type DrawerTab = 'exec' | 'attempts' | 'definition';

const TABS: ReadonlyArray<{ key: DrawerTab; label: string }> = [
  { key: 'exec', label: '실행 정보' },
  { key: 'attempts', label: '시도 기록' },
  { key: 'definition', label: '정의·계약' },
];

const d = improvedStyles.drawer;

function Section({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <div className={d.sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

/** 진행 기록 + 시도 횟수 + (FAILED) 실패 원인 — the 실행 정보 tab. */
function ExecTab({ task, detail }: { task: TaskSummary; detail: TaskDetail }): ReactElement {
  const failed = task.status === 'FAILED';
  const errorCode = detail.error_code ?? task.error_code;
  const endLabel = failed ? 'Failed' : 'Finished';

  return (
    <>
      {failed && errorCode && (
        <div className={d.failCard}>
          <div className={d.failLabel}>실패 원인</div>
          <div className={d.failRow}>
            <span className={d.failKey}>error_code</span>
            <span className={d.failCode}>{errorCode}</span>
          </div>
        </div>
      )}

      {/* 설명 (definition.description) now lives in the drawer header (70:35). */}
      {detail.description && detail.definition?.description && (
        <Section label="운영자 설명">
          <div className={d.descText}>{detail.description}</div>
        </Section>
      )}

      <Section label="진행 기록">
        <div className={d.rowsGap}>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Started</span>
            <span className={d.kvVal}>{fmtDateTime(detail.started_at)}</span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>{endLabel}</span>
            <span className={failed ? d.kvValErr : d.kvVal}>{fmtDateTime(detail.finished_at)}</span>
          </div>
        </div>
      </Section>

      <div className={d.attemptRow}>
        <span className={d.sectionLabel}>시도 횟수</span>
        <span className={failed ? d.bigValErr : d.bigVal}>
          {detail.fail_count} / {detail.effective_max_fail_count}
        </span>
      </div>
    </>
  );
}

/** attempts table (TERRAFORM_JOB) / 폴 관찰 (CONDITION_CHECK) — the 시도 기록 tab. */
function AttemptsTab({ detail }: { detail: TaskDetail }): ReactElement {
  if (detail.kind === 'CONDITION_CHECK') {
    const check = [...detail.attempts].reverse().find((a) => a.check)?.check ?? null;
    if (!check) return <div className={d.empty}>아직 폴링 기록 없음</div>;
    return (
      <Section label="폴 관찰 (task_check)">
        <div className={d.rowsGap}>
          <div className={d.kvRow}>
            <span className={d.kvKey}>call / not_met</span>
            <span className={d.kvVal}>
              {check.call_count} / {check.not_met_count}
            </span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>api_error / timeout</span>
            <span className={d.kvVal}>
              {check.api_error_count} / {check.call_timeout_count}
            </span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>last_external_status</span>
            <span className={d.kvVal}>{check.last_external_status ?? '—'}</span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>last_checked_at</span>
            <span className={d.kvVal}>{fmtDateTime(check.last_checked_at)}</span>
          </div>
        </div>
      </Section>
    );
  }

  if (detail.attempts.length === 0) {
    return <div className={d.empty}>아직 시도 없음</div>;
  }

  return (
    <div className={d.tableWrap}>
      <table className={d.table}>
        <thead>
          <tr>
            <th className={d.th}>#</th>
            <th className={d.th}>상태</th>
            <th className={d.th}>error_code</th>
            <th className={d.th}>시각</th>
            <th className={d.th}>response</th>
          </tr>
        </thead>
        <tbody className={d.tbody}>
          {detail.attempts.map((a) => (
            <tr key={a.attempt_number}>
              <td className={d.td}>{a.attempt_number}</td>
              <td className={d.td}>
                <PipelineStatusBadge status={a.status} size="mini" />
              </td>
              <td className={d.td}>{a.error_code ?? '—'}</td>
              <td className={d.td}>{fmtDateTime(a.started_at)}</td>
              <td className={cn(d.td, d.respCell)} title={a.response ?? ''}>
                {a.response ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** definition·contract rows — the 정의·계약 tab. `judgment_policy` is a prose
 *  policy (KIND_POLICY), so it renders as a paragraph below the compact card. */
function DefinitionTab({ detail, displayName }: { detail: TaskDetail; displayName: string }): ReactElement {
  const cond = detail.kind === 'CONDITION_CHECK';
  const rows: Array<{ k: string; v: string; mono?: boolean }> = [
    { k: 'task_definition', v: detail.task_definition, mono: true },
    { k: 'operation', v: detail.operation ?? displayName, mono: true },
    { k: '실행 방식', v: detail.kind, mono: true },
    { k: 'polling_interval', v: fmtDuration(detail.effective_polling_interval) },
    { k: 'timeout', v: cond ? '—' : fmtDuration(detail.effective_execution_timeout) },
    { k: 'retry_budget', v: `${detail.effective_max_fail_count}회` },
  ];
  return (
    <>
      <div className={d.defCard}>
        {rows.map((row) => (
          <div key={row.k} className={d.defRow}>
            <span className={d.defKey}>{row.k}</span>
            <span className={row.mono ? d.defValMono : d.defVal}>{row.v}</span>
          </div>
        ))}
      </div>
      <div>
        <div className={d.policyLabel}>판정 정책</div>
        <p className={d.policyText}>{KIND_POLICY[detail.kind]}</p>
      </div>
    </>
  );
}

export interface TaskDrawerProps {
  task: TaskSummary;
  detail: TaskDetail | null;
  detailLoaded?: boolean;
  displayName: string;
  onClose: () => void;
  onRetry?: () => void;
}

export function TaskDrawer({
  task,
  detail,
  detailLoaded = true,
  displayName,
  onClose,
  onRetry,
}: TaskDrawerProps): ReactElement {
  const [tab, setTab] = useState<DrawerTab>('exec');
  const description = detail ? detail.definition?.description ?? detail.description : null;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside role="complementary" aria-labelledby={TITLE_ID} className={d.root}>
      <div className={d.header}>
        <div className="min-w-0">
          <h3 id={TITLE_ID} className={d.title}>
            {displayName}
            <PipelineStatusBadge status={task.status} className={d.titleBadge} />
          </h3>
          {description && <p className={d.headerDesc}>{description}</p>}
          <div className={d.typeRow}>
            <span className={d.typeLabel}>타입</span>
            <span className={d.tag}>{task.kind}</span>
          </div>
        </div>
        <button type="button" className={d.close} onClick={onClose} aria-label="Task 상세 닫기" title="닫기">
          <Icon name="chev-r" size="lg" />
        </button>
      </div>

      <div className={d.nav}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              className={cn(d.navTab, active ? d.navActive : d.navIdle)}
              onClick={() => setTab(t.key)}
              aria-pressed={active}
            >
              {t.label}
              <span className={active ? d.navUnderline : d.navUnderlineHidden} />
            </button>
          );
        })}
      </div>

      <div className={d.body}>
        {detail ? (
          <>
            {tab === 'exec' && <ExecTab task={task} detail={detail} />}
            {tab === 'attempts' && <AttemptsTab detail={detail} />}
            {tab === 'definition' && <DefinitionTab detail={detail} displayName={displayName} />}
          </>
        ) : !detailLoaded ? (
          <div className={cn(detailStyles.skeleton, 'h-24')} aria-hidden="true" />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <div className={d.empty}>상세를 불러오지 못했습니다</div>
            {onRetry && (
              <PlButton variant="secondary" size="sm" onClick={onRetry}>
                재시도
              </PlButton>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
