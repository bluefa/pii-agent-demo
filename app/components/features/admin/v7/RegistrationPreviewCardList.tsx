'use client';

import Link from 'next/link';
import {
  cn,
  bgColors,
  borderColors,
  statusColors,
  textColors,
  providerColors,
  primaryColors,
} from '@/lib/theme';
import type { TargetSourceCreationCandidate } from '@/app/lib/api';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';
import { integrationRoutes } from '@/lib/routes';
import type { CloudProvider } from '@/lib/types';

// Candidate `cloudType` is UPPERCASE (AWS|GCP|AZURE|IDC|UNKNOWN); map to the
// canonical UI provider for the logo/badges.
const PROVIDER_CANONICAL: Record<string, CloudProvider> = {
  AWS: 'AWS',
  AZURE: 'Azure',
  GCP: 'GCP',
  IDC: 'IDC',
};

const toCloudProvider = (cloudType: string): CloudProvider =>
  PROVIDER_CANONICAL[cloudType.toUpperCase()] ?? 'AWS';

const formatIdentifierLabel = (item: TargetSourceCreationCandidate): string => {
  const { metadata } = item;
  switch (item.cloudType) {
    case 'AWS':
      return metadata.awsAccountId ? `Payer ${metadata.awsAccountId}` : '—';
    case 'AZURE':
      return metadata.subscriptionId ? `Sub ${metadata.subscriptionId}` : '—';
    case 'GCP':
      return metadata.projectId ? `Project ${metadata.projectId}` : '—';
    case 'IDC':
      return metadata.description || '—';
    default:
      return '—';
  }
};

export interface PreviewRow {
  item: TargetSourceCreationCandidate;
  dbType: string;
}

interface RegistrationPreviewCardListProps {
  rows: PreviewRow[];
}

const StatusBadge = ({ item }: { item: TargetSourceCreationCandidate }) => {
  if (item.status === 'DUPLICATE') {
    return (
      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
            statusColors.warning.bg,
            statusColors.warning.textDark,
          )}
        >
          이미 등록된 인프라
        </span>
        {item.existingTargetSourceId != null && (
          <Link
            href={integrationRoutes.targetSource(item.existingTargetSourceId)}
            className={cn('text-[11px] font-medium underline', primaryColors.text)}
            onClick={(e) => e.stopPropagation()}
          >
            기존 항목 열기 →
          </Link>
        )}
      </div>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
        statusColors.info.bg,
        statusColors.info.textDark,
      )}
    >
      신규
    </span>
  );
};

const RegionChip = ({ item }: { item: TargetSourceCreationCandidate }) => {
  if (item.cloudType !== 'AWS') return null;
  if (item.isChinaRegion) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
          statusColors.error.bg,
          statusColors.error.textDark,
        )}
      >
        China
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
        bgColors.muted,
        textColors.secondary,
      )}
    >
      Global
    </span>
  );
};

const InstallModeChip = ({ item }: { item: TargetSourceCreationCandidate }) => {
  if (item.cloudType !== 'AWS') return null;
  if (item.grantServiceTerraformExecutionPermission) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
          statusColors.success.bg,
          statusColors.success.textDark,
        )}
      >
        자동 설치
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
        bgColors.muted,
        textColors.secondary,
      )}
    >
      수동 설치
    </span>
  );
};

const SduTag = ({ item }: { item: TargetSourceCreationCandidate }) =>
  item.isSduType ? (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
        providerColors.SDU.bg,
        providerColors.SDU.text,
      )}
    >
      SDU
    </span>
  ) : null;

export const RegistrationPreviewCardList = ({ rows }: RegistrationPreviewCardListProps) => {
  if (rows.length === 0) {
    return (
      <div className={cn('py-10 text-center text-sm', textColors.tertiary)}>
        미리보기 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row, idx) => {
        const provider = toCloudProvider(row.item.cloudType);
        return (
          <div
            key={`${row.dbType}-${idx}`}
            className={cn(
              'flex items-start gap-3 p-4 rounded-[12px] border',
              bgColors.surface,
              borderColors.default,
              row.item.status === 'DUPLICATE' && 'opacity-80',
            )}
          >
            <ProviderLogo provider={provider} isSdu={row.item.isSduType} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-sm font-semibold', textColors.primary)}>
                  {row.item.cloudType}
                </span>
                <span className={cn('text-xs', textColors.tertiary)}>·</span>
                <span className={cn('text-xs font-medium', textColors.secondary)}>
                  {row.dbType}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <RegionChip item={row.item} />
                <InstallModeChip item={row.item} />
                <SduTag item={row.item} />
              </div>
              <div className={cn('mt-1.5 text-xs truncate', textColors.tertiary)}>
                {formatIdentifierLabel(row.item)}
              </div>
            </div>
            <StatusBadge item={row.item} />
          </div>
        );
      })}
    </div>
  );
};
