'use client';

import { Resource, CloudProvider, SecretKey, VmDatabaseConfig } from '@/lib/types';
import type { AthenaSelectionRule } from '@/app/lib/api';
import { cn, textColors, bgColors } from '@/lib/theme';
import { ResourceRow } from './ResourceRow';

interface AthenaRegionCandidate {
  resource_id: string;
  athena_region: string;
  total_table_count: number;
}

interface ResourceTableBodyProps {
  resources: Resource[];
  cloudProvider: CloudProvider;
  targetSourceId?: number;
  selectedIds: Set<string>;
  isEditMode: boolean;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  colSpan: number;
  credentials: SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
  athenaRules?: AthenaSelectionRule[];
  onAthenaRulesChange?: (rules: AthenaSelectionRule[]) => void;
  athenaRegionsByResourceId?: Record<string, AthenaRegionCandidate>;
}

export const FlatResourceTableBody = ({
  resources,
  cloudProvider,
  targetSourceId,
  selectedIds,
  isEditMode,
  isCheckboxEnabled,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  colSpan,
  credentials,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
  athenaRules,
  onAthenaRulesChange,
  athenaRegionsByResourceId,
}: ResourceTableBodyProps) => (
  <>
    <thead>
      <tr className={cn('text-left text-xs font-medium uppercase tracking-wider', textColors.tertiary, bgColors.muted)}>
        {isEditMode && <th className="px-6 py-3 w-12" />}
        <th className="px-6 py-3">인스턴스 타입</th>
        <th className="px-6 py-3">리소스 ID</th>
        <th className="px-6 py-3">데이터베이스</th>
        {showCredentialColumn && <th className="px-6 py-3">Credential</th>}
        {showConnectionStatus && <th className="px-6 py-3">연결 상태</th>}
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {resources.map((resource) => (
        <ResourceRow
          key={resource.id}
          resource={resource}
          cloudProvider={cloudProvider}
          targetSourceId={targetSourceId}
          selectedIds={selectedIds}
          colSpan={colSpan}
          isEditMode={isEditMode}
          isCheckboxEnabled={isCheckboxEnabled}
          showConnectionStatus={showConnectionStatus}
          showCredentialColumn={showCredentialColumn}
          onCheckboxChange={onCheckboxChange}
          credentials={credentials}
          onCredentialChange={onCredentialChange}
          expandedVmId={expandedVmId}
          onVmConfigToggle={onVmConfigToggle}
          onVmConfigSave={onVmConfigSave}
          athenaRules={athenaRules}
          onAthenaRulesChange={onAthenaRulesChange}
          athenaRegionsByResourceId={athenaRegionsByResourceId}
        />
      ))}
    </tbody>
  </>
);
