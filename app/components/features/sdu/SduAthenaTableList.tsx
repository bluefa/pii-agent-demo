'use client';

import type { SduAthenaTable } from '@/lib/types/sdu';
import { tableStyles, cn } from '@/lib/theme';

interface SduAthenaTableListProps {
  tables: SduAthenaTable[];
  database: string;
}

export const SduAthenaTableList = ({ tables, database }: SduAthenaTableListProps) => {
  if (tables.length === 0) {
    return (
      <div className="w-full p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p className="text-sm font-medium text-gray-600">생성된 Athena Table이 없습니다.</p>
        <p className="text-xs text-gray-500 mt-1">Crawler 실행 후 테이블이 생성됩니다.</p>
      </div>
    );
  }

  return (
    <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className={tableStyles.header}>
          <tr>
            <th className={tableStyles.headerCell}>Table명</th>
            <th className={tableStyles.headerCell}>S3 Location</th>
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {tables.map((table) => (
            <tr key={table.tableName} className={tableStyles.row}>
              <td className={tableStyles.cell}>
                <code className="text-sm font-mono text-gray-900">
                  {database}.{table.tableName}
                </code>
              </td>
              <td className={tableStyles.cell}>
                <code className="text-xs font-mono text-gray-600">
                  {table.s3Location}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
