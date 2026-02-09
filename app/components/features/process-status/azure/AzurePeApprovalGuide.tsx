'use client';

import { statusColors, cn, modalStyles } from '@/lib/theme';

interface AzurePeApprovalGuideProps {
  peId?: string;
  onClose: () => void;
}

export const AzurePeApprovalGuide = ({ peId, onClose }: AzurePeApprovalGuideProps) => (
  <div className={modalStyles.overlay} onClick={onClose}>
    <div
      className={cn(modalStyles.container, modalStyles.sizes.lg, 'w-full mx-4')}
      onClick={e => e.stopPropagation()}
    >
      <div className={modalStyles.header}>
        <h3 className="text-lg font-semibold text-gray-900">보안 연결 승인 방법</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={modalStyles.body}>
        <div className="space-y-4 text-sm text-gray-600">
          <p>Azure Portal에서 보안 연결 요청을 승인해야 합니다.</p>

          {peId && (
            <div className={cn('p-3 rounded-lg', statusColors.pending.bg)}>
              <span className="text-xs text-gray-500">연결 ID</span>
              <p className="font-mono text-sm text-gray-900 break-all">{peId}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-medium text-gray-900">승인 절차:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Azure Portal에 로그인</li>
              <li>해당 리소스 (DB/Storage 등)로 이동</li>
              <li><span className="font-medium">네트워킹 &rarr; 보안 연결</span> 메뉴 선택</li>
              <li>대기 중인 연결 요청 선택 후 <span className={cn('font-medium', statusColors.success.textDark)}>승인</span> 클릭</li>
            </ol>
          </div>

          <a
            href="https://portal.azure.com/#browse/Microsoft.Network%2FprivateEndpoints"
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-2 hover:underline', statusColors.info.textDark)}
          >
            Azure Portal에서 보안 연결 보기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      <div className={modalStyles.footer}>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  </div>
);
