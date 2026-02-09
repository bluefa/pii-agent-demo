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

const CopyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckSmallIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const IdField = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2">
      <span className={cn('text-xs block mb-0.5', textColors.tertiary)}>{label}</span>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-mono text-xs break-all leading-relaxed', textColors.primary)}>{value}</span>
        <button onClick={handleCopy} className={cn('shrink-0 p-0.5 rounded hover:bg-gray-100 transition-colors', copied ? statusColors.success.text : textColors.tertiary)} title="복사">
          {copied ? <CheckSmallIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  );
};

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
      <div className="space-y-2">
        {project.tenantId && (
          <IdField label={PROVIDER_FIELD_LABELS.Azure.tenantId} value={project.tenantId} />
        )}
        {project.subscriptionId && (
          <IdField label={PROVIDER_FIELD_LABELS.Azure.subscriptionId} value={project.subscriptionId} />
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
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {visibleCredentials.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                <svg className={cn('w-4 h-4 shrink-0', textColors.tertiary)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span className={cn('text-sm truncate', textColors.secondary)}>{c.name}</span>
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllCredentials(!showAllCredentials)}
                className={cn('w-full px-3 py-1.5 text-sm text-center', statusColors.info.text, 'hover:bg-gray-50')}
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
          <span className={cn('inline-flex items-center gap-1 text-sm font-medium', statusColors.warning.text)}>
            <WarningIcon />
            미등록
          </span>
        )}
      </div>
    </div>
  );
};
