'use client';

import { createPortal } from 'react-dom';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { VnetIntegrationGuideModal } from '@/app/components/features/resource-table/VnetIntegrationGuideModal';
import { useModal } from '@/app/hooks/useModal';
import { cn, bgColors, primaryColors, statusColors, textColors } from '@/lib/theme';
import type {
  CandidateDraftState,
  CandidateResource,
  EndpointConfigDraft,
} from '@/lib/types/resources';
import { getCandidateBehavior } from './candidate-resource-behavior';
import { CandidateEndpointConfigPanel } from './CandidateEndpointConfigPanel';

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

const WarningTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-3.5 h-3.5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const getDisplayName = (resourceId: string): string => {
  if (!resourceId) return '—';
  const lastSlash = resourceId.lastIndexOf('/');
  if (lastSlash >= 0 && lastSlash < resourceId.length - 1) return resourceId.slice(lastSlash + 1);
  const lastColon = resourceId.lastIndexOf(':');
  if (lastColon >= 0 && lastColon < resourceId.length - 1) return resourceId.slice(lastColon + 1);
  return resourceId;
};

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
      <div className={cn('rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm', textColors.tertiary)}>
        발견된 리소스가 없습니다
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={cn('text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap', textColors.tertiary, bgColors.muted)}>
                {showCheckboxColumn && <th className="px-6 py-3 w-10" />}
                <th className="px-6 py-3">연동 대상 여부</th>
                <th className="px-6 py-3">DB Type</th>
                <th className="px-6 py-3">Resource ID</th>
                <th className="px-6 py-3">Region</th>
                <th className="px-6 py-3">DB Name</th>
                <th className="px-6 py-3">연동 완료 여부</th>
                <th className="px-6 py-3">스캔 이력</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
            연동 대상 확정 승인 요청
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
  const isIneligible = candidate.integrationCategory === 'INSTALL_INELIGIBLE';
  const hasEndpointConfig = behavior.isConfigured(candidate, drafts);
  const requiresEndpointConfig = candidate.configKind === 'endpoint';
  const showConfigNeeded = requiresEndpointConfig && isSelected && !hasEndpointConfig;
  const canExpand = requiresEndpointConfig && isSelected && !readonly;
  const region = candidate.metadata.region ?? '—';
  const displayName = getDisplayName(candidate.resourceId);
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
          'transition-colors',
          `hover:${bgColors.muted}`,
          canExpand && 'cursor-pointer',
          isExpanded && statusColors.info.bg,
          showConfigNeeded && !isExpanded && statusColors.warning.bg,
          isIneligible && 'opacity-60',
        )}
        onClick={handleRowClick}
      >
        {showCheckboxColumn && (
          <td className="px-6 py-3 w-10" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isIneligible}
              onChange={(event) => handleCheckboxChange(event.target.checked)}
              className={cn('w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed', statusColors.pending.border, primaryColors.text, primaryColors.focusRing)}
            />
          </td>
        )}

        <td className="px-6 py-3">
          <Badge variant={isIneligible ? 'pending' : 'success'} size="sm">
            {isIneligible ? '비대상' : '대상'}
          </Badge>
        </td>

        <td className="px-6 py-3">
          <div className="flex items-center gap-1.5">
            <Badge variant="info" size="sm">{getDatabaseLabel(effectiveDbType)}</Badge>
            {showConfigNeeded && (
              <span className={cn('text-xs', statusColors.warning.textDark)}>(DB 설정 필요)</span>
            )}
          </div>
        </td>

        <td className="px-6 py-3">
          <div className="flex items-center gap-2">
            <span className={cn('font-mono text-xs', textColors.tertiary)}>{candidate.resourceId}</span>
            {isIneligible && (
              <button
                onClick={(event) => { event.stopPropagation(); vnetModal.open(); }}
                className={cn('flex-shrink-0 inline-flex items-center gap-1', statusColors.warning.text, 'hover:underline transition-opacity')}
                aria-label="VNet Integration으로 인해 설치 불가 - 클릭하여 상세 안내 보기"
              >
                <WarningTriangleIcon />
                <span className={cn('text-xs font-medium', statusColors.warning.textDark)}>설치 불가</span>
              </button>
            )}
          </div>
        </td>

        <td className="px-6 py-3">
          <span className={cn('font-mono text-xs', textColors.tertiary)}>{region}</span>
        </td>

        <td className="px-6 py-3">
          <span className={cn('font-mono text-xs', textColors.secondary)}>{displayName}</span>
        </td>

        <td className="px-6 py-3">
          <span className={cn('text-xs', textColors.quaternary)}>—</span>
        </td>

        <td className="px-6 py-3">
          <span className={cn('text-xs', textColors.quaternary)}>—</span>
        </td>
      </tr>

      {isExpanded && (
        <CandidateEndpointConfigPanel
          resourceId={candidate.id}
          initial={drafts.endpointDrafts[candidate.id] ?? candidate.endpointConfig}
          networkInterfaces={candidate.networkInterfaces}
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
