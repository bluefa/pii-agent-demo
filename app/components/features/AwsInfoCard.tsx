'use client';

import { useState } from 'react';
import { badgeStyles, cardStyles, statusColors, cn, textColors } from '@/lib/theme';
import { PROVIDER_FIELD_LABELS } from '@/lib/constants/labels';
import type { Project, AwsInstallationStatus, AwsSettings, SecretKey } from '@/lib/types';

interface AwsInfoCardProps {
  project: Project;
  awsStatus: AwsInstallationStatus | null;
  awsSettings: AwsSettings | null;
  credentials: SecretKey[];
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

const InstallationModeBadge = ({ isAutoInstall }: { isAutoInstall: boolean }) => (
  <div className="flex items-center gap-1.5">
    <span className={cn(badgeStyles.base, badgeStyles.sizes.md,
      isAutoInstall
        ? cn(statusColors.info.bg, statusColors.info.textDark)
        : cn(statusColors.pending.bg, statusColors.pending.textDark)
    )}>
      {isAutoInstall ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          자동 설치
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          수동 설치
        </>
      )}
    </span>
    <span className={statusColors.pending.text} title="설치 모드는 프로젝트 생성 시 결정되며 변경할 수 없습니다">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
    </span>
  </div>
);

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <span className={cn('text-sm', textColors.tertiary)}>{label}</span>
    {children}
  </div>
);

const RoleStatusRow = ({
  label,
  completed,
  arn,
  onGuide,
}: {
  label: string;
  completed: boolean;
  arn?: string | null;
  onGuide: () => void;
}) => (
  <div className="py-2">
    <div className="flex items-center justify-between">
      <span className={cn('text-sm font-medium', textColors.secondary)}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 text-sm font-medium',
          completed ? statusColors.success.text : statusColors.warning.text
        )}>
          {completed ? <CheckIcon /> : <WarningIcon />}
          {completed ? '등록 완료' : '미등록'}
        </span>
        {!completed && (
          <button
            onClick={onGuide}
            className={cn('inline-flex items-center gap-0.5 text-sm', statusColors.info.text, 'hover:underline')}
          >
            등록 가이드
            <ArrowIcon />
          </button>
        )}
      </div>
    </div>
    {completed && arn && (
      <p className={cn('mt-1 font-mono text-xs truncate', textColors.tertiary)} title={arn}>
        {arn}
      </p>
    )}
  </div>
);

export const AwsInfoCard = ({
  project,
  awsStatus,
  awsSettings,
  credentials,
  onOpenGuide,
  onManageCredentials,
}: AwsInfoCardProps) => {
  const [showAllCredentials, setShowAllCredentials] = useState(false);

  const scanRole = awsSettings?.scanRole;
  const isScanRoleComplete = scanRole?.status === 'VALID';
  const isManualInstall = project.awsInstallationMode === 'MANUAL';
  // executionRole 상태는 installation status에서 가져옴 (settings의 executionRole은 고정값)
  const isExecutionRoleComplete = awsStatus?.hasExecutionPermission ?? false;

  const applicableItems = [
    { completed: isScanRoleComplete },
    ...(isManualInstall ? [{ completed: isExecutionRoleComplete }] : []),
  ];
  const completedCount = applicableItems.filter((i) => i.completed).length;
  const totalCount = applicableItems.length;

  const visibleCredentials = showAllCredentials
    ? credentials
    : credentials.slice(0, CREDENTIAL_PREVIEW_COUNT);
  const hiddenCount = credentials.length - CREDENTIAL_PREVIEW_COUNT;

  return (
    <div className={cn(cardStyles.base, 'p-6')}>
      <h3 className={cn(cardStyles.title, 'mb-4')}>AWS 기본 정보</h3>

      {/* Section 1: Basic Info */}
      <div className="space-y-3">
        {project.awsAccountId && (
          <InfoRow label={PROVIDER_FIELD_LABELS.AWS.accountId}>
            <span className={cn('font-mono text-sm', textColors.primary)}>{project.awsAccountId}</span>
          </InfoRow>
        )}
        {project.awsRegionType && (
          <InfoRow label={PROVIDER_FIELD_LABELS.AWS.regionType}>
            <span className={cn('text-sm', textColors.primary)}>
              {project.awsRegionType === 'global' ? 'Global' : 'China'}
            </span>
          </InfoRow>
        )}
        {awsStatus && (
          <InfoRow label="설치 모드">
            <InstallationModeBadge isAutoInstall={awsStatus.hasExecutionPermission} />
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
              <div key={c.name} className={cn('py-1 px-2 text-sm', textColors.secondary)}>
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

      {/* Section 3: Prerequisite Status */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-sm font-medium', textColors.secondary)}>사전 조치 현황</span>
          <span className={cn(
            badgeStyles.base, badgeStyles.sizes.sm,
            completedCount === totalCount
              ? cn(statusColors.success.bg, statusColors.success.textDark)
              : cn(statusColors.warning.bg, statusColors.warning.textDark)
          )}>
            {completedCount}/{totalCount} 완료
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          <RoleStatusRow
            label="스캔 Role"
            completed={isScanRoleComplete}
            arn={scanRole?.roleArn}
            onGuide={onOpenGuide}
          />
          {isManualInstall && (
            <RoleStatusRow
              label="TF Execution Role"
              completed={isExecutionRoleComplete}
              arn={awsSettings?.executionRole?.roleArn || null}
              onGuide={onOpenGuide}
            />
          )}
        </div>
      </div>
    </div>
  );
};
