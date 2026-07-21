'use client';

import { createPortal } from 'react-dom';
import { Badge } from '@/app/components/ui/Badge';
import { getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
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
  tableStyles,
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

interface CandidateResourceRowProps {
  candidate: CandidateResource;
  isSelected: boolean;
  /** Reason for an excluded (unselected) resource; undefined when selected or none picked. */
  exclusionReason: string | undefined;
  isExpanded: boolean;
  readonly: boolean;
  drafts: CandidateDraftState;
  actions: CandidateRowActions;
}

export const CandidateResourceRow = ({
  candidate,
  isSelected,
  exclusionReason,
  isExpanded,
  readonly,
  drafts,
  actions,
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
        className={cn(
          tableStyles.row,
          'group',
          canExpand && 'cursor-pointer',
          isExpanded && statusColors.info.bg,
          showConfigNeeded && !isExpanded && statusColors.warning.bg,
          isIneligible && 'opacity-60',
        )}
        onClick={handleRowClick}
      >
        {showCheckboxColumn && (
          <td className={cn(idcStyles.table.cell, 'w-10')} onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isIneligible}
              onChange={(event) => handleCheckboxChange(event.target.checked, event.currentTarget)}
              className={cn('w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed', statusColors.pending.border, primaryColors.text, primaryColors.focusRing)}
            />
          </td>
        )}

        <td className={idcStyles.table.cell}>
          {isIneligible
            ? <Badge variant="pending" size="sm">비대상</Badge>
            : <Badge variant="success" size="sm">대상</Badge>}
        </td>

        <td className={idcStyles.table.cell}>
          <div className="flex items-center gap-1.5">
            {effectiveDbType
              ? <Badge variant="info" size="sm">{getDatabaseLabel(effectiveDbType)}</Badge>
              : <span className={cn('text-xs', textColors.quaternary)}>—</span>}
            {showConfigNeeded && (
              <span className={cn('text-xs', statusColors.warning.textDark)}>(DB 설정 필요)</span>
            )}
          </div>
        </td>

        <td className={idcStyles.table.cell}>
          <div className="flex items-center gap-2">
            <span onClick={(event) => event.stopPropagation()}>
              <ResourceIdCell value={candidate.resourceId} label="Resource ID" />
            </span>
            {isIneligible && (
              <button
                onClick={(event) => { event.stopPropagation(); vnetModal.open(); }}
                className={cn('flex-shrink-0 inline-flex items-center gap-1', statusColors.warning.text, 'hover:underline transition-opacity')}
                aria-label="VNet Integration으로 인해 설치 불가 - 클릭하여 상세 안내 보기"
              >
                <StatusWarningIcon className="w-3.5 h-3.5" />
                <span className={cn('text-xs font-medium', statusColors.warning.textDark)}>설치 불가</span>
              </button>
            )}
          </div>
        </td>

        <td className={idcStyles.table.cell}>
          <span className={cn('font-mono text-xs', textColors.tertiary)}>{region}</span>
        </td>

        <td className={idcStyles.table.cell}>
          <span className={cn('font-mono text-xs', textColors.secondary)}>{displayName}</span>
        </td>

        <td className={idcStyles.table.cell}>
          {candidate.scanStatus
            ? (
                <span
                  className={cn(
                    idcStyles.tag.base,
                    candidate.scanStatus === 'NEW_SCAN' ? idcStyles.tag.blue : idcStyles.tag.orange,
                  )}
                >
                  {candidate.scanStatus === 'NEW_SCAN' ? '신규' : '변경'}
                </span>
              )
            : <span className={cn('text-xs', textColors.quaternary)}>—</span>}
        </td>

        {showCheckboxColumn && (
          <td className={idcStyles.table.cell} onClick={(event) => event.stopPropagation()}>
            {!isSelected && exclusionReason ? (
              <button
                type="button"
                aria-label="제외 사유 수정"
                onClick={(event) => actions.reasonChipClick(candidate.id, event.currentTarget)}
                className="text-left"
              >
                <ReasonChipInline reason={exclusionReason} />
              </button>
            ) : (
              <span className={cn('text-xs', textColors.quaternary)}>—</span>
            )}
          </td>
        )}

        <td className={idcStyles.table.cell}>
          <span className={cn('text-xs', textColors.quaternary)}>—</span>
        </td>
      </tr>

      {isExpanded && (
        <VmDatabaseConfigPanel
          resourceId={candidate.id}
          initialConfig={drafts.endpointDrafts[candidate.id] ?? candidate.endpointConfig}
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
