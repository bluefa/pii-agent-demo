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
import type { RegistrationPreviewItem } from '@/app/lib/api';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';
import { integrationRoutes } from '@/lib/routes';
import type { CloudProvider } from '@/lib/types';

const PROVIDER_CANONICAL: Record<string, CloudProvider> = {
  AWS: 'AWS',
  Azure: 'Azure',
  AZURE: 'Azure',
  GCP: 'GCP',
  IDC: 'IDC',
};

const toCloudProvider = (raw: string): CloudProvider => PROVIDER_CANONICAL[raw] ?? 'AWS';

const formatIdentifierLabel = (item: RegistrationPreviewItem): string => {
  const provider = item.cloud_provider.toUpperCase();
  switch (provider) {
    case 'AWS': {
      const payer = item.aws_account_id ? `Payer ${item.aws_account_id}` : '';
      const linked =
        item.aws_linked_account_id && item.aws_linked_account_id !== item.aws_account_id
          ? ` · Linked ${item.aws_linked_account_id}`
          : '';
      return `${payer}${linked}` || '—';
    }
    case 'AZURE': {
      const tenant = item.tenant_id ? `Tenant ${item.tenant_id}` : '';
      const sub = item.subscription_id ? ` · Sub ${item.subscription_id}` : '';
      return `${tenant}${sub}` || '—';
    }
    case 'GCP':
      return item.gcp_project_id ? `Project ${item.gcp_project_id}` : '—';
    case 'IDC':
      return item.description || '—';
    default:
      return '—';
  }
};

export interface PreviewRow {
  item: RegistrationPreviewItem;
  dbType: string;
}

interface RegistrationPreviewCardListProps {
  rows: PreviewRow[];
}

const StatusBadge = ({ item }: { item: RegistrationPreviewItem }) => {
  if (item.type === 'DUPLICATE') {
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
        <Link
          href={integrationRoutes.targetSource(item.existing_target_source_id)}
          className={cn('text-[11px] font-medium underline', primaryColors.text)}
          onClick={(e) => e.stopPropagation()}
        >
          기존 항목 열기 →
        </Link>
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

const RegionChip = ({ item }: { item: RegistrationPreviewItem }) => {
  if (item.cloud_provider.toUpperCase() !== 'AWS') return null;
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

const InstallModeChip = ({ item }: { item: RegistrationPreviewItem }) => {
  if (item.cloud_provider.toUpperCase() !== 'AWS') return null;
  if (item.is_terraform_execution_granted) {
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

const SduTag = ({ item }: { item: RegistrationPreviewItem }) =>
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
        const provider = toCloudProvider(row.item.cloud_provider);
        return (
          <div
            key={`${row.dbType}-${idx}`}
            className={cn(
              'flex items-start gap-3 p-4 rounded-[12px] border',
              bgColors.surface,
              borderColors.default,
              row.item.type === 'DUPLICATE' && 'opacity-80',
            )}
          >
            <ProviderLogo provider={provider} isSdu={row.item.is_sdu_type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-sm font-semibold', textColors.primary)}>
                  {row.item.cloud_provider}
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
