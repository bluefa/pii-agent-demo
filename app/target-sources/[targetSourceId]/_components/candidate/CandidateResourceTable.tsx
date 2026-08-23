'use client';

import { Fragment, useMemo } from 'react';
import { cn, idcStyles, tipTiers } from '@/lib/theme';
import { groupResourceRows } from '@/lib/resource-grouping';
import { useClusterFold } from '@/app/hooks/useClusterFold';
import { listMissingExclusionReasons } from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import type { CandidateDraftState, CandidateResource } from '@/lib/types/resources';
import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import {
  CandidateResourceRow,
  type CandidateRowActions,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceRow';
import { useRailHover, type RailRowProps } from '@/app/hooks/useRailHover';
import { TableEmptyState } from '@/app/target-sources/[targetSourceId]/_components/shared/TableEmptyState';
import { ResourceGroupRow } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceGroupRow';

// 설치 구분 = 스캔이 판정한 시스템 사실(사용자 변경 불가). 값의 뜻만이 아니라
// 각 값이 선택에 거는 규칙(대상 제외 시 사유 필수, 불가는 선택 자체 불가)까지가
// 한 세트다 — 사유 입력·비활성 체크박스를 만난 사용자가 여기서 이유를 찾는다.
//
// IdentifierTip(변수: variant="value")과 같은 화이트 박스 가족. 계층 3단 —
// 캡션(회색 제목) < 본문(tipTiers.body) < 용어(bold, tipTiers.term) — 로
// 용어가 제목보다 크게 읽힌다: 사용자가 찾으러 온 것은 "안내"가 아니라 자기
// 행에 찍힌 그 단어다. 제목 구역과 용어 구역은 헤어라인으로 가른다.
const CATEGORY_TERMS = [
  {
    term: '설치 대상',
    description:
      '연동하려면 Agent 설치(4단계)가 진행되는 DB예요. 연동에서 제외하려면 제외 사유를 입력해야 해요.',
  },
  {
    term: '설치 선택',
    description:
      'VM·EC2처럼 DB 외 다른 용도로도 쓰는 리소스라 필수 연동 대상은 아니에요. DB 서버를 운영하고 있다면 연동 대상이 맞아요. 행을 펼쳐 데이터베이스 설정을 저장하면 선택할 수 있어요.',
  },
  {
    term: '설치 불가',
    description:
      '네트워크 구성 제약으로 Agent를 설치할 수 없는 리소스예요. 선택할 수 없고, 행의 설치 불가 라벨을 누르면 상세 사유를 확인할 수 있어요.',
  },
] as const;

const CATEGORY_TOOLTIP_CONTENT = (
  <div className="leading-[1.55]">
    <span className={cn('block', tipTiers.title)}>설치 구분 안내</span>
    <p className={cn('mt-[4px]', tipTiers.body)}>
      스캔 결과를 바탕으로 시스템이 판정하는 값이라 직접 변경할 수 없어요.
    </p>
    <div className={cn('my-[10px]', tipTiers.hairline)} aria-hidden="true" />
    <div className="space-y-[10px]">
      {CATEGORY_TERMS.map(({ term, description }) => (
        <div key={term}>
          <span className={cn('block', tipTiers.term)}>{term}</span>
          <p className={cn('mt-[2px]', tipTiers.body)}>{description}</p>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Step-1 floors, from the LIN-96 ledger §1·§2 — this table QUOTES them, it does not choose:
 * checkbox 52 (실측 — see below) · name 250 (심사 문맥, the steps-2·3 value) ·
 * id 186 · dbType 142 · region 156 · reason 160 (편집 열: the floor keeps the column from
 * shrinking under the 「사유 입력」 link; the chip itself cuts at the column boundary — see
 * `REASON_CLAMP`).
 *
 * `select` is 52 by MEASUREMENT, not the legacy `w-10` declaration: in the old auto-layout
 * table that 40 was never obeyed — the column rendered its min-content, `approvalCell`'s
 * 18px padding + 16px box + 18px = 52 — and the tier family's absolute px are built on the
 * real 52: `RdsInstancePanel`'s pl-[106px] is 52+30+24, and the instance band's trunk
 * (`-left-[38px]`) drops exactly from the fold chevron's center at 52+16. Landing 40 pulled
 * everything right of the gutter 12px left of those constants, so an expanded cluster's tree
 * line visibly missed its chevron (user report, 2026-08-23). Ledger method (a) 실측 beats
 * (b) 선언 재사용 whenever the declaration never actually governed.
 *
 * `category` (설치 구분) was the ledger's one [실측→LIN-98] hole. Measured 2026-08-23 on
 * TS 1006: the vocabulary is closed (`CATEGORY_LABELS` + the 설치 불가 guide button), the
 * widest member is the 설치 불가 button at 68.3px (14px semibold + icon + gap) and the
 * header ("설치 구분" + help icon) is 62.5. 68 + approvalCell's 36px padding + slack = 112 —
 * the 요청 대상 여부 value class, which carries the same kind of short verdict word.
 *
 * Sums: edit 52+250+186+142+156+112+160 = 1058 · read-only 250+186+142+156+112 = 846.
 */
const CANDIDATE_COLUMN_WIDTHS = {
  select: 52,
  name: 250,
  id: 186,
  dbType: 142,
  region: 156,
  category: 112,
  reason: 160,
} as const;

/**
 * The step-1 flex pair — the same two arbitrary-length columns every standard surface
 * declares, with id as the declaration-order sink (see `APPROVAL_FLEX_KEYS` for the
 * measurement that rejected 제외 사유: blank on selected rows, a self-expanding chip on the
 * rest, so its pixels never pay).
 */
const CANDIDATE_FLEX_KEYS = ['name', 'id'] as const;

/**
 * The step-1 column spec. Identity (name → id) → attributes (type · region) → system verdict
 * (설치 구분 = integration_category, a FACT the user cannot change) → user decision
 * (checkbox + 제외 사유). The two axes never share a word family: 분류 speaks 설치-,
 * selection speaks 연동 요청-. The checkbox IS the selection verdict, so there is no
 * 대상/비대상 badge column.
 */
const candidateColumns = (withDecisionColumns: boolean): ConsoleTableColumn[] => [
  ...(withDecisionColumns
    ? [
        {
          // A structural gutter, not a data column: the checkbox is the row's verdict, so
          // the header stays visually empty (`head` renders nothing; the spec test pins its
          // textContent as '') while `label` still names the column for assistive tech.
          key: 'select',
          label: '선택',
          head: <></>,
          width: CANDIDATE_COLUMN_WIDTHS.select,
          resizable: false,
        } satisfies ConsoleTableColumn,
      ]
    : []),
  {
    key: 'name',
    label: 'Resource Name',
    width: CANDIDATE_COLUMN_WIDTHS.name,
    flex: true,
    headClassName: idcStyles.table.nameCell,
  },
  // The sink: last flex column, so it takes what the others leave — the resource id, which
  // every ungrouped row fills and which is the only value here a cut actually costs.
  { key: 'id', label: 'Resource ID', width: CANDIDATE_COLUMN_WIDTHS.id, flex: true },
  { key: 'dbType', label: 'Database Type', width: CANDIDATE_COLUMN_WIDTHS.dbType },
  { key: 'region', label: 'Region', width: CANDIDATE_COLUMN_WIDTHS.region },
  {
    key: 'category',
    label: '설치 구분',
    width: CANDIDATE_COLUMN_WIDTHS.category,
    head: (
      <span className="inline-flex items-center gap-1">
        설치 구분
        <InfoTooltip
          content={CATEGORY_TOOLTIP_CONTENT}
          position="top"
          size="md"
          variant="value"
          label="설치 구분 안내"
          iconSize={17}
        />
      </span>
    ),
  },
  ...(withDecisionColumns
    ? [
        {
          key: 'reason',
          label: '제외 사유',
          width: CANDIDATE_COLUMN_WIDTHS.reason,
        } satisfies ConsoleTableColumn,
      ]
    : []),
];

interface CandidateResourceTableProps {
  candidates: CandidateResource[];
  selectedIds: Set<string>;
  /** id → exclusion reason for the currently-excluded (unselected) resources. */
  exclusionReasons: Record<string, string>;
  drafts: CandidateDraftState;
  expandedResourceId: string | null;
  readonly: boolean;
  actions: CandidateRowActions;
  /** The instance just added by hand — that one row wears the "방금 추가" marker. */
  justAddedResourceId?: string | null;
  /** Shown when the (filtered) list is empty — the section passes the filter-empty copy. */
  emptyMessage?: string;
  /**
   * Force every Athena group open. Pass this while a search or filter is narrowing the list:
   * a row can match inside a collapsed group, and leaving it shut shows the user a group
   * head that does not visibly contain what they typed (reproduced on TS 1006: searching
   * the one Athena child left a single folded parent row and no match on screen). The
   * chevron becomes an indicator while the filter owns the open state — same contract as
   * `WaitingApprovalTable`'s `expandFolds`. The derived blocks-approval default below stays
   * the unfiltered table's own rule.
   */
  expandFolds?: boolean;
}

export const CandidateResourceTable = ({
  candidates,
  selectedIds,
  exclusionReasons,
  drafts,
  expandedResourceId,
  readonly,
  actions,
  justAddedResourceId,
  emptyMessage,
  expandFolds = false,
}: CandidateResourceTableProps) => {
  const totalCount = candidates.length;
  const showCheckboxColumn = !readonly;

  // Athena arrives as many rows of one catalog family per region; grouping restores the parent
  // they belong to (LIN-85).
  const sections = useMemo(
    () =>
      groupResourceRows(candidates, (candidate) => ({
        type: candidate.type,
        region: candidate.metadata.region,
        selected: selectedIds.has(candidate.id),
      })),
    [candidates, selectedIds],
  );

  // Everything foldable starts COLLAPSED — the owner's rule for this step (2026-08-11): a table
  // that is always expanded reads as too dense, Athena groups included. ONE fold for both kinds,
  // since Athena group keys (`ATHENA|region`) and RDS cluster ids never collide and the policy is
  // the same. What the user presses wins and survives the default changing under it.
  //
  // `useClusterFold` rather than a set of open keys, because one default has to be DERIVED per
  // render (see `blocksApproval` below) and a seeded set would compute it once — at first render,
  // before the fetch has delivered a single candidate to look at.
  const foldOf = useClusterFold();

  // The group rails: parent and children carry the group's key, so hovering any of them
  // lights the whole group.
  const railRow = useRailHover();

  // Drag-resizable columns. The instance lives here rather than in the section: the shared
  // shell's contract hands it to "the caller that owns one screen's table", and step 1 has
  // exactly one mount. The flex pair is session-only, like every console surface.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v1:candidate-resources',
    ephemeralKeys: CANDIDATE_FLEX_KEYS,
  });
  const columns = useMemo(() => candidateColumns(showCheckboxColumn), [showCheckboxColumn]);

  if (totalCount === 0) {
    return <TableEmptyState message={emptyMessage ?? '발견된 리소스가 없습니다'} />;
  }

  return (
    // Step 2's connected grammar, not idcStyles.table.frame: no border/shadow/radius —
    // the toolbar above owns the rounded top, the Pagination footer below owns the
    // rounded bottom, and everything between stays bare (step-2 table silhouette).
    //
    // Row height raised one step over approvalCell's py-4 (owner request) — the selector
    // moved here from the old <table> when ConsoleTable took that element over; an ancestor
    // reaches the same cells. The :not([colspan]) guard keeps it off spanning cells:
    // VmDatabaseConfigPanel's td is deliberately py-0 and would lose to this selector's
    // higher specificity.
    <div className={cn('overflow-hidden bg-white', '[&_td:not([colspan])]:py-5')}>
      <ConsoleTable columns={columns} resize={resize}>
        {sections.map((section) => {
          const renderRow = (
            candidate: CandidateResource,
            grouped = false,
            lastInGroup = false,
            rail?: RailRowProps,
          ) => {
            const isSelected = selectedIds.has(candidate.id);
            return (
              <CandidateResourceRow
                key={candidate.id}
                candidate={candidate}
                isSelected={isSelected}
                exclusionReason={exclusionReasons[candidate.id]}
                isExpanded={expandedResourceId === candidate.id}
                readonly={readonly}
                drafts={drafts}
                actions={actions}
                justAdded={justAddedResourceId === candidate.id}
                grouped={grouped}
                lastInGroup={lastInGroup}
                rail={rail}
                instancesExpanded={foldOf(candidate.id, false).open}
                onInstancesToggle={foldOf(candidate.id, false).toggle}
              />
            );
          };

          if (section.kind === 'rows') {
            return (
              <tbody key={section.key} className={idcStyles.table.body}>
                {section.rows.map((candidate) => renderRow(candidate))}
              </tbody>
            );
          }

          const { group } = section;
          const rowsId = `candidate-group-${group.key.replace('|', '-')}`;
          // A group holding a row that BLOCKS the approval CTA opens by itself. Collapsed is
          // the default because a full group is noise; a group whose child is the reason the
          // button is dead is not noise, it is the work. The only control that clears it —
          // 사유 입력 — lives on that child's row, and `hidden` takes the child out of the
          // accessibility tree too, so leaving the group folded left the CTA naming a resource
          // the user could not reach without guessing which group to open.
          //
          // Gated on there being a selection at all, matching the CTA's own order of reasons
          // (`CandidateResourceSection`): with nothing selected the button asks for a selection
          // and no reason is owed yet, so an untouched table still opens fully collapsed.
          const fold = foldOf(
            group.key,
            selectedIds.size > 0
              && listMissingExclusionReasons(group.rows, selectedIds, exclusionReasons).length > 0,
          );
          // The filter owns the open state while it narrows the list (`expandFolds`) — the
          // press-wins fold above is the unfiltered table's rule.
          const collapsed = expandFolds ? false : !fold.open;
          const rail = railRow(group.key);
          return (
            <Fragment key={group.key}>
              <tbody className={idcStyles.table.body}>
                <ResourceGroupRow
                  type={group.type}
                  region={group.region}
                  expanded={!collapsed}
                  onToggle={fold.toggle}
                  controls={rowsId}
                  toggleable={!expandFolds}
                  rail={rail}
                  leadingCell={
                    showCheckboxColumn ? (
                      // No group-level checkbox: selecting a whole Athena family is a bulk
                      // action nobody asked for, and 제외 사유 is required per resource.
                      // No width class (the header spec owns the column under table-fixed);
                      // data-static-col keeps the gutter boundary-free (`consoleGrid`).
                      <td data-static-col="" className={idcStyles.table.approvalCell} />
                    ) : undefined
                  }
                  // Resource Name · Resource ID · Database Type · Region · 설치 구분, plus
                  // 제외 사유 when the table is editable.
                  colSpan={showCheckboxColumn ? 6 : 5}
                />
              </tbody>
              {/* Kept mounted while collapsed so `aria-controls` always resolves. */}
              <tbody id={rowsId} hidden={collapsed} className={idcStyles.table.body}>
                {group.rows.map((candidate, index) =>
                  renderRow(candidate, true, index === group.rows.length - 1, rail),
                )}
              </tbody>
            </Fragment>
          );
        })}
      </ConsoleTable>
    </div>
  );
};
