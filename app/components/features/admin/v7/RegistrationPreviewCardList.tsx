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
import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
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

const formatIdentifierLabel = (item: TargetSourceCreationCandidateResponse): string => {
  const { metadata } = item;
  switch (item.cloud_type) {
    case 'AWS':
      return metadata?.aws_account_id ? `Payer ${metadata.aws_account_id}` : '—';
    case 'AZURE':
      return metadata?.subscription_id ? `Sub ${metadata.subscription_id}` : '—';
    case 'GCP':
      return metadata?.project_id ? `Project ${metadata.project_id}` : '—';
    case 'IDC':
      return metadata?.description || '—';
    default:
      return '—';
  }
};

export interface PreviewRow {
  item: TargetSourceCreationCandidateResponse;
  dbType: string;
}

interface RegistrationPreviewCardListProps {
  rows: PreviewRow[];
}

const StatusBadge = ({ item }: { item: TargetSourceCreationCandidateResponse }) => {
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
        {item.existing_target_source_id != null && (
          <Link
            href={integrationRoutes.targetSource(item.existing_target_source_id!)}
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

const RegionChip = ({ item }: { item: TargetSourceCreationCandidateResponse }) => {
  if (item.cloud_type !== 'AWS') return null;
  if (item.is_china_region) {
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

const InstallModeChip = ({ item }: { item: TargetSourceCreationCandidateResponse }) => {
  if (item.cloud_type !== 'AWS') return null;
  if (item.grant_service_terraform_execution_permission) {
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

const SduTag = ({ item }: { item: TargetSourceCreationCandidateResponse }) =>
  item.is_sdu_type ? (
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
        const provider = toCloudProvider(row.item.cloud_type ?? '');
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
            <ProviderLogo provider={provider} isSdu={row.item.is_sdu_type ?? false} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-sm font-semibold', textColors.primary)}>
                  {row.item.cloud_type}
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
