'use client';

import { useState } from 'react';
import { CloudProvider } from '@/lib/types';
import { useScanPolling } from '@/app/hooks/useScanPolling';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { startScan } from '@/app/lib/api/scan';
import { cn } from '@/lib/theme';
import { ScanStatusBadge } from './ScanStatusBadge';
import { ScanProgressBar } from './ScanProgressBar';
import { ScanResultSummary } from './ScanResultSummary';
import { ScanHistoryList } from './ScanHistoryList';
import { useCooldownTimer } from './CooldownTimer';

interface ScanPanelProps {
  projectId: string;
  cloudProvider: CloudProvider;
  /** 스캔 완료 시 호출되는 콜백. 부모에서 프로젝트 새로고침 처리 */
  onScanComplete?: () => void;
}

export const ScanPanel = ({ projectId, cloudProvider, onScanComplete }: ScanPanelProps) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showResult, setShowResult] = useState(true);

  // 스캔 상태 폴링
  const {
    status,
    uiState,
    loading,
    refresh,
    startPolling,
  } = useScanPolling(projectId, {
    onScanComplete: () => {
      // 스캔 완료 시 결과 표시
      setShowResult(true);
      // 부모 컴포넌트에 알림 (프로젝트 새로고침 트리거)
      onScanComplete?.();
    },
  });

  // 스캔 시작 액션
  const { execute: doStartScan, loading: starting } = useApiAction(
    () => startScan(projectId),
    {
      onSuccess: () => {
        startPolling();
        refresh();
      },
      errorMessage: '스캔을 시작할 수 없습니다.',
    }
  );

  // 쿨다운 타이머
  const { remainingMs, formatted: cooldownText } = useCooldownTimer(
    status?.cooldownUntil,
    refresh
  );
  const isCooldown = uiState === 'COOLDOWN' && remainingMs > 0;

  const handleStartScan = () => {
    if (status?.canScan) {
      doStartScan();
    }
  };

  const canStartScan = status?.canScan && !starting && uiState !== 'IN_PROGRESS';

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScanStatusBadge uiState={loading ? 'IDLE' : uiState} />
          <span className="text-sm font-medium text-gray-700">리소스 스캔</span>
          <span className="text-xs text-gray-400">({cloudProvider})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 이력 토글 버튼 */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showHistory ? '이력 접기' : '이력 보기'}
          </button>

          {/* 스캔 시작 버튼 */}
          <button
            onClick={handleStartScan}
            disabled={!canStartScan}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
              canStartScan
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            {starting ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                시작 중...
              </span>
            ) : isCooldown ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {cooldownText} 후
              </span>
            ) : (
              '스캔 시작'
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-500">상태 확인 중...</span>
          </div>
        )}

        {/* IN_PROGRESS: Progress Bar */}
        {!loading && uiState === 'IN_PROGRESS' && status?.currentScan && (
          <ScanProgressBar
            progress={status.currentScan.progress}
            startedAt={status.currentScan.startedAt}
          />
        )}

        {/* COMPLETED or COOLDOWN: Result Summary (쿨다운 상태에서도 결과 표시) */}
        {!loading && (uiState === 'COMPLETED' || uiState === 'COOLDOWN') && status?.lastCompletedScan?.result && showResult && (
          <ScanResultSummary
            result={status.lastCompletedScan.result}
            completedAt={status.lastCompletedScan.completedAt}
            onClose={() => setShowResult(false)}
          />
        )}

        {/* FAILED: Error Message */}
        {!loading && uiState === 'FAILED' && (
          <div className="flex items-center gap-2 py-4 px-3 bg-red-50 rounded-lg">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-700">
              스캔 중 오류가 발생했습니다. 다시 시도해주세요.
            </span>
          </div>
        )}

        {/* IDLE: No scan yet */}
        {!loading && uiState === 'IDLE' && !status?.lastCompletedScan && (
          <div className="text-center py-6 text-sm text-gray-500">
            스캔을 시작하여 리소스를 검색하세요.
          </div>
        )}

        {/* 결과 닫힘 상태일 때 마지막 스캔 정보 간략 표시 (쿨다운 포함) */}
        {!loading && (uiState === 'COMPLETED' || uiState === 'COOLDOWN') && status?.lastCompletedScan?.result && !showResult && (
          <button
            onClick={() => setShowResult(true)}
            className="w-full text-center py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            마지막 스캔 결과 보기 (발견: {status.lastCompletedScan.result.totalFound}개)
          </button>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="border-t border-gray-100">
          <div className="px-4 py-3 bg-gray-50">
            <span className="text-xs font-medium text-gray-500 uppercase">스캔 이력</span>
          </div>
          <ScanHistoryList projectId={projectId} limit={5} />
        </div>
      )}
    </div>
  );
};

export default ScanPanel;
