'use client';

import { useState } from 'react';
import { cardStyles, statusColors, cn, textColors } from '@/lib/theme';
import { PROVIDER_FIELD_LABELS } from '@/lib/constants/labels';
import type { Project, DBCredential } from '@/lib/types';
import type { AzureServiceSettings } from '@/lib/types/azure';

interface AzureInfoCardProps {
  project: Project;
  serviceSettings: AzureServiceSettings | null;
  credentials: DBCredential[];
  onOpenGuide: () => void;
  onManageCredentials: () => void;
}

const CREDENTIAL_PREVIEW_COUNT = 3;

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const ArrowIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <span className={cn('text-sm', textColors.tertiary)}>{label}</span>
    {children}
  </div>
);

export const AzureInfoCard = ({
  project,
  serviceSettings,
  credentials,
  onOpenGuide,
  onManageCredentials,
}: AzureInfoCardProps) => {
  const [showAllCredentials, setShowAllCredentials] = useState(false);

  const scanApp = serviceSettings?.scanApp ?? null;

  const visibleCredentials = showAllCredentials
    ? credentials
    : credentials.slice(0, CREDENTIAL_PREVIEW_COUNT);
  const hiddenCount = credentials.length - CREDENTIAL_PREVIEW_COUNT;

  return (
    <div className={cn(cardStyles.base, 'p-6')}>
      <h3 className={cn(cardStyles.title, 'mb-4')}>Azure 연동 정보</h3>

      {/* Section 1: Basic Info */}
      <div className="space-y-3">
        {project.tenantId && (
          <InfoRow label={PROVIDER_FIELD_LABELS.Azure.tenantId}>
            <span className={cn('font-mono text-sm', textColors.primary)}>{project.tenantId}</span>
          </InfoRow>
        )}
        {project.subscriptionId && (
          <InfoRow label={PROVIDER_FIELD_LABELS.Azure.subscriptionId}>
            <span className={cn('font-mono text-sm', textColors.primary)}>{project.subscriptionId}</span>
          </InfoRow>
        )}
      </div>

      {/* Section 2: DB Credential */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-sm font-medium', textColors.secondary)}>DB Credential</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenGuide}
              className={cn('inline-flex items-center gap-0.5 text-sm', statusColors.info.text, 'hover:underline')}
            >
              가이드
              <ArrowIcon />
            </button>
            <button
              onClick={onManageCredentials}
              className={cn('inline-flex items-center gap-0.5 text-sm', statusColors.info.text, 'hover:underline')}
            >
              관리
              <ArrowIcon />
            </button>
          </div>
        </div>

        {credentials.length === 0 ? (
          <p className={cn('text-sm py-2', textColors.quaternary)}>등록된 Credential이 없습니다</p>
        ) : (
          <div className={cn('rounded-lg p-2', statusColors.pending.bg)}>
            {visibleCredentials.map((c) => (
              <div key={c.id} className={cn('py-1 px-2 text-sm', textColors.secondary)}>
                {c.name}
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllCredentials(!showAllCredentials)}
                className={cn('py-1 px-2 text-sm', statusColors.info.text, 'hover:underline')}
              >
                {showAllCredentials ? '접기' : `+${hiddenCount}개 더보기`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Scan App */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-sm font-medium', textColors.secondary)}>Scan App</span>
          <button
            onClick={onOpenGuide}
            className={cn('inline-flex items-center gap-0.5 text-sm', statusColors.info.text, 'hover:underline')}
          >
            등록 가이드
            <ArrowIcon />
          </button>
        </div>

        {scanApp?.registered ? (
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex items-center gap-1 text-sm font-medium', statusColors.success.text)}>
                <CheckIcon />
                등록 완료
              </span>
              <span className={cn('text-sm', textColors.secondary)}>PII Agent Scanner</span>
            </div>
            {scanApp.appId && (
              <p className={cn('mt-1 font-mono text-xs truncate', textColors.tertiary)} title={scanApp.appId}>
                App ID: {scanApp.appId}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 text-sm font-medium', statusColors.warning.text)}>
              <WarningIcon />
              미등록
            </span>
            <button
              onClick={onOpenGuide}
              className={cn('inline-flex items-center gap-0.5 text-sm', statusColors.info.text, 'hover:underline')}
            >
              등록 가이드
              <ArrowIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
