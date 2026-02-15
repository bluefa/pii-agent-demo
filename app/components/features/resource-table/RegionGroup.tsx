'use client';

import { Resource, DatabaseType, SecretKey, VmDatabaseConfig } from '@/lib/types';
import { REGION_LABELS } from '@/lib/constants/labels';
import { ResourceRow } from './ResourceRow';

interface RegionGroupProps {
  region: string;
  resources: Resource[];
  selectedIds: Set<string>;
  isEditMode?: boolean;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  colSpan: number;
  credentials: SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  // VM 설정 관련
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
}

const RegionIcon = () => (
  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  </svg>
);

export const RegionGroup = ({
  region,
  resources,
  selectedIds,
  isEditMode = false,
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
}: RegionGroupProps) => (
  <>
    {/* Region Header */}
    <tr className="bg-gradient-to-r from-slate-50 to-transparent">
      <td colSpan={colSpan} className="px-6 py-2">
        <div className="flex items-center gap-2">
          <RegionIcon />
          <span className="text-sm font-semibold text-slate-700">
            {REGION_LABELS[region] || region}
          </span>
          <span className="text-xs text-slate-400">({resources.length})</span>
        </div>
      </td>
    </tr>
    {/* Region Resources */}
    {resources.map((resource) => (
      <ResourceRow
        key={resource.id}
        resource={resource}
        cloudProvider="AWS"
        selectedIds={selectedIds}
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
      />
    ))}
  </>
);
