'use client';

import { createPortal } from 'react-dom';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { VmDatabaseConfigPanel } from '@/app/target-sources/[targetSourceId]/_components/candidate/VmDatabaseConfigPanel';
import { InstallIneligibleGuideModal } from '@/app/target-sources/[targetSourceId]/_components/candidate/InstallIneligibleGuideModal';
import { useModal } from '@/app/hooks/useModal';
import { getResourceDisplayName } from '@/lib/resource';
import { GROUPED_CHILD_KIND_LABEL } from '@/lib/resource-grouping';
import {
  rdsInstanceLabel,
  sortRdsInstances,
  type RdsInstanceCandidate,
} from '@/lib/rds-instances';
import {
  RdsClusterTag,
  RdsMemberChip,
  RdsSelectionChip,
} from '@/app/components/ui/RdsInstanceChips';
import { ChevronRightIcon } from '@/app/components/ui/icons';
import {
  cn,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
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

/** Row-level interaction callbacks, grouped so the table/row prop lists stay small. */
export interface CandidateRowActions {
  toggleSelected: (resourceId: string, checked: boolean, anchor: HTMLElement) => void;
  reasonChipClick: (resourceId: string, anchor: HTMLElement) => void;
  expandToggle: (resourceId: string | null) => void;
  endpointSave: (resourceId: string, draft: EndpointConfigDraft) => void;
  /** RDS cluster: the member instance the agent will connect through. */
  selectRdsInstance: (resourceId: string, instanceResourceId: string) => void;
}

// Row/cell state grammar — mirrors WaitingApprovalTable (step 2·3); keep the two
// in sync so the step-1 selection table and the approval tables read as one family.
// Unchecked rows REST one tier dimmer (#6B7280, 4.63:1 on the #F9FAFB tint) and the
// hover/focus lifts restore full contrast; chips (verdict/reason/scan tags) keep
// full contrast because the "why" must survive the fade.
const ROW_BASE = 'group transition-colors duration-150 motion-reduce:transition-none';
const ROW_TARGET = 'hover:bg-[#EAEEF7] focus-within:bg-[#EAEEF7]';
const ROW_EXCLUDED = 'bg-[#F9FAFB] hover:bg-[#E3E8F2] focus-within:bg-[#E3E8F2]';
const CELL_LIFT = 'group-hover:text-[#191F28] group-focus-within:text-[#191F28]';
const NAME_LIFT = primaryColors.textGroupHover;
const DIM_TEXT = 'text-[#6B7280]';

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
  /** True when the row hangs under a group parent — draws the tree rail on the identity cell (LIN-85). */
  grouped?: boolean;
  /** Last child of its group — the rail stops at this row's elbow, closing the group. */
  lastInGroup?: boolean;
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
  /** Sorted-top instance. Earns the 기본 badge only while it is still the effective choice. */
  isDefault: boolean;
  /** Radios exist only inside a checked cluster in the editable table (spec: absent, not disabled). */
  selectable: boolean;
  readonly: boolean;
  lastInGroup: boolean;
  showCheckboxColumn: boolean;
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
  isDefault,
  selectable,
  readonly,
  lastInGroup,
  showCheckboxColumn,
  onSelect,
}: RdsInstanceRowProps) => {
  const identifier = rdsInstanceLabel(instance);
  // Outside a chosen cluster the list is informational, so it rests on the excluded tier.
  const dimmed = !selectable && !isChosen;

  return (
    <tr className={cn(ROW_BASE, dimmed ? ROW_EXCLUDED : ROW_TARGET)}>
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
          <span
            className={cn(
              'truncate font-mono text-[14px]',
              dimmed ? DIM_TEXT : textColors.primary,
              CELL_LIFT,
            )}
          >
            {identifier}
          </span>
          <RdsMemberChip role={instance.cluster_member_role} />
          {/* Exactly one of these, never both. 기본 says "the table chose this for you, and
              you can still change it" — a statement only the editable table can make, so it
              goes quiet in read-only, where 선택됨 states the settled choice instead. */}
          {!readonly && isDefault && isChosen && <RdsSelectionChip label="기본" />}
          {readonly && isChosen && <RdsSelectionChip label="선택됨" />}
        </span>
      </td>

      {/* Resource ID / 설치 구분 / 제외 사유 belong to the cluster, not to its members. */}
      <td className={idcStyles.table.approvalCell} />
      <td className={cn(idcStyles.table.approvalCell, 'text-[12px]', dimmed ? DIM_TEXT : textColors.secondary, CELL_LIFT)}>
        Instance
      </td>
      <td
        className={cn(
          idcStyles.table.approvalCell,
          'whitespace-nowrap font-mono text-[12px]',
          dimmed ? DIM_TEXT : textColors.secondary,
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
  grouped = false,
  lastInGroup = false,
  rdsInstancesExpanded = false,
  onRdsInstancesToggle,
}: CandidateResourceRowProps) => {
  const ineligibleModal = useModal();
  const behavior = getCandidateBehavior(candidate);
  const requiresEndpointConfig = behavior.configKind === 'endpoint';
  const isIneligible = candidate.integrationCategory === 'INSTALL_INELIGIBLE';
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

  // Ineligible rows share the dim tier with excluded ones — the ⚠ 설치 불가 entry
  // point beside the ID (full contrast) carries the distinction, not a badge column.
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
        className={cn(ROW_BASE, rowStateClass, canExpand && 'cursor-pointer')}
        onClick={handleRowClick}
      >
        {showCheckboxColumn && (
          <td className={cn(idcStyles.table.approvalCell, 'w-10')} onClick={(event) => event.stopPropagation()}>
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
            dimmed ? DIM_TEXT : textColors.primary,
            NAME_LIFT,
            grouped && idcStyles.table.group.childCell,
            grouped && lastInGroup && idcStyles.table.group.childCellLast,
            // Cluster parent: carry the rail's first segment down to its first instance row.
            isRdsClusterRow && rdsInstancesExpanded && idcStyles.table.group.parentCell,
          )}
        >
          {isRdsClusterRow ? (
            // Two-line identity (owner request): the tag sits at the row's top-left ABOVE the
            // name, not beside it, so the chevron top-aligns to the tag line.
            <span className="flex items-start gap-2">
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
                  'mt-0.5',
                )}
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
              <span className="flex min-w-0 flex-col items-start gap-1">
                <RdsClusterTag />
                <span className="flex min-w-0 items-center gap-2">
                  <Tooltip
                    content={<IdentifierTip label="Resource Name" value={displayName} />}
                    variant="value"
                    size="md"
                    triggerClassName="min-w-0 max-w-[200px] block"
                    truncatedOnly
                  >
                    <span className="block truncate">{displayName || '—'}</span>
                  </Tooltip>
                  {/* Count only. Which instance is chosen is said once, by the 기본/선택됨 chip on
                      the instance row itself — repeating it here made the parent argue with the
                      radio whenever the two rendered from different state. */}
                  <span className={cn('whitespace-nowrap font-sans text-[12px]', textColors.tertiary)}>
                    인스턴스 {sortedInstances.length}
                  </span>
                </span>
              </span>
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
          {grouped ? null : (
            <span onClick={(event) => event.stopPropagation()}>
              <ResourceIdCell
                value={candidate.resourceId}
                label="Resource ID"
                // 220px(승인 테이블 기본)에서 축소: 이 테이블은 체크박스+설치 구분이
                // 더 있어 220이면 제외 사유 열이 가로 스크롤 뒤로 밀린다. 전문은 팁·복사에.
                maxWidthClass="max-w-[160px]"
                textClassName={cn(dimmed ? DIM_TEXT : textColors.secondary, CELL_LIFT)}
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
            'text-[12px]',
            dimmed ? DIM_TEXT : textColors.secondary,
            CELL_LIFT,
          )}
        >
          {grouped ? (
            GROUPED_CHILD_KIND_LABEL
          ) : (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {effectiveDbType ? getDatabaseShortLabel(effectiveDbType) : '—'}
              {showConfigNeeded && (
                <span className={cn('text-xs', statusColors.warning.textDark)}>(DB 설정 필요)</span>
              )}
            </span>
          )}
        </td>

        <td
          className={cn(
            idcStyles.table.approvalCell,
            'whitespace-nowrap font-mono text-[12px]',
            dimmed ? DIM_TEXT : textColors.secondary,
            CELL_LIFT,
          )}
        >
          {grouped ? null : region}
        </td>

        {/* 시스템 분류는 조용한 사실 티어 — 행동을 막는 설치 불가만 주황 + 안내
            링크로 예외 강조(감광에서도 제외: 왜 못 고르는지는 살아 있어야 한다). */}
        <td className={cn(idcStyles.table.approvalCell, 'text-[12px]')}>
          {isIneligible ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); ineligibleModal.open(); }}
              className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold underline decoration-dotted underline-offset-2',
                statusColors.warning.textDark,
              )}
              aria-label="설치 불가 사유 안내 보기"
            >
              <StatusWarningIcon className="h-3.5 w-3.5" />
              설치 불가
            </button>
          ) : (
            <span className={cn('whitespace-nowrap', dimmed ? DIM_TEXT : textColors.secondary, CELL_LIFT)}>
              {CATEGORY_LABELS[candidate.integrationCategory]}
            </span>
          )}
        </td>

        {showCheckboxColumn && (
          <td className={idcStyles.table.approvalCell} onClick={(event) => event.stopPropagation()}>
            {!isSelected && exclusionReason ? (
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
                className={cn('text-xs underline decoration-dotted underline-offset-2', statusColors.warning.textDark)}
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
          isDefault={index === 0}
          // Radios exist only inside a checked cluster: an unchecked cluster submits no
          // instance, so offering the choice would promise something the payload never sends.
          selectable={isSelected && !readonly}
          readonly={readonly}
          lastInGroup={index === sortedInstances.length - 1}
          showCheckboxColumn={showCheckboxColumn}
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
