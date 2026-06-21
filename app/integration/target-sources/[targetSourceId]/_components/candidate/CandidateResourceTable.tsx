'use client';

import { createPortal } from 'react-dom';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { VmDatabaseConfigPanel } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate/VmDatabaseConfigPanel';
import { VnetIntegrationGuideModal } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate/VnetIntegrationGuideModal';
import { useModal } from '@/app/hooks/useModal';
import { getResourceDisplayName } from '@/lib/resource';
import {
  bgColors,
  borderColors,
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
import { getCandidateBehavior } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';

interface CandidateResourceTableProps {
  candidates: CandidateResource[];
  selectedIds: Set<string>;
  drafts: CandidateDraftState;
  expandedResourceId: string | null;
  readonly: boolean;
  approvalSubmitting: boolean;
  onToggleSelected: (resourceId: string, checked: boolean) => void;
  onExpandToggle: (resourceId: string | null) => void;
  onEndpointSave: (resourceId: string, draft: EndpointConfigDraft) => void;
  onRequestApproval: () => void;
}

export const CandidateResourceTable = ({
  candidates,
  selectedIds,
  drafts,
  expandedResourceId,
  readonly,
  approvalSubmitting,
  onToggleSelected,
  onExpandToggle,
  onEndpointSave,
  onRequestApproval,
}: CandidateResourceTableProps) => {
  const totalCount = candidates.length;
  const selectedCount = selectedIds.size;
  const showCheckboxColumn = !readonly;

  if (totalCount === 0) {
    return (
      <div className={cn('rounded-lg border px-6 py-10 text-center text-sm', bgColors.surface, borderColors.default, textColors.tertiary)}>
        발견된 리소스가 없습니다
      </div>
    );
  }

  return (
    <div>
      <div className={cn('rounded-xl border border-[#EBEEF2] shadow-[0_1px_2px_rgba(17,24,39,0.04),0_6px_16px_-8px_rgba(17,24,39,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] overflow-hidden', bgColors.surface)}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={cn('whitespace-nowrap', idcStyles.table.header)}>
                {showCheckboxColumn && <th className={cn(idcStyles.table.headerCell, 'w-10')} />}
                <th className={idcStyles.table.headerCell}>연동 대상 여부</th>
                <th className={idcStyles.table.headerCell}>Database Type</th>
                <th className={idcStyles.table.headerCell}>Resource ID</th>
                <th className={idcStyles.table.headerCell}>Region</th>
                <th className={idcStyles.table.headerCell}>Resource Name</th>
                <th className={idcStyles.table.headerCell}>스캔 상태</th>
                <th className={idcStyles.table.headerCell}>연동 완료 여부</th>
              </tr>
            </thead>
            <tbody className={idcStyles.table.body}>
              {candidates.map((candidate) => (
                <CandidateResourceRow
                  key={candidate.id}
                  candidate={candidate}
                  isSelected={selectedIds.has(candidate.id)}
                  isExpanded={expandedResourceId === candidate.id}
                  showCheckboxColumn={showCheckboxColumn}
                  readonly={readonly}
                  drafts={drafts}
                  onToggleSelected={onToggleSelected}
                  onExpandToggle={onExpandToggle}
                  onEndpointSave={onEndpointSave}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!readonly && (
        <div className="flex justify-between items-center pt-4">
          <span className={cn('text-xs', textColors.tertiary)}>
            총 <strong className={textColors.primary}>{totalCount}</strong>건 ·{' '}
            <strong className={primaryColors.text}>{selectedCount}</strong>건 선택됨
          </span>
          <Button
            variant="primary"
            onClick={onRequestApproval}
            disabled={approvalSubmitting || selectedCount === 0}
            className="flex items-center gap-2"
          >
            {approvalSubmitting && <LoadingSpinner />}
            연동 대상 승인 요청
          </Button>
        </div>
      )}
    </div>
  );
};

interface CandidateResourceRowProps {
  candidate: CandidateResource;
  isSelected: boolean;
  isExpanded: boolean;
  showCheckboxColumn: boolean;
  readonly: boolean;
  drafts: CandidateDraftState;
  onToggleSelected: (resourceId: string, checked: boolean) => void;
  onExpandToggle: (resourceId: string | null) => void;
  onEndpointSave: (resourceId: string, draft: EndpointConfigDraft) => void;
}

const CandidateResourceRow = ({
  candidate,
  isSelected,
  isExpanded,
  showCheckboxColumn,
  readonly,
  drafts,
  onToggleSelected,
  onExpandToggle,
  onEndpointSave,
}: CandidateResourceRowProps) => {
  const vnetModal = useModal();
  const behavior = getCandidateBehavior(candidate);
  const requiresEndpointConfig = behavior.configKind === 'endpoint';
  const isIneligible = candidate.integrationCategory === 'INSTALL_INELIGIBLE';
  const hasEndpointConfig = behavior.isConfigured(candidate, drafts);
  const showConfigNeeded = requiresEndpointConfig && isSelected && !hasEndpointConfig;
  const canExpand = requiresEndpointConfig && isSelected && !readonly;
  const region = candidate.metadata.region ?? '—';
  const displayName = getResourceDisplayName(candidate);
  const effectiveDbType = drafts.endpointDrafts[candidate.id]?.databaseType
    ?? candidate.endpointConfig?.databaseType
    ?? candidate.databaseType;

  const handleRowClick = () => {
    if (canExpand) onExpandToggle(isExpanded ? null : candidate.id);
  };

  const handleCheckboxChange = (checked: boolean) => {
    onToggleSelected(candidate.id, checked);
    if (requiresEndpointConfig) onExpandToggle(checked ? candidate.id : null);
  };

  const handleEndpointSave = (resourceId: string, draft: EndpointConfigDraft) => {
    onEndpointSave(resourceId, draft);
    onExpandToggle(null);
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
              onChange={(event) => handleCheckboxChange(event.target.checked)}
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
            <Badge variant="info" size="sm">{getDatabaseLabel(effectiveDbType)}</Badge>
            {showConfigNeeded && (
              <span className={cn('text-xs', statusColors.warning.textDark)}>(DB 설정 필요)</span>
            )}
          </div>
        </td>

        <td className={idcStyles.table.cell}>
          <div className="flex items-center gap-2">
            <span className={cn('font-mono text-xs', textColors.tertiary)}>{candidate.resourceId}</span>
            <span onClick={(event) => event.stopPropagation()}>
              <CopyButton
                value={candidate.resourceId}
                label={`${candidate.resourceId} 복사`}
                className="opacity-0 group-hover:opacity-100"
              />
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

        <td className={idcStyles.table.cell}>
          <span className={cn('text-xs', textColors.quaternary)}>—</span>
        </td>
      </tr>

      {isExpanded && (
        <VmDatabaseConfigPanel
          resourceId={candidate.id}
          initialConfig={drafts.endpointDrafts[candidate.id] ?? candidate.endpointConfig}
          onSave={handleEndpointSave}
          onCancel={() => onExpandToggle(null)}
        />
      )}

      {isIneligible && typeof document !== 'undefined' && createPortal(
        <VnetIntegrationGuideModal isOpen={vnetModal.isOpen} onClose={vnetModal.close} resourceId={candidate.resourceId} />,
        document.body,
      )}
    </>
  );
};
