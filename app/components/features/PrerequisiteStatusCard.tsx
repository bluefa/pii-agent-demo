'use client';

import { badgeStyles, cardStyles, statusColors, cn } from '@/lib/theme';
import type { Project, AwsInstallationStatus, ScanRoleInfo } from '@/lib/types';
import { needsCredential } from '@/lib/types';

interface PrerequisiteStatusCardProps {
  project: Project;
  awsStatus: AwsInstallationStatus | null;
  scanRoleInfo: ScanRoleInfo | null;
  onOpenGuide: () => void;
  onManageCredentials: () => void;
}

interface PrerequisiteItem {
  label: string;
  completed: boolean;
  applicable: boolean;
  statusText: string;
  actionLabel?: string;
  onAction?: () => void;
}

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

const PrerequisiteRow = ({ item }: { item: PrerequisiteItem }) => {
  if (!item.applicable) {
    return (
      <div className="flex items-center justify-between py-3">
        <span className="text-sm font-medium">{item.label}</span>
        <span className={cn('text-sm', statusColors.pending.text)}>{item.statusText}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium">{item.label}</span>
      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 text-sm font-medium',
          item.completed ? statusColors.success.text : statusColors.warning.text
        )}>
          {item.completed ? <CheckIcon /> : <WarningIcon />}
          {item.statusText}
        </span>
        {item.actionLabel && item.onAction && (
          <button
            onClick={item.onAction}
            className={cn('inline-flex items-center gap-0.5 text-sm', statusColors.info.text, 'hover:underline')}
          >
            {item.actionLabel}
            <ArrowIcon />
          </button>
        )}
      </div>
    </div>
  );
};

export const PrerequisiteStatusCard = ({
  project,
  awsStatus,
  scanRoleInfo,
  onOpenGuide,
  onManageCredentials,
}: PrerequisiteStatusCardProps) => {
  const isScanRoleComplete = !!(scanRoleInfo?.registered && scanRoleInfo?.status === 'VALID');

  const isAutoInstall = awsStatus?.hasTfPermission === true;
  const isManualInstall = project.awsInstallationMode === 'MANUAL';
  const isTfRoleApplicable = !isManualInstall && !!awsStatus;
  const isTfRoleComplete = isAutoInstall;

  const credentialRequiredResources = project.resources.filter(
    (r) => r.isSelected && needsCredential(r.databaseType)
  );
  const credentialRequiredCount = credentialRequiredResources.length;
  const credentialRegisteredCount = credentialRequiredResources.filter(
    (r) => r.selectedCredentialId
  ).length;
  const isCredentialComplete = credentialRequiredCount > 0
    ? credentialRegisteredCount >= credentialRequiredCount
    : true;

  const items: PrerequisiteItem[] = [
    {
      label: '스캔 Role',
      completed: isScanRoleComplete,
      applicable: true,
      statusText: isScanRoleComplete ? '등록 완료' : '미등록',
      actionLabel: isScanRoleComplete ? undefined : '등록 가이드',
      onAction: isScanRoleComplete ? undefined : onOpenGuide,
    },
    {
      label: 'TF Execution Role',
      completed: isTfRoleComplete,
      applicable: isTfRoleApplicable,
      statusText: isTfRoleApplicable
        ? (isTfRoleComplete ? '등록됨' : '미등록')
        : '수동 설치 -- 해당 없음',
      actionLabel: isTfRoleApplicable && !isTfRoleComplete ? '등록 가이드' : undefined,
      onAction: isTfRoleApplicable && !isTfRoleComplete ? onOpenGuide : undefined,
    },
    {
      label: 'DB Credential',
      completed: isCredentialComplete,
      applicable: true,
      statusText: credentialRequiredCount > 0
        ? `${credentialRegisteredCount}/${credentialRequiredCount} 등록`
        : '대상 없음',
      actionLabel: credentialRequiredCount > 0 ? '관리' : undefined,
      onAction: credentialRequiredCount > 0 ? onManageCredentials : undefined,
    },
  ];

  const applicableItems = items.filter((i) => i.applicable);
  const completedCount = applicableItems.filter((i) => i.completed).length;
  const totalCount = applicableItems.length;

  return (
    <div className={cn(cardStyles.base, 'p-6')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={cardStyles.title}>사전 조치 현황</h3>
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
        {items.map((item) => (
          <PrerequisiteRow key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
};
