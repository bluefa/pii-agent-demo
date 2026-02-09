'use client';

import type { SduInstallationStatus } from '@/lib/types/sdu';
import { ATHENA_SETUP_STATUS_LABELS } from '@/lib/constants/sdu';
import { statusColors, cn, getButtonClass } from '@/lib/theme';

interface SduInstallationProgressProps {
  installationStatus: SduInstallationStatus;
  onRefresh?: () => void;
  loading?: boolean;
}

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const PendingIcon = () => (
  <div className={cn('w-5 h-5 border-2 rounded-full', statusColors.pending.border)} />
);

const ProgressIcon = () => (
  <div className={cn('w-5 h-5 border-2 border-t-transparent rounded-full animate-spin', statusColors.warning.border)} />
);

export const SduInstallationProgress = ({
  installationStatus,
  onRefresh,
  loading = false,
}: SduInstallationProgressProps) => {
  const { crawler, athenaTable, athenaSetup } = installationStatus;

  const crawlerCompleted = crawler.configured;
  const athenaTableCompleted = athenaTable.status === 'CREATED';
  const athenaSetupCompleted = athenaSetup.status === 'COMPLETED';
  const athenaSetupInProgress = athenaSetup.status === 'IN_PROGRESS';

  const renderRow = (
    label: string,
    detail: string,
    completed: boolean,
    inProgress = false
  ) => (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg border',
      completed ? cn(statusColors.success.bg, statusColors.success.border) : 'bg-white border-gray-200'
    )}>
      <div className="flex items-center gap-3">
        <div className={completed ? statusColors.success.text : inProgress ? statusColors.warning.text : statusColors.pending.text}>
          {completed ? <CheckIcon /> : inProgress ? <ProgressIcon /> : <PendingIcon />}
        </div>
        <div>
          <span className={cn('text-sm font-medium', completed ? statusColors.success.textDark : 'text-gray-700')}>
            {label}
          </span>
          <p className={cn('text-xs', completed ? statusColors.success.textDark : 'text-gray-500')}>
            {detail}
          </p>
        </div>
      </div>
      <span className={cn(
        'text-xs font-medium',
        completed ? statusColors.success.textDark : inProgress ? statusColors.warning.textDark : statusColors.pending.textDark
      )}>
        {completed ? '완료' : inProgress ? '진행 중' : '대기'}
      </span>
    </div>
  );

  return (
    <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">환경 구성 진행 상황</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
              title="새로고침"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3 bg-white">
        {renderRow(
          'Crawler 설정',
          crawlerCompleted ? '설정 완료' : '설정 대기 중',
          crawlerCompleted
        )}

        {renderRow(
          'Athena Table 생성',
          athenaTableCompleted ? `${athenaTable.database} / ${athenaTable.tableCount}개 테이블` : '대기',
          athenaTableCompleted
        )}

        {renderRow(
          'BDC측 Athena 설정',
          ATHENA_SETUP_STATUS_LABELS[athenaSetup.status],
          athenaSetupCompleted,
          athenaSetupInProgress
        )}

        <div className={cn('p-3 rounded-lg', statusColors.info.bg)}>
          <p className={cn('text-sm', statusColors.info.textDark)}>
            BDC에서 환경을 구성하고 있습니다. 완료되면 연결 테스트를 진행할 수 있습니다.
          </p>
        </div>

        {installationStatus.lastCheckedAt && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>마지막 확인: {new Date(installationStatus.lastCheckedAt).toLocaleString('ko-KR')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
