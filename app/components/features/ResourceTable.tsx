'use client';

import React, { useState, useMemo } from 'react';
import {
  Resource,
  CloudProvider,
  ProcessStatus,
  ConnectionStatus,
  AwsResourceType,
  DatabaseType,
  DBCredential,
  needsCredential,
} from '../../../lib/types';
import { DatabaseIcon, getDatabaseLabel } from '../ui/DatabaseIcon';
import { AwsServiceIcon } from '../ui/AwsServiceIcon';

interface ResourceTableProps {
  resources: Resource[];
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  isEditMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  // 4단계 Credential 관련
  credentials?: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

type FilterType = 'all' | 'selected';

const CONNECTION_STATUS_CONFIG: Record<ConnectionStatus, { label: string; className: string; icon: string }> = {
  CONNECTED: { label: '연결됨', className: 'text-green-500', icon: '●' },
  DISCONNECTED: { label: '연결 끊김', className: 'text-red-500', icon: '●' },
  PENDING: { label: '대기중', className: 'text-gray-400', icon: '○' },
};

const REGION_LABELS: Record<string, string> = {
  'ap-northeast-2': '서울 (ap-northeast-2)',
  'ap-northeast-1': '도쿄 (ap-northeast-1)',
  'us-east-1': '버지니아 (us-east-1)',
  'us-west-2': '오레곤 (us-west-2)',
};

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

  // 외부에서 selectedIds를 받으면 그것을 사용, 아니면 내부 상태 사용
  const selectedIdsSet = new Set(
    externalSelectedIds ?? resources.filter((r) => r.isSelected).map((r) => r.id)
  );

  const isAWS = cloudProvider === 'AWS';
  // 1단계이거나 편집 모드일 때 체크박스 활성화
  const isCheckboxEnabled =
    processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION || isEditMode;
  const showConnectionStatus =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;
  // 4단계, 5단계, 6단계에서 Credential 컬럼 표시
  const showCredentialColumn =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;

  // 필터링된 리소스
  const filteredResources = resources.filter((resource) => {
    switch (filter) {
      case 'selected':
        return resource.isSelected || selectedIdsSet.has(resource.id);
      default:
        return true;
    }
  });

  // Region별 그룹화 (AWS만)
  const groupedByRegion = useMemo(() => {
    if (!isAWS) return null;

    const groups: Record<string, Resource[]> = {};
    filteredResources.forEach((resource) => {
      const region = resource.region || 'unknown';
      if (!groups[region]) groups[region] = [];
      groups[region].push(resource);
    });

    // Region 정렬: 서울 먼저, 나머지는 알파벳순
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

  // DB 타입에 맞는 credential 목록 가져오기
  const getCredentialsForType = (databaseType: DatabaseType): DBCredential[] => {
    return (credentials || []).filter((c) => c.databaseType === databaseType);
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
                // AWS: Region별 그룹화
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
                // IDC: Flat list
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
                    credentials={credentials}
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

// Region Group Component
interface RegionGroupProps {
  region: string;
  resources: Resource[];
  selectedIds: Set<string>;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  colSpan: number;
  credentials: DBCredential[];
  getCredentialsForType: (databaseType: DatabaseType) => DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

const RegionGroup = ({
  region,
  resources,
  selectedIds,
  isCheckboxEnabled,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  colSpan,
  credentials,
  getCredentialsForType,
  onCredentialChange,
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
        isAWS={true}
        selectedIds={selectedIds}
        isCheckboxEnabled={isCheckboxEnabled}
        showConnectionStatus={showConnectionStatus}
        showCredentialColumn={showCredentialColumn}
        onCheckboxChange={onCheckboxChange}
        credentials={credentials}
        getCredentialsForType={getCredentialsForType}
        onCredentialChange={onCredentialChange}
      />
    ))}
  </>
);

// Resource Row Component
interface ResourceRowProps {
  resource: Resource;
  isAWS: boolean;
  selectedIds: Set<string>;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  credentials: DBCredential[];
  getCredentialsForType: (databaseType: DatabaseType) => DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

const ResourceRow = ({
  resource,
  isAWS,
  selectedIds,
  isCheckboxEnabled,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  getCredentialsForType,
  onCredentialChange,
}: ResourceRowProps) => {
  const needsCred = needsCredential(resource.databaseType);
  const availableCredentials = needsCred ? getCredentialsForType(resource.databaseType) : [];
  const hasCredentialError = showCredentialColumn && needsCred && resource.isSelected && !resource.selectedCredentialId;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Checkbox (1단계에서만 활성화) */}
      <td className="px-6 py-4 w-12">
        {isCheckboxEnabled && (
          <input
            type="checkbox"
            checked={selectedIds.has(resource.id)}
            onChange={(e) => onCheckboxChange(resource.id, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        )}
      </td>

      {/* Instance Type */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {isAWS && resource.awsType && <AwsServiceIcon type={resource.awsType} size="lg" />}
          <span className="font-medium text-gray-900">{resource.awsType || resource.type}</span>
        </div>
      </td>

      {/* Database Type */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <DatabaseIcon type={resource.databaseType} size="sm" />
          <span className="text-sm text-gray-700">{getDatabaseLabel(resource.databaseType)}</span>
        </div>
      </td>

      {/* Resource ID */}
      <td className="px-6 py-4">
        <span className="text-gray-600 font-mono text-sm">{resource.resourceId}</span>
      </td>

      {/* Credential (4단계만) */}
      {showCredentialColumn && (
        <td className="px-6 py-4">
          {needsCred ? (
            <select
              value={resource.selectedCredentialId || ''}
              onChange={(e) => onCredentialChange?.(resource.id, e.target.value || null)}
              className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                hasCredentialError
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : resource.selectedCredentialId
                  ? 'border-green-300 bg-green-50 text-gray-900'
                  : 'border-gray-300 text-gray-900'
              }`}
            >
              <option value="">{hasCredentialError ? '미선택' : '선택하세요'}</option>
              {availableCredentials.map((cred) => (
                <option key={cred.id} value={cred.id}>
                  {cred.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-gray-400">불필요</span>
          )}
        </td>
      )}

      {/* Connection Status (4단계, 5단계만) */}
      {showConnectionStatus && (
        <td className="px-6 py-4">
          <ConnectionIndicator status={resource.connectionStatus} hasCredentialError={hasCredentialError} />
        </td>
      )}

      {/* Status Icons */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          {resource.isSelected && <StatusIcon type="selected" />}
          {resource.isNew && <StatusIcon type="new" />}
          {resource.connectionStatus === 'DISCONNECTED' && <StatusIcon type="disconnected" />}
        </div>
      </td>
    </tr>
  );
};

const RegionIcon = () => (
  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  </svg>
);

// Sub-components

interface FilterTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

const FilterTab = ({ label, count, active, onClick }: FilterTabProps) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {label}
    <span
      className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
        active ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {count}
    </span>
  </button>
);

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  hasCredentialError?: boolean;
}

const ConnectionIndicator = ({ status, hasCredentialError }: ConnectionIndicatorProps) => {
  // Credential 미선택 에러가 있으면 빨간색 표시
  if (hasCredentialError) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg text-red-500">●</span>
        <span className="text-sm text-red-500">Credential 미선택</span>
      </div>
    );
  }

  const config = CONNECTION_STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`text-lg ${config.className}`}>{config.icon}</span>
      <span className="text-sm text-gray-600">{config.label}</span>
    </div>
  );
};

// Status Icons with Tooltip
interface StatusIconProps {
  type: 'selected' | 'new' | 'disconnected';
}

const StatusIcon = ({ type }: StatusIconProps) => {
  const configs = {
    selected: {
      icon: (
        <svg className="w-5 h-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      tooltip: '연동 대상',
      bgColor: 'bg-green-50',
    },
    new: {
      icon: (
        <svg className="w-5 h-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
        </svg>
      ),
      tooltip: '신규 발견된 리소스',
      bgColor: 'bg-blue-50',
    },
    disconnected: {
      icon: (
        <svg className="w-5 h-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
      tooltip: '연결이 끊어졌습니다',
      bgColor: 'bg-red-50',
    },
  };

  const config = configs[type];

  return (
    <div className="group relative">
      <div className={`p-1 rounded ${config.bgColor} cursor-help`}>
        {config.icon}
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {config.tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
};

interface EmptyStateProps {
  filter: FilterType;
}

const EmptyState = ({ filter }: EmptyStateProps) => {
  const messages: Record<FilterType, string> = {
    all: '리소스가 없습니다.',
    selected: '연동 대상으로 선택된 리소스가 없습니다.',
  };

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
          />
        </svg>
      </div>
      <p className="text-gray-500">{messages[filter]}</p>
    </div>
  );
};
