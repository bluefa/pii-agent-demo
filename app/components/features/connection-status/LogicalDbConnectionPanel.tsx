'use client';

import { useState, useEffect } from 'react';
import { ProcessStatus } from '@/lib/types';
import type { ConnectionStatusResponse } from '@/lib/types';
import { getConnectionStatus } from '@/app/lib/api';
import { ResourceDbStatusRow } from './ResourceDbStatusRow';
import { cn, statusColors, textColors } from '@/lib/theme';

interface LogicalDbConnectionPanelProps {
  targetSourceId: number;
  processStatus: ProcessStatus;
}

export const LogicalDbConnectionPanel = ({
  targetSourceId,
  processStatus,
}: LogicalDbConnectionPanelProps) => {
  const [data, setData] = useState<ConnectionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 설치 완료(6)이면 기본 펼침, 그 외(4~5)는 접힘
  const [isExpanded, setIsExpanded] = useState(
    processStatus === ProcessStatus.INSTALLATION_COMPLETE,
  );

  useEffect(() => {
    if (processStatus < ProcessStatus.WAITING_CONNECTION_TEST) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getConnectionStatus(targetSourceId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '연결 상태를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [targetSourceId, processStatus]);

  // 연결 테스트 이전 단계에서는 숨김
  if (processStatus < ProcessStatus.WAITING_CONNECTION_TEST) return null;

  // 로딩 중
  if (loading) {
    return (
      <div className="mt-4 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          <span className={cn('text-sm', textColors.tertiary)}>논리 DB 연결 현황 로딩 중...</span>
        </div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className={cn('mt-4 border rounded-lg p-4', statusColors.error.border, statusColors.error.bg)}>
        <span className={cn('text-sm', statusColors.error.textDark)}>{error}</span>
      </div>
    );
  }

  // 데이터 없음
  if (!data || data.resources.length === 0) return null;

  const { summary } = data;
  const notFoundCount = summary.totalLogicalDbs - summary.connectedLogicalDbs - summary.failedLogicalDbs;

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      {/* 헤더 (접힘/펼침 토글) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
          isExpanded ? 'bg-gray-50 border-b border-gray-200' : 'hover:bg-gray-50',
        )}
      >
        <div className="flex items-center gap-2">
          <svg
            className={cn('w-4 h-4 transition-transform', textColors.quaternary, isExpanded && 'rotate-90')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={cn('text-sm font-semibold', textColors.primary)}>논리 DB 연결 현황</span>
        </div>

        {/* 요약 카운트 */}
        <div className="flex items-center gap-3 text-xs">
          <span className={textColors.tertiary}>
            전체 {summary.totalLogicalDbs}
          </span>
          <span className={statusColors.success.textDark}>
            성공 {summary.connectedLogicalDbs}
          </span>
          {summary.failedLogicalDbs > 0 && (
            <span className={statusColors.error.textDark}>
              실패 {summary.failedLogicalDbs}
            </span>
          )}
          {notFoundCount > 0 && (
            <span className={statusColors.pending.textDark}>
              미연결 {notFoundCount}
            </span>
          )}
        </div>
      </button>

      {/* 본문 */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* 재진행 안내 (processStatus < 4 = 이전 설치 데이터) */}
          {processStatus < ProcessStatus.WAITING_CONNECTION_TEST && data.resources.length > 0 && (
            <div className={cn('text-xs px-3 py-2 rounded', statusColors.info.bg, statusColors.info.textDark)}>
              이전 설치의 논리 DB 연결 현황입니다. 새 프로세스가 완료되면 갱신됩니다.
            </div>
          )}

          {/* 리소스별 행 */}
          {data.resources.map((resource) => (
            <ResourceDbStatusRow key={resource.resourceId} resource={resource} />
          ))}

          {/* 마지막 확인 시간 */}
          <div className={cn('text-xs text-right', textColors.quaternary)}>
            마지막 확인: {new Date(data.checkedAt).toLocaleString('ko-KR')}
          </div>
        </div>
      )}
    </div>
  );
};
