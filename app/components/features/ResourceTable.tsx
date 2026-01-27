'use client';

import React, { useState, useMemo } from 'react';
import {
  Resource,
  CloudProvider,
  ProcessStatus,
  DatabaseType,
  DBCredential,
} from '@/lib/types';
import { filterCredentialsByType } from '@/lib/utils/credentials';
import {
  ResourceRow,
  RegionGroup,
  FilterTab,
  EmptyState,
  FilterType,
} from './resource-table';

interface ResourceTableProps {
  resources: Resource[];
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  isEditMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  credentials?: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

export const ResourceTable = ({
  resources,
  cloudProvider,
  processStatus,
  isEditMode = false,
  selectedIds: externalSelectedIds,
  onSelectionChange,
  credentials = [],
  onCredentialChange,
}: ResourceTableProps) => {
  const [filter, setFilter] = useState<FilterType>('selected');

  const selectedIdsSet = new Set(
    externalSelectedIds ?? resources.filter((r) => r.isSelected).map((r) => r.id)
  );

  const isAWS = cloudProvider === 'AWS';
  const isCheckboxEnabled =
    processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION || isEditMode;
  const showConnectionStatus =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;
  const showCredentialColumn =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;

  const filteredResources = resources.filter((resource) => {
    switch (filter) {
      case 'selected':
        return resource.isSelected || selectedIdsSet.has(resource.id);
      default:
        return true;
    }
  });

  const groupedByRegion = useMemo(() => {
    if (!isAWS) return null;

    const groups: Record<string, Resource[]> = {};
    filteredResources.forEach((resource) => {
      const region = resource.region || 'unknown';
      if (!groups[region]) groups[region] = [];
      groups[region].push(resource);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'ap-northeast-2') return -1;
      if (b === 'ap-northeast-2') return 1;
      return a.localeCompare(b);
    });
  }, [filteredResources, isAWS]);

  const handleCheckboxChange = (resourceId: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIdsSet);
    if (checked) {
      newSelectedIds.add(resourceId);
    } else {
      newSelectedIds.delete(resourceId);
    }
    onSelectionChange?.(Array.from(newSelectedIds));
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelectedIds = checked
      ? new Set(filteredResources.map((r) => r.id))
      : new Set<string>();
    onSelectionChange?.(Array.from(newSelectedIds));
  };

  const isAllSelected =
    filteredResources.length > 0 && filteredResources.every((r) => selectedIdsSet.has(r.id));
  const isSomeSelected =
    filteredResources.some((r) => selectedIdsSet.has(r.id)) && !isAllSelected;

  const colSpan = 5 + (showCredentialColumn ? 1 : 0) + (showConnectionStatus ? 1 : 0);

  const getCredentialsForType = (databaseType: DatabaseType): DBCredential[] => {
    return filterCredentialsByType(credentials, databaseType);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            리소스 목록
          </h3>
          <span className="text-sm text-gray-500">총 {resources.length}개</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 pt-4 pb-2 border-b border-gray-100">
        <div className="flex gap-2">
          <FilterTab
            label="연동 대상"
            count={resources.filter((r) => r.isSelected).length}
            active={filter === 'selected'}
            onClick={() => setFilter('selected')}
          />
          <FilterTab
            label="전체"
            count={resources.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
        </div>
      </div>

      {/* Table */}
      {filteredResources.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 w-12">
                  {isCheckboxEnabled && (
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                </th>
                <th className="px-6 py-3">인스턴스 타입</th>
                <th className="px-6 py-3">데이터베이스</th>
                <th className="px-6 py-3">리소스 ID</th>
                {showCredentialColumn && (
                  <th className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <span>Credential</span>
                      <div className="group relative">
                        <svg className="w-4 h-4 text-gray-400 cursor-help" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-xs">
                          <p>RDS, PostgreSQL, Redshift는</p>
                          <p>DB 접속 정보가 필요합니다.</p>
                          <p className="mt-1 text-gray-300">DynamoDB, Athena는 불필요</p>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                    </div>
                  </th>
                )}
                {showConnectionStatus && <th className="px-6 py-3">연결 상태</th>}
                <th className="px-6 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isAWS && groupedByRegion ? (
                groupedByRegion.map(([region, regionResources]) => (
                  <RegionGroup
                    key={region}
                    region={region}
                    resources={regionResources}
                    selectedIds={selectedIdsSet}
                    isCheckboxEnabled={isCheckboxEnabled}
                    showConnectionStatus={showConnectionStatus}
                    showCredentialColumn={showCredentialColumn}
                    onCheckboxChange={handleCheckboxChange}
                    colSpan={colSpan}
                    credentials={credentials}
                    getCredentialsForType={getCredentialsForType}
                    onCredentialChange={onCredentialChange}
                  />
                ))
              ) : (
                filteredResources.map((resource) => (
                  <ResourceRow
                    key={resource.id}
                    resource={resource}
                    isAWS={false}
                    selectedIds={selectedIdsSet}
                    isCheckboxEnabled={isCheckboxEnabled}
                    showConnectionStatus={showConnectionStatus}
                    showCredentialColumn={showCredentialColumn}
                    onCheckboxChange={handleCheckboxChange}
                    getCredentialsForType={getCredentialsForType}
                    onCredentialChange={onCredentialChange}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
