'use client';

import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import type { DatabaseType } from '@/lib/types';
import { cn, statusColors, tagStyles, textColors } from '@/lib/theme';

interface InfraDbTableProps {
  resources: ConfirmedIntegrationResourceItem[];
}

/**
 * ConfirmedIntegrationResourceItem → 6-column table mapping
 *
 * | 컬럼              | 소스 필드                                            |
 * | ----------------- | ---------------------------------------------------- |
 * | Database name     | host ?? resource_id                                  |
 * | DB Type           | database_type (tag, 미확인은 gray "-")               |
 * | Region            | resource_id 파싱 불가 → "—" (상세는 A4+ 통합 시점에서) |
 * | 연동 대상 여부    | 응답에 포함되면 "대상"                               |
 * | 연동 완료 여부    | credential_id 유무로 "연동 완료" / "연동 진행중"     |
 * | 연동 상태         | credential_id 유무로 Healthy / 준비중                |
 */

const DB_TYPE_LABEL: Record<DatabaseType, string> = {
  MYSQL: 'MySQL',
  POSTGRESQL: 'PostgreSQL',
  MSSQL: 'MSSQL',
  DYNAMODB: 'DynamoDB',
  ATHENA: 'Athena',
  REDSHIFT: 'Redshift',
  COSMOSDB: 'Cosmos DB',
  BIGQUERY: 'BigQuery',
  MONGODB: 'MongoDB',
  ORACLE: 'Oracle',
};

const dbTypeTag = (dbType: DatabaseType | null): string => {
  if (!dbType) return tagStyles.gray;
  switch (dbType) {
    case 'MYSQL':
    case 'POSTGRESQL':
    case 'MSSQL':
      return tagStyles.blue;
    case 'DYNAMODB':
    case 'ATHENA':
    case 'REDSHIFT':
      return tagStyles.orange;
    case 'COSMOSDB':
    case 'BIGQUERY':
    case 'MONGODB':
    case 'ORACLE':
      return tagStyles.green;
    default:
      return tagStyles.gray;
  }
};

const resolveDatabaseName = (item: ConfirmedIntegrationResourceItem): string => {
  return item.host ?? item.resource_id ?? '-';
};

export const InfraDbTable = ({ resources }: InfraDbTableProps) => {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <th className={cn('text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider', textColors.tertiary)}>
            Database name
          </th>
          <th className={cn('text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider', textColors.tertiary)}>
            DB Type
          </th>
          <th className={cn('text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider', textColors.tertiary)}>
            Region
          </th>
          <th className={cn('text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider', textColors.tertiary)}>
            연동 대상 여부
          </th>
          <th className={cn('text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider', textColors.tertiary)}>
            연동 완료 여부
          </th>
          <th className={cn('text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider', textColors.tertiary)}>
            연동 상태
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {resources.map((item) => {
          const completed = Boolean(item.credential_id);
          return (
            <tr key={`${item.resource_id}-${item.host ?? ''}`} className="hover:bg-gray-50/50 transition-colors">
              <td className={cn('px-4 py-3.5 font-mono text-xs', textColors.secondary)}>
                {resolveDatabaseName(item)}
              </td>
              <td className="px-4 py-3.5">
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', dbTypeTag(item.database_type))}>
                  {item.database_type ? DB_TYPE_LABEL[item.database_type] : '미확인'}
                </span>
              </td>
              <td className={cn('px-4 py-3.5 font-mono text-xs', textColors.tertiary)}>
                —
              </td>
              <td className={cn('px-4 py-3.5 text-xs', textColors.secondary)}>대상</td>
              <td className={cn('px-4 py-3.5 text-xs', completed ? textColors.secondary : textColors.tertiary)}>
                {completed ? '연동 완료' : '연동 진행중'}
              </td>
              <td className="px-4 py-3.5">
                <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', completed ? statusColors.success.textDark : statusColors.warning.textDark)}>
                  <span className={cn('w-2 h-2 rounded-full', completed ? statusColors.success.dot : statusColors.warning.dot)} />
                  {completed ? 'Healthy' : '준비중'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
