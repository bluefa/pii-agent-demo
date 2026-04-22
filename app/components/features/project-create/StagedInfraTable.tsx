'use client';

import { Fragment } from 'react';
import { cn, bgColors, borderColors, statusColors, tableStyles, tagStyles, textColors } from '@/lib/theme';
import { DB_TYPE_LABEL } from '@/lib/constants/db-types';
import type { StagedInfra } from './types';

interface StagedInfraTableProps {
  items: StagedInfra[];
  onRemove: (tempId: string) => void;
}

const renderInfraInfo = (item: StagedInfra) => {
  const entries = Object.entries(item.credentials).filter(([, v]) => v && v.trim());
  if (entries.length === 0) return <span className={textColors.quaternary}>—</span>;
  return (
    <div className="space-y-0.5 font-mono text-[11.5px]">
      {entries.map(([key, value]) => (
        <div key={key} className={textColors.secondary}>
          {humanizeKey(key)}: {value}
        </div>
      ))}
    </div>
  );
};

const humanizeKey = (key: string): string => {
  switch (key) {
    case 'payerAccount': return 'Payer';
    case 'linkedAccount': return 'Linked';
    case 'tenantId': return 'Tenant';
    case 'subscriptionId': return 'Subscription';
    case 'projectId': return 'Project';
    default: return key;
  }
};

export const StagedInfraTable = ({ items, onRemove }: StagedInfraTableProps) => {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed px-4 py-8 text-center text-sm',
          borderColors.default,
          bgColors.muted,
          textColors.tertiary,
        )}
      >
        아직 추가된 인프라가 없습니다. 위에서 Provider와 정보를 입력한 뒤 <span className="font-medium">+ Add to List</span>를 눌러 추가하세요.
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border', borderColors.default)}>
      <table className="w-full text-sm">
        <thead className={tableStyles.header}>
          <tr>
            <th className="px-4 py-2.5">인프라 유형</th>
            <th className="px-4 py-2.5">인프라 정보</th>
            <th className="px-4 py-2.5">DB Type</th>
            <th className="px-4 py-2.5">커뮤니케이션 모듈</th>
            <th className="w-14 px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {items.map((item) => (
            <Fragment key={item.tempId}>
              <tr className="align-top">
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                      tagStyles.blue,
                    )}
                  >
                    {item.providerLabel}
                  </span>
                </td>
                <td className="px-4 py-3">{renderInfraInfo(item)}</td>
                <td className="px-4 py-3">
                  {item.dbTypes.length === 0 ? (
                    <span className={textColors.quaternary}>—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {item.dbTypes.map((t) => (
                        <span
                          key={t}
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                            tagStyles.blue,
                          )}
                        >
                          {DB_TYPE_LABEL[t] ?? t}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                      tagStyles.gray,
                    )}
                  >
                    {item.communicationModule}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    aria-label="삭제"
                    onClick={() => onRemove(item.tempId)}
                    className={cn(
                      'rounded-md p-1.5 transition-colors',
                      textColors.tertiary,
                      'hover:bg-red-50 hover:text-red-600',
                    )}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </td>
              </tr>
              {item.error && (
                <tr>
                  <td colSpan={5} className="px-4 pb-3">
                    <div
                      className={cn(
                        'rounded-md border px-3 py-2 text-xs',
                        statusColors.error.bg,
                        statusColors.error.border,
                        statusColors.error.textDark,
                      )}
                    >
                      생성 실패: {item.error}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};
