'use client';

import { useState, useEffect } from 'react';
import { ScanResult } from '@/lib/types';

interface ScanResultSummaryProps {
  /** 스캔 결과 */
  result: ScanResult;
  /** 닫기 핸들러 */
  onDismiss?: () => void;
  /** 자동 닫힘 시간 (ms, 기본: 10000) */
  autoDismissMs?: number;
}

/**
 * 스캔 결과 요약 배너
 * - 성공 시: 총 발견/신규/변경 수 표시
 * - 자동 닫힘 지원 (10초 후)
 */
export const ScanResultSummary = ({
  result,
  onDismiss,
  autoDismissMs = 10000,
}: ScanResultSummaryProps) => {
  const [isVisible, setIsVisible] = useState(true);

  // 자동 닫힘
  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoDismissMs);

      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) {
    return null;
  }

  const hasChanges = result.newFound > 0 || result.updated > 0 || result.removed > 0;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-green-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm text-green-700">
          <span className="font-medium">스캔 완료:</span>{' '}
          총 {result.totalFound}개 리소스
          {hasChanges && (
            <span className="text-green-600">
              {result.newFound > 0 && ` (신규 ${result.newFound}개`}
              {result.updated > 0 && `${result.newFound > 0 ? ', ' : ' ('}변경 ${result.updated}개`}
              {result.removed > 0 && `${result.newFound > 0 || result.updated > 0 ? ', ' : ' ('}삭제 ${result.removed}개`}
              {')'}
            </span>
          )}
        </span>
      </div>

      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="text-green-600 hover:text-green-800 p-1 rounded-md hover:bg-green-100 transition-colors"
          aria-label="닫기"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ScanResultSummary;
