'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { ChevronDownIcon, InfoCircleIcon, SearchIcon } from '@/app/components/ui/icons';
import {
  bgColors,
  borderColors,
  buttonStyles,
  cn,
  interactiveColors,
  logicalDbStyles,
  primaryColors,
  segmentedControlStyles,
  statusColors,
  tagStyles,
  textColors,
} from '@/lib/theme';
import type { SkipReason } from '@/app/lib/api/logical-db';
import {
  abbrevMiddle,
  buildLogicalDbTree,
  isDenyish,
  listStagedChanges,
  logicalDbRowStatus,
  type LogicalDbNode,
  type LogicalDbRowStatus,
} from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-tree';
import type {
  LogicalDatabase,
  LogicalDbModalDraft,
  LogicalDbModalProps,
} from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

const EMPTY_DRAFT: LogicalDbModalDraft = {
  excludedIds: new Set<string>(),
  reasons: {},
};

/** Contract enum + the Korean labels it never had. The enum stays visible (admin/logs match on it). */
const REASON_OPTIONS: ReadonlyArray<{ value: SkipReason; label: string }> = [
  { value: 'STG', label: '스테이징' },
  { value: 'DEV', label: '개발용' },
  { value: 'TEMP', label: '임시' },
];

const reasonLabel = (reason: SkipReason | undefined): string =>
  REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason ?? '';

/** Client-side windowing: the fetched lists are unpaginated, but the DOM must not be. */
const DB_PAGE_SIZE = 10;
const SCHEMA_PAGE_SIZE = 20;

const fmt = (n: number): string => n.toLocaleString('ko-KR');

type ListFilter = 'all' | 'keep' | 'deny';

const chipCls = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold';
const rowBtnCls = 'inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold';

export const LogicalDbModal = ({
  open,
  resourceName,
  databases,
  initialDraft = EMPTY_DRAFT,
  onSave,
  onClose,
}: LogicalDbModalProps) => {
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(
    initialDraft.excludedIds,
  );
  const [reasons, setReasons] = useState<Readonly<Record<string, SkipReason>>>(
    initialDraft.reasons,
  );
  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  /** Collapsed DATABASE ids — absent means open (groups start expanded). */
  const [closedDbs, setClosedDbs] = useState<ReadonlySet<string>>(new Set());
  const [dbPage, setDbPage] = useState(0);
  const [schemaPages, setSchemaPages] = useState<Readonly<Record<string, number>>>({});
  const [reasonPickId, setReasonPickId] = useState<string | null>(null);
  const [pickedReason, setPickedReason] = useState<SkipReason>('STG');
  const popRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildLogicalDbTree(databases), [databases]);

  const statusOf = (id: string, parentId?: string): LogicalDbRowStatus =>
    logicalDbRowStatus(id, parentId, excludedIds, initialDraft.excludedIds);

  // Counts cover the FULL set (query/filter-agnostic) — the segmented control is
  // a summary of the target, not of the current view.
  const counts = useMemo(() => {
    let total = 0;
    let deny = 0;
    for (const node of tree.nodes) {
      total += 1;
      if (isDenyish(logicalDbRowStatus(node.row.id, undefined, excludedIds, initialDraft.excludedIds))) deny += 1;
      for (const child of node.children) {
        total += 1;
        if (isDenyish(logicalDbRowStatus(child.id, node.row.id, excludedIds, initialDraft.excludedIds))) deny += 1;
      }
    }
    return { total, keep: total - deny, deny };
  }, [tree, excludedIds, initialDraft.excludedIds]);

  // Query + state filter → visible nodes with their visible children.
  const visibleNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Array<{ node: LogicalDbNode; children: LogicalDatabase[] }> = [];
    for (const node of tree.nodes) {
      const dbStatus = logicalDbRowStatus(node.row.id, undefined, excludedIds, initialDraft.excludedIds);
      const dbMatchesQuery = !q || node.row.name.toLowerCase().includes(q);
      const children = node.children.filter((child) => {
        const s = logicalDbRowStatus(child.id, node.row.id, excludedIds, initialDraft.excludedIds);
        if (filter === 'keep' && isDenyish(s)) return false;
        if (filter === 'deny' && !isDenyish(s)) return false;
        if (q && !dbMatchesQuery) return child.name.toLowerCase().includes(q);
        return true;
      });
      const dbPassesFilter =
        filter === 'all' || (filter === 'keep' ? !isDenyish(dbStatus) : isDenyish(dbStatus));
      if (!dbMatchesQuery && children.length === 0) continue;
      if (!dbPassesFilter && children.length === 0) continue;
      out.push({ node, children });
    }
    return out;
  }, [tree, excludedIds, initialDraft.excludedIds, filter, query]);

  const dbMaxPage = Math.max(0, Math.ceil(visibleNodes.length / DB_PAGE_SIZE) - 1);
  const dbPageClamped = Math.min(dbPage, dbMaxPage);
  const windowNodes =
    visibleNodes.length > DB_PAGE_SIZE
      ? visibleNodes.slice(dbPageClamped * DB_PAGE_SIZE, dbPageClamped * DB_PAGE_SIZE + DB_PAGE_SIZE)
      : visibleNodes;

  const staged = useMemo(
    () => listStagedChanges(databases, { excludedIds, reasons }, initialDraft),
    [databases, excludedIds, reasons, initialDraft],
  );
  const pendingCount = staged.length;

  // Close the reason popover on any outside pointer-down.
  useEffect(() => {
    if (!reasonPickId) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && e.target instanceof Node && !popRef.current.contains(e.target)) {
        setReasonPickId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [reasonPickId]);

  const openReasonPick = (id: string) => {
    setPickedReason('STG');
    setReasonPickId(id);
  };

  const confirmExclude = () => {
    if (!reasonPickId) return;
    const id = reasonPickId;
    const node = tree.nodes.find((n) => n.row.id === id);
    const childIds = node ? node.children.map((c) => c.id) : [];
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      // DATABASE-scope exclusion absorbs schema-scope entries — they never coexist.
      for (const childId of childIds) next.delete(childId);
      return next;
    });
    setReasons((prev) => {
      const next: Record<string, SkipReason> = { ...prev, [id]: pickedReason };
      for (const childId of childIds) delete next[childId];
      return next;
    });
    setReasonPickId(null);
  };

  const removeExclusion = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setReasons((prev) => {
      if (!(id in prev)) return prev;
      const next: Record<string, SkipReason> = { ...prev };
      delete next[id];
      return next;
    });
  };

  /** Undo one staged change back to its saved state. */
  const undoStaged = (id: string, status: LogicalDbRowStatus) => {
    if (status === 'staged-exclude') {
      removeExclusion(id);
      return;
    }
    // staged-restore → re-add with the saved reason.
    setExcludedIds((prev) => new Set(prev).add(id));
    const savedReason = initialDraft.reasons[id];
    if (savedReason) setReasons((prev) => ({ ...prev, [id]: savedReason }));
  };

  const revertAll = () => {
    setExcludedIds(initialDraft.excludedIds);
    setReasons(initialDraft.reasons);
    setReasonPickId(null);
  };

  const handleSave = () => {
    onSave({ excludedIds, reasons });
  };

  const setListFilter = (next: ListFilter) => {
    setFilter(next);
    setDbPage(0);
    setSchemaPages({});
  };

  const onQueryChange = (next: string) => {
    setQuery(next);
    setDbPage(0);
    setSchemaPages({});
  };

  const unitDesc = tree.hasSchemaUnit
    ? 'Test Connection으로 조회된 논리 DB와 제외 목록이에요. Database 행에서 제외하면 하위 Schema까지, Schema 행에서 제외하면 그 스키마만 빠져요.'
    : 'Test Connection으로 조회된 논리 DB와 제외 목록이에요. 이 대상은 Database 단위로 조회·제외돼요.';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="logical-tree"
      chrome="bare"
      ariaLabel="논리 DB 목록"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className={cn('min-w-0 truncate text-[12px]', textColors.tertiary)}>
            {pendingCount === 0 ? (
              '변경 없음'
            ) : (
              <>
                <strong className={cn('tabular-nums', textColors.primary)}>
                  저장 전 변경 {pendingCount}건
                </strong>
                {' — '}
                {staged.map((change, i) => (
                  <span key={change.id}>
                    {i > 0 && ', '}
                    <span className="font-mono">{abbrevMiddle(change.name, 12, 8)}</span>{' '}
                    {change.action === 'exclude'
                      ? `제외(${reasonLabel(reasons[change.id])})`
                      : '복원'}
                  </span>
                ))}
              </>
            )}
          </span>
          <div className="flex shrink-0 gap-2">
            {pendingCount > 0 && (
              <Button variant="secondary" onClick={revertAll}>
                되돌리기
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" disabled={pendingCount === 0} onClick={handleSave}>
              저장
            </Button>
          </div>
        </div>
      }
    >
      {/* bare chrome: this block is the modal's own header. */}
      <h2 className={cn('text-[20px] font-bold leading-[1.2] tracking-[-0.02em]', textColors.primary)}>
        논리 DB 목록
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={cn('shrink-0 text-[12px] font-bold uppercase tracking-[0.06em]', textColors.tertiary)}>
          Resource
        </span>
        <span className={cn('break-all font-mono text-[14px] font-semibold', textColors.primary)}>
          {resourceName}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={cn(chipCls, tagStyles.gray)}>
          {tree.hasSchemaUnit ? 'Schema 단위 조회' : 'Database 단위 조회'}
          <Tooltip
            variant="value"
            size="lg"
            content={
              <span className={cn('block text-[12px] leading-[1.6]', textColors.secondary)}>
                물리 DB 클러스터 안의 논리적 데이터베이스예요. MySQL은 Database 단위,
                PostgreSQL은 Database 아래 Schema 단위로 조회돼요.
              </span>
            }
          >
            <InfoCircleIcon className={cn('h-3.5 w-3.5', textColors.tertiary)} aria-label="논리 DB 설명" />
          </Tooltip>
        </span>
        {/* Entry is gated on a successful run (설정 buttons disable until connected). */}
        <span className={cn(chipCls, statusColors.success.bg, statusColors.success.text)}>
          연결 테스트 성공
        </span>
      </div>
      <p className={cn('mt-2 text-[14px] font-medium leading-[1.5]', textColors.secondary)}>{unitDesc}</p>

      <div className="mt-4 flex items-center gap-3">
        <div className={segmentedControlStyles.container} role="group" aria-label="상태 필터">
          <FilterButton active={filter === 'all'} onClick={() => setListFilter('all')}>
            전체 {fmt(counts.total)}
          </FilterButton>
          <FilterButton active={filter === 'keep'} onClick={() => setListFilter('keep')}>
            수집 대상 {fmt(counts.keep)}
          </FilterButton>
          <FilterButton active={filter === 'deny'} onClick={() => setListFilter('deny')}>
            제외 {fmt(counts.deny)}
          </FilterButton>
        </div>
        <div
          className={cn(
            'flex h-9 flex-1 items-center gap-1.5 rounded-lg border px-2.5',
            bgColors.surface,
            borderColors.default,
          )}
        >
          <SearchIcon className={cn('h-3.5 w-3.5 shrink-0', textColors.quaternary)} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={tree.hasSchemaUnit ? 'Database / Schema 검색' : 'Database 검색'}
            className={cn('w-full bg-transparent text-[14px] outline-none', textColors.primary)}
            aria-label="논리 DB 검색"
          />
        </div>
      </div>
      <p className={cn('mt-2 text-[12px]', textColors.tertiary)}>
        제외한 DB는 다음 테스트부터 조회되지 않지만, 제외 목록에는 계속 남아 복원할 수 있어요.
      </p>

      <div className={cn('mt-3 h-[380px] overflow-y-auto rounded-lg border', borderColors.default)}>
        {windowNodes.length === 0 ? (
          <p className={cn('px-3 py-8 text-center text-[14px]', textColors.tertiary)}>
            조건에 맞는 결과가 없어요.
          </p>
        ) : (
          windowNodes.map(({ node, children }) => (
            <DbGroup
              key={node.row.id}
              node={node}
              visibleChildren={children}
              hasSchemaUnit={tree.hasSchemaUnit}
              open={!closedDbs.has(node.row.id)}
              onToggle={() =>
                setClosedDbs((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.row.id)) next.delete(node.row.id);
                  else next.add(node.row.id);
                  return next;
                })
              }
              schemaPage={schemaPages[node.row.id] ?? 0}
              onSchemaPage={(page) =>
                setSchemaPages((prev) => ({ ...prev, [node.row.id]: page }))
              }
              statusOf={statusOf}
              reasons={reasons}
              excludedIds={excludedIds}
              initialExcludedIds={initialDraft.excludedIds}
              reasonPickId={reasonPickId}
              pickedReason={pickedReason}
              onPickReason={setPickedReason}
              onOpenPick={openReasonPick}
              onCancelPick={() => setReasonPickId(null)}
              onConfirmPick={confirmExclude}
              onRestore={removeExclusion}
              onUndo={undoStaged}
              popRef={popRef}
            />
          ))
        )}
      </div>

      {visibleNodes.length > DB_PAGE_SIZE && (
        <div className={cn('mt-2 flex items-center gap-2 text-[12px]', textColors.secondary)}>
          <button
            type="button"
            className={cn(rowBtnCls, 'border disabled:opacity-40', borderColors.default, textColors.secondary)}
            disabled={dbPageClamped === 0}
            onClick={() => setDbPage(dbPageClamped - 1)}
          >
            이전
          </button>
          <button
            type="button"
            className={cn(rowBtnCls, 'border disabled:opacity-40', borderColors.default, textColors.secondary)}
            disabled={dbPageClamped === dbMaxPage}
            onClick={() => setDbPage(dbPageClamped + 1)}
          >
            다음
          </button>
          <span className="tabular-nums">
            Database {fmt(dbPageClamped * DB_PAGE_SIZE + 1)}–
            {fmt(dbPageClamped * DB_PAGE_SIZE + windowNodes.length)} / {fmt(visibleNodes.length)}
          </span>
          <span className={cn('ml-auto', textColors.tertiary)}>목록이 길면 검색으로 좁히는 게 빨라요</span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className={cn('mt-3 rounded-lg px-4 py-2.5 text-[14px]', statusColors.warning.bgSoft, textColors.secondary)}>
          <strong className={textColors.primary}>저장하면 연결 테스트를 다시 실행해야 해요.</strong>{' '}
          지금 보이는 결과는 제외가 반영되기 전 상태예요.
        </div>
      )}
    </Modal>
  );
};

const FilterButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      segmentedControlStyles.item,
      'tabular-nums',
      active && segmentedControlStyles.itemActive,
    )}
  >
    {children}
  </button>
);

interface DbGroupProps {
  node: LogicalDbNode;
  visibleChildren: LogicalDatabase[];
  hasSchemaUnit: boolean;
  open: boolean;
  onToggle: () => void;
  schemaPage: number;
  onSchemaPage: (page: number) => void;
  statusOf: (id: string, parentId?: string) => LogicalDbRowStatus;
  reasons: Readonly<Record<string, SkipReason>>;
  excludedIds: ReadonlySet<string>;
  initialExcludedIds: ReadonlySet<string>;
  reasonPickId: string | null;
  pickedReason: SkipReason;
  onPickReason: (reason: SkipReason) => void;
  onOpenPick: (id: string) => void;
  onCancelPick: () => void;
  onConfirmPick: () => void;
  onRestore: (id: string) => void;
  onUndo: (id: string, status: LogicalDbRowStatus) => void;
  popRef: React.RefObject<HTMLDivElement | null>;
}

const DbGroup = ({
  node,
  visibleChildren,
  hasSchemaUnit,
  open,
  onToggle,
  schemaPage,
  onSchemaPage,
  statusOf,
  reasons,
  excludedIds,
  initialExcludedIds,
  reasonPickId,
  pickedReason,
  onPickReason,
  onOpenPick,
  onCancelPick,
  onConfirmPick,
  onRestore,
  onUndo,
  popRef,
}: DbGroupProps) => {
  const dbStatus = statusOf(node.row.id);
  const parentStaged = dbStatus === 'staged-exclude';

  const maxSchemaPage = Math.max(0, Math.ceil(visibleChildren.length / SCHEMA_PAGE_SIZE) - 1);
  const pageClamped = Math.min(schemaPage, maxSchemaPage);
  const pagedChildren =
    visibleChildren.length > SCHEMA_PAGE_SIZE
      ? visibleChildren.slice(pageClamped * SCHEMA_PAGE_SIZE, pageClamped * SCHEMA_PAGE_SIZE + SCHEMA_PAGE_SIZE)
      : visibleChildren;

  const absorbedCount = node.children.filter((c) => excludedIds.has(c.id)).length;

  return (
    <>
      <Row
        row={node.row}
        status={dbStatus}
        isDb
        hasSchemaUnit={hasSchemaUnit}
        schemaCount={node.children.length}
        chevron={
          node.children.length > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={open ? `${node.row.name} 접기` : `${node.row.name} 펼치기`}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]',
                bgColors.mutedHover,
                open ? primaryColors.text : textColors.secondary,
              )}
            >
              <ChevronDownIcon className={cn('h-5 w-5 transition-transform', !open && '-rotate-90')} />
            </button>
          ) : (
            <span className="h-10 w-10 shrink-0" aria-hidden />
          )
        }
        reason={reasons[node.row.id]}
        parentStaged={false}
        onOpenPick={onOpenPick}
        onRestore={onRestore}
        onUndo={onUndo}
      />
      {reasonPickId === node.row.id && (
        <ReasonPanel
          row={node.row}
          isDb
          hasSchemaUnit={hasSchemaUnit}
          schemaCount={node.children.length}
          absorbedCount={absorbedCount}
          pickedReason={pickedReason}
          onPickReason={onPickReason}
          onCancelPick={onCancelPick}
          onConfirmPick={onConfirmPick}
          popRef={popRef}
        />
      )}
      {open &&
        pagedChildren.map((child) => (
          <Fragment key={child.id}>
            <Row
              row={child}
              status={statusOf(child.id, node.row.id)}
              isDb={false}
              hasSchemaUnit={hasSchemaUnit}
              schemaCount={0}
              chevron={null}
              reason={reasons[child.id]}
              parentStaged={parentStaged}
              onOpenPick={onOpenPick}
              onRestore={onRestore}
              onUndo={onUndo}
            />
            {reasonPickId === child.id && (
              <ReasonPanel
                row={child}
                isDb={false}
                hasSchemaUnit={hasSchemaUnit}
                schemaCount={0}
                absorbedCount={0}
                pickedReason={pickedReason}
                onPickReason={onPickReason}
                onCancelPick={onCancelPick}
                onConfirmPick={onConfirmPick}
                popRef={popRef}
              />
            )}
          </Fragment>
        ))}
      {open && visibleChildren.length > SCHEMA_PAGE_SIZE && (
        <div className={cn('relative flex items-center gap-2 border-b py-1.5 pl-14 pr-2', borderColors.light)}>
          <span aria-hidden className={cn('absolute bottom-0 left-6 top-0 w-px', logicalDbStyles.guide)} />
          <button
            type="button"
            className={cn(rowBtnCls, 'border disabled:opacity-40', borderColors.default, textColors.secondary)}
            disabled={pageClamped === 0}
            onClick={() => onSchemaPage(pageClamped - 1)}
          >
            이전
          </button>
          <button
            type="button"
            className={cn(rowBtnCls, 'border disabled:opacity-40', borderColors.default, textColors.secondary)}
            disabled={pageClamped === maxSchemaPage}
            onClick={() => onSchemaPage(pageClamped + 1)}
          >
            다음
          </button>
          <span className={cn('text-[12px] tabular-nums', textColors.secondary)}>
            {fmt(pageClamped * SCHEMA_PAGE_SIZE + 1)}–
            {fmt(pageClamped * SCHEMA_PAGE_SIZE + pagedChildren.length)} / {fmt(visibleChildren.length)}
          </span>
        </div>
      )}
    </>
  );
};

interface RowProps {
  row: LogicalDatabase;
  status: LogicalDbRowStatus;
  isDb: boolean;
  hasSchemaUnit: boolean;
  schemaCount: number;
  chevron: React.ReactNode;
  reason: SkipReason | undefined;
  /** For inherited children: whether the excluding parent is itself staged (blue rail) or saved (red). */
  parentStaged: boolean;
  onOpenPick: (id: string) => void;
  onRestore: (id: string) => void;
  onUndo: (id: string, status: LogicalDbRowStatus) => void;
}

const Row = ({
  row,
  status,
  isDb,
  hasSchemaUnit,
  schemaCount,
  chevron,
  reason,
  parentStaged,
  onOpenPick,
  onRestore,
  onUndo,
}: RowProps) => {
  const staged = status === 'staged-exclude' || status === 'staged-restore';
  const railStagedTone = status === 'staged-exclude' || (status === 'inherited' && parentStaged);
  const rail =
    status === 'deny' || status === 'staged-exclude' || status === 'inherited'
      ? railStagedTone
        ? logicalDbStyles.railStaged
        : logicalDbStyles.railDeny
      : null;
  const guideTone =
    status === 'inherited'
      ? parentStaged
        ? logicalDbStyles.guideStaged
        : logicalDbStyles.guideDeny
      : logicalDbStyles.guide;
  const branchTone =
    status === 'inherited'
      ? parentStaged
        ? logicalDbStyles.branchStaged
        : logicalDbStyles.branchDeny
      : logicalDbStyles.branch;

  const scopeHead = hasSchemaUnit && isDb ? 'Database 제외 · 하위 Schema 포함' : isDb ? 'Database 제외' : 'Schema 제외';
  const subLine =
    status === 'deny'
      ? `${scopeHead} · 사유: ${reasonLabel(reason)}${row.untested ? ' · 이번 테스트 미조회' : ''}`
      : status === 'staged-exclude'
        ? `${scopeHead.replace(' 제외', ' 제외 예정')} · 사유: ${reasonLabel(reason)}`
        : status === 'staged-restore'
          ? '복원 예정 — 저장하면 다음 테스트부터 다시 조회돼요'
          : null;

  const dimmed = status === 'inherited' || (row.untested && status !== 'staged-restore');

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 border-b py-2 pr-2',
        isDb ? cn('pl-2', logicalDbStyles.dbRow) : 'pl-14',
        borderColors.light,
        staged && logicalDbStyles.stagedRow,
        rail,
      )}
    >
      {!isDb && (
        <>
          <span aria-hidden className={cn('absolute bottom-0 left-6 top-0 w-px', guideTone)} />
          <span aria-hidden className={cn('shrink-0 text-[12px]', branchTone)}>
            └
          </span>
        </>
      )}
      {chevron}
      <span className="min-w-0 flex-1">
        <span
          title={row.name}
          className={cn(
            'block truncate font-mono text-[14px]',
            isDb ? 'font-semibold' : 'font-medium',
            dimmed ? textColors.tertiary : textColors.primary,
          )}
        >
          {row.name}
        </span>
        {subLine && (
          <span
            className={cn(
              'block truncate text-[12px] font-semibold',
              status === 'deny' ? logicalDbStyles.subDeny : logicalDbStyles.subPending,
            )}
          >
            {subLine}
          </span>
        )}
      </span>
      {isDb && hasSchemaUnit && (
        <span className={cn('shrink-0 text-[12px] font-medium', textColors.tertiary)}>
          Database{schemaCount > 0 ? ` · 스키마 ${fmt(schemaCount)}` : ''}
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1">
        {status === 'deny' && <span className={cn(chipCls, tagStyles.red)}>제외</span>}
        {status === 'staged-exclude' && (
          <>
            <span className={cn(chipCls, tagStyles.red)}>제외</span>
            <span className={cn(chipCls, tagStyles.info)}>저장 전</span>
          </>
        )}
        {status === 'staged-restore' && <span className={cn(chipCls, tagStyles.info)}>저장 전</span>}
        {status === 'inherited' && (
          <span className={cn(chipCls, tagStyles.neutral)}>↳ 상위 Database 제외에 포함</span>
        )}
      </span>
      <span className="w-[84px] shrink-0 text-right">
        {status === 'allow' && (
          <button
            type="button"
            onClick={() => onOpenPick(row.id)}
            className={cn(rowBtnCls, 'border', interactiveColors.unselectedBorder, textColors.secondary)}
          >
            제외
          </button>
        )}
        {status === 'deny' && (
          <button
            type="button"
            onClick={() => onRestore(row.id)}
            className={cn(rowBtnCls, buttonStyles.variants.soft)}
          >
            복원
          </button>
        )}
        {staged && (
          <button
            type="button"
            onClick={() => onUndo(row.id, status)}
            className={cn(rowBtnCls, 'border', interactiveColors.unselectedBorder, textColors.secondary)}
          >
            실행 취소
          </button>
        )}
      </span>
    </div>
  );
};

interface ReasonPanelProps {
  row: LogicalDatabase;
  isDb: boolean;
  hasSchemaUnit: boolean;
  schemaCount: number;
  absorbedCount: number;
  pickedReason: SkipReason;
  onPickReason: (reason: SkipReason) => void;
  onCancelPick: () => void;
  onConfirmPick: () => void;
  popRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Inline reason editor, rendered as a full-width row directly under the target.
 * Deliberately NOT a floating popover: the list is a fixed-height scroll
 * container, which clips anything absolutely positioned near its bottom edge.
 */
const ReasonPanel = ({
  row,
  isDb,
  hasSchemaUnit,
  schemaCount,
  absorbedCount,
  pickedReason,
  onPickReason,
  onCancelPick,
  onConfirmPick,
  popRef,
}: ReasonPanelProps) => (
  <div
    ref={popRef}
    className={cn('border-b px-4 py-3', isDb ? 'pl-4' : 'pl-14', borderColors.light, bgColors.muted)}
    onKeyDown={(e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancelPick();
      }
    }}
  >
    <p className={cn('text-[14px] font-bold', textColors.primary)}>제외 사유</p>
    <p className={cn('mt-1 text-[12px] leading-[1.5]', textColors.secondary)}>
      {isDb ? (
        <>
          <strong className="font-mono">{abbrevMiddle(row.name, 16, 12)}</strong> 전체가 제외돼요
          {hasSchemaUnit && schemaCount > 0 ? ` — 하위 스키마 ${fmt(schemaCount)}개 포함` : ''}
        </>
      ) : (
        <>
          <strong className="font-mono">{abbrevMiddle(row.name, 16, 12)}</strong> 스키마만 제외돼요
        </>
      )}
    </p>
    {isDb && absorbedCount > 0 && (
      <p className={cn('mt-1 text-[12px] font-semibold', logicalDbStyles.subDeny)}>
        기존 Schema 제외 {absorbedCount}건은 Database 제외로 합쳐져요.
      </p>
    )}
    <fieldset className="mt-2">
      <legend className="sr-only">제외 사유 선택</legend>
      <div className="flex items-center gap-4">
        {REASON_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn('flex cursor-pointer items-center gap-1.5 py-1 text-[14px]', textColors.secondary)}
          >
            <input
              type="radio"
              name="logical-db-skip-reason"
              value={opt.value}
              checked={pickedReason === opt.value}
              onChange={() => onPickReason(opt.value)}
            />
            {opt.label}
            <span className={cn('text-[12px]', textColors.tertiary)}>({opt.value})</span>
          </label>
        ))}
      </div>
    </fieldset>
    <div className="mt-2 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancelPick}
        className={cn(rowBtnCls, 'border', borderColors.default, textColors.secondary)}
      >
        취소
      </button>
      <button
        type="button"
        onClick={onConfirmPick}
        className={cn(rowBtnCls, primaryColors.bg, primaryColors.bgHover, textColors.inverse)}
      >
        제외 (저장 전에 추가)
      </button>
    </div>
  </div>
);
