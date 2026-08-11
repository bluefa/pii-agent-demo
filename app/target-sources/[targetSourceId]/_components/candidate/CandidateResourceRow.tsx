'use client';

import { createPortal } from 'react-dom';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { DeleteIcon, EditIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { VmDatabaseConfigPanel } from '@/app/target-sources/[targetSourceId]/_components/candidate/VmDatabaseConfigPanel';
import { InstallIneligibleGuideModal } from '@/app/target-sources/[targetSourceId]/_components/candidate/InstallIneligibleGuideModal';
import { useModal } from '@/app/hooks/useModal';
import { useRailHover, type RailRowProps } from '@/app/hooks/useRailHover';
import { getResourceDisplayName } from '@/lib/resource';
import { GROUPED_CHILD_KIND_LABEL } from '@/lib/resource-grouping';
import {
  rdsInstanceLabel,
  sortRdsInstances,
  type RdsInstanceCandidate,
} from '@/lib/rds-instances';
import {
  Ec2InstanceTag,
  RdsClusterTag,
  RdsInstanceIdentity,
} from '@/app/components/ui/RdsInstanceChips';
import { ChevronRightIcon } from '@/app/components/ui/icons';
import { isEc2Instance, resolveExclusionReason } from '@/lib/types';
import {
  cn,
  ec2Styles,
  idcStyles,
  primaryColors,
  statusColors,
  tableRowLift,
  textColors,
  verdictRailClass,
} from '@/lib/theme';
import type {
  CandidateDraftState,
  CandidateResource,
  EndpointConfigDraft,
} from '@/lib/types/resources';
import {
  getCandidateBehavior,
  resolveRdsInstanceResourceId,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';
import { isManualEc2Candidate } from '@/app/target-sources/[targetSourceId]/_components/candidate/manual-ec2';

/** Row-level interaction callbacks, grouped so the table/row prop lists stay small. */
export interface CandidateRowActions {
  toggleSelected: (resourceId: string, checked: boolean, anchor: HTMLElement) => void;
  reasonChipClick: (resourceId: string, anchor: HTMLElement) => void;
  expandToggle: (resourceId: string | null) => void;
  endpointSave: (resourceId: string, draft: EndpointConfigDraft) => void;
  /** RDS cluster: the member instance the agent will connect through. */
  selectRdsInstance: (resourceId: string, instanceResourceId: string) => void;
  /** Manually added EC2 instance: reopen its connection form / drop it from the list. */
  editManualEc2: (resourceId: string) => void;
  deleteManualEc2: (resourceId: string) => void;
}

// Row/cell state grammar — the SAME tokens the approval tables use, so the step-1
// selection table and steps 2·3 read as one family.
//
// These four used to be copied literals here with a "keep the two in sync" note. Lowering
// the excluded tint is what made that note fail: one copy moved and the other did not, and
// nothing outside a screenshot would have caught it. The token is the sync.
// 미선택 행도 본문은 선택 행과 같은 강도로 읽는다 — 표시는 왼쪽 레일이 맡는다(verdictRail).
const ROW_BASE = tableRowLift.base;
const ROW_TARGET = tableRowLift.target;
const ROW_EXCLUDED = tableRowLift.excluded;
const CELL_LIFT = tableRowLift.cellText;
const NAME_LIFT = primaryColors.textGroupHover;

// integration_category(시스템의 사실) → 설치-계열 표기. 선택(사용자의 결정)과
// 단어 가족을 나눠 갖지 않도록 "설치"로만 말한다 — 승인 요청/상세 모달 라벨과
// 같은 계열. NO_INSTALL_NEEDED는 "설치가 선택사항"(VM·EC2는 DB 외 용도가 많아
// 필수 대상이 아니고, DB 서버를 운영 중일 때만 연동 대상)이라 설치 선택으로 쓴다.
const CATEGORY_LABELS: Record<CandidateResource['integrationCategory'], string> = {
  TARGET: '설치 대상',
  NO_INSTALL_NEEDED: '설치 선택',
  INSTALL_INELIGIBLE: '설치 불가',
};

interface CandidateResourceRowProps {
  candidate: CandidateResource;
  isSelected: boolean;
  /** Reason for an excluded (unselected) resource; undefined when selected or none picked. */
  exclusionReason: string | undefined;
  isExpanded: boolean;
  readonly: boolean;
  drafts: CandidateDraftState;
  actions: CandidateRowActions;
  /** Just added by hand — tint sweep + a "방금 추가" badge that fades on its own. */
  justAdded?: boolean;
  /** True when the row hangs under a group parent — draws the tree rail on the identity cell (LIN-85). */
  grouped?: boolean;
  /** Last child of its group — the rail stops at this row's elbow, closing the group. */
  lastInGroup?: boolean;
  /** Grouped child: its share of the group's rail, tagged with the group's key by the table. */
  rail?: RailRowProps;
  /** RDS cluster only — whether its member instance rows are showing. The table owns the
   *  fold because the default follows the checkbox, which it already tracks. */
  rdsInstancesExpanded?: boolean;
  onRdsInstancesToggle?: () => void;
}

// ===== RDS cluster member instances =====

interface RdsInstanceRowProps {
  clusterId: string;
  instance: RdsInstanceCandidate;
  /** The cluster's effective selection — the checked radio / the 선택됨 chip. */
  isChosen: boolean;
  /** Radios exist only inside a checked cluster in the editable table (spec: absent, not disabled). */
  selectable: boolean;
  readonly: boolean;
  lastInGroup: boolean;
  showCheckboxColumn: boolean;
  /** This member's share of the cluster's rail — same key as the cluster row itself. */
  rail: RailRowProps;
  onSelect: (instanceResourceId: string) => void;
}

/**
 * One member instance of an RDS cluster.
 *
 * The radio sits INSIDE the name cell, left of the identifier — the leading column belongs to
 * the cluster checkbox alone, and a radio there would read as a second selection of the row
 * itself. Grouping is the native `name` attribute rather than `role="radiogroup"`: the radios
 * live in sibling `<tr>`s, so any element wrapping all of them is a row group, and giving a
 * `<tbody>` the radiogroup role would strip the table semantics the rest of the row needs.
 */
const RdsInstanceRow = ({
  clusterId,
  instance,
  isChosen,
  selectable,
  readonly,
  lastInGroup,
  showCheckboxColumn,
  rail,
  onSelect,
}: RdsInstanceRowProps) => {
  const identifier = rdsInstanceLabel(instance);
  // Outside a chosen cluster the list is informational, so it rests on the excluded tier.
  const dimmed = !selectable && !isChosen;

  return (
    <tr
      className={cn(ROW_BASE, dimmed ? ROW_EXCLUDED : ROW_TARGET, rail.className)}
      onMouseEnter={rail.onMouseEnter}
      onMouseLeave={rail.onMouseLeave}
    >
      {/* The leading column stays cluster-checkbox-only. */}
      {showCheckboxColumn && <td className={cn(idcStyles.table.approvalCell, 'w-10')} />}

      <td
        className={cn(
          idcStyles.table.approvalCell,
          idcStyles.table.group.childCell,
          lastInGroup && idcStyles.table.group.childCellLast,
        )}
      >
        <span className="flex items-center gap-2">
          {selectable && (
            <input
              type="radio"
              name={`rds-instance-${clusterId}`}
              value={instance.resource_id}
              checked={isChosen}
              onChange={() => onSelect(instance.resource_id)}
              aria-label={`접속 인스턴스 ${identifier} 선택`}
              className={cn('h-4 w-4', statusColors.pending.border, primaryColors.text, primaryColors.focusRing)}
            />
          )}
          {/* Editable: the checked radio already says which member is chosen, so no chip.
              Read-only has no radio, so 선택됨 is the only thing left to say it. */}
          <RdsInstanceIdentity
            identifier={identifier}
            role={instance.cluster_member_role}
            selected={readonly && isChosen}
            nameClassName={cn('font-mono text-[14px]', textColors.primary, CELL_LIFT)}
          />
        </span>
      </td>

      {/* Resource ID / 설치 구분 / 제외 사유 belong to the cluster, not to its members. */}
      <td className={idcStyles.table.approvalCell} />
      <td className={cn(idcStyles.table.approvalCell, 'text-[14px]', textColors.secondary, CELL_LIFT)}>
        Instance
      </td>
      <td
        className={cn(
          idcStyles.table.approvalCell,
          'whitespace-nowrap font-mono text-[14px]',
          textColors.secondary,
          CELL_LIFT,
        )}
      >
        {instance.availability_zone ?? ''}
      </td>
      <td className={idcStyles.table.approvalCell} />
      {showCheckboxColumn && <td className={idcStyles.table.approvalCell} />}
    </tr>
  );
};

export const CandidateResourceRow = ({
  candidate,
  isSelected,
  exclusionReason,
  isExpanded,
  readonly,
  drafts,
  actions,
  justAdded = false,
  grouped = false,
  lastInGroup = false,
  rail,
  rdsInstancesExpanded = false,
  onRdsInstancesToggle,
}: CandidateResourceRowProps) => {
  const ineligibleModal = useModal();
  // A cluster owns its member rows, so its rail lives here; a group's rail is owned by the
  // table, which renders the children in a different tbody, and arrives as the `rail` prop.
  const clusterRailRow = useRailHover();
  const behavior = getCandidateBehavior(candidate);
  const requiresEndpointConfig = behavior.configKind === 'endpoint';
  // Manually added EC2: the user typed its connection info in a modal, so the row shows the
  // identity it was added by and NOT the config — Database Type / Region / the expandable
  // config panel all belong to rows the scan proposed.
  const isManualEc2 = isManualEc2Candidate(candidate);
  // 태그는 종류로 묻고, 아래의 접속 주소 표기·hover 액션은 수동 추가로 묻는다 — 스캔이
  // 스스로 찾은 EC2 도 같은 태그를 받아야 하지만, 그 행에는 사용자가 입력한 접속 정보도
  // 지울 대상도 없다.
  const isEc2 = isEc2Instance(candidate.type);
  const isIneligible = candidate.integrationCategory === 'INSTALL_INELIGIBLE';
  // 설치 불가 행이 사유 칸에 세우는 것 — 두 필드 어디에 실려 왔든(서버가 되돌려준
  // exclusion_reason / 스캔의 recommend_fail_reason) 한 줄로 풀고, 원문 코드는 팁에만 둔다.
  // 코드가 없는 설치 불가(AWS·IDC)는 null 이라 칸이 비고, 그것이 steps 2·3 과 같은 표기다.
  const ineligibleReason = isIneligible
    ? resolveExclusionReason(exclusionReason, candidate.recommendFailReason)
    : null;
  const hasEndpointConfig = behavior.isConfigured(candidate, drafts);
  const showConfigNeeded = requiresEndpointConfig && isSelected && !hasEndpointConfig;
  const canExpand = requiresEndpointConfig && isSelected && !readonly;
  const showCheckboxColumn = !readonly;
  const region = candidate.metadata.region ?? '—';
  const displayName = getResourceDisplayName(candidate);
  const effectiveDbType = drafts.endpointDrafts[candidate.id]?.databaseType
    ?? candidate.endpointConfig?.databaseType
    ?? candidate.databaseType;

  // RDS cluster: the member instances the user picks between. Display order is Reader-first
  // (the wire order is what the payload echoes, so sorting stays here).
  const isRdsClusterRow = behavior.configKind === 'rdsInstance';
  const sortedInstances = isRdsClusterRow ? sortRdsInstances(candidate.rdsInstanceCandidates ?? []) : [];
  // Only a selected cluster has a choice: an unchecked one submits no instance, so its rows
  // stay a flat informational list with nothing marked.
  const chosenInstanceResourceId = isRdsClusterRow && isSelected
    ? resolveRdsInstanceResourceId(candidate, drafts)
    : undefined;

  // 제외·설치 불가 행도 본문은 대상 행과 같은 강도로 읽힌다: 표시는 왼쪽 레일이 맡고,
  // 흐리게 하는 처리는 "덜 중요하다"는 뜻이라 검토해야 하는 행에는 정반대의 신호였다.
  const dimmed = !isSelected;

  // One static background per row: expanded/config-needed functional tints win over
  // the dim tint, and each branch owns its hover pair (`cn` is a plain join — two
  // static bg classes on one element would leave the winner to CSS order).
  const rowStateClass = isExpanded
    ? statusColors.info.bg
    : showConfigNeeded
      ? statusColors.warning.bg
      : dimmed
        ? ROW_EXCLUDED
        : ROW_TARGET;

  // A row belongs to at most one rail: its group's (passed in) or its own cluster's.
  const rowRail = isRdsClusterRow ? clusterRailRow(candidate.id) : rail;

  const handleRowClick = () => {
    if (canExpand) actions.expandToggle(isExpanded ? null : candidate.id);
  };

  const handleCheckboxChange = (checked: boolean, anchor: HTMLElement) => {
    actions.toggleSelected(candidate.id, checked, anchor);
    if (requiresEndpointConfig) actions.expandToggle(checked ? candidate.id : null);
  };

  const handleEndpointSave = (resourceId: string, draft: EndpointConfigDraft) => {
    actions.endpointSave(resourceId, draft);
    actions.expandToggle(null);
  };

  return (
    <>
      <tr
        // data-just-added: 섹션이 이 행을 찾아 화면 안으로 스크롤하는 표식.
        data-just-added={justAdded ? 'true' : undefined}
        className={cn(
          ROW_BASE,
          rowStateClass,
          justAdded && ec2Styles.rowJustAdded,
          canExpand && 'cursor-pointer',
          rowRail?.className,
        )}
        onClick={handleRowClick}
        onMouseEnter={rowRail?.onMouseEnter}
        onMouseLeave={rowRail?.onMouseLeave}
      >
        {showCheckboxColumn && (
          <td
            className={cn(
              idcStyles.table.approvalCell,
              'w-10',
              verdictRailClass(dimmed, isIneligible),
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isIneligible}
              onChange={(event) => handleCheckboxChange(event.target.checked, event.currentTarget)}
              className={cn('h-4 w-4 rounded disabled:cursor-not-allowed disabled:opacity-50', statusColors.pending.border, primaryColors.text, primaryColors.focusRing)}
            />
          </td>
        )}

        {/* One line, always — the full name is in the tip (step 2·3 grammar). */}
        <td
          className={cn(
            idcStyles.table.approvalCell,
            'font-mono text-[14px]',
            textColors.primary,
            !showCheckboxColumn && verdictRailClass(dimmed, isIneligible),
            NAME_LIFT,
            // A grouped child's indent already carries the column's 26px — the two padding
            // tokens must never both land on one cell.
            !grouped && idcStyles.table.nameCell,
            grouped && idcStyles.table.group.childCell,
            grouped && lastInGroup && idcStyles.table.group.childCellLast,
            // Cluster parent: carry the rail's first segment down to its first instance row.
            isRdsClusterRow && rdsInstancesExpanded && idcStyles.table.group.parentCell,
          )}
        >
          {isRdsClusterRow ? (
            // Two-line identity (owner request): the tag sits ABOVE the name, not beside it.
            // The chevron centres on the pair — pinned to the tag line it read as misaligned
            // against every other control in the row, which all sit on the row's middle.
            // It hangs off `lead`, whose box `stackedIdentityLift` does NOT move, so the
            // chevron stays on that middle line — where the lift puts the name.
            <span className={idcStyles.table.group.lead}>
              <button
                type="button"
                // No aria-controls: the instance rows are `<tr>` siblings with no single
                // element to point at, and a dangling reference is worse than the optional
                // attribute's absence (APG disclosure: aria-expanded alone is conforming).
                aria-expanded={rdsInstancesExpanded}
                aria-label={`${displayName} 인스턴스 목록 ${rdsInstancesExpanded ? '접기' : '펼치기'}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRdsInstancesToggle?.();
                }}
                className={cn(
                  idcStyles.table.group.toggle,
                  rdsInstancesExpanded
                    ? idcStyles.table.group.toggleOpen
                    : idcStyles.table.group.toggleClosed,
                  primaryColors.focusRing,
                )}
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
              <span className={cn('flex min-w-0 flex-col items-start gap-1', idcStyles.table.stackedIdentityLift)}>
                {/* Count only, and it rides the tag line rather than the name: it is the
                    quietest thing here, so it stays out of the name's line and out of chip
                    chrome. WHICH instance is chosen is said once, by the radio on the member
                    row — repeating it here made the parent argue with the radio whenever the
                    two rendered from different state. */}
                <span className="flex items-center gap-2">
                  <RdsClusterTag />
                  <span className={cn('whitespace-nowrap font-sans text-[12px]', textColors.tertiary)}>
                    {sortedInstances.length}개 인스턴스
                  </span>
                </span>
                <Tooltip
                  content={<IdentifierTip label="Resource Name" value={displayName} />}
                  variant="value"
                  size="md"
                  triggerClassName="min-w-0 max-w-[200px] block"
                  truncatedOnly
                >
                  <span className="block truncate">{displayName || '—'}</span>
                </Tooltip>
              </span>
            </span>
          ) : isEc2 ? (
            // 종류 태그는 이름 위 — RDS Cluster 와 같은 자리다. 이 열이 행의 정체성을
            // 여는 자리이므로, "무엇인가"를 먼저 말하고 이름이 뒤따른다.
            <span className={cn(ec2Styles.rowStack, idcStyles.table.stackedIdentityLift)}>
              {/* 배지는 종류 태그 옆 — 모션을 못 본 사람도 읽어서 알 수 있는 층이고,
                  이름은 잘릴 수 있으므로 배지를 밀어내지 않는 자리에 둔다. */}
              <span className="flex items-center">
                <Ec2InstanceTag />
                {justAdded && <span className={ec2Styles.newBadge}>방금 추가</span>}
              </span>
              <Tooltip
                content={<IdentifierTip label="Resource Name" value={displayName} />}
                variant="value"
                size="md"
                triggerClassName="min-w-0 max-w-[200px] block"
                truncatedOnly
              >
                <span className="block truncate">{displayName || '—'}</span>
              </Tooltip>
            </span>
          ) : (
            <Tooltip
              content={<IdentifierTip label="Resource Name" value={displayName} />}
              variant="value"
              size="md"
              triggerClassName="min-w-0 max-w-[200px] block"
              truncatedOnly
            >
              <span className="block truncate">{displayName || '—'}</span>
            </Tooltip>
          )}
        </td>

        {/* Inside a group the id is dropped: it is the parent's own path with the child's name
            tacked on (`athena:<acct>:<region>/<catalog>/test_raw`), so every child repeated the
            group's identity and then said its name a second time. */}
        <td className={idcStyles.table.approvalCell}>
          {grouped ? null : isManualEc2 ? (
            // 종류 태그는 이름 열이 가져갔다 — 여기는 instance id → 접속 주소.
            // 여기는 값이 위·보조 줄이 아래라 스택을 반대로 내린다: 이름 열이 `stackedIdentityLift`
            // 로 이름을 행의 가운데 선에 올려놓았고, id 도 같은 선에 서야 둘이 짝을 이룬다.
            // 10 = 보조 줄(16px) + 4px gap 의 절반.
            <span className={cn(ec2Styles.rowStack, 'relative top-[10px]')}>
              <span className={cn(ec2Styles.rowId, 'block max-w-[220px] truncate')}>
                {candidate.resourceId}
              </span>
              <span className={cn(ec2Styles.rowSub, 'block max-w-[220px] truncate')}>
                Private IP {candidate.endpointConfig?.host || '—'}
              </span>
            </span>
          ) : (
            <span onClick={(event) => event.stopPropagation()}>
              <ResourceIdCell
                value={candidate.resourceId}
                label="Resource ID"
                // 220px(승인 테이블 기본)에서 축소: 이 테이블은 체크박스+설치 구분이
                // 더 있어 220이면 제외 사유 열이 가로 스크롤 뒤로 밀린다. 전문은 팁·복사에.
                maxWidthClass="max-w-[160px]"
                sizeClass="text-[14px]"
                textClassName={cn(textColors.secondary, CELL_LIFT)}
              />
            </span>
          )}
        </td>

        {/* DB Type is a repeating attribute, not a status — plain text, no badge; the
            config-needed warning is the one exception because it names an action.
            Inside a group this column carries what the row IS: the parent says `Athena`,
            each child says `Database`. Region belongs to the parent alone. */}
        <td
          className={cn(
            idcStyles.table.approvalCell,
            'text-[14px]',
            textColors.secondary,
            CELL_LIFT,
          )}
        >
          {grouped ? (
            GROUPED_CHILD_KIND_LABEL
          ) : (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {effectiveDbType ? getDatabaseShortLabel(effectiveDbType) : '—'}
              {showConfigNeeded && (
                <span className={cn('text-[14px]', statusColors.warning.textDark)}>(DB 설정 필요)</span>
              )}
            </span>
          )}
        </td>

        <td
          className={cn(
            idcStyles.table.approvalCell,
            'whitespace-nowrap font-mono text-[14px]',
            textColors.secondary,
            CELL_LIFT,
          )}
        >
          {/* A searched instance carries no region: the search response reports the private
              address and the scan version, nothing else about where it sits. */}
          {grouped || isManualEc2 ? null : region}
        </td>

        {/* 시스템 분류는 조용한 사실 티어 — 행동을 막는 설치 불가만 주황 + 안내
            링크로 예외 강조(감광에서도 제외: 왜 못 고르는지는 살아 있어야 한다). */}
        <td className={cn(idcStyles.table.approvalCell, 'text-[14px]')}>
          {isIneligible ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); ineligibleModal.open(); }}
              className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap text-[14px] font-semibold underline decoration-dotted underline-offset-2',
                statusColors.warning.textDark,
              )}
              aria-label="설치 불가 사유 안내 보기"
            >
              <StatusWarningIcon className="h-3.5 w-3.5" />
              설치 불가
            </button>
          ) : candidate.integrationCategory === 'NO_INSTALL_NEEDED' ? (
            // 설치가 선택인 행(VM·EC2)은 사용자의 판단이 필요한 예외라 태그로 세운다.
            // 기본값인 설치 대상은 평문으로 남겨야 이 강조가 산다. 제외된 행에서도
            // 흐리지 않는다 — 판단이 필요한 이유는 페이드를 견뎌야 한다.
            <span className={cn(idcStyles.tag.base, idcStyles.tag.orange)}>
              {CATEGORY_LABELS.NO_INSTALL_NEEDED}
            </span>
          ) : (
            <span className={cn('whitespace-nowrap', textColors.secondary, CELL_LIFT)}>
              {CATEGORY_LABELS[candidate.integrationCategory]}
            </span>
          )}
        </td>

        {showCheckboxColumn && (
          <td className={idcStyles.table.approvalCell} onClick={(event) => event.stopPropagation()}>
            {isManualEc2 ? (
              // 사용자가 직접 담은 행이라 제외 사유를 물을 자리가 아니다 — 고치거나 뺀다.
              <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  aria-label="접속 정보 수정"
                  title="접속 정보 수정"
                  onClick={() => actions.editManualEc2(candidate.id)}
                  className={ec2Styles.rowAction}
                >
                  <EditIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="연동 대상에서 삭제"
                  title="연동 대상에서 삭제"
                  onClick={() => actions.deleteManualEc2(candidate.id)}
                  className={ec2Styles.rowActionDelete}
                >
                  <DeleteIcon className="h-4 w-4" />
                </button>
              </span>
            ) : isIneligible ? (
              // 스캔의 판정이지 사용자의 제외가 아니다 — 고쳐 쓸 수 있으면 체크박스는 잠겨
              // 있는데 사유만 사람 말로 덮인 채 승인 요청이 나간다. 읽기 전용 칩으로 세우고,
              // 표기는 steps 2·3·관리자 표와 같은 resolveExclusionReason 을 쓴다: 서버가
              // exclusion_reason 에 판정 코드를 그대로 실어 보내는 경로가 있어, 그대로 찍으면
              // 이 칸에 원문 enum 이 나왔다.
              ineligibleReason && (
                <ReasonChipInline reason={ineligibleReason.text} code={ineligibleReason.code} />
              )
            ) : !isSelected && exclusionReason ? (
              <button
                type="button"
                aria-label="제외 사유 수정"
                onClick={(event) => actions.reasonChipClick(candidate.id, event.currentTarget)}
                className="text-left"
              >
                <ReasonChipInline reason={exclusionReason} />
              </button>
            ) : !isSelected && candidate.integrationCategory === 'TARGET' ? (
              // Server-seeded unselected TARGET without a reason: approval is blocked
              // until one exists, so give a direct entry point to the reason picker.
              <button
                type="button"
                aria-label="제외 사유 입력"
                onClick={(event) => actions.reasonChipClick(candidate.id, event.currentTarget)}
                className={cn('text-[14px] underline decoration-dotted underline-offset-2', statusColors.warning.textDark)}
              >
                사유 입력
              </button>
            ) : null}
          </td>
        )}
      </tr>

      {isRdsClusterRow && rdsInstancesExpanded && sortedInstances.map((instance, index) => (
        <RdsInstanceRow
          key={instance.resource_id}
          clusterId={candidate.id}
          instance={instance}
          isChosen={instance.resource_id === chosenInstanceResourceId}
          // Radios exist only inside a checked cluster: an unchecked cluster submits no
          // instance, so offering the choice would promise something the payload never sends.
          selectable={isSelected && !readonly}
          readonly={readonly}
          lastInGroup={index === sortedInstances.length - 1}
          showCheckboxColumn={showCheckboxColumn}
          rail={clusterRailRow(candidate.id)}
          onSelect={(instanceResourceId) => actions.selectRdsInstance(candidate.id, instanceResourceId)}
        />
      ))}

      {isExpanded && (
        <VmDatabaseConfigPanel
          resourceId={candidate.id}
          initialConfig={drafts.endpointDrafts[candidate.id] ?? candidate.endpointConfig}
          // Editable table: checkbox + 5 data columns + exclusion-reason column.
          colSpan={showCheckboxColumn ? 7 : 5}
          onSave={handleEndpointSave}
          onCancel={() => actions.expandToggle(null)}
        />
      )}

      {isIneligible && typeof document !== 'undefined' && createPortal(
        <InstallIneligibleGuideModal
          isOpen={ineligibleModal.isOpen}
          onClose={ineligibleModal.close}
          recommendFailReason={candidate.recommendFailReason}
        />,
        document.body,
      )}
    </>
  );
};
