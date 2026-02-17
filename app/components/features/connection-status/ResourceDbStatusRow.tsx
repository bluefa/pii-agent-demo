'use client';

import { useState } from 'react';
import type { ResourceConnectionStatus, LogicalDbConnectionStatus, DatabaseType } from '@/lib/types';
import { LOGICAL_DB_STATUS_LABELS, ERROR_TYPE_LABELS } from '@/lib/constants/labels';
import { cn, statusColors, textColors } from '@/lib/theme';
import { getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';

interface ResourceDbStatusRowProps {
  resource: ResourceConnectionStatus;
}

const STATUS_CONFIG: Record<LogicalDbConnectionStatus, { icon: string; className: string }> = {
  SUCCESS: { icon: '●', className: statusColors.success.text },
  FAILED: { icon: '●', className: statusColors.error.text },
  CONNECTION_NOT_FOUND: { icon: '○', className: statusColors.pending.text },
};

export const ResourceDbStatusRow = ({ resource }: ResourceDbStatusRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const successCount = resource.logicalDatabases.filter(
    (db) => db.connectionStatus === 'SUCCESS',
  ).length;
  const totalCount = resource.logicalDatabases.length;
  const hasRestart = resource.logicalDatabases.some((db) => db.restartRequired);
  const hasFailed = resource.logicalDatabases.some((db) => db.connectionStatus === 'FAILED');

  return (
    <div className={cn('border rounded-lg overflow-hidden', hasFailed ? statusColors.error.border : 'border-gray-200')}>
      {/* 리소스 헤더 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
          isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* 펼침/접힘 화살표 */}
          <svg
            className={cn('w-4 h-4 transition-transform flex-shrink-0', textColors.quaternary, isExpanded && 'rotate-90')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          <span className={cn('font-medium text-sm truncate', textColors.primary)}>
            {resource.resourceName}
          </span>
          <span className={cn('text-xs flex-shrink-0', textColors.quaternary)}>
            ({getDatabaseLabel(resource.databaseType as DatabaseType)})
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* 성공/전체 카운트 */}
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            hasFailed
              ? cn(statusColors.error.bg, statusColors.error.textDark)
              : cn(statusColors.success.bg, statusColors.success.textDark),
          )}>
            {successCount}/{totalCount}
          </span>

          {/* 재시작 필요 뱃지 */}
          {hasRestart && (
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusColors.warning.bg, statusColors.warning.textDark)}>
              재시작 필요
            </span>
          )}
        </div>
      </button>

      {/* 논리 DB 테이블 */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className={cn('px-4 py-2 text-left font-medium', textColors.tertiary)}>스키마</th>
                <th className={cn('px-4 py-2 text-left font-medium', textColors.tertiary)}>상태</th>
                <th className={cn('px-4 py-2 text-left font-medium', textColors.tertiary)}>사유</th>
                <th className={cn('px-4 py-2 text-left font-medium', textColors.tertiary)}>확인 시간</th>
              </tr>
            </thead>
            <tbody>
              {resource.logicalDatabases.map((db) => {
                const config = STATUS_CONFIG[db.connectionStatus];
                const errorLabel = db.errorDetail
                  ? ERROR_TYPE_LABELS[db.errorDetail.status] ?? db.errorDetail.status
                  : undefined;

                return (
                  <tr key={db.name} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className={cn('px-4 py-2 font-mono text-xs', textColors.primary)}>
                      {db.name}
                      {db.restartRequired && (
                        <span className={cn('ml-2 text-xs', statusColors.warning.text)} title="재시작 필요">
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs', config.className)}>
                        <span className="text-xs">{config.icon}</span>
                        {LOGICAL_DB_STATUS_LABELS[db.connectionStatus]}
                      </span>
                    </td>
                    <td className={cn('px-4 py-2 text-xs', textColors.tertiary)}>
                      {errorLabel ?? '-'}
                    </td>
                    <td className={cn('px-4 py-2 text-xs', textColors.quaternary)}>
                      {db.lastCheckedAt
                        ? new Date(db.lastCheckedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
