'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Resource, SecretKey, needsCredential } from '@/lib/types';
import type { ProcessGuideStep } from '@/lib/types/process-guide';
import { useTestConnectionPolling } from '@/app/hooks/useTestConnectionPolling';
import { getSecrets, updateResourceCredential, getTestConnectionResults } from '@/app/lib/api';
import type { TestConnectionJob, TestConnectionResourceResult } from '@/app/lib/api';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Modal } from '@/app/components/ui/Modal';
import { ProcessGuideStepCard } from '@/app/components/features/process-status/ProcessGuideStepCard';
import { statusColors, primaryColors, textColors, getButtonClass, cn } from '@/lib/theme';
import { getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';

// ===== Constants =====

const CONNECTION_TEST_GUIDE_STEP: ProcessGuideStep = {
  stepNumber: 4,
  label: '연결 테스트',
  description: '설치가 완료되었습니다. DB 연결을 테스트하세요.',
  procedures: [
    '[Test Connection] 버튼 클릭',
    '연결 결과 확인 (성공/실패)',
    '실패 시 Credential 확인 또는 네트워크 점검',
  ],
  warnings: ['DB Credential이 미설정된 리소스는 테스트 전 설정이 필요합니다'],
};

const TEXT_LINK_CLASS = 'text-sm text-gray-700 hover:text-gray-900 underline underline-offset-2 cursor-pointer';

// ===== Types =====

interface ConnectionTestPanelProps {
  targetSourceId: number;
  selectedResources: Resource[];
}

// ===== Credential Setup Modal =====

const CredentialSetupModal = ({
  isOpen,
  onClose,
  missingResources,
  credentials,
  targetSourceId,
  onComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  missingResources: Resource[];
  credentials: SecretKey[];
  targetSourceId: number;
  onComplete: () => void;
}) => {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const allSelected = missingResources.every((r) => selections[r.id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      for (const resource of missingResources) {
        const credentialId = selections[resource.id];
        if (credentialId) {
          await updateResourceCredential(targetSourceId, resource.id, credentialId);
        }
      }
      onComplete();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Credential 설정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Credential 설정 필요"
      subtitle="연결 테스트를 실행하려면 아래 리소스에 Credential을 설정해주세요."
      size="lg"
      icon={
        <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      }
      footer={
        <>
          <button onClick={onClose} className={getButtonClass('secondary')}>
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!allSelected || saving}
            className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
          >
            {saving && <LoadingSpinner />}
            설정 완료 후 테스트 실행
          </button>
        </>
      }
    >
      {/* 상태 요약 메시지 */}
      <div className={cn(
        'mb-4 px-3 py-2 rounded-lg text-sm flex items-center gap-2',
        allSelected
          ? cn(statusColors.success.bg, 'border', statusColors.success.border)
          : 'bg-gray-50 border border-gray-200',
      )}>
        <span className={cn(
          'w-2 h-2 rounded-full',
          allSelected ? statusColors.success.dot : 'bg-gray-300',
        )} />
        <span className={allSelected ? statusColors.success.text : textColors.quaternary}>
          {allSelected
            ? `DB Credential 선택 완료되었습니다 (${missingResources.length}건)`
            : `아직 DB Credential이 미선택되었습니다 (${Object.keys(selections).filter((k) => selections[k]).length}/${missingResources.length})`}
        </span>
      </div>

      {/* 리소스 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className={cn('px-4 py-2 text-left text-xs font-medium', textColors.tertiary)}>리소스</th>
              <th className={cn('px-4 py-2 text-left text-xs font-medium', textColors.tertiary)}>DB 유형</th>
              <th className={cn('px-4 py-2 text-left text-xs font-medium', textColors.tertiary)}>Credential</th>
              <th className={cn('px-4 py-2 text-center text-xs font-medium w-20', textColors.tertiary)}>상태</th>
            </tr>
          </thead>
          <tbody>
            {missingResources.map((resource) => {
              const isSelected = !!selections[resource.id];
              return (
                <tr key={resource.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium uppercase', textColors.quaternary)}>{resource.type}</span>
                      <span className={cn('text-sm font-mono truncate', textColors.secondary)}>{resource.resourceId}</span>
                    </div>
                  </td>
                  <td className={cn('px-4 py-3 text-sm', textColors.secondary)}>
                    {getDatabaseLabel(resource.databaseType)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selections[resource.id] || ''}
                      onChange={(e) =>
                        setSelections((prev) => ({ ...prev, [resource.id]: e.target.value }))
                      }
                      className={cn(
                        'w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2',
                        primaryColors.focusRing,
                        isSelected
                          ? cn(statusColors.success.border, statusColors.success.bg, textColors.primary)
                          : cn(statusColors.pending.border, textColors.primary),
                      )}
                    >
                      <option value="">선택하세요</option>
                      {credentials.map((cred) => (
                        <option key={cred.name} value={cred.name}>
                          {cred.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSelected ? (
                      <span className={cn('text-xs font-medium', statusColors.success.text)}>선택 완료</span>
                    ) : (
                      <span className={cn('text-xs', textColors.quaternary)}>미선택</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

// ===== Result Detail Modal =====

const ResultDetailModal = ({
  isOpen,
  onClose,
  job,
}: {
  isOpen: boolean;
  onClose: () => void;
  job: TestConnectionJob;
}) => {
  const failCount = job.resource_results.filter((r) => r.status === 'FAIL').length;
  const successCount = job.resource_results.filter((r) => r.status === 'SUCCESS').length;
  const dateStr = new Date(job.completed_at ?? job.requested_at ?? '').toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="연결 테스트 결과"
      subtitle={`${dateStr} · ${successCount}개 성공${failCount > 0 ? `, ${failCount}개 실패` : ''}`}
      size="lg"
      icon={
        failCount > 0 ? (
          <svg className={cn('w-5 h-5', statusColors.error.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className={cn('w-5 h-5', statusColors.success.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      }
    >
      <div className="max-h-[400px] overflow-auto">
        {job.resource_results.map((r) => (
          <ResourceResultRow key={r.resource_id} result={r} />
        ))}
      </div>
    </Modal>
  );
};

// ===== Test Connection History Modal =====

const TestConnectionHistoryModal = ({
  isOpen,
  onClose,
  targetSourceId,
}: {
  isOpen: boolean;
  onClose: () => void;
  targetSourceId: number;
}) => {
  const [jobs, setJobs] = useState<TestConnectionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      try {
        const res = await getTestConnectionResults(targetSourceId, page, PAGE_SIZE);
        if (cancelled) return;
        setJobs(res.content);
        setTotal(res.page.totalElements);
      } catch {
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [isOpen, targetSourceId, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('ko-KR', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="연결 테스트 내역"
      subtitle={total > 0 ? `총 ${total}건` : undefined}
      size="xl"
      icon={
        <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      footer={
        totalPages > 1 ? (
          <div className="flex items-center gap-2 w-full justify-center">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={getButtonClass('ghost', 'sm')}
            >
              이전
            </button>
            <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={getButtonClass('ghost', 'sm')}
            >
              다음
            </button>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-2 text-sm text-gray-500">내역 로딩 중...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">연결 테스트 내역이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const isSuccess = job.status === 'SUCCESS';
            const isFail = job.status === 'FAIL';
            const failCount = job.resource_results.filter((r) => r.status === 'FAIL').length;
            return (
              <HistoryJobCard
                key={job.id}
                job={job}
                isSuccess={isSuccess}
                isFail={isFail}
                failCount={failCount}
                formatDate={formatDate}
              />
            );
          })}
        </div>
      )}
    </Modal>
  );
};

const HistoryJobCard = ({
  job,
  isSuccess,
  isFail,
  failCount,
  formatDate,
}: {
  job: TestConnectionJob;
  isSuccess: boolean;
  isFail: boolean;
  failCount: number;
  formatDate: (d: string) => string;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('border rounded-lg overflow-hidden', isSuccess ? statusColors.success.border : isFail ? statusColors.error.border : statusColors.pending.border)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between text-left',
          isSuccess ? statusColors.success.bg : isFail ? statusColors.error.bg : statusColors.pending.bg,
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            'w-2 h-2 rounded-full',
            isSuccess ? statusColors.success.dot : isFail ? statusColors.error.dot : statusColors.pending.dot,
          )} />
          <span className="text-sm font-medium text-gray-700">
            {formatDate(job.requested_at ?? job.completed_at ?? '')}
          </span>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isSuccess ? cn(statusColors.success.bg, statusColors.success.text) : isFail ? cn(statusColors.error.bg, statusColors.error.text) : cn(statusColors.pending.bg, statusColors.pending.text),
          )}>
            {isSuccess ? '성공' : isFail ? `실패 (${failCount}건)` : '진행 중'}
          </span>
        </div>
        <svg className={cn('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && job.resource_results.length > 0 && (
        <div className="max-h-[200px] overflow-auto">
          {job.resource_results.map((r) => (
            <ResourceResultRow key={r.resource_id} result={r} />
          ))}
        </div>
      )}
    </div>
  );
};

// ===== Sub-components =====

const ProgressBar = ({
  job,
  totalResources,
}: {
  job: TestConnectionJob;
  totalResources: number;
}) => {
  const completed = job.resource_results.length;
  const total = totalResources || completed || 1;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" className={primaryColors.text} />
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
      isFail && statusColors.error.bg,
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
          <div className={cn('mt-1 text-xs', statusColors.error.text)}>
            <span className="font-medium">{result.error_status}</span>
            {result.guide ? (
              <span className="ml-1 opacity-80">— {result.guide}</span>
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

// ===== Result Summary =====

const ResultSummary = ({
  job,
  isShaking,
  onShowDetail,
}: {
  job: TestConnectionJob;
  isShaking: boolean;
  onShowDetail: () => void;
}) => {
  const successCount = job.resource_results.filter((r) => r.status === 'SUCCESS').length;
  const failCount = job.resource_results.filter((r) => r.status === 'FAIL').length;
  const isSuccess = job.status === 'SUCCESS';
  const dateStr = new Date(job.completed_at ?? job.requested_at ?? '').toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={cn('space-y-2', isShaking && 'animate-shake')}>
      <span className={cn('text-xs font-semibold uppercase tracking-wide', textColors.tertiary)}>최근 테스트 결과</span>
      <div className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-lg border',
        isSuccess
          ? cn(statusColors.success.bg, statusColors.success.border)
          : cn(statusColors.error.bg, statusColors.error.border),
      )}>
        {isSuccess ? (
          <svg className={cn('w-4 h-4 flex-shrink-0', statusColors.success.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={cn('w-4 h-4 flex-shrink-0', statusColors.error.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
        <span className={cn('text-sm flex-1', isSuccess ? statusColors.success.textDark : statusColors.error.textDark)}>
          {isSuccess
            ? `${successCount}개 성공`
            : `${successCount}개 성공, ${failCount}개 실패`}
          <span className="mx-1.5 opacity-50">·</span>
          <span className="opacity-70">{dateStr}</span>
        </span>
        <button onClick={onShowDetail} className={TEXT_LINK_CLASS}>
          상세 보기 →
        </button>
      </div>
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

  // Credential 모달 상태
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [credentials, setCredentials] = useState<SecretKey[]>([]);
  const [missingCredResources, setMissingCredResources] = useState<Resource[]>([]);

  // 모달 상태
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const handleTriggerClick = useCallback(async () => {
    const missing = selectedResources.filter(
      (r) => needsCredential(r.databaseType) && !r.selectedCredentialId,
    );

    if (missing.length > 0) {
      try {
        const creds = await getSecrets(targetSourceId);
        setCredentials(creds);
        setMissingCredResources(missing);
        setCredModalOpen(true);
      } catch {
        trigger();
      }
      return;
    }

    trigger();
  }, [selectedResources, targetSourceId, trigger]);

  const handleCredentialComplete = useCallback(() => {
    setCredModalOpen(false);
    trigger();
  }, [trigger]);

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
    <div className="space-y-4">
      {/* 1. 가이드 (ProcessGuideStepCard 재활용) */}
      <ProcessGuideStepCard
        step={CONNECTION_TEST_GUIDE_STEP}
        status="current"
        defaultExpanded
      />

      {/* 2. 액션 영역 */}
      <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
        {/* Primary CTA */}
        <button
          onClick={handleTriggerClick}
          disabled={isPending}
          className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
        >
          {isPending && <LoadingSpinner />}
          {isPending ? '테스트 진행 중...' : '연결 테스트 수행'}
        </button>

        {/* 트리거 에러 */}
        {triggerError && (
          <p className={cn('text-sm', statusColors.error.text)}>{triggerError}</p>
        )}

        {/* PENDING 진행률 */}
        {isPending && latestJob && (
          <ProgressBar job={latestJob} totalResources={selectedResources.length} />
        )}

        {/* 완료 결과 요약 */}
        {isCompleted && latestJob && (
          <ResultSummary
            job={latestJob}
            isShaking={isShaking}
            onShowDetail={() => setDetailModalOpen(true)}
          />
        )}

        {/* 이력 텍스트 링크 */}
        {hasHistory && !isPending && (
          <button onClick={() => setHistoryModalOpen(true)} className={TEXT_LINK_CLASS}>
            모든 연결 내역 확인하러 가기 →
          </button>
        )}
      </div>

      {/* Modals */}
      <CredentialSetupModal
        isOpen={credModalOpen}
        onClose={() => setCredModalOpen(false)}
        missingResources={missingCredResources}
        credentials={credentials}
        targetSourceId={targetSourceId}
        onComplete={handleCredentialComplete}
      />

      {isCompleted && latestJob && (
        <ResultDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          job={latestJob}
        />
      )}

      <TestConnectionHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        targetSourceId={targetSourceId}
      />
    </div>
  );
};
