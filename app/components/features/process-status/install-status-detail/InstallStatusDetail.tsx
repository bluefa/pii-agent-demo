'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  stackGap,
  shadows,
  statusColors,
  tagStyles,
  textColors,
  textStyles,
} from '@/lib/theme';
import { TABLE_TAG_PILL } from '@/app/components/features/process-status/install-task-pipeline/table-styles';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
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

/**
 * 레일 상태 글자색 — 태그를 걷어낸 자리. 손댈 단계(실패·진행중)만 색을 갖고,
 * 끝났거나 남의 차례인 단계(완료·대기)는 회색으로 가라앉는다.
 */
const NAV_STATUS_TEXT: Record<AggregateKind, string> = {
  failed: statusColors.error.textDark,
  running: statusColors.info.textDark,
  done: textColors.tertiary,
  waiting: textColors.tertiary,
};

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

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

/**
 * Per-resource table for the selected step — the steps 2·3 approval table with the
 * verdict/reason pair swapped for install status + guidance (`install` variant). Every
 * install row is a confirmed target, so the search / filter / pagination grammar is the
 * one the user already learned on the earlier steps.
 */
const StepResourceTable = ({ rows }: { rows: ResourceRow[] }) => {
  const approvalRows = useMemo<readonly WaitingApprovalResource[]>(
    () =>
      rows.map((row) => ({
        resourceId: row.resourceId,
        resourceType: row.databaseType ?? '',
        region: row.region ?? '',
        resourceName: row.resourceName ?? '',
        selected: true,
        displayDbType: row.databaseType ?? undefined,
        installCell: row.cell,
      })),
    [rows],
  );
  const table = useApprovalTableState(approvalRows);

  if (rows.length === 0) {
    return (
      <div className={cn('px-4 py-3 rounded-lg border', textStyles.body, borderColors.default, textColors.tertiary)}>
        설치 대상 리소스가 없습니다.
      </div>
    );
  }

  // Toolbar (top-rounded) + table + pagination join as one card, same as steps 2·3.
  return (
    <div>
      <WaitingApprovalToolbar
        searchValue={table.searchValue}
        onSearchChange={table.onSearchChange}
        dbType={table.dbType}
        onDbTypeChange={table.onDbTypeChange}
        region={table.region}
        onRegionChange={table.onRegionChange}
        dbTypeOptions={table.dbTypeOptions}
        regionOptions={table.regionOptions}
      />
      <WaitingApprovalTable
        resources={table.visibleResources}
        variant="install"
        connected
        emptyMessage={FILTER_EMPTY_MESSAGE}
      />
      {table.filteredCount > 0 && (
        <Pagination
          page={table.safePage}
          pageSize={table.pageSize}
          totalCount={table.filteredCount}
          onPageChange={table.onPageChange}
          onPageSizeChange={table.onPageSizeChange}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}
    </div>
  );
};

const SUMMARY_ID = '__summary__';

const SUMMARY_STEP: InstallTableStep = {
  id: SUMMARY_ID,
  title: '설치 현황 요약',
  side: null,
  desc: '전체 진행 상황과, 서비스 측에서 확인해야 할 항목을 모아 보여줍니다.',
};

/** 한 단계의 요약 표시에 필요한 것 전부. */
interface StepView {
  step: InstallTableStep;
  navIndex: number;
  aggregate: StepAggregate;
  /** 미완료 리소스의 guide 를 문구별로 묶은 것 (계약 데이터, 발명 금지). */
  reasons: { text: string; count: number }[];
  /** 서비스 측이 지금 손대야 하는가 — serviceAction 이 있거나 실패한 단계. */
  actionable: boolean;
}

/**
 * 조치 항목 — 박스가 아니다. 요약 자체가 이미 카드 안이고, 그 안에 또 채운 카드를
 * 두면 "설치 현황 요약 > 카드"로 한 겹이 더 생긴다(오너 지적). 여백으로 묶고,
 * 색은 조치 문구 한 줄에만 남긴다.
 */
const ActionItem = ({ view, onOpen }: { view: StepView; onOpen: () => void }) => {
  const failed = view.aggregate.kind === 'failed';
  return (
    <div className={cn('flex flex-col', stackGap.related)}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={cn(textStyles.bodyStrong, textColors.primary)}>{view.step.title}</span>
        {view.step.side && (
          <span className={cn(textStyles.caption, textColors.tertiary)}>· {view.step.side}</span>
        )}
      </div>

      {/* 조치 문구는 제목과 같은 14px — 계층은 크기가 아니라 색으로 가른다. */}
      {view.step.serviceAction && (
        <p className={cn(textStyles.body, failed ? statusColors.error.textDark : statusColors.warning.textDark)}>
          {view.step.serviceAction}
        </p>
      )}

      {view.reasons.length > 0 && (
        <ul className={cn('flex flex-col', stackGap.tight, textStyles.caption, textColors.secondary)}>
          {view.reasons.map((reason) => (
            <li key={reason.text} className="flex gap-1.5">
              <span aria-hidden>·</span>
              <span className="min-w-0">
                {reason.text}
                <span className={cn('ml-1 font-semibold tabular-nums', textColors.tertiary)}>
                  {reason.count}건
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onOpen}
        className={cn('self-start', textStyles.captionStrong, primaryColors.text)}
      >
        해당 단계 열기 →
      </button>
    </div>
  );
};

/** 요약의 지표 한 칸 — 숫자가 라벨보다 크다(숫자가 내용, 라벨은 주석). */
const RollupStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className={cn('text-[20px] font-bold leading-[1.2] tabular-nums', tone ?? textColors.primary)}>
      {value}
    </span>
    <span className={cn(textStyles.caption, textColors.tertiary)}>{label}</span>
  </div>
);

/**
 * 요약 패널 — 좌측 레일이 이미 단계 목록을 갖고 있으므로, 여기서는 레일이 못 하는
 * 두 가지만 한다: ① 전체 진척을 숫자로 ② 지금 해야 할 일.
 *
 * 예전에는 "진행 중·대기 / 완료된 단계" 묶음까지 나열했는데, 그건 레일과 같은 목록을
 * 같은 모양으로 한 번 더 그린 것이라 좌우가 구분되지 않았다(오너 지적).
 */
const InstallSummaryPanel = ({
  views,
  rollup,
  onOpen,
}: {
  views: readonly StepView[];
  /** 리소스별 전체 상태(installation_status) 집계. */
  rollup: { total: number; done: number; running: number; failed: number };
  onOpen: (stepId: string) => void;
}) => {
  const action = views.filter((v) => v.actionable);

  return (
    // 그룹(섹션) 사이 = section 32px, 그룹 제목↔본문 = related 8px (비대칭 규칙)
    <div className={cn('flex flex-col', stackGap.section)}>
      {/* 지표 행 — 요약 패널의 본문. 숫자 20px 이 이 패널에서 가장 큰 글자다.
          판을 깔지 않는다: 카드 안에 또 카드를 두지 않는 것이 이 화면의 규칙. */}
      <div className="flex items-start gap-8">
        <RollupStat label="전체 리소스" value={rollup.total} />
        <RollupStat label="완료" value={rollup.done} />
        <RollupStat label="진행중" value={rollup.running} tone={statusColors.info.textDark} />
        <RollupStat
          label="실패"
          value={rollup.failed}
          {...(rollup.failed > 0 && { tone: statusColors.error.textDark })}
        />
      </div>

      <section className={cn('flex flex-col', stackGap.related)}>
        {/* 섹션 라벨은 한 단 내려 쓴다 — 항목 제목과 같은 14/700 이면 둘 중 무엇이
            상위인지 화면이 답하지 못한다(인접 계층은 크기·색 두 축이 달라야 한다). */}
        <h4 className={cn(textStyles.captionStrong, textColors.tertiary)}>
          지금 서비스 측에서 확인이 필요합니다
        </h4>
        {action.length === 0 ? (
          <p className={cn(textStyles.body, textColors.secondary)}>
            확인이 필요한 항목이 없어요. 나머지 단계는 BDC가 처리 중이며, 왼쪽 목록에서 진행
            상황을 볼 수 있어요.
          </p>
        ) : (
          action.map((view) => (
            <ActionItem key={view.step.id} view={view} onOpen={() => onOpen(view.step.id)} />
          ))
        )}
      </section>
    </div>
  );
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

  // Step views for the summary panel / banner — nav order, summary itself excluded.
  const views = useMemo<StepView[]>(() => {
    return navSteps.flatMap((step, navIndex) => {
      if (step.id === SUMMARY_ID) return [];
      const aggregate = aggregates.get(step.id)!;
      const counts = new Map<string, number>();
      for (const resource of resources) {
        const cell = cellOf(resource, step.id);
        if (isSettledInstallStatus(cell.status) || !cell.guide) continue;
        counts.set(cell.guide, (counts.get(cell.guide) ?? 0) + 1);
      }
      const reasons = [...counts]
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count);
      return [{
        step,
        navIndex,
        aggregate,
        reasons,
        actionable: aggregate.kind !== 'done' && (Boolean(step.serviceAction) || aggregate.kind === 'failed'),
      }];
    });
  }, [navSteps, aggregates, resources, cellOf]);

  const actionViews = useMemo(() => views.filter((v) => v.actionable), [views]);

  const rollup = useMemo(() => {
    const kinds = resources.map((r) => kindOfValue(r.rollup.status));
    return {
      total: resources.length,
      done: kinds.filter((k) => k === 'done').length,
      running: kinds.filter((k) => k === 'running').length,
      failed: kinds.filter((k) => k === 'failed').length,
    };
  }, [resources]);

  // 조치할 항목이 있으면 요약(=할 일 목록)으로 열고, 없으면 진행 중인 단계로
  // 바로 들어간다. 사용자 클릭은 항상 선택을 고정한다.
  const hotStepId = useMemo<string>(() => {
    if (actionViews.length > 0) return SUMMARY_ID;
    for (const kind of ['failed', 'running', 'waiting'] as const) {
      const hit = navSteps.find((s) => s.id !== SUMMARY_ID && aggregates.get(s.id)?.kind === kind);
      if (hit) return hit.id;
    }
    return SUMMARY_ID;
  }, [actionViews, navSteps, aggregates]);
  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? hotStepId;
  const active = navSteps.find((s) => s.id === activeId) ?? navSteps[0];
  const activePanel = panelSteps.find((p) => p.id === active.id);
  const isSummary = active.id === SUMMARY_ID;
  const activeAggregate = aggregates.get(active.id);

  const rows = useMemo<ResourceRow[]>(() => {
    if (activePanel || active.id === SUMMARY_ID) return [];
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
    <div className="flex flex-col gap-3">
      {/* 레일은 목차, 우측은 내용 — 둘을 표면으로 가른다. 레일은 가라앉은 회색 판
          위에 앉고 우측은 카드의 흰 바닥을 그대로 쓴다. 구분선 하나로는 "같은 종류의
          정보가 두 단 있다"로 읽혔다(오너 지적). 폭은 224px — 목차가 넓을 이유는 없고,
          남는 폭은 전부 리소스 테이블이 쓴다. */}
      <div className="grid grid-cols-[224px_minmax(0,1fr)] gap-6">
      <nav
        className={cn('flex flex-col gap-0.5 rounded-xl p-2 self-start', bgColors.muted)}
        aria-label="설치 단계"
      >
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
                'flex flex-col gap-1 w-full text-left px-2.5 py-2 rounded-lg transition-colors',
                // 레일 자체가 회색이므로 선택 항목은 흰 카드로 떠오른다(반대 방향의 대비).
                isActive ? cn('bg-white', shadows.pill) : 'hover:bg-white/60',
              )}
            >
              <span className="flex items-start gap-2.5 w-full">
                <span
                  className={cn(
                    'w-6 h-6 rounded-full grid place-items-center flex-shrink-0',
                    textStyles.captionStrong,
                    bgColors.muted,
                    textColors.secondary,
                  )}
                >
                  {step.id === SUMMARY_ID ? '≡' : index}
                </span>
                <span className={cn('flex-1 min-w-0', textStyles.bodyStrong, textColors.primary)}>
                  {step.title}
                </span>
              </span>
              {/* 34px = 24px index circle + 10px gap — aligns with the title.
                  목차 한 줄에 채운 태그가 둘씩 반복되면 색이 내용을 이긴다. 여기서는 상태도
                  주체도 글자로 쓰고, 색은 "봐야 하는가"(실패·진행중)에만 남긴다. */}
              <span className={cn('flex items-center gap-1.5 flex-wrap pl-[34px]', textStyles.caption)}>
                <span
                  className={cn(
                    NAV_STATUS_TEXT[aggregate.kind],
                    // 끝난 단계는 굵기까지 내려놓는다 — 남은 일만 눈에 걸리게.
                    aggregate.kind === 'done' || aggregate.kind === 'waiting'
                      ? 'font-normal'
                      : 'font-semibold',
                  )}
                >
                  {aggregate.label}
                </span>
                {aggregate.count && (
                  <span className={cn('tabular-nums', textColors.tertiary)}>{aggregate.count}</span>
                )}
                {step.side && (
                  <span className={cn('flex items-center gap-1.5', textColors.tertiary)}>
                    <span aria-hidden>·</span>
                    <span className="truncate">{step.side}</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          {/* 제목↔부제 = tight 4px */}
          <div className={cn('min-w-0 flex flex-col', stackGap.tight)}>
            <h3 className={cn(textStyles.cardTitle, textColors.primary)}>{active.title}</h3>
            <p className={cn(textStyles.caption, 'max-w-[60ch]', textColors.secondary)}>
              {active.desc}
            </p>
          </div>
          <span className="flex items-center gap-2 flex-shrink-0">
            {active.side && <SideTag side={active.side} />}
            {active.action}
            {!isSummary && activeAggregate && (
              <span className={cn(TABLE_TAG_PILL, activeAggregate.tag, 'whitespace-nowrap')}>
                {activeAggregate.count
                  ? `${activeAggregate.label} ${activeAggregate.count}`
                  : activeAggregate.label}
              </span>
            )}
          </span>
        </div>

        {!activePanel && (
          <div className={cn('mt-4 mb-2', textStyles.caption, textColors.tertiary)}>
            {lastCheck.checkedAt && <>마지막 확인 {formatDateTime(lastCheck.checkedAt)}</>}
            {lastCheck.status === 'FAILED' && (
              <span className={cn('font-semibold', statusColors.error.textDark)}> · 상태 확인 실패</span>
            )}
          </div>
        )}

        <div className={activePanel ? 'mt-4' : ''}>
          {activePanel ? (
            activePanel.panel
          ) : isSummary ? (
            <InstallSummaryPanel views={views} rollup={rollup} onOpen={setSelected} />
          ) : (
            // key resets pagination when switching steps
            <StepResourceTable key={active.id} rows={rows} />
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
