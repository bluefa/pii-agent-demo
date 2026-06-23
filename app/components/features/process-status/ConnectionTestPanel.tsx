'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { SecretKey, needsCredential } from '@/lib/types';
import type { ConfirmedResource } from '@/lib/types/resources';
import { useTestConnectionPolling } from '@/app/hooks/useTestConnectionPolling';
import { getSecrets } from '@/app/lib/api';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { statusColors, textColors, borderColors, bgColors, getButtonClass, cn } from '@/lib/theme';
import { ProgressBar } from '@/app/components/features/process-status/connection-test/ProgressBar';
import { ResultSummary } from '@/app/components/features/process-status/connection-test/ResultSummary';

const CredentialSetupModal = dynamic(
  () => import('@/app/components/features/process-status/connection-test/CredentialSetupModal').then(m => ({ default: m.CredentialSetupModal })),
  { ssr: false },
);
const ResultDetailModal = dynamic(
  () => import('@/app/components/features/process-status/connection-test/ResultDetailModal').then(m => ({ default: m.ResultDetailModal })),
  { ssr: false },
);

interface ConnectionTestPanelProps {
  targetSourceId: number;
  confirmed: readonly ConfirmedResource[];
  /** Credential 변경 후 부모가 프로젝트를 재조회하도록 알림 */
  onResourceUpdate?: () => void;
}

export const ConnectionTestPanel = ({
  targetSourceId,
  confirmed,
  onResourceUpdate,
}: ConnectionTestPanelProps) => {
  const {
    latestJob,
    uiState,
    loading,
    triggerError,
    trigger,
  } = useTestConnectionPolling(targetSourceId);

  // Shake 애니메이션 제어
  const [isShaking, setIsShaking] = useState(false);
  const prevUiStateRef = useRef(uiState);

  useEffect(() => {
    const prev = prevUiStateRef.current;
    prevUiStateRef.current = uiState;
    if (prev === 'PENDING' && (uiState === 'SUCCESS' || uiState === 'FAIL')) {
      queueMicrotask(() => setIsShaking(true));
      const timer = setTimeout(() => setIsShaking(false), 500);
      // 연결 테스트 성공 시 프로젝트를 재조회하여 다음 단계로 진행
      if (uiState === 'SUCCESS') onResourceUpdate?.();
      return () => clearTimeout(timer);
    }
  }, [uiState, onResourceUpdate]);

  // Credential 모달 상태
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [credReviewMode, setCredReviewMode] = useState(false);
  const [credentials, setCredentials] = useState<SecretKey[]>([]);
  const [missingCredResources, setMissingCredResources] = useState<ConfirmedResource[]>([]);

  // 모달 상태
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const handleTriggerClick = useCallback(async () => {
    // 마지막 테스트 실패 시: credential 확인 모달 (review mode)
    if (latestJob?.connectionStatus === 'FAIL') {
      const credResources = confirmed.filter(
        (r) => r.databaseType !== null && needsCredential(r.databaseType),
      );
      if (credResources.length > 0) {
        try {
          const creds = await getSecrets(targetSourceId);
          setCredentials(creds);
          setMissingCredResources([...credResources]);
          setCredReviewMode(true);
          setCredModalOpen(true);
        } catch {
          trigger();
        }
        return;
      }
    }

    // 미설정 credential 확인
    const missing = confirmed.filter(
      (r) => r.databaseType !== null && needsCredential(r.databaseType) && !r.credentialId,
    );

    if (missing.length > 0) {
      try {
        const creds = await getSecrets(targetSourceId);
        setCredentials(creds);
        setMissingCredResources([...missing]);
        setCredReviewMode(false);
        setCredModalOpen(true);
      } catch {
        trigger();
      }
      return;
    }

    trigger();
  }, [confirmed, targetSourceId, trigger, latestJob]);

  const handleCredentialComplete = useCallback(() => {
    setCredModalOpen(false);
    setCredReviewMode(false);
    onResourceUpdate?.();
    trigger();
  }, [trigger, onResourceUpdate]);

  if (loading) {
    return (
      <div className={cn('border rounded-lg p-6 flex items-center justify-center', borderColors.default)}>
        <LoadingSpinner />
        <span className={cn('ml-2 text-sm', textColors.tertiary)}>연결 테스트 정보 로딩 중...</span>
      </div>
    );
  }

  const isPending = uiState === 'PENDING';
  const isCompleted = uiState === 'SUCCESS' || uiState === 'FAIL';

  return (
    <div className={cn('max-w-md border rounded-lg p-4 space-y-3', bgColors.muted, borderColors.default)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h4 className={cn('text-sm font-semibold', textColors.primary)}>연결 테스트</h4>
      </div>

      {/* 가이드 */}
      <div className="space-y-1">
        <p className={cn('text-sm', textColors.tertiary)}>
          설치가 완료되었습니다. DB 연결을 테스트하세요.
        </p>
        <ol className={cn('text-xs list-decimal list-inside space-y-0.5', textColors.quaternary)}>
          <li>[연결 테스트 수행] 버튼 클릭</li>
          <li>연결 결과 확인 (성공/실패)</li>
          <li>실패 시 Credential 확인 또는 네트워크 점검</li>
        </ol>
      </div>

      {/* CTA + 결과 */}
      <div className="space-y-2">
        <button
          onClick={handleTriggerClick}
          disabled={isPending}
          className={cn(getButtonClass('primary', 'sm'), 'flex items-center gap-2')}
        >
          {isPending && <LoadingSpinner size="sm" />}
          {isPending ? '테스트 진행 중...' : '연결 테스트 수행'}
        </button>

        {triggerError && (
          <p className={cn('text-xs', statusColors.error.text)}>{triggerError}</p>
        )}

        {isPending && latestJob && (
          <ProgressBar job={latestJob} totalResources={confirmed.length} />
        )}

        {isCompleted && latestJob && (
          <ResultSummary
            job={latestJob}
            isShaking={isShaking}
            onShowDetail={() => setDetailModalOpen(true)}
          />
        )}
      </div>

      {/* Modals */}
      <CredentialSetupModal
        isOpen={credModalOpen}
        onClose={() => { setCredModalOpen(false); setCredReviewMode(false); }}
        missingResources={missingCredResources}
        credentials={credentials}
        targetSourceId={targetSourceId}
        onComplete={handleCredentialComplete}
        reviewMode={credReviewMode}
      />

      {isCompleted && latestJob && (
        <ResultDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          job={latestJob}
        />
      )}
    </div>
  );
};
