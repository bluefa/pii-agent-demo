'use client';

import { useState } from 'react';
import { GCP_GUIDE_URLS, GCP_PSC_STATUS_LABELS } from '@/lib/constants/gcp';
import { statusColors, cn } from '@/lib/theme';
import type { PscConnection } from '@/app/api/_lib/v1-types';
import type { GcpPscStatus } from '@/lib/types/gcp';

interface PscApprovalGuideProps {
  pscConnection: PscConnection;
}

const getPscStatusColor = (status: GcpPscStatus) => {
  switch (status) {
    case 'APPROVED': return statusColors.success;
    case 'REJECTED': return statusColors.error;
    case 'PENDING_APPROVAL': return statusColors.warning;
    default: return statusColors.pending;
  }
};

export const PscApprovalGuide = ({ pscConnection }: PscApprovalGuideProps) => {
  const [expanded, setExpanded] = useState(false);
  const status = pscConnection.status as GcpPscStatus;
  const color = getPscStatusColor(status);
  const showGuide = status === 'PENDING_APPROVAL' || status === 'REJECTED';

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between py-1">
        <span className="text-xs text-gray-600">연결 상태</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', color.textDark)}>
            {GCP_PSC_STATUS_LABELS[status]}
          </span>
          {showGuide && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                'px-1.5 py-0.5 text-xs rounded transition-colors',
                statusColors.info.bg, statusColors.info.textDark,
                'hover:opacity-80'
              )}
            >
              {expanded ? '닫기' : '승인 방법 보기'}
            </button>
          )}
        </div>
      </div>

      {expanded && showGuide && (
        <div className={cn('mt-1 p-2 rounded border', statusColors.info.bg, statusColors.info.borderLight)}>
          <p className={cn('text-xs font-medium mb-1.5', statusColors.info.textDark)}>
            연결 승인 방법
          </p>

          {pscConnection.connectionId && (
            <div className="mb-1.5">
              <span className="text-xs text-gray-500">연결 ID</span>
              <div className="mt-0.5 px-2 py-1 bg-white rounded border border-gray-200 text-xs font-mono text-gray-700 break-all">
                {pscConnection.connectionId}
              </div>
            </div>
          )}

          {pscConnection.serviceAttachmentUri && (
            <div className="mb-1.5">
              <span className="text-xs text-gray-500">Service Attachment</span>
              <div className="mt-0.5 px-2 py-1 bg-white rounded border border-gray-200 text-xs font-mono text-gray-700 break-all">
                {pscConnection.serviceAttachmentUri}
              </div>
            </div>
          )}

          <div className="mb-2">
            <p className="text-xs text-gray-600 mb-1">승인 절차:</p>
            <ol className="text-xs text-gray-600 space-y-0.5 pl-4 list-decimal">
              <li>GCP Console에 로그인</li>
              <li>해당 Cloud SQL 인스턴스로 이동</li>
              <li>연결 &gt; Private Service Connect 메뉴 선택</li>
              <li>대기 중인 연결 요청 &quot;승인&quot; 클릭</li>
            </ol>
          </div>

          <a
            href={GCP_GUIDE_URLS.PSC_APPROVAL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors',
              statusColors.info.bg, statusColors.info.textDark,
              `border ${statusColors.info.borderLight} hover:border-blue-300`
            )}
          >
            GCP Console에서 확인 →
          </a>
        </div>
      )}
    </div>
  );
};
