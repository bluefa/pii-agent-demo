'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  serviceSidebarStyles,
  sideTextColors,
  stackGap,
  shadows,
  statusColors,
  tagStyles,
  textColors,
  textStyles,
} from '@/lib/theme';
import { TABLE_TAG_PILL } from '@/app/components/features/process-status/install-task-pipeline/table-styles';
import { DownloadIcon } from '@/app/components/ui/icons';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import { formatDateTime, formatDateTimeKst } from '@/lib/utils/date';
import {
  INSTALL_STATUS_LABEL,
  isSettledInstallStatus,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallReferenceStep,
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

/**
 * 레일 항목끼리 서로를 가리키는 링크 — 요약 패널 "N단계로 이동" 과 같은 문법.
 * 단계 → 참고 항목, 참고 항목 → 단계 양방향에서 같은 모양이어야 한다.
 */
const JumpLink = ({ label, onJump }: { label: string; onJump: () => void }) => (
  <button
    type="button"
    onClick={onJump}
    className={cn('underline underline-offset-2 decoration-1 font-semibold', primaryColors.text)}
  >
    {label}
  </button>
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

/**
 * 레일 상태 글자색 — 태그를 걷어낸 자리. 손댈 단계(실패·진행중)만 색을 갖고,
 * 끝났거나 남의 차례인 단계(완료·대기)는 회색으로 가라앉는다.
 */
// 조용한 톤이 secondary(gray-700)인 이유: 레일 표면이 bgColors.panel(gray-100)이라
// tertiary(gray-500)는 4.37:1 로 AA 미달 (theme.ts panel 토큰 주석 참조).
const NAV_STATUS_TEXT: Record<AggregateKind, string> = {
  failed: statusColors.error.textDark,
  running: statusColors.info.textDark,
  done: textColors.secondary,
  waiting: textColors.secondary,
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

/**
 * 주체를 글자로 — 정보는 앞머리 한 단어(서비스측 / BDC측)에 있으므로 거기에만 색이
 * 붙고, 뒤따르는 설명("리소스 생성", "승인")은 회색으로 남는다.
 */
const SideText = ({ side }: { side: string }) => {
  const [owner, ...rest] = side.split(' ');
  return (
    // secondary — panel(gray-100) 표면 위라 tertiary 는 AA 미달.
    <span className={textColors.secondary}>
      <span className={cn('font-semibold', side.startsWith('BDC') ? sideTextColors.bdc : sideTextColors.service)}>
        {owner}
      </span>
      {rest.length > 0 && ` ${rest.join(' ')}`}
    </span>
  );
};

interface ResourceRow {
  resourceId: string;
  resourceName: string | null;
  region: string | null;
  databaseType: string | null;
  /** Top-level resource type, joined via `meta` — drives the RDS-cluster tag only. */
  resourceType: string | null;
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
        // The engine, as this table has always printed it; the real type rides
        // `declaredResourceType` so the cluster tag can key off it.
        resourceType: row.databaseType ?? '',
        declaredResourceType: row.resourceType ?? undefined,
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
 * 조치 항목 — Step 2 의 반려 사유와 같은 인용 룰 문법.
 *
 * 채운 블록은 카드 폭 그대로 서서 "두 번째 카드"로 읽히지만, 3px 룰에 걸어두면 같은
 * 상태를 색면 ~800px² 로 말한다. 크기 계층도 Step 2 와 같다: 12px 태그가 블록의 이름,
 * 17px 문장이 payload — 사용자가 실제로 해야 하는 일이 이 블록에서 가장 큰 글자다.
 */
const ActionItem = ({ view, onOpen }: { view: StepView; onOpen: () => void }) => {
  const failed = view.aggregate.kind === 'failed';
  const tone = failed ? statusColors.error : statusColors.warning;
  // 조치 문구가 없는 단계(자동 진행 중 실패 등)는 계약이 준 사유 첫 줄이 payload 다.
  // 그 경우 아래 목록은 나머지만 — 같은 문장을 크게 한 번, 작게 또 한 번 쓰지 않는다.
  const payload = view.step.serviceAction ?? view.reasons[0]?.text ?? view.aggregate.label;
  const payloadCount = view.step.serviceAction ? null : view.reasons[0]?.count ?? null;
  const restReasons = view.step.serviceAction ? view.reasons : view.reasons.slice(1);
  return (
    <div className={cn('border-l-[3px] pl-4', tone.borderStrong)}>
      {/* 제목이 아니라 태그 — 이 블록이 무엇에 대한 것인지만 말하고, payload 아래로 내려간다. */}
      <p className={cn('text-[12px] font-bold tracking-[0.02em]', tone.textDark)}>
        {view.step.title}
        {view.step.side && (
          <span className={cn('ml-1.5 font-semibold', textColors.tertiary)}>· {view.step.side}</span>
        )}
      </p>

      {/* payload = 해야 하는 일. 이 블록에서 가장 큰 글자이자 가장 진한 톤. */}
      <p className={cn('mt-1.5 text-[18px] font-semibold leading-[1.5]', textColors.primary)}>
        {payload}
        {payloadCount !== null && (
          <span className={cn('ml-2 font-semibold tabular-nums', textStyles.caption, textColors.tertiary)}>
            {payloadCount}건
          </span>
        )}
      </p>

      {restReasons.length > 0 && (
        <ul className={cn('mt-2 flex flex-col', stackGap.tight, textStyles.caption, textColors.secondary)}>
          {restReasons.map((reason) => (
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

      {/* 나가는 길은 룰 안에 둔다 — 밖으로 빼면 별개 블록으로 읽힌다(Step 2 서명행 규칙). */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'underline underline-offset-2 decoration-1',
            textStyles.captionStrong,
            primaryColors.text,
          )}
        >
          {view.step.title} 단계로 이동
        </button>
      </div>
    </div>
  );
};

/** 조회 시각 한 줄 — 요약에서는 지표 카드 안, 단계 표에서는 표 아래에 선다. */
const LastCheckLine = ({ lastCheck }: { lastCheck: InstallLastCheck }) => (
  <div className={cn(textStyles.caption, textColors.tertiary)}>
    {lastCheck.checkedAt && <>마지막 확인 {formatDateTime(lastCheck.checkedAt)}</>}
    {lastCheck.status === 'FAILED' && (
      <span className={cn('font-semibold', statusColors.error.textDark)}> · 상태 확인 실패</span>
    )}
  </div>
);

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
  lastCheck,
  onOpen,
}: {
  views: readonly StepView[];
  /** 리소스별 전체 상태(installation_status) 집계. */
  rollup: { total: number; done: number; running: number; failed: number };
  lastCheck: InstallLastCheck;
  onOpen: (stepId: string) => void;
}) => {
  const action = views.filter((v) => v.actionable);

  return (
    // 그룹(섹션) 사이 = section 32px, 그룹 제목↔본문 = related 8px (비대칭 규칙)
    <div className={cn('flex flex-col', stackGap.section)}>
      {/* 현황 카드 — 숫자와 그 숫자가 언제 기준인지는 한 덩어리다. 이 패널에서 판을
          가진 유일한 블록이고, 조치 항목은 아래에서 인용 룰이 대신 묶는다. */}
      <div className={cn('rounded-xl border px-5 py-4 flex flex-col', stackGap.related, borderColors.light)}>
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
        <LastCheckLine lastCheck={lastCheck} />
      </div>

      {/* 제목은 조건부다 — 확인할 게 없는데 "확인이 필요합니다"를 띄워놓고 그 아래에서
          "없어요"라고 하면 한 섹션이 서로 반대말을 한다. */}
      {action.length === 0 ? (
        <p className={cn(textStyles.body, textColors.secondary)}>
          지금 서비스 측에서 확인할 항목은 없어요. 나머지 단계는 BDC가 처리 중이며, 왼쪽
          목록에서 진행 상황을 볼 수 있어요.
        </p>
      ) : (
        // 판을 두르지 않는다 — 묶음은 각 항목의 인용 룰이 말한다(Step 2 문법).
        <section className={cn('flex flex-col', stackGap.related)}>
          {/* 섹션 라벨은 한 단 내려 쓴다 — 항목 제목과 같은 14/700 이면 둘 중 무엇이
              상위인지 화면이 답하지 못한다(인접 계층은 크기·색 두 축이 달라야 한다). */}
          <h4 className={cn(textStyles.captionStrong, textColors.tertiary)}>
            지금 서비스 측에서 확인이 필요합니다
          </h4>
          {/* 여러 건일 수 있으므로 목록이다 — 스크린리더도 "N개 항목"으로 읽는다. */}
          <ul className={cn('flex flex-col', stackGap.section)}>
            {action.map((view) => (
              <li key={view.step.id}>
                <ActionItem view={view} onOpen={() => onOpen(view.step.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}
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
  /**
   * 단계가 아닌 참고 항목 — 그룹 레일에서만 '설치 스크립트' 묶음으로 렌더한다.
   * 레거시 레일(Azure/GCP/IDC)은 그리지 않으므로 넘겨도 도달할 수 없다.
   */
  reference?: InstallReferenceStep;
}

export const InstallStatusDetail = ({
  lastCheck,
  resources,
  steps,
  panelSteps = [],
  meta,
  reference,
}: InstallStatusDetailProps) => {
  // Grouped rail (v2) — on only when EVERY step declares a group (AWS first).
  // A half-migrated adapter (some steps missing `group`) falls back to the
  // legacy layout: the grouped rail partitions by group and would silently
  // drop — and make unreachable — any step that declares none.
  const grouped = useMemo(() => {
    const all = [...panelSteps, ...steps];
    return all.length > 0 && all.every((s) => s.group);
  }, [panelSteps, steps]);

  // The grouped rail has no summary step — its rail lists the steps directly, so
  // `rollup` stays unrendered there (owner removed the footer that used to show it).
  const navSteps: InstallTableStep[] = useMemo(
    () => (grouped ? [...panelSteps, ...steps] : [SUMMARY_STEP, ...panelSteps, ...steps]),
    [grouped, panelSteps, steps],
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

  const openTodoCount = useMemo(
    () =>
      navSteps.filter(
        (s) => s.group === 'todo' && aggregates.get(s.id)?.kind !== 'done',
      ).length,
    [navSteps, aggregates],
  );

  const rollup = useMemo(() => {
    const kinds = resources.map((r) => kindOfValue(r.rollup.status));
    return {
      total: resources.length,
      done: kinds.filter((k) => k === 'done').length,
      running: kinds.filter((k) => k === 'running').length,
      failed: kinds.filter((k) => k === 'failed').length,
    };
  }, [resources]);

  // Default selection: with actionable items, open the summary (= todo list);
  // otherwise jump straight to the step in motion. The grouped rail has no
  // summary, so its first open todo IS the first screen. A user click always
  // pins the selection.
  const hotStepId = useMemo<string>(() => {
    if (grouped) {
      const todo = navSteps.find(
        (s) => s.group === 'todo' && aggregates.get(s.id)?.kind !== 'done',
      );
      if (todo) return todo.id;
    } else if (actionViews.length > 0) return SUMMARY_ID;
    for (const kind of ['failed', 'running', 'waiting'] as const) {
      const hit = navSteps.find((s) => s.id !== SUMMARY_ID && aggregates.get(s.id)?.kind === kind);
      if (hit) return hit.id;
    }
    // The grouped rail has no summary step — when everything is done, open the first item.
    return grouped ? navSteps[0]?.id ?? SUMMARY_ID : SUMMARY_ID;
  }, [grouped, actionViews, navSteps, aggregates]);
  const [selected, setSelected] = useState<string | null>(null);
  // 존재하지 않는 id 로 선택이 굳는 것을 막는다. 죽은 점프 링크를 누르면 어떤 레일 행도
  // aria-current 를 갖지 못하고(선택 표시가 통째로 사라진다) 패널은 조용히 첫 단계로 튄다.
  // 둘 다 에러 없이 일어나므로 여기서 걸러 hot step 으로 되돌린다.
  const isKnownId = (id: string) => navSteps.some((s) => s.id === id) || reference?.id === id;
  const activeId = selected && isKnownId(selected) ? selected : hotStepId;
  // 참고 항목은 단계 배열(navSteps) 밖에 산다 — 그래서 집계·기본 선택·진행률 어디에도
  // 끼지 않고, 선택됐을 때만 우측 패널을 통째로 차지한다.
  const activeReference = reference && reference.id === activeId ? reference : null;
  // 점프 링크는 미리 묶어둔다 — JSX 안에서 좁힌 타입은 onClick 클로저까지 따라오지 않아
  // 단언(!)을 부르게 된다.
  const referenceLink = activeReference?.descLink ?? null;
  const active = navSteps.find((s) => s.id === activeId) ?? navSteps[0];
  const activePanel = panelSteps.find((p) => p.id === active.id);
  const isSummary = active.id === SUMMARY_ID;
  const activeAggregate = aggregates.get(active.id);

  const rows = useMemo<ResourceRow[]>(() => {
    if (activeReference || activePanel || active.id === SUMMARY_ID) return [];
    return resources.map((r) => {
      const m = meta.get(r.resourceId);
      return {
        resourceId: r.resourceId,
        resourceName: r.resourceName ?? m?.resourceName ?? null,
        region: m?.region ?? null,
        databaseType: m?.databaseType ?? null,
        resourceType: m?.resourceType ?? null,
        cell: cellOf(r, active.id),
      };
    });
  }, [activeReference, activePanel, active.id, resources, meta, cellOf]);

  // 단계 ↔ 참고 항목을 서로 가리키는 링크는 문법이 하나다.
  const activeNote = active.note ?? null;

  // Right-pane header/body — shared by both layouts (grouped / legacy).
  const paneHead = (
    <div className="flex items-start justify-between gap-3">
      {/* title↔subtitle = tight 4px */}
      <div className={cn('min-w-0 flex flex-col', stackGap.tight)}>
        <h3 className={cn(textStyles.cardTitle, textColors.primary)}>{active.title}</h3>
        {/* 폭 캡 없음 — 단계 설명은 전부 한 문장이라, 판이 허용하는 만큼 한 줄로
            선다(오너 요구: "리소스별 Private Endpoint …" 줄바꿈 금지). */}
        <p className={cn(textStyles.caption, textColors.secondary)}>
          {active.desc}
        </p>
        {/* 역참조 한 줄 — 참고 항목이 이 단계를 가리키는 만큼, 이 단계도 참고 항목을
            가리킨다. 조사가 라벨에 붙으므로 사이에 공백을 넣지 않는다. */}
        {activeNote && (
          <p className={cn(textStyles.caption, textColors.secondary)}>
            <JumpLink label={activeNote.link.label} onJump={() => setSelected(activeNote.link.stepId)} />
            {activeNote.text}
          </p>
        )}
      </div>
      <span className="flex items-center gap-2 flex-shrink-0">
        {active.side && <SideTag side={active.side} />}
        {active.action}
        {!isSummary && activeAggregate && (
          <span className={cn(TABLE_TAG_PILL, activeAggregate.tag, 'whitespace-nowrap')}>
            {/* The grouped rail drops n/m counts — status words only. */}
            {!grouped && activeAggregate.count
              ? `${activeAggregate.label} ${activeAggregate.count}`
              : activeAggregate.label}
          </span>
        )}
      </span>
    </div>
  );

  const paneBody = activePanel ? (
    activePanel.panel
  ) : isSummary ? (
    <InstallSummaryPanel views={views} rollup={rollup} lastCheck={lastCheck} onOpen={setSelected} />
  ) : (
    // key resets pagination when switching steps
    <StepResourceTable key={active.id} rows={rows} />
  );

  // ---------------------------------------------------------------------------
  // Grouped rail layout (v3.6, AWS first) — a gray wrapper encloses the rail
  // and the white content card.
  // ---------------------------------------------------------------------------
  if (grouped) {
    const todoSteps = navSteps.filter((s) => s.group === 'todo');
    const autoSteps = navSteps.filter((s) => s.group === 'auto');
    // 레일 항목 껍데기 — 단계와 참고 항목이 같은 히트 영역·선택 표현을 쓴다.
    // 선택은 서비스 목록 rail 의 "현재 위치" 문법(rowCurrent: 파란 틴트 + 좌측 2px 바)
    // 그대로다 — 흰 pill + 헤어라인은 회색 판 위에서 눌린 티가 나지 않았다(오너 지적).
    // 바가 라운드를 뚫지 않도록 overflow-hidden.
    const railItemClass = (isActive: boolean) =>
      cn(
        'flex items-baseline gap-2 w-full text-left pl-3.5 pr-2.5 py-2 rounded-lg transition-colors flex-shrink-0 overflow-hidden',
        isActive ? serviceSidebarStyles.rowCurrent : 'hover:bg-white/60',
      );

    // 레일 항목 제목 — 평시 14/400, 선택 시 14/600. 항목이 조용해진 만큼(A안)
    // 선택된 것 하나만 무게를 갖는다.
    const railTitleClass = (isActive: boolean) =>
      cn(
        'flex-1 min-w-0 truncate',
        isActive ? textStyles.bodyStrong : textStyles.body,
        textColors.primary,
      );

    // Rail item — one line: [ordinal] title · status word.
    const railItem = (step: InstallTableStep, ord: number | null) => {
      const aggregate = aggregates.get(step.id)!;
      const isActive = step.id === activeId;
      return (
        <button
          key={step.id}
          type="button"
          onClick={() => setSelected(step.id)}
          aria-current={isActive}
          className={railItemClass(isActive)}
        >
          {ord !== null && (
            // Execution order — quiet gray digits. secondary, not tertiary:
            // gray-500 on the panel surface (gray-100) is 4.37:1, under AA.
            <span className={cn('flex-shrink-0 w-3.5 tabular-nums', textStyles.caption, textColors.secondary)}>
              {ord}
            </span>
          )}
          <span className={railTitleClass(isActive)}>
            {step.title}
          </span>
          <span
            className={cn(
              'flex-shrink-0',
              textStyles.caption,
              NAV_STATUS_TEXT[aggregate.kind],
              aggregate.kind === 'done' || aggregate.kind === 'waiting' ? 'font-normal' : 'font-semibold',
            )}
          >
            {aggregate.label}
          </span>
        </button>
      );
    };

    // 참고 항목 — 상태도 순번도 없다. 제목 한 줄이 전부다.
    const referenceItem = (ref: InstallReferenceStep) => (
      <button
        key={ref.id}
        type="button"
        onClick={() => setSelected(ref.id)}
        aria-current={ref.id === activeId}
        className={railItemClass(ref.id === activeId)}
      >
        <span className={railTitleClass(ref.id === activeId)}>{ref.title}</span>
      </button>
    );

    // 16/600 — 그룹 이름이 항목(14/400)보다 크고 굵다. 계층 레버(크기·굵기)가 전부
    // 라벨 편을 가리켜야 한다 — 16/500 은 크기로는 상위, 굵기·잉크로는 하위라
    // 부모가 오락가락했다(레일 타이포 벤치마크 진단 1).
    const groupLabel = (text: string, tone: string, trailing?: ReactNode) => (
      <div
        className={cn(
          'flex items-baseline gap-2 px-2.5 pt-3 pb-1 text-[16px] font-semibold leading-[24px] tracking-[-0.01em] flex-shrink-0',
          // On the gray-100 panel: raw Primary is 4.47:1 and gray-500 is 4.37:1,
          // both under AA — use the darker tiers the theme keeps for tints.
          tone,
        )}
      >
        <span className="min-w-0 truncate">{text}</span>
        {trailing}
      </div>
    );

    return (
      <div className={cn('rounded-2xl p-2', bgColors.panel)}>
        {/* Metabar — title left / last-check right, one baseline row. No manual
            refresh or interval control (owner decision) — polling refreshes quietly. */}
        <div className="flex items-baseline gap-3 flex-wrap px-2.5 pt-1.5 pb-2.5">
          <h3
            className={cn(
              'text-[20px] font-semibold leading-[28px] tracking-[-0.01em]',
              textColors.primary,
            )}
          >
            설치 진행 상황
          </h3>
          <span className={cn('ml-auto', textStyles.caption, textColors.secondary)}>
            {/* checked_at is UTC wire — the label asserts KST, so the formatter
                pins Asia/Seoul instead of trusting the browser timezone. */}
            {lastCheck.checkedAt && <>마지막 확인 {formatDateTimeKst(lastCheck.checkedAt)} (KST)</>}
            {lastCheck.status === 'FAILED' && (
              <span className={cn('font-semibold', statusColors.error.textDark)}> · 상태 확인 실패</span>
            )}
          </span>
        </div>

        {/* Fixed height — scrolling lives in the card body on the right; the
            card header is the clipping point. */}
        <div className="grid grid-cols-[224px_minmax(0,1fr)] gap-2 h-[560px]">
          <nav className="flex flex-col gap-0.5 overflow-y-auto min-h-0 pb-1" aria-label="설치 단계">
            {groupLabel(
              `내가 할 일 (${openTodoCount})`,
              openTodoCount > 0 ? primaryColors.textOnLight : textColors.secondary,
              // 0 은 "비어 있다"가 아니라 "다 끝났다" — 남는 자리에 문단을 뿌리는 대신
              // 그룹 이름 옆에서 한 마디로 닫는다. 지웠던 두 줄은 둘 다 중복이었다:
              // "하실 일이 없어요"는 라벨의 (0)이, "자동으로 진행돼요"는 바로 아래
              // 'BDC 진행' 라벨이 이미 말한다.
              openTodoCount === 0 && (
                <span className={cn('ml-auto flex-shrink-0', textStyles.caption, statusColors.success.textDark)}>
                  모두 완료
                </span>
              ),
            )}
            {todoSteps.map((s) => railItem(s, null))}
            {/* BDC 는 인디고 — 새 색이 아니라 이 화면이 이미 'BDC측'에 쓰고 있는 색이다
                (SideTag 의 tagStyles.indigo, sideTextColors.bdc). 그룹 이름과 행 태그가
                같은 색을 말해야 "이 묶음이 곧 BDC 측"으로 읽힌다. */}
            {groupLabel('BDC 진행', sideTextColors.bdc)}
            {autoSteps.map((s, i) => railItem(s, i + 1))}

            {/* 설치 스크립트 — 단계가 아니므로 진행 순번 다음, 레일 끝에 선다.
                주황은 파랑(내가 할 일)과 겹치지 않는 유일한 강조색이라, 처음 들어온
                담당자도 찾지 않고 걸린다(오너 요구). */}
            {reference && (
              <>
                {groupLabel('설치 스크립트', statusColors.warning.textDark)}
                {referenceItem(reference)}
              </>
            )}
            {/* 레일 푸터(진행바 + "N개 중 M개 완료") 삭제 — 오너 결정. 단계 행의 상태
                글자는 최악값 한 단어라 리소스 개수를 대신하지 못하므로, 그룹 레일에는
                수치 진행률이 남아 있지 않다. 필요해지면 메타바 우측이 자리다. */}
          </nav>

          {/* Primer card — separation is the hairline border (gray-200, so it
              reads against the gray-100 panel), the shadow is only a 1px lift hint. */}
          <div className={cn('min-w-0 min-h-0 flex flex-col bg-white rounded-xl border', borderColors.default, shadows.hair)}>
            {activeReference ? (
              /* 참고 패널은 표가 아니라 액션 하나다 — 헤더+본문으로 쪼개면 16px 제목,
                 12px 설명, 떠 있는 버튼 세 조각이 큰 빈 면 위에 남는다(오너 지적).
                 EmptyState(block)의 히어로 문법을 한 단계 키워 카드 전체가 한 구도가
                 되게 한다: 아이콘 칩 → 제목 → 설명 → 액션, 수직 중앙. */
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                  <div
                    aria-hidden
                    className={cn(
                      'mb-1 grid h-14 w-14 place-items-center rounded-2xl',
                      primaryColors.bgLight,
                      primaryColors.textOnLight,
                    )}
                  >
                    {/* 공용 아이콘 — 칩 안에서만 24px 로 키운다(CSS 가 svg 의 width/height
                        속성을 이긴다). 같은 글리프를 손으로 다시 그리지 않는다. */}
                    <DownloadIcon className="h-6 w-6" />
                  </div>
                  <h3 className={cn('text-[18px] font-bold leading-[1.3] tracking-[-0.01em]', textColors.primary)}>
                    {activeReference.title}
                  </h3>
                  <p className={cn(textStyles.body, 'max-w-[46ch] break-keep', textColors.secondary)}>
                    {referenceLink && (
                      <>
                        <JumpLink
                          label={referenceLink.label}
                          onJump={() => setSelected(referenceLink.stepId)}
                        />{' '}
                      </>
                    )}
                    {activeReference.desc}
                  </p>
                  <div className="mt-2">{activeReference.panel}</div>
                </div>
              </div>
            ) : (
              <>
                <div className={cn('flex-none px-5 py-4 border-b', borderColors.light)}>{paneHead}</div>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{paneBody}</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Legacy layout — CSPs whose steps declare no groups (Azure / GCP / IDC).
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3">
      {/* 레일은 목차, 우측은 내용 — 둘을 표면으로 가른다. 레일은 가라앉은 회색 판
          위에 앉고 우측은 카드의 흰 바닥을 그대로 쓴다. 구분선 하나로는 "같은 종류의
          정보가 두 단 있다"로 읽혔다(오너 지적). 폭은 224px — 목차가 넓을 이유는 없고,
          남는 폭은 전부 리소스 테이블이 쓴다.
          둘은 하나의 테두리 컨테이너로 묶는다 — 레일을 self-start 로 띄워두면 리소스가
          많은 단계에서 우측 테이블이 레일보다 길어져 그룹 밖으로 흘러나온 것처럼
          보였다(오너 지적). 레일 회색면은 컨테이너 높이를 그대로 따라 늘어난다. */}
      <div className={cn('grid grid-cols-[224px_minmax(0,1fr)] rounded-xl border overflow-hidden', borderColors.light)}>
      <nav
        className={cn('flex flex-col gap-0.5 p-2 border-r', bgColors.panel, borderColors.light)}
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
                    // divider(gray-200) — 레일이 panel(gray-100)로 어두워져 muted 원은
                    // 바탕보다 밝아 구멍처럼 읽힌다.
                    bgColors.divider,
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
                  <span className={cn('tabular-nums', textColors.secondary)}>{aggregate.count}</span>
                )}
                {step.side && (
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span aria-hidden className={textColors.tertiary}>·</span>
                    <SideText side={step.side} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 컨테이너에 갇힌 뒤로는 내용이 테두리에 닿으므로 안쪽 여백이 gap-6 을 대신한다. */}
      <div className="min-w-0 px-5 py-4">
        {paneHead}

        <div className="mt-4">{paneBody}</div>

        {/* 표 아래 조회 시각 — 요약에서는 지표 카드가 이미 갖고 있으므로 여기서는 뺀다. */}
        {!activePanel && !isSummary && (
          <div className="mt-4">
            <LastCheckLine lastCheck={lastCheck} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
