'use client';

import { Resource, CloudProvider, DatabaseType, SecretKey, VmDatabaseConfig } from '@/lib/types';
import { cn, textColors, bgColors } from '@/lib/theme';
import { ResourceRow } from './ResourceRow';

interface ResourceTableBodyProps {
  resources: Resource[];
  cloudProvider: CloudProvider;
  selectedIds: Set<string>;
  isEditMode: boolean;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  colSpan: number;
  getCredentialsForType: (databaseType: DatabaseType) => SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
}

export const FlatResourceTableBody = ({
  resources,
  cloudProvider,
  selectedIds,
  isEditMode,
  isCheckboxEnabled,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  colSpan,
  getCredentialsForType,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
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
        <th className="px-6 py-3 w-16" />
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {resources.map((resource) => (
        <ResourceRow
          key={resource.id}
          resource={resource}
          cloudProvider={cloudProvider}
          selectedIds={selectedIds}
          isEditMode={isEditMode}
          isCheckboxEnabled={isCheckboxEnabled}
          showConnectionStatus={showConnectionStatus}
          showCredentialColumn={showCredentialColumn}
          onCheckboxChange={onCheckboxChange}
          getCredentialsForType={getCredentialsForType}
          onCredentialChange={onCredentialChange}
          expandedVmId={expandedVmId}
          onVmConfigToggle={onVmConfigToggle}
          onVmConfigSave={onVmConfigSave}
        />
      ))}
    </tbody>
  </>
);
