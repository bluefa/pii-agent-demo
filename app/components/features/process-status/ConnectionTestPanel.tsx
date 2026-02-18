'use client';

import { useState, useEffect, useRef } from 'react';
import { Resource } from '@/lib/types';
import { useTestConnectionPolling } from '@/app/hooks/useTestConnectionPolling';
import type { TestConnectionJob, TestConnectionResourceResult } from '@/app/lib/api';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { statusColors, primaryColors, getButtonClass, cn } from '@/lib/theme';

interface ConnectionTestPanelProps {
  targetSourceId: number;
  selectedResources: Resource[];
}

// ===== Sub-components =====

const LastSuccessBar = ({
  job,
  onShowDetail,
}: {
  job: TestConnectionJob | null;
  onShowDetail: () => void;
}) => {
  if (!job) {
    return (
      <div className={cn('px-4 py-3 rounded-lg', statusColors.info.bgLight, 'border', statusColors.info.borderLight)}>
        <span className="text-sm text-gray-500">아직 성공한 연결 테스트가 없습니다</span>
      </div>
    );
  }

  const date = new Date(job.requested_at ?? job.completed_at ?? '');
  const resourceCount = job.resource_results.length;

  return (
    <div className={cn('px-4 py-3 rounded-lg flex items-center justify-between', statusColors.success.bg, 'border', statusColors.success.border)}>
      <div className="flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full', statusColors.success.dot)} />
        <span className="text-sm font-medium text-gray-700">
          {date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-sm text-gray-500">
          성공 ({resourceCount}개 리소스)
        </span>
      </div>
      <button
        onClick={onShowDetail}
        className={cn('text-sm font-medium', primaryColors.text, primaryColors.textHover)}
      >
        확인하러 가기
      </button>
    </div>
  );
};

const ProgressBar = ({
  job,
  totalResources,
}: {
  job: TestConnectionJob;
  totalResources: number;
}) => {
  const completed = job.resource_results.filter((r) => r.status !== 'PENDING').length;
  const total = totalResources || completed || 1;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-700 font-medium">연결 테스트 진행 중...</span>
        </div>
        <span className="text-gray-500">{completed}/{total} 리소스 완료</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', primaryColors.bg)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

const ResourceResultRow = ({ result }: { result: TestConnectionResourceResult }) => {
  const isSuccess = result.status === 'SUCCESS';
  const isFail = result.status === 'FAIL';

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-b-0',
      isFail && 'bg-red-50/50',
    )}>
      <span className={cn(
        'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
        isSuccess ? statusColors.success.dot : statusColors.error.dot,
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase">{result.resource_type}</span>
          <span className="text-sm text-gray-700 font-mono truncate">{result.resource_id}</span>
        </div>
        {isFail && (
          <div className="mt-1 text-xs text-red-600">
            <span className="font-medium">{result.error_status}</span>
            {result.guide ? (
              <span className="ml-1 text-red-500">— {result.guide}</span>
            ) : (
              <span className="ml-1 text-gray-400">— 가이드: 미지원</span>
            )}
          </div>
        )}
      </div>
      <span className={cn(
        'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
        isSuccess ? cn(statusColors.success.bg, statusColors.success.text) : cn(statusColors.error.bg, statusColors.error.text),
      )}>
        {result.status}
      </span>
    </div>
  );
};

const ResultCard = ({
  job,
  isShaking,
}: {
  job: TestConnectionJob;
  isShaking: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = job.status === 'SUCCESS';
  const failCount = job.resource_results.filter((r) => r.status === 'FAIL').length;
  const totalCount = job.resource_results.length;

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden',
      isSuccess ? statusColors.success.border : statusColors.error.border,
      isShaking && 'animate-shake',
    )}>
      {/* 요약 */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isSuccess ? statusColors.success.bg : statusColors.error.bg,
      )}>
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={cn('text-sm font-medium', isSuccess ? 'text-green-700' : 'text-red-700')}>
            {isSuccess
              ? `연결 성공 (${totalCount}개 리소스)`
              : `${failCount}개 리소스 연결 실패 (총 ${totalCount}개)`}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn('text-sm font-medium flex items-center gap-1', primaryColors.text)}
        >
          모든 리소스 확인하기
          <svg
            className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 리소스 목록 (아코디언) */}
      {expanded && (
        <div className="max-h-[300px] overflow-auto">
          {job.resource_results.map((r) => (
            <ResourceResultRow key={r.resource_id} result={r} />
          ))}
        </div>
      )}
    </div>
  );
};

// ===== Main Component =====

export const ConnectionTestPanel = ({
  targetSourceId,
  selectedResources,
}: ConnectionTestPanelProps) => {
  const {
    latestJob,
    lastSuccessJob,
    uiState,
    loading,
    triggerError,
    hasHistory,
    trigger,
  } = useTestConnectionPolling(targetSourceId);

  // Shake 애니메이션 제어
  const [isShaking, setIsShaking] = useState(false);
  const prevUiStateRef = useRef(uiState);

  useEffect(() => {
    // PENDING → SUCCESS/FAIL 전환 시 shake
    if (
      prevUiStateRef.current === 'PENDING' &&
      (uiState === 'SUCCESS' || uiState === 'FAIL')
    ) {
      queueMicrotask(() => setIsShaking(true));
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
    prevUiStateRef.current = uiState;
  }, [uiState]);

  // 마지막 성공 리소스 상세 토글
  const [showLastSuccessDetail, setShowLastSuccessDetail] = useState(false);

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 flex items-center justify-center">
        <LoadingSpinner />
        <span className="ml-2 text-sm text-gray-500">연결 테스트 정보 로딩 중...</span>
      </div>
    );
  }

  const isPending = uiState === 'PENDING';
  const isCompleted = uiState === 'SUCCESS' || uiState === 'FAIL';

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden space-y-0">
      {/* 1. 마지막 성공 영역 */}
      <div className="px-4 pt-4">
        <LastSuccessBar
          job={lastSuccessJob}
          onShowDetail={() => setShowLastSuccessDetail(!showLastSuccessDetail)}
        />
        {showLastSuccessDetail && lastSuccessJob && (
          <div className="mt-2 max-h-[200px] overflow-auto border border-gray-200 rounded-lg">
            {lastSuccessJob.resource_results.map((r) => (
              <ResourceResultRow key={r.resource_id} result={r} />
            ))}
          </div>
        )}
      </div>

      {/* 2. 설명 영역 */}
      <div className="px-4 pt-3">
        <div className={cn('flex items-start gap-2 p-3 rounded-lg', statusColors.info.bgLight, 'border', statusColors.info.borderLight)}>
          <svg className={cn('w-4 h-4 mt-0.5 flex-shrink-0', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-gray-600">
            <p>PII Agent가 설치된 리소스에 정상 접속되는지 확인합니다.</p>
            <p className="text-gray-500">Credential이 필요한 DB는 사전에 설정해주세요.</p>
          </div>
        </div>
      </div>

      {/* 3. 버튼 영역 */}
      <div className="px-4 pt-3 flex items-center gap-3">
        <button
          onClick={trigger}
          disabled={isPending}
          className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
        >
          {isPending && <LoadingSpinner />}
          {isPending
            ? '테스트 진행 중...'
            : hasHistory
              ? '재실행'
              : '연결 테스트 실행'}
        </button>
        {hasHistory && !isPending && (
          <button
            onClick={() => {/* TODO: 이력 모달 */}}
            className={getButtonClass('secondary')}
          >
            이전 결과 확인하러 가기
          </button>
        )}
      </div>

      {/* 트리거 에러 */}
      {triggerError && (
        <div className="px-4 pt-2">
          <p className={cn('text-sm', statusColors.error.text)}>{triggerError}</p>
        </div>
      )}

      {/* 4. PENDING 진행률 */}
      {isPending && latestJob && (
        <div className="px-4 pt-3">
          <ProgressBar job={latestJob} totalResources={selectedResources.length} />
        </div>
      )}

      {/* 5. 완료 결과 */}
      {isCompleted && latestJob && (
        <div className="px-4 pt-3">
          <ResultCard job={latestJob} isShaking={isShaking} />
        </div>
      )}

      {/* 하단 패딩 */}
      <div className="h-4" />
    </div>
  );
};
