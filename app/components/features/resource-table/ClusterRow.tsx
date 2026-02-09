'use client';

import { useState, useCallback } from 'react';
import { cn, statusColors, textColors, bgColors } from '@/lib/theme';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';
import { DatabaseIcon, getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { Badge } from '@/app/components/ui/Badge';
import { StatusIcon } from './StatusIcon';
import { InstancePanel } from './InstancePanel';
import type { Resource, ClusterInstance } from '@/lib/types';

interface ClusterRowProps {
  resource: Resource;
  selectedIds: Set<string>;
  isEditMode: boolean;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={cn('w-4 h-4 transition-transform', textColors.quaternary, expanded && 'rotate-180')}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const SelectedInstancesSummary = ({ instances }: { instances: ClusterInstance[] }) => {
  const selected = instances.filter((i) => i.isSelected);
  if (selected.length === 0) return null;

  return (
    <div className={cn('mt-1 text-xs', textColors.quaternary)}>
      {selected.map((inst) => {
        const shortId = inst.instanceId.split('-').slice(-1)[0] || inst.instanceId;
        const shortAz = inst.availabilityZone.split('-').slice(-1)[0] || inst.availabilityZone;
        return (
          <div key={inst.instanceId} className="flex items-center gap-1">
            <span className={textColors.quaternary}>└</span>
            <span>{shortId}</span>
            <span>({inst.role === 'READER' ? 'Reader' : 'Writer'}, {shortAz})</span>
          </div>
        );
      })}
    </div>
  );
};

export const ClusterRow = ({
  resource,
  selectedIds,
  isEditMode,
  isCheckboxEnabled,
  showConnectionStatus,
  onCheckboxChange,
}: ClusterRowProps) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [instanceSelections, setInstanceSelections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (resource.clusterInstances ?? []).forEach((inst) => {
      initial[inst.instanceId] = inst.isSelected;
    });
    return initial;
  });

  const isSelected = selectedIds.has(resource.id);
  const baseInstances = resource.clusterInstances ?? [];
  const instances: ClusterInstance[] = baseInstances.map((inst) => ({
    ...inst,
    isSelected: instanceSelections[inst.instanceId] ?? inst.isSelected,
  }));
  const selectedCount = instances.filter((i) => i.isSelected).length;
  const isReadOnly = !isEditMode && !isCheckboxEnabled;

  const handleCheckboxChange = (checked: boolean) => {
    onCheckboxChange(resource.id, checked);
    if (checked) {
      setIsPanelOpen(true);
    } else {
      setIsPanelOpen(false);
      // Reset instance selections on uncheck
      const reset: Record<string, boolean> = {};
      baseInstances.forEach((inst) => { reset[inst.instanceId] = false; });
      setInstanceSelections(reset);
    }
  };

  const handleRowClick = () => {
    if (isSelected) setIsPanelOpen((prev) => !prev);
  };

  const handleInstanceToggle = useCallback((instanceId: string, checked: boolean) => {
    setInstanceSelections((prev) => ({ ...prev, [instanceId]: checked }));
  }, []);

  return (
    <>
      <tr
        className={cn(
          'transition-colors',
          `hover:${bgColors.muted}`,
          isSelected && 'cursor-pointer',
          isPanelOpen && statusColors.info.bg
        )}
        onClick={handleRowClick}
      >
        {/* Checkbox */}
        {isEditMode && (
          <td className="px-6 py-4 w-12" onClick={(e) => e.stopPropagation()}>
            {isCheckboxEnabled && (
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!!resource.exclusion}
                onChange={(e) => handleCheckboxChange(e.target.checked)}
                className={cn('w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed', statusColors.pending.border)}
              />
            )}
          </td>
        )}

        {/* Instance Type + Cluster Type Badge */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <AwsServiceIcon type="RDS_CLUSTER" size="lg" />
            <span className={cn('font-medium', textColors.primary)}>RDS_CLUSTER</span>
            {resource.clusterType && (
              <Badge variant={resource.clusterType === 'GLOBAL' ? 'info' : 'pending'} size="sm">
                {resource.clusterType === 'GLOBAL' ? 'Global' : 'Regional'}
              </Badge>
            )}
          </div>
        </td>

        {/* Database Type */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <DatabaseIcon type={resource.databaseType} size="sm" />
            <span className={cn('text-sm', textColors.secondary)}>{getDatabaseLabel(resource.databaseType)}</span>
          </div>
        </td>

        {/* Resource ID + Instance summary */}
        <td className="px-6 py-4">
          <div>
            <span className={cn('font-mono text-sm', textColors.tertiary)}>{resource.resourceId}</span>
            <div className={cn('text-xs mt-0.5', textColors.quaternary)}>
              {instances.length} Instances
              {isSelected && selectedCount > 0 && (
                <span className={cn('ml-1', statusColors.info.textDark)}>
                  · {selectedCount}개 선택됨
                </span>
              )}
            </div>
            {isSelected && !isPanelOpen && <SelectedInstancesSummary instances={instances} />}
            {isReadOnly && <SelectedInstancesSummary instances={instances} />}
          </div>
        </td>

        {/* Connection Status placeholder */}
        {showConnectionStatus && <td className="px-6 py-4" />}

        {/* Status Icons + Chevron */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-1">
            {resource.isSelected && <StatusIcon type="selected" />}
            {resource.isNew && <StatusIcon type="new" />}
            {resource.connectionStatus === 'DISCONNECTED' && <StatusIcon type="disconnected" />}
            {isSelected && <ChevronIcon expanded={isPanelOpen} />}
          </div>
        </td>
      </tr>

      {/* Instance Panel */}
      {isPanelOpen && isSelected && (
        <InstancePanel
          instances={instances}
          isEditMode={isEditMode || isCheckboxEnabled}
          onInstanceToggle={handleInstanceToggle}
        />
      )}
    </>
  );
};
