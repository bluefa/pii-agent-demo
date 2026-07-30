'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  statusColors,
  tagStyles,
  textColors,
} from '@/lib/theme';
import {
  TABLE_BODY_CELL,
  TABLE_HEADER_CELL,
  TABLE_MONO_CELL,
  TABLE_TAG_PILL,
} from '@/app/components/features/process-status/install-task-pipeline/table-styles';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { formatDateTime } from '@/lib/utils/date';
import {
  INSTALL_STATUS_LABEL,
  isSettledInstallStatus,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallResourceMeta,
  type InstallStepCell,
  type InstallStepValue,
  type InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';

/**
 * Step-4 install status — provider-agnostic master-detail layout. Left rail
 * lists the install steps (summary / optional custom panels / per-resource
 * table steps) with worst-wins aggregates; the right panel shows the selected
 * step's per-resource table (name / id / region joined via `meta`) with
 * pagination.
 */

const STATUS_TAG: Record<InstallStepValue, string> = {
  COMPLETED: tagStyles.success,
  IN_PROGRESS: tagStyles.info,
  FAIL: tagStyles.error,
  SKIP: tagStyles.neutral,
  BDC_INSTALL_REQUIRED: tagStyles.amber,
  UNKNOWN: tagStyles.neutral,
};

const StatusPill = ({ cell }: { cell: InstallStepCell }) => (
  <span className={cn(TABLE_TAG_PILL, 'whitespace-nowrap', STATUS_TAG[cell.status])}>
    {cell.label ?? INSTALL_STATUS_LABEL[cell.status]}
  </span>
);

/** A nav step whose right panel is custom content (e.g. AWS role verify). */
export interface InstallPanelStep extends InstallTableStep {
  status: InstallStepValue;
  panel: ReactNode;
}

type AggregateKind = 'failed' | 'running' | 'waiting' | 'done';

interface StepAggregate {
  label: string;
  tag: string;
  /** 'settled/total' — null for panel steps (no resource list). */
  count: string | null;
  kind: AggregateKind;
}

const kindOfValue = (value: InstallStepValue): AggregateKind =>
  value === 'FAIL' ? 'failed'
    : value === 'IN_PROGRESS' ? 'running'
      : isSettledInstallStatus(value) ? 'done'
        : 'waiting';

const aggregateCells = (cells: InstallStepValue[]): StepAggregate => {
  const settled = cells.filter(isSettledInstallStatus).length;
  const count = `${settled}/${cells.length}`;
  if (cells.includes('FAIL')) {
    return { label: '실패', tag: tagStyles.error, count, kind: 'failed' };
  }
  if (cells.includes('IN_PROGRESS')) {
    return { label: '진행중', tag: tagStyles.info, count, kind: 'running' };
  }
  if (cells.length > 0 && settled === cells.length) {
    return { label: '완료', tag: tagStyles.success, count, kind: 'done' };
  }
  return { label: '대기', tag: tagStyles.neutral, count, kind: 'waiting' };
};

/**
 * 주체 태그 (서비스측 리소스 생성 / BDC측 리소스 생성) — top-right of every step,
 * color-coded by owner so the two sides read apart at a glance (owner ask).
 * Adapters phrase the label; the "BDC" prefix is the color key.
 */
const SideTag = ({ side }: { side: string }) => (
  <span
    className={cn(
      TABLE_TAG_PILL,
      'whitespace-nowrap font-bold',
      side.startsWith('BDC') ? tagStyles.indigo : tagStyles.info,
    )}
  >
    {side}
  </span>
);

interface ResourceRow {
  resourceId: string;
  resourceName: string | null;
  region: string | null;
  databaseType: string | null;
  cell: InstallStepCell;
}

const StepResourceTable = ({ rows }: { rows: ResourceRow[] }) => {
  const { page, pageSize, setPage, setPageSize, pageItems } = usePagination(rows);

  if (rows.length === 0) {
    return (
      <div className={cn('px-4 py-3 rounded-lg border text-sm', borderColors.default, textColors.tertiary)}>
        설치 대상 리소스가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={cn(idcStyles.table.frame, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead className={bgColors.muted}>
            <tr>
              <th className={TABLE_HEADER_CELL}>Database Type</th>
              <th className={TABLE_HEADER_CELL}>Resource Name</th>
              <th className={TABLE_HEADER_CELL}>Resource ID</th>
              <th className={TABLE_HEADER_CELL}>Region</th>
              <th className={TABLE_HEADER_CELL}>상태</th>
              <th className={TABLE_HEADER_CELL}>안내</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <tr
                key={row.resourceId}
                className={cn('border-t border-[#EBEEF2] group', row.cell.status === 'FAIL' && statusColors.error.bg)}
              >
                <td className={TABLE_BODY_CELL}>
                  {row.databaseType ? (
                    <span className={cn(TABLE_TAG_PILL, tagStyles.info)}>
                      {getDatabaseShortLabel(row.databaseType)}
                    </span>
                  ) : (
                    <span className={textColors.tertiary}>—</span>
                  )}
                </td>
                <td className={TABLE_MONO_CELL}>
                  {row.resourceName ? (
                    <span
                      className="block max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap"
                      title={row.resourceName}
                    >
                      {row.resourceName}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={TABLE_MONO_CELL}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] text-left">
                      {row.resourceId}
                    </span>
                    <CopyButton
                      value={row.resourceId}
                      label={`${row.resourceId} 복사`}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </span>
                </td>
                <td className={TABLE_MONO_CELL}>{row.region ?? '—'}</td>
                <td className={TABLE_BODY_CELL}>
                  <StatusPill cell={row.cell} />
                </td>
                <td className={cn(TABLE_BODY_CELL, 'text-[13px]')}>
                  {row.cell.guide ? (
                    <span
                      className={cn(
                        'block max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap',
                        row.cell.status === 'FAIL' ? statusColors.error.textDark : textColors.secondary,
                      )}
                      title={row.cell.guide}
                    >
                      {row.cell.guide}
                    </span>
                  ) : (
                    <span className={textColors.tertiary}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={rows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 20, 50]}
      />
    </div>
  );
};

const SUMMARY_ID = '__summary__';

const SUMMARY_STEP: InstallTableStep = {
  id: SUMMARY_ID,
  title: '설치 현황 요약',
  side: null,
  desc: '리소스별 전체 설치 상태입니다. 단계별 진행 상황은 좌측 단계를 선택해 확인하세요.',
};

export interface InstallStatusDetailProps {
  lastCheck: InstallLastCheck;
  resources: readonly InstallDetailResource[];
  /** Per-resource table steps, in nav order (after summary/panel steps). */
  steps: readonly InstallTableStep[];
  /** Custom-panel steps rendered between the summary and the table steps. */
  panelSteps?: readonly InstallPanelStep[];
  /** resourceId → region/DB-type/name enrichment (confirmed integration 등). */
  meta: ReadonlyMap<string, InstallResourceMeta>;
}

export const InstallStatusDetail = ({
  lastCheck,
  resources,
  steps,
  panelSteps = [],
  meta,
}: InstallStatusDetailProps) => {
  const navSteps: InstallTableStep[] = useMemo(
    () => [SUMMARY_STEP, ...panelSteps, ...steps],
    [panelSteps, steps],
  );

  const cellOf = useMemo(() => {
    return (resource: InstallDetailResource, stepId: string): InstallStepCell =>
      stepId === SUMMARY_ID
        ? resource.rollup
        : resource.cells[stepId] ?? { status: 'UNKNOWN', guide: null };
  }, []);

  const aggregates = useMemo(() => {
    const map = new Map<string, StepAggregate>();
    for (const step of navSteps) {
      const panelStep = panelSteps.find((p) => p.id === step.id);
      if (panelStep) {
        map.set(step.id, {
          label: INSTALL_STATUS_LABEL[panelStep.status],
          tag: STATUS_TAG[panelStep.status],
          count: null,
          kind: kindOfValue(panelStep.status),
        });
      } else {
        map.set(step.id, aggregateCells(resources.map((r) => cellOf(r, step.id).status)));
      }
    }
    return map;
  }, [navSteps, panelSteps, resources, cellOf]);

  // Default selection follows the data (failed > running > waiting step);
  // a user click pins the selection.
  const hotStepId = useMemo<string>(() => {
    for (const kind of ['failed', 'running', 'waiting'] as const) {
      const hit = navSteps.find((s) => s.id !== SUMMARY_ID && aggregates.get(s.id)?.kind === kind);
      if (hit) return hit.id;
    }
    return SUMMARY_ID;
  }, [navSteps, aggregates]);
  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? hotStepId;
  const active = navSteps.find((s) => s.id === activeId) ?? navSteps[0];
  const activePanel = panelSteps.find((p) => p.id === active.id);
  const activeAggregate = aggregates.get(active.id);

  const rows = useMemo<ResourceRow[]>(() => {
    if (activePanel) return [];
    return resources.map((r) => {
      const m = meta.get(r.resourceId);
      return {
        resourceId: r.resourceId,
        resourceName: r.resourceName ?? m?.resourceName ?? null,
        region: m?.region ?? null,
        databaseType: m?.databaseType ?? null,
        cell: cellOf(r, active.id),
      };
    });
  }, [activePanel, active.id, resources, meta, cellOf]);

  return (
    <div className={cn('grid grid-cols-[320px_minmax(0,1fr)] rounded-xl border overflow-hidden', borderColors.default)}>
      <nav className={cn('border-r p-2.5 flex flex-col gap-1 bg-white', borderColors.default)} aria-label="설치 단계">
        {navSteps.map((step, index) => {
          const aggregate = aggregates.get(step.id)!;
          const isActive = step.id === activeId;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setSelected(step.id)}
              aria-current={isActive}
              className={cn(
                'flex flex-col gap-1.5 w-full text-left px-2.5 py-2.5 rounded-lg border',
                isActive
                  ? cn(bgColors.muted, borderColors.default)
                  : cn('border-transparent', bgColors.mutedHover),
              )}
            >
              <span className="flex items-start gap-2.5 w-full">
                <span
                  className={cn(
                    'w-6 h-6 rounded-full grid place-items-center text-[11.5px] font-bold flex-shrink-0',
                    bgColors.muted,
                    textColors.secondary,
                  )}
                >
                  {step.id === SUMMARY_ID ? '≡' : index}
                </span>
                <span
                  className={cn(
                    'flex-1 min-w-0 text-[13px] font-bold leading-[1.5] tracking-[-0.01em]',
                    textColors.primary,
                  )}
                >
                  {step.title}
                </span>
                {step.side && <SideTag side={step.side} />}
              </span>
              {/* 34px = 24px index circle + 10px gap — aligns with the title. */}
              <span className="flex items-center gap-1.5 flex-wrap pl-[34px]">
                <span className={cn(TABLE_TAG_PILL, 'whitespace-nowrap', aggregate.tag)}>{aggregate.label}</span>
                {aggregate.count && (
                  <span className={cn('text-[11px] font-semibold tabular-nums', textColors.tertiary)}>
                    {aggregate.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="p-5 bg-white min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={cn('text-[16px] font-bold tracking-[-0.02em]', textColors.primary)}>{active.title}</h3>
            <p className={cn('mt-1 text-[12.5px] max-w-[60ch]', textColors.secondary)}>
              {active.desc}
            </p>
          </div>
          <span className="flex items-center gap-2 flex-shrink-0">
            {active.side && <SideTag side={active.side} />}
            {active.action}
            {activeAggregate && (
              <span className={cn(TABLE_TAG_PILL, activeAggregate.tag, 'whitespace-nowrap')}>
                {activeAggregate.count
                  ? `${activeAggregate.label} ${activeAggregate.count}`
                  : activeAggregate.label}
              </span>
            )}
          </span>
        </div>

        {!activePanel && (
          <div className={cn('mt-3 mb-2.5 text-[11.5px]', textColors.tertiary)}>
            {lastCheck.checkedAt && <>마지막 확인 {formatDateTime(lastCheck.checkedAt)}</>}
            {lastCheck.status === 'FAILED' && (
              <span className={cn('font-semibold', statusColors.error.textDark)}> · 상태 확인 실패</span>
            )}
          </div>
        )}

        <div className={activePanel ? 'mt-4' : ''}>
          {activePanel ? (
            activePanel.panel
          ) : (
            // key resets pagination when switching steps
            <StepResourceTable key={active.id} rows={rows} />
          )}
        </div>
      </div>
    </div>
  );
};
