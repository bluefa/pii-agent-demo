'use client';

import { DBCredential } from '@/lib/types';
import { formatDateOnly } from '@/lib/utils/date';

interface CredentialListTabProps {
  credentials: DBCredential[];
}

export const CredentialListTab = ({ credentials }: CredentialListTabProps) => {

  if (credentials.length === 0) {
    return (
      <div>
        {/* 상단 안내 */}
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-gray-700 mb-2">
            RDS, PostgreSQL, Redshift 연결에 필요한 DB 접속 정보입니다.
          </p>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert('Credential 관리 페이지로 이동합니다. (데모에서는 미구현)');
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center gap-1"
          >
            Credential 등록 페이지로 이동
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">등록된 Credential이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 상단 안내 */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <p className="text-sm text-gray-700 mb-2">
          RDS, PostgreSQL, Redshift 연결에 필요한 DB 접속 정보입니다.
        </p>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            alert('Credential 관리 페이지로 이동합니다. (데모에서는 미구현)');
          }}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center gap-1"
        >
          Credential 등록 페이지로 이동
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">등록일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {credentials.map((cred) => (
              <tr key={cred.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-900">{cred.name}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDateOnly(cred.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
