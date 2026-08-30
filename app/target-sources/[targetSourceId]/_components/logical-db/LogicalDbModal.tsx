'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { AlertCircleIcon, CheckIcon, ChevronRightIcon, SearchIcon } from '@/app/components/ui/icons';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { fmtRelativeTime } from '@/lib/pipeline/format';
import {
  bgColors,
  borderColors,
  buttonStyles,
  cn,
  idcStyles,
  interactiveColors,
  logicalDbStyles,
  modalStyles,
  primaryColors,
  segmentedControlStyles,
  statusColors,
  tagStyles,
  textColors,
} from '@/lib/theme';
import type { SkipReason } from '@/app/lib/api/logical-db';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import {
  abbrevMiddle,
  buildLogicalDbTree,
  isDenyish,
  listStagedChanges,
  logicalDbRowStatus,
  logicalDbUnit,
  type LogicalDbNode,
  type LogicalDbRowStatus,
  type LogicalDbStagedChange,
} from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-tree';
import { logicalDbFailureCopy } from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-failures';
import {
  denyId,
  manualDenyRow,
  virtualParentRow,
} from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-deny';
import type {
  LogicalDatabase,
  LogicalDbModalDraft,
  LogicalDbModalProps,
  LogicalDbSaveResult,
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

/**
 * 사유 한 줄. `withCode` 면 wire enum 이 앞에 선다 — `TEMP · 임시`.
 *
 * 운영자 화면에서만 켠다: 로그와 BE 는 `STG`/`DEV`/`TEMP` 로 말하므로 그 둘을 맞춰보는
 * 사람에게 한국어만 주면 매번 머릿속에서 옮겨 적어야 한다. 요청자는 enum 을 쓸 일이 없으니
 * 라벨만 본다. 코드가 앞인 이유도 그것이다 — 맞춰보는 눈이 먼저 닿는 쪽이 코드다.
 */
const reasonLabel = (
  reason: SkipReason | undefined,
  opts?: { withCode?: boolean },
): string => {
  const label = REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason ?? '';
  return reason && opts?.withCode ? `${reason} · ${label}` : label;
};

/** 이 select 가 내놓을 수 있는 값은 REASON_OPTIONS 뿐이다 — DOM 문자열을 계약 enum 으로
 *  단언하는 대신 그 목록에 물어보고, 아닌 값은 받지 않는다. */
const isSkipReason = (value: string): value is SkipReason =>
  REASON_OPTIONS.some((option) => option.value === value);

/** Client-side windowing: the fetched lists are unpaginated, but the DOM must not be. */
const DB_PAGE_SIZE = 10;
const SCHEMA_PAGE_SIZE = 20;

const fmt = (n: number): string => n.toLocaleString('ko-KR');

type ListFilter = 'all' | 'keep' | 'deny';

/**
 * 열 폭. 고정 열 합 = 444, 이름 열은 나머지를 전부 먹는 sink 다 — `wide`(920) 모달의
 * 본문 상자 872 에서 이름 열은 ~428px 이 된다(옛 트리 목록의 ~282px 이 이 표를 만든
 * 첫 불만이었다).
 *
 * 액션 84 → **132**: 84 는 열 패딩이 없던 옛 목록에서 버튼이 서던 폭이었다. 표의 셀은
 * 좌우 18px 를 먼저 쓰므로 84 안에 남는 건 48px 이고, 가장 긴 라벨 `상위에서 복원`
 * (12px/600 + `px-2.5`)이 그 두 배를 넘는다. 132 − 36 = 96 이 그 버튼이 서는 최소 폭이다.
 *
 * flex 는 이름 **하나**다. 둘을 선언하면 sink 가 마지막 flex 열로 넘어가고(ConsoleTable
 * `slackSinkKey`) 이름은 제 바닥값의 지분(240/636)만큼만 퍼센트로 받아 ~329px 에 멈춘다 —
 * 이 표가 존재하는 이유가 그 폭이므로 단일 flex 를 고른다(IDC 표와 같은 판단). sink 는
 * 비지 않는다: 이름은 언제나 flex 이고, 끌고 있는 동안에도 `flex[flex.length - 1]` 폴백이
 * 역할을 그대로 쥔다.
 */
const LDB_COLUMNS: readonly ConsoleTableColumn[] = [
  { key: 'name', label: '이름', width: 240, flex: true, headClassName: idcStyles.table.nameCell },
  { key: 'unit', label: '단위', width: 96 },
  { key: 'status', label: '상태', width: 120 },
  { key: 'reason', label: '제외 사유', width: 96 },
  { key: 'action', label: '액션', width: 132 },
];

const chipCls = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold';
/** Field label of the identifier stack — same type as the `Resource` label it replaces. */
const identLabelCls = 'shrink-0 text-[12px] font-bold uppercase tracking-[0.06em]';
const rowBtnCls = 'inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold';
const outlineBtnCls = cn(rowBtnCls, 'border', interactiveColors.unselectedBorder, textColors.secondary);
const CELL = cn(idcStyles.table.approvalCell, idcStyles.table.consoleCell);
/** Full-width rows inside a group (reason editor, schema pager) — they span every column. */
const SPAN_ALL = LDB_COLUMNS.length;

/** A computed-style length as a number; jsdom hands back '' for anything it did not lay out. */
const cssPx = (value: string): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export const LogicalDbModal = ({
  open,
  resourceId,
  resourceName,
  databaseType,
  completedAt,
  databases,
  initialDraft = EMPTY_DRAFT,
  notice,
  manualEntry = false,
  onSave,
  saving = false,
  result = null,
  onRetry,
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
  /**
   * Rows the operator typed in — DBs this run never discovered, so no fetch can produce
   * them. They live here, beside the draft they belong to, and die with the modal.
   */
  const [manualRows, setManualRows] = useState<ReadonlyArray<LogicalDatabase>>([]);
  const [manualDatabase, setManualDatabase] = useState('');
  const [manualSchema, setManualSchema] = useState('');
  const [manualReason, setManualReason] = useState<SkipReason>('TEMP');
  const [manualError, setManualError] = useState<string | null>(null);
  /** The row that just landed — flashed once so the operator sees where the table put it. */
  const [flashId, setFlashId] = useState<string | null>(null);
  // Ephemeral by design — a modal's column widths die with the modal, the same call the
  // 승인 모달 makes in IdcResourceTable (a width dragged in a dialog is "let me see this
  // name", not a setting). `clampToContent` arms the double-click reveal on the handles.
  const resize = useColumnResize({ clampToContent: true });
  /**
   * The changes as they were WHEN 저장 WAS PRESSED. The draft state survives the save (the
   * table is still mounted behind the frame), so reading it live would let a later edit
   * rewrite what the ledger says was saved.
   */
  const [savedChanges, setSavedChanges] = useState<ReadonlyArray<SavedChange>>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  /** Card height and the height of the region the frame replaces — both from the LAST edit render. */
  const pinRef = useRef<number | null>(null);
  const floorRef = useRef<number | null>(null);

  /**
   * Everything the table draws: the fetched list plus whatever was typed in. EVERY consumer
   * of the draft reads this — the tree, the staged list and the save — because an id the
   * draft holds but the row list does not is silently dropped (`draftToExcludedItems`).
   */
  const allRows = useMemo(() => [...databases, ...manualRows], [databases, manualRows]);

  const tree = useMemo(() => buildLogicalDbTree(allRows), [allRows]);
  /**
   * ⛔ `databases`, NOT `allRows`. The unit is judged from what the run reported; a
   * hand-typed row is policy, and policy must never flip `Database 단위 조회`.
   */
  const unit = useMemo(() => logicalDbUnit(databases), [databases]);

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
    () => listStagedChanges(allRows, { excludedIds, reasons }, initialDraft),
    [allRows, excludedIds, reasons, initialDraft],
  );
  const pendingCount = staged.length;

  useLayoutEffect(() => {
    // ⛔ THE BOX DOES NOT MOVE. The result replaces the table and the footer, so without a
    // pin the card would shrink by ~500px at the exact moment the outcome is being read —
    // the jump becomes the first thing seen. `minHeight` only, so a long ledger can grow
    // rather than clip (`ConfirmStepModal` pins the same way, for the same reason).
    //
    // NO DEPENDENCY ARRAY, on purpose. The edit card is not one height: the 저장 전 변경
    // banner appears when the first change is staged — 53px of it, measured 707 → 760 — and
    // the Database pager appears past ten groups. Measuring once at open would pin a card
    // that had neither and shrink the box by exactly the layers the user added on the way
    // to pressing 저장, which is the jump the pin exists to prevent. The number is
    // therefore re-read on EVERY edit render, and only ever WRITTEN once the
    // result is standing: writing it in the edit state would ratchet (offsetHeight would
    // then be reading back the pin, so the card could never shrink again).
    //
    // Read into a ref rather than state: it is a measurement of the DOM, and feeding it
    // back through a render would be a round trip for a value React never draws with.
    const card = cardRef.current;
    if (!open || !card) return;
    if (!result) {
      pinRef.current = card.offsetHeight;
      // The frame stands BELOW the header, so its floor is the card minus everything the
      // card holds above it — the body's own padding and the header's height. Read off the
      // box rather than repeating the shell's `p-6` here.
      //
      // ⛔ SIZES, NOT POSITIONS. `headRef` lives inside the body, which scrolls
      // (`min-h-0 overflow-y-auto`): a tall edit table scrolls it, `head` slides up by
      // scrollTop, and a floor read from `head.bottom` comes out inflated by exactly that
      // much. Measured: scrolled 120px, the frame pinned at 472 in a 352 room and 닫기
      // landed 56px below the card — with ESC and backdrop-click both off, 닫기 is the
      // only exit there is.
      const head = headRef.current;
      const body = head?.parentElement ?? null;
      if (head && body) {
        const style = window.getComputedStyle(body);
        const floor =
          card.getBoundingClientRect().height -
          cssPx(style.paddingTop) -
          head.getBoundingClientRect().height -
          cssPx(style.paddingBottom);
        floorRef.current = floor > 0 ? floor : null;
      }
      return;
    }
    // The table is already gone in this render — both numbers come from the last edit one.
    //
    // ⛔ WRITTEN AS A CLAMP, NOT A NUMBER. `min-height` in px beats the card's
    // `max-h-[90vh]` (a min always wins a max), so a window shrunk while the frame stands
    // would push 닫기 below the viewport with no way back. `min(px, 90vh)` hands the
    // arbitration to the browser: it re-resolves on every viewport change, so there is no
    // resize listener and no extra render — the same pin, expressed so it cannot outgrow
    // the cap it lives under.
    const pin = pinRef.current;
    if (pin !== null) card.style.minHeight = `min(${pin}px, 90vh)`;
    const frame = frameRef.current;
    const floor = floorRef.current;
    if (!frame || floor === null) return;
    // min AND max at the same measured number: the frame is exactly the room the table and
    // the footer vacated, so a long ledger cannot push the card past the height it had.
    // The ledger is the only child that can give (everything else is `shrink-0`), so the
    // slack comes out of the list, which scrolls — never out of 닫기, which must stay put.
    //
    // Clamped for the same reason the card is, and by the same 90vh — minus whatever the
    // card holds above this frame (header + padding), measured in the same pass. So when
    // the viewport is the shorter of the two, the frame gives up exactly the room the card
    // no longer has, and the ledger scrolls instead of the box growing past the cap.
    const chrome = pin !== null ? Math.max(pin - floor, 0) : 0;
    const clamped = `min(${floor}px, calc(90vh - ${chrome}px))`;
    frame.style.minHeight = clamped;
    frame.style.maxHeight = clamped;
    // ...unless the room is so short that even a two-row ledger no longer fits. The list will
    // not shrink past that floor (`logicalDbStyles.result.ledgerList`), so when the frame's
    // content outgrows the ceiling, the ceiling is the thing that gives — an unreadable
    // ledger is worse than a box that moved. Does not arise at 920×760.
    //
    // Asking the frame whether it fits, rather than measuring the list against a number
    // repeated here: the floor is already spelled once, in the token that enforces it.
    // The 1px slack keeps sub-pixel rounding from reading as an overflow.
    if (frame.scrollHeight > frame.clientHeight + 1) frame.style.maxHeight = '';
  });

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
    setSavedChanges(
      staged.map((change) => ({ ...change, reason: reasons[change.id] })),
    );
    onSave({ excludedIds, reasons }, allRows);
  };

  /**
   * Add a DB the run never listed. It becomes a normal row of this table — `untested`, so it
   * carries `미조회` exactly like an excluded-only row does — and is staged at once, because
   * "제외 추가" is the only reason anyone types a name in here.
   */
  const addManualRow = () => {
    const database = manualDatabase.trim();
    const schema = manualSchema.trim() || undefined;
    if (!database) {
      setManualError('Database 이름을 입력해 주세요.');
      return;
    }
    const id = denyId({ database, schema });
    if (allRows.some((row) => row.id === id)) {
      setManualError('이미 목록에 있습니다.');
      return;
    }
    setManualRows((prev) => [
      ...prev,
      manualDenyRow({ database, schema }),
      // 이 schema 의 DATABASE 부모가 아직 아무 행도 아니면 함께 앉힌다 — 트리는 그룹 머리를
      // 자리표시자로 그리지만, 그 머리를 제외하는 순간 행 없는 id 가 되어 저장 전 변경에서도
      // PUT 몸통에서도 조용히 사라진다(`virtualParentRow`). 조회된 schema 행이 이미 받는 것과
      // 같은 대접이고, 손으로 적은 이름이라 `미조회` 를 함께 단다.
      ...(schema && !allRows.some((row) => row.id === database)
        ? [virtualParentRow(database, { untested: true })]
        : []),
    ]);
    setExcludedIds((prev) => new Set(prev).add(id));
    setReasons((prev) => ({ ...prev, [id]: manualReason }));
    // The two names clear, the reason stays — a run of adds is usually one reason.
    setManualDatabase('');
    setManualSchema('');
    setManualError(null);
    setFlashId(id);
  };

  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [flashId]);

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

  /**
   * ⛔ 모르는 것과 없는 것은 다른 사실이다. `notice` 가 서 있다는 건 이번 실행의 조회 목록을
   * **읽지 못했다**는 뜻이라, 이 화면은 그 실행이 무엇을 찾았는지 말할 자격이 없다. 판정이
   * 없는 채로 `조회된 논리 DB 없음` 이라고 하면, 실패를 결과로 바꿔 말하는 것이다.
   *
   * 판정이 있으면 판정이 이긴다 — 조회를 못 읽었다는 사실이 지우는 건 판정이 아니라 **없다는
   * 주장** 뿐이다(오늘 `notice` 는 정책만 있는 화면에서만 서므로 unit 은 늘 null 이다).
   */
  const discoveryUnavailable = !!notice;

  /**
   * The unit-specific rule, now the tooltip body rather than a header layer. The old
   * paragraph opened with "Test Connection으로 조회된 논리 DB와 제외 목록이에요" — that half is
   * the screen's purpose and stays visible in the header; only the rule moves in here.
   */
  const unitTip =
    unit === 'schema'
      ? 'Database 행에서 제외하면 하위 Schema까지, Schema 행에서 제외하면 그 스키마만 빠져요.'
      : unit === 'database'
        ? '이 대상은 Database 단위로 조회·제외돼요.'
        : discoveryUnavailable
          ? '최근 연결 테스트의 조회 결과를 읽지 못해 단위를 판정할 수 없어요.'
          : // One sentence for "this run found nothing", whatever else the list holds. The
            // branch that used to split on `databases.length > 0` told the reader the rows
            // below were the skip policy — but that list can be empty too, and then the
            // sentence promised a list that was not there. Only the first clause is true in
            // both cases, so only the first clause is said.
            '이번 Test Connection에서 조회된 논리 DB가 없어요.';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      cardRef={cardRef}
      // 720 → 920. The five columns spend 444 on fixed widths, so at 720 (본문 상자 672)
      // the name column would land on 228 — narrower than the tree list it replaces, which
      // is the complaint this redesign started from. 872 gives it ~428.
      size="wide"
      chrome="bare"
      ariaLabel="논리 DB 관리"
      // 결과가 서 있는 동안, 그리고 저장이 나가 있는 동안에는 닫기만이 나가는 길이다: 스치는
      // ESC 나 바깥 클릭 한 번에 방금 벌어진 일이 사라져서는 안 되고, 비활성화된 취소 옆에서
      // 살아 있는 ESC 는 같은 화면이 두 말을 하는 것이다.
      closeOnEscape={!result && !saving}
      closeOnBackdropClick={!result && !saving}
      footer={
        result ? undefined : (
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
                      ? `제외(${reasonLabel(reasons[change.id], { withCode: manualEntry })})`
                      : '복원'}
                  </span>
                ))}
              </>
            )}
          </span>
          <div className="flex shrink-0 gap-2">
            {pendingCount > 0 && (
              <Button variant="secondary" disabled={saving} onClick={revertAll}>
                되돌리기
              </Button>
            )}
            <Button variant="secondary" disabled={saving} onClick={onClose}>
              취소
            </Button>
            {/* 저장 중은 프레임이 아니라 버튼의 상태다 — 표는 있던 자리에 그대로 있고,
                방금 누른 손 아래에서 아무것도 움직이지 않는다. */}
            <Button
              variant="primary"
              className="inline-flex items-center gap-1.5"
              disabled={saving || pendingCount === 0}
              onClick={handleSave}
            >
              {saving && <LoadingSpinner size="sm" />}
              {saving ? '저장 중' : '저장'}
            </Button>
          </div>
        </div>
        )
      }
    >
      {/* bare chrome: this block is the modal's own header. It OUTLIVES the table — the
          result frame stands under it, so the box that reports the outcome is still the box
          that names the resource it happened to. */}
      <div ref={headRef}>
      <h2 className={cn('text-[20px] font-bold leading-[1.2] tracking-[-0.02em]', textColors.primary)}>
        논리 DB 관리
      </h2>
      {/* Provenance in the `[명사][동사] [상대시각]` grammar Step 4/5 already use
          (`fmtRelativeTime`): this list is whatever one connection-test run found, so the
          header names that run. No freshness judgment — the elapsed time is the whole
          statement. Dropped, not guessed, when the caller has no settled run. */}
      {completedAt && (
        <p className={cn('mt-1 text-[12px] font-medium', textColors.tertiary)}>
          연결 테스트 완료 · {fmtRelativeTime(completedAt)}
        </p>
      )}
      {/* Identifier stack in the table's grammar — truncate + tooltip + copy (ResourceIdCell).
          A `title` alone would leave the full value out of reach for keyboard and screen
          readers, and the id is the only thing that distinguishes two same-named resources. */}
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
        {resourceName && (
          <>
            <span className={cn(identLabelCls, textColors.tertiary)}>Resource Name</span>
            <ResourceIdCell
              value={resourceName}
              label="Resource Name"
              maxWidthClass="max-w-full"
              sizeClass="text-[14px]"
              textClassName={cn(textColors.primary, 'font-semibold')}
            />
          </>
        )}
        <span className={cn(identLabelCls, textColors.tertiary)}>Resource ID</span>
        <ResourceIdCell
          value={resourceId}
          label="Resource ID"
          maxWidthClass="max-w-full"
          sizeClass="text-[14px]"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {/* 엔진 배지 — 여러 리소스를 훑는 운영자는 이름만으로 무슨 엔진인지 알 수 없다.
            넘어오지 않은 화면(요청자)에서는 배지 자체가 없다. */}
        {databaseType && (
          <span className={cn(chipCls, tagStyles.blue)}>{getDatabaseShortLabel(databaseType)}</span>
        )}
        {/* Unit is judged from tested rows only (never the excluded policy). When
            nothing was tested there is no judgment — plain state text, and when the run's
            list could not be READ (`unitUnknown`) there is not even that: the chip goes.
            TODO(contract): once the backend declares the unit per resource
            (e.g. `logical_database_unit`), promote the judgment to that field. */}
        <span className={cn(chipCls, tagStyles.gray)}>
          {unit === 'schema'
            ? 'Schema 단위 조회'
            : unit === 'database'
              ? 'Database 단위 조회'
              : discoveryUnavailable
                ? '조회 결과 미확인'
                : '조회된 논리 DB 없음'}
        </span>
        {/* Light `value` box, not the dark default: the identifier tooltips beside it are
            light, and one header should not answer two hovers in two popover languages. */}
        <InfoTooltip
          variant="value"
          iconSize={14}
          label="논리 DB 조회·제외 안내"
          content={
            <div className="space-y-1.5">
              <p>{unitTip}</p>
              <p>제외한 DB는 다음 테스트부터 조회되지 않지만, 제외 목록에는 계속 남아 복원할 수 있어요.</p>
            </div>
          }
        />
        <p className={cn('text-[14px] font-medium leading-[1.5]', textColors.secondary)}>
          조회된 논리 DB를 확인하고, 수집에서 제외할 DB를 골라요.
        </p>
      </div>
      </div>
      {/* 손으로 행을 더할 수 있는 화면에서만 — 저장이 목록 전체를 바꾼다는 사실은 그 손이
          알아야 할 것이고, 요청자 화면의 문장은 하나 그대로 둔다.
          ⛔ 그리고 편집 중에만. 결과가 선 아래에서 `저장하면 … 교체돼요` 는 이미 벌어진 일에
          대고 하는 지시다.
          ⛔ `headRef` **밖**이다(자리는 그대로, 바로 아래). 안에 두면 머리가 결과 순간에 이
          줄만큼 짧아지는데, 바닥은 마지막 편집 렌더에서 잰 것이라 프레임 아래에 딱 그만큼
          여백이 남는다 — 상자는 움직이지 않아야 한다. */}
      {manualEntry && !result && (
        <p className={logicalDbStyles.replaceWarn}>
          저장하면 제외 목록 전체가 교체돼요. 목록에서 뺀 항목은 제외가 해제됩니다.
        </p>
      )}

      {result ? (
        <SaveResultFrame
          result={result}
          saving={saving}
          changes={savedChanges}
          rawReason={manualEntry}
          frameRef={frameRef}
          onRetry={onRetry}
          onClose={onClose}
        />
      ) : (
      <>
      {notice && (
        <p role="status" className={logicalDbStyles.notice}>
          {notice}
        </p>
      )}
      {/* 표 밖에 선다 — 표에는 필터와 페이저가 있어서, 표 끝에 매단 입력 행은 그 둘 아래로
          사라진다. 여기서는 어떤 필터를 걸어도 같은 자리에 있다. */}
      {manualEntry && (
        <div className={logicalDbStyles.manual.box}>
          <div className={logicalDbStyles.manual.label}>제외 추가</div>
          <div className={logicalDbStyles.manual.row}>
            <input
              aria-label="Database 이름"
              value={manualDatabase}
              onChange={(e) => {
                setManualDatabase(e.target.value);
                setManualError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addManualRow();
              }}
              placeholder="database"
              autoComplete="off"
              spellCheck={false}
              className={cn(logicalDbStyles.manual.field, logicalDbStyles.manual.fieldDatabase)}
            />
            <input
              aria-label="Schema 이름 (선택)"
              value={manualSchema}
              onChange={(e) => {
                setManualSchema(e.target.value);
                setManualError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addManualRow();
              }}
              placeholder="schema (선택)"
              autoComplete="off"
              spellCheck={false}
              className={cn(logicalDbStyles.manual.field, logicalDbStyles.manual.fieldSchema)}
            />
            {/* 사유는 이 모달이 이미 쓰는 한국어 라벨이다 — 같은 화면에서 같은 사유가 한 번은
                `임시`, 한 번은 `TEMP` 로 불리면 두 가지처럼 읽힌다. */}
            <select
              aria-label="추가할 제외 사유"
              value={manualReason}
              onChange={(e) => {
                if (isSkipReason(e.target.value)) setManualReason(e.target.value);
              }}
              className={logicalDbStyles.manual.select}
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {reasonLabel(option.value, { withCode: true })}
                </option>
              ))}
            </select>
            {/* 범위는 schema 칸이 정한다 — 누르기 전에 무엇이 제외될지 여기서 읽힌다. */}
            <span className={cn(chipCls, tagStyles.gray)}>
              {manualSchema.trim() ? 'SCHEMA' : 'DATABASE'}
            </span>
            <Button variant="secondary" onClick={addManualRow}>
              추가
            </Button>
            <span className={logicalDbStyles.manual.hint}>schema를 비우면 database 전체</span>
          </div>
          {manualError && (
            <p role="alert" className={logicalDbStyles.manual.error}>
              {manualError}
            </p>
          )}
        </div>
      )}
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
      {/* `group/ldb-table` is what the idle spine listens to — a NAMED group, because a bare
          `group-hover` leaks into any nested group a cell might grow later. */}
      <div
        className={cn(
          'group/ldb-table mt-3 h-[380px] overflow-y-auto rounded-lg border',
          borderColors.default,
        )}
      >
        <ConsoleTable columns={LDB_COLUMNS} resize={resize}>
          {windowNodes.length === 0 ? (
            <tbody className={idcStyles.table.body}>
              <tr>
                <td colSpan={SPAN_ALL} className={cn('px-[18px] py-8 text-center text-[14px]', textColors.tertiary)}>
                  {databases.length > 0
                    ? '조건에 맞는 결과가 없어요.'
                    : discoveryUnavailable
                      ? // 표가 비었다고 이번 실행이 아무것도 못 찾았다고 말할 수는 없다 —
                        // 우리가 읽지 못한 것이다.
                        '조회 결과를 읽지 못했어요.'
                      : '조회된 논리 DB가 없어요.'}
                </td>
              </tr>
            </tbody>
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
                flashId={flashId}
                reasonPickId={reasonPickId}
                pickedReason={pickedReason}
                onPickReason={setPickedReason}
                onOpenPick={openReasonPick}
                onCancelPick={() => setReasonPickId(null)}
                onConfirmPick={confirmExclude}
                onRestore={removeExclusion}
                onUndo={undoStaged}
                rawReason={manualEntry}
                popRef={popRef}
              />
            ))
          )}
        </ConsoleTable>
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
      </>
      )}
    </Modal>
  );
};

/** One saved change, frozen at the moment 저장 fired — its reason travels with it. */
interface SavedChange extends LogicalDbStagedChange {
  reason?: SkipReason;
}

interface SaveResultFrameProps {
  result: LogicalDbSaveResult;
  saving: boolean;
  changes: ReadonlyArray<SavedChange>;
  /** 원장의 사유가 wire enum 을 함께 쓰는가 — 표와 같은 답이어야 한다(운영자 화면만). */
  rawReason: boolean;
  frameRef: React.RefObject<HTMLDivElement | null>;
  onRetry?: () => void;
  onClose: () => void;
}

/** `제외 2건 · 복원 1건이 정책에 반영됐어요.` — a clause that counted nothing is dropped
 *  rather than printed as `0건`, which would name a change that never happened. */
const savedSummary = (changes: ReadonlyArray<SavedChange>): string => {
  const excluded = changes.filter((change) => change.action === 'exclude').length;
  const restored = changes.length - excluded;
  const clauses: string[] = [];
  if (excluded > 0) clauses.push(`제외 ${fmt(excluded)}건`);
  if (restored > 0) clauses.push(`복원 ${fmt(restored)}건`);
  if (clauses.length === 0) return '제외 설정이 정책에 반영됐어요.';
  return `${clauses.join(' · ')}이 정책에 반영됐어요.`;
};

/**
 * 저장의 결과를 이 모달 안에서 말하는 프레임 — 표와 푸터가 있던 자리에 선다.
 *
 * toast 였을 때는 결과가 모달 뒤에서 4초 살다 사라졌다. 무엇이 저장됐는지는 방금 고른
 * 목록 옆에서 답해야 할 질문이라, 원장(무엇이) 과 다음 할 일(언제 반영되나) 이 함께 선다.
 *
 * 실패해도 프레임은 실패에 머문다: 다시 저장하기가 도는 동안 버튼만 스피너로 바뀌고,
 * 성공했을 때만 프레임이 넘어간다.
 */
const SaveResultFrame = ({
  result,
  saving,
  changes,
  rawReason,
  frameRef,
  onRetry,
  onClose,
}: SaveResultFrameProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const failure = result.kind === 'error' ? logicalDbFailureCopy(result.code) : null;
  /**
   * 저장이 서버에 남았는가 — `stale` 도 남았다(PUT 은 끝났고 그 뒤의 재조회만 실패했다).
   * 원장과 "다음 연결 테스트부터" 는 이 사실에 달려 있지, 목록을 다시 읽었는지에 달려 있지 않다.
   */
  const wrote = result.kind !== 'error';
  // 다시 눌러도 같은 실패인 코드에는 버튼을 주지 않는다 — 권한이 없는 사람에게 다시
  // 저장하기를 내미는 것은 없는 길을 가리키는 것이다.
  const canRetry = failure?.retry === true && !!onRetry;

  useEffect(() => {
    // The controls that held focus were unmounted with the table, so focus would fall to
    // <body> and Tab would walk the page behind an aria-modal dialog. A disabled button
    // cannot hold focus either, so this waits for a running retry to settle.
    if (saving) return;
    (retryRef.current ?? closeRef.current)?.focus();
  }, [saving]);

  return (
    <div
      ref={frameRef}
      className={logicalDbStyles.result.frame}
      // 프레임이 곧 알림이다 — 열릴 때 읽힌 대화상자를 대신하므로, 실패는 끼어들어야 한다.
      role={result.kind === 'error' ? 'alert' : 'status'}
      aria-live={result.kind === 'error' ? 'assertive' : 'polite'}
    >
      <div
        className={cn(
          logicalDbStyles.result.tile,
          result.kind === 'success'
            ? cn(statusColors.success.bg, statusColors.success.textDark)
            : result.kind === 'stale'
              ? // 저장은 됐다 — 빨강은 안 한 일을 했다고 말한다. 주의는 목록 쪽이다.
                cn(statusColors.warning.bg, statusColors.warning.textDark)
              : cn(statusColors.error.bg, statusColors.error.textDark),
        )}
      >
        {/* 성공은 그려지는 체크(`draw` = scanTransition.checkDraw), 나머지는 느낌표 동그라미.
            둘 다 아이콘 배럴의 것이다 — 같은 글리프를 프레임마다 다시 그리면 하나만 고쳐진다. */}
        {result.kind === 'success' ? (
          <CheckIcon className="h-10 w-10" draw />
        ) : (
          <AlertCircleIcon className="h-[38px] w-[38px]" />
        )}
      </div>
      <h3 className={logicalDbStyles.result.title}>
        {result.kind === 'success'
          ? '논리 DB 제외 설정을 저장했어요'
          : result.kind === 'stale'
            ? '저장은 됐지만 목록을 다시 읽지 못했어요'
            : '제외 설정을 저장하지 못했어요'}
      </h3>
      <p className={logicalDbStyles.result.desc}>
        {result.kind === 'success'
          ? savedSummary(changes)
          : result.kind === 'stale'
            ? '제외 설정은 저장됐어요. 최신 목록은 모달을 다시 열면 보여요.'
            : '서버의 제외 정책은 그대로예요.'}
      </p>
      {failure && <p className={logicalDbStyles.result.reason}>{failure.reason}</p>}
      {wrote ? (
        <>
          {changes.length > 0 && (
            <div className={logicalDbStyles.result.ledger}>
              <div className={logicalDbStyles.result.ledgerHead}>
                <span>저장된 변경</span>
                <span className="tabular-nums">{fmt(changes.length)}건</span>
              </div>
              <div className={logicalDbStyles.result.ledgerList}>
                {changes.map((change) => (
                  <div key={change.id} className={logicalDbStyles.result.ledgerRow}>
                    <span
                      className={cn(
                        logicalDbStyles.statusDot,
                        change.action === 'exclude'
                          ? logicalDbStyles.statusDotDeny
                          : logicalDbStyles.statusDotKeep,
                      )}
                    />
                    <span className={logicalDbStyles.result.ledgerName}>{change.name}</span>
                    <span className={logicalDbStyles.result.ledgerValue}>
                      {change.action === 'exclude'
                        ? `제외${change.reason ? ` (${reasonLabel(change.reason, { withCode: rawReason })})` : ''}`
                        : '복원'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className={logicalDbStyles.result.nextBox}>
            이 정책은 <strong className="font-semibold">다음 연결 테스트부터</strong> 반영돼요.
            지금 적용하려면 연결 테스트를 다시 실행해 주세요.
          </p>
        </>
      ) : (
        <p className={logicalDbStyles.result.keptBox}>
          고른 변경 {fmt(changes.length)}건은 그대로 있어요. 닫으면 사라져요.
        </p>
      )}
      <div className={logicalDbStyles.result.actions}>
        <button
          ref={closeRef}
          type="button"
          className={modalStyles.confirm.cancelBtn}
          disabled={saving}
          onClick={onClose}
        >
          닫기
        </button>
        {canRetry && (
          <button
            ref={retryRef}
            type="button"
            className={modalStyles.confirm.primaryBtn}
            disabled={saving}
            onClick={onRetry}
          >
            {/* 재시도는 이 프레임 위에서 돈다 — 스피너가 프레임이 아니라 라벨 옆을 대신하므로
                아래의 아무것도 움직이지 않는다. */}
            {saving && <LoadingSpinner size="sm" />}
            다시 저장하기
          </button>
        )}
      </div>
    </div>
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
  /** The hand-typed row that just landed, if any — it flashes once, then goes quiet. */
  flashId: string | null;
  reasonPickId: string | null;
  pickedReason: SkipReason;
  onPickReason: (reason: SkipReason) => void;
  onOpenPick: (id: string) => void;
  onCancelPick: () => void;
  onConfirmPick: () => void;
  onRestore: (id: string) => void;
  onUndo: (id: string, status: LogicalDbRowStatus) => void;
  /** 사유 칸이 wire enum 을 함께 보이는가 — 운영자 화면만 true(`reasonLabel`). */
  rawReason: boolean;
  popRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * One Database and its Schemas — a single `<tbody>`, so `idcStyles.table.tbodySeam` keeps
 * the hairline rhythm between groups and `body`'s divide-y keeps it inside one.
 */
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
  flashId,
  reasonPickId,
  pickedReason,
  onPickReason,
  onOpenPick,
  onCancelPick,
  onConfirmPick,
  onRestore,
  onUndo,
  rawReason,
  popRef,
}: DbGroupProps) => {
  const dbStatus = statusOf(node.row.id);
  /**
   * The excluded RUN — the only thing that lights the spine amber. An individually excluded
   * Schema is not a run: nothing hangs off it, so its rail stays the neutral one and the amber
   * stays a claim about a parent that actually covers children.
   */
  const runExcluded = isDenyish(dbStatus);
  const spineTone = runExcluded ? logicalDbStyles.spineExcluded : logicalDbStyles.spineIdle;

  const maxSchemaPage = Math.max(0, Math.ceil(visibleChildren.length / SCHEMA_PAGE_SIZE) - 1);
  const pageClamped = Math.min(schemaPage, maxSchemaPage);
  const pagedChildren =
    visibleChildren.length > SCHEMA_PAGE_SIZE
      ? visibleChildren.slice(pageClamped * SCHEMA_PAGE_SIZE, pageClamped * SCHEMA_PAGE_SIZE + SCHEMA_PAGE_SIZE)
      : visibleChildren;

  const absorbedCount = node.children.filter((c) => excludedIds.has(c.id)).length;
  const hasRun = open && pagedChildren.length > 0;

  return (
    <tbody className={idcStyles.table.body}>
      <Row
        row={node.row}
        status={dbStatus}
        isDb
        hasSchemaUnit={hasSchemaUnit}
        schemaCount={node.children.length}
        parentName={undefined}
        parentId={undefined}
        parentReason={undefined}
        spineTone={spineTone}
        spineClass={hasRun ? logicalDbStyles.spineParent : undefined}
        flash={flashId === node.row.id}
        toggle={
          node.children.length > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={open ? `${node.row.name} 접기` : `${node.row.name} 펼치기`}
              className={cn(
                idcStyles.table.group.toggle,
                open ? idcStyles.table.group.toggleOpen : idcStyles.table.group.toggleClosed,
                primaryColors.focusRing,
              )}
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          ) : null
        }
        reason={reasons[node.row.id]}
        rawReason={rawReason}
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
          // The picker can only open on an `allow` row, so the run it sits in is never the
          // excluded one — the bridge is always the neutral rail.
          bridge={hasRun}
          pickedReason={pickedReason}
          onPickReason={onPickReason}
          onCancelPick={onCancelPick}
          onConfirmPick={onConfirmPick}
          popRef={popRef}
        />
      )}
      {open &&
        pagedChildren.map((child, i) => (
          <Fragment key={child.id}>
            <Row
              row={child}
              status={statusOf(child.id, node.row.id)}
              isDb={false}
              hasSchemaUnit={hasSchemaUnit}
              schemaCount={0}
              parentName={node.row.name}
              parentId={node.row.id}
              parentReason={reasons[node.row.id]}
              spineTone={spineTone}
              spineClass={cn(
                logicalDbStyles.spineChild,
                i === pagedChildren.length - 1 && logicalDbStyles.spineChildLast,
              )}
              flash={flashId === child.id}
              toggle={null}
              reason={reasons[child.id]}
              rawReason={rawReason}
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
                bridge={i < pagedChildren.length - 1}
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
        <tr>
          <td colSpan={SPAN_ALL} className="py-1.5 pl-[54px] pr-[18px]">
            <div className="flex items-center gap-2">
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
          </td>
        </tr>
      )}
    </tbody>
  );
};

/**
 * The 상태 cell — an 8px dot plus the word, the count-row grammar PR #746 shipped
 * (`idcStyles.connProgress.countDot`). The filled 제외/저장 전 pills are gone: 수집 is ~80%
 * of the rows, and a filled chip on every one of them made the quietest fact the loudest
 * thing on screen. The word is never dropped — the dot is a second channel, not the only one.
 */
const statusDot = (status: LogicalDbRowStatus): string => {
  switch (status) {
    case 'deny':
    case 'inherited':
      return logicalDbStyles.statusDotDeny;
    case 'staged-exclude':
    case 'staged-restore':
      return logicalDbStyles.statusDotStaged;
    default:
      return logicalDbStyles.statusDotKeep;
  }
};

/**
 * Inherited rows name the ANCESTOR, not the relationship — Azure's `(Inherited)` grammar,
 * where the subject is the thing that decided and the state is the suffix. The old 176px
 * `↳ 상위 Database 제외에 포함` chip said the same thing without ever saying WHICH database.
 */
const statusText = (
  status: LogicalDbRowStatus,
  parentName: string | undefined,
): string => {
  switch (status) {
    case 'deny':
      return '제외';
    case 'staged-exclude':
      return '제외 · 저장 전';
    case 'staged-restore':
      return '복원 · 저장 전';
    case 'inherited':
      return `제외 · ${parentName ?? '상위'}`;
    default:
      return '수집';
  }
};

interface RowProps {
  row: LogicalDatabase;
  status: LogicalDbRowStatus;
  isDb: boolean;
  hasSchemaUnit: boolean;
  schemaCount: number;
  /** Excluding ancestor's name — the subject of an inherited row's status and action. */
  parentName: string | undefined;
  /** …and its id, which is what `onRestore` acts on. A virtual parent's id is its database
   *  name, a real one's is not — the two must never be conflated. */
  parentId: string | undefined;
  /** The ancestor's skip reason: the one that actually applies to an inherited row. */
  parentReason: SkipReason | undefined;
  /** `spineExcluded` | `spineIdle` — which ink the rail draws in. */
  spineTone: string;
  /** The rail geometry this row carries, or undefined when it is not part of a run. */
  spineClass: string | undefined;
  /** This row was just typed in — sweep it once so the eye finds where it landed. */
  flash: boolean;
  toggle: React.ReactNode;
  reason: SkipReason | undefined;
  /** 사유를 `임시 (TEMP)` 로 쓸 것인가 — 운영자 화면만. */
  rawReason: boolean;
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
  parentName,
  parentId,
  parentReason,
  spineTone,
  spineClass,
  flash,
  toggle,
  reason,
  rawReason,
  onOpenPick,
  onRestore,
  onUndo,
}: RowProps) => {
  const staged = status === 'staged-exclude' || status === 'staged-restore';
  const dimmed = status === 'inherited' || (row.untested && status !== 'staged-restore');
  // `미조회` rides beside the name, not in 상태: it is a fact about this NAME (the policy
  // outlived the run that would have listed it), while 상태 answers "collected or not".
  const meta = [
    isDb && hasSchemaUnit && schemaCount > 0 ? `스키마 ${fmt(schemaCount)}` : null,
    row.untested ? '미조회' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const shownReason =
    status === 'deny' || status === 'staged-exclude'
      ? reasonLabel(reason, { withCode: rawReason })
      : status === 'inherited'
        ? reasonLabel(parentReason, { withCode: rawReason })
        : '';

  return (
    <tr
      className={cn(
        staged ? logicalDbStyles.stagedRow : idcStyles.table.group.row,
        flash && logicalDbStyles.flashRow,
      )}
    >
      <td className={cn(CELL, idcStyles.table.nameCell, spineTone, spineClass)}>
        <span className={idcStyles.table.group.lead}>
          {toggle}
          <span
            title={row.name}
            className={cn(
              'min-w-0 truncate font-mono text-[14px]',
              isDb ? 'font-semibold' : 'font-medium',
              dimmed ? textColors.tertiary : textColors.primary,
            )}
          >
            {row.name}
          </span>
          {meta && (
            <span className={cn('shrink-0 text-[12px] tabular-nums', textColors.tertiary)}>{meta}</span>
          )}
        </span>
      </td>
      <td className={cn(CELL, 'text-[12px]', textColors.tertiary)}>{isDb ? 'Database' : 'Schema'}</td>
      <td className={cn(CELL, 'text-[12px]', textColors.secondary)}>
        <span className={logicalDbStyles.statusCell}>
          <span aria-hidden className={cn(logicalDbStyles.statusDot, statusDot(status))} />
          {statusText(status, parentName)}
        </span>
      </td>
      <td className={cn(CELL, 'text-[12px]', status === 'inherited' ? textColors.tertiary : textColors.secondary)}>
        {shownReason}
      </td>
      <td className={cn(CELL, 'text-right')}>
        {status === 'allow' && (
          <button type="button" onClick={() => onOpenPick(row.id)} className={outlineBtnCls}>
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
          <button type="button" onClick={() => onUndo(row.id, status)} className={outlineBtnCls}>
            실행 취소
          </button>
        )}
        {/* An inherited child cannot be restored on its own — the exclusion is the parent's —
            but it must still carry a control: stripping it leaves a row a user can read and
            not act on, and no console we checked does that (Cloudscape's expandable rows keep
            every child individually operable). The button names where the change lands. */}
        {status === 'inherited' && parentId && (
          <button
            type="button"
            onClick={() => onRestore(parentId)}
            title={`${parentName} 제외를 복원해요 — ${row.name} 포함`}
            className={outlineBtnCls}
          >
            상위에서 복원
          </button>
        )}
      </td>
    </tr>
  );
};

interface ReasonPanelProps {
  row: LogicalDatabase;
  isDb: boolean;
  hasSchemaUnit: boolean;
  schemaCount: number;
  absorbedCount: number;
  /** The rail passes through this row on its way to a member below it. */
  bridge: boolean;
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
  bridge,
  pickedReason,
  onPickReason,
  onCancelPick,
  onConfirmPick,
  popRef,
}: ReasonPanelProps) => (
  <tr>
    <td
      colSpan={SPAN_ALL}
      className={cn(
        'py-3 pr-[18px]',
        isDb ? 'pl-[30px]' : 'pl-[54px]',
        bgColors.muted,
        bridge && logicalDbStyles.spineIdle,
        bridge && logicalDbStyles.spineBridge,
      )}
    >
      <div
        ref={popRef}
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
    </td>
  </tr>
);
