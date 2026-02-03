'use client';

import { ScanStatus } from '@/lib/types';

interface ScanProgressProps {
  /** 스캔 상태 */
  status: ScanStatus;
  /** 진행률 (0-100) */
  progress: number;
  /** 에러 메시지 */
  error?: string | null;
}

/**
 * 스캔 진행 상태 표시 컴포넌트
 * - PENDING: 스캔 준비 중
 * - IN_PROGRESS: 프로그레스 바 + 진행률
 * - FAILED: 에러 메시지
 */
export const ScanProgress = ({ status, progress, error }: ScanProgressProps) => {
  if (status === 'COMPLETED') {
    return null;
  }

  if (status === 'FAILED') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
        <svg
          className="h-5 w-5 text-red-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm text-red-700">
          스캔 실패: {error || '알 수 없는 오류가 발생했습니다.'}
        </span>
      </div>
    );
  }

  const getMessage = () => {
    if (status === 'PENDING') {
      return '스캔 준비 중...';
    }
    return `스캔 중... ${progress}%`;
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="animate-spin h-4 w-4 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm text-blue-700 font-medium">{getMessage()}</span>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>
    </div>
  );
};

export default ScanProgress;
