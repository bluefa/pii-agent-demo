'use client';

import { createPortal } from 'react-dom';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { VmDatabaseConfigPanel } from '@/app/target-sources/[targetSourceId]/_components/candidate/VmDatabaseConfigPanel';
import { VnetIntegrationGuideModal } from '@/app/target-sources/[targetSourceId]/_components/candidate/VnetIntegrationGuideModal';
import { useModal } from '@/app/hooks/useModal';
import { getResourceDisplayName } from '@/lib/resource';
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
import { getCandidateBehavior } from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';

/** Row-level interaction callbacks, grouped so the table/row prop lists stay small. */
export interface CandidateRowActions {
  toggleSelected: (resourceId: string, checked: boolean, anchor: HTMLElement) => void;
  reasonChipClick: (resourceId: string, anchor: HTMLElement) => void;
  expandToggle: (resourceId: string | null) => void;
  endpointSave: (resourceId: string, draft: EndpointConfigDraft) => void;
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
  /** True when the row hangs under a group parent — indents the identity cell only (LIN-85). */
  grouped?: boolean;
}

export const CandidateResourceRow = ({
  candidate,
  isSelected,
  exclusionReason,
  isExpanded,
  readonly,
  drafts,
  actions,
  grouped = false,
}: CandidateResourceRowProps) => {
  const vnetModal = useModal();
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
          )}
        >
          <Tooltip
            content={<IdentifierTip label="Resource Name" value={displayName} />}
            variant="value"
            size="md"
            triggerClassName="min-w-0 max-w-[200px] block"
            truncatedOnly
          >
            <span className="block truncate">{displayName || '—'}</span>
          </Tooltip>
        </td>

        <td className={idcStyles.table.approvalCell}>
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
        </td>

        {/* DB Type is a repeating attribute, not a status — plain text, no badge; the
            config-needed warning is the one exception because it names an action. */}
        <td
          className={cn(
            idcStyles.table.approvalCell,
            'text-[12px]',
            dimmed ? DIM_TEXT : textColors.secondary,
            CELL_LIFT,
          )}
        >
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {effectiveDbType ? getDatabaseShortLabel(effectiveDbType) : '—'}
            {showConfigNeeded && (
              <span className={cn('text-xs', statusColors.warning.textDark)}>(DB 설정 필요)</span>
            )}
          </span>
        </td>

        <td
          className={cn(
            idcStyles.table.approvalCell,
            'whitespace-nowrap font-mono text-[12px]',
            dimmed ? DIM_TEXT : textColors.secondary,
            CELL_LIFT,
          )}
        >
          {region}
        </td>

        {/* 시스템 분류는 조용한 사실 티어 — 행동을 막는 설치 불가만 주황 + 안내
            링크로 예외 강조(감광에서도 제외: 왜 못 고르는지는 살아 있어야 한다). */}
        <td className={cn(idcStyles.table.approvalCell, 'text-[12px]')}>
          {isIneligible ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); vnetModal.open(); }}
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
        <VnetIntegrationGuideModal isOpen={vnetModal.isOpen} onClose={vnetModal.close} resourceId={candidate.resourceId} />,
        document.body,
      )}
    </>
  );
};
