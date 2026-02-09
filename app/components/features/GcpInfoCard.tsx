'use client';

import { useState } from 'react';
import { cardStyles, statusColors, cn, textColors } from '@/lib/theme';
import { PROVIDER_FIELD_LABELS } from '@/lib/constants/labels';
import type { Project, DBCredential } from '@/lib/types';

interface GcpInfoCardProps {
  project: Project;
  credentials: DBCredential[];
  onOpenGuide: () => void;
  onManageCredentials: () => void;
}

const CREDENTIAL_PREVIEW_COUNT = 3;

const ArrowIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={cn('w-4 h-4 transition-transform', open && 'rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <span className={cn('text-sm', textColors.tertiary)}>{label}</span>
    {children}
  </div>
);

const GUIDE_STEPS = [
  'GCP Console에서 IAM & Admin → Service Accounts로 이동합니다.',
  'Create Service Account를 클릭하고, 이름을 pii-agent-scanner로 설정합니다.',
  '다음 역할(Role)을 부여합니다:\n• BigQuery Data Viewer\n• Cloud SQL Viewer\n• Compute Viewer (VM 사용 시)',
  '생성된 Service Account에서 Keys 탭 → Add Key → JSON 형식으로 키를 생성합니다.',
  '다운로드한 JSON 키 파일을 PII Agent 관리 페이지에서 등록합니다.',
];

export const GcpInfoCard = ({
  project,
  credentials,
  onOpenGuide,
  onManageCredentials,
}: GcpInfoCardProps) => {
  const [showAllCredentials, setShowAllCredentials] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const visibleCredentials = showAllCredentials
    ? credentials
    : credentials.slice(0, CREDENTIAL_PREVIEW_COUNT);
  const hiddenCount = credentials.length - CREDENTIAL_PREVIEW_COUNT;

  return (
    <div className={cn(cardStyles.base, 'p-6')}>
      <h3 className={cn(cardStyles.title, 'mb-4')}>GCP 연동 정보</h3>

      {/* Section 1: Basic Info */}
      <div className="space-y-3">
        {project.gcpProjectId && (
          <InfoRow label={PROVIDER_FIELD_LABELS.GCP.projectId}>
            <span className={cn('font-mono text-sm', textColors.primary)}>{project.gcpProjectId}</span>
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

      {/* Section 3: Scan Service Account Guide */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center justify-between w-full"
        >
          <span className={cn('text-sm font-medium', textColors.secondary)}>Scan Service Account</span>
          <span className={cn('inline-flex items-center gap-1 text-sm', statusColors.info.text)}>
            가이드 보기
            <ChevronIcon open={showGuide} />
          </span>
        </button>

        {showGuide && (
          <div className={cn('mt-2 rounded-lg p-3', statusColors.pending.bg)}>
            <ol className="space-y-2">
              {GUIDE_STEPS.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className={cn('text-sm font-medium shrink-0', textColors.tertiary)}>{i + 1}.</span>
                  <span className={cn('text-sm whitespace-pre-line', textColors.secondary)}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};
