'use client';

import { cn, textColors, bgColors } from '@/lib/theme';
import { ResourceRow } from './ResourceRow';
import type { ResourceTableBodyProps } from './types';

export const FlatResourceTableBody = ({
  resources,
  processStatus,
  selectedIds,
  isEditMode,
  isCheckboxEnabled,
  showCredentialColumn,
  onCheckboxChange,
  credentials,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
}: ResourceTableBodyProps) => (
  <>
    <thead>
      <tr className={cn('text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap', textColors.tertiary, bgColors.muted)}>
        {isEditMode && <th className="px-6 py-3 w-10" />}
        <th className="px-6 py-3">연동 대상 여부</th>
        <th className="px-6 py-3">DB Type</th>
        <th className="px-6 py-3">Resource ID</th>
        <th className="px-6 py-3">Region</th>
        <th className="px-6 py-3">DB Name</th>
        <th className="px-6 py-3">연동 완료 여부</th>
        <th className="px-6 py-3">스캔 이력</th>
        {showCredentialColumn && <th className="px-6 py-3">Credential</th>}
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {resources.map((resource) => (
        <ResourceRow
          key={resource.id}
          resource={resource}
          processStatus={processStatus}
          selectedIds={selectedIds}
          isEditMode={isEditMode}
          isCheckboxEnabled={isCheckboxEnabled}
          showCredentialColumn={showCredentialColumn}
          onCheckboxChange={onCheckboxChange}
          credentials={credentials}
          onCredentialChange={onCredentialChange}
          expandedVmId={expandedVmId}
          onVmConfigToggle={onVmConfigToggle}
          onVmConfigSave={onVmConfigSave}
        />
      ))}
    </tbody>
  </>
);
