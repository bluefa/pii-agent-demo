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

const PROVIDER_CANONICAL: Record<string, CloudProvider> = {
  AWS: 'AWS',
  AZURE: 'Azure',
  GCP: 'GCP',
  IDC: 'IDC',
};

// candidate.cloud_type casing is not guaranteed (loose wire); normalize uppercase.
const toCloudProvider = (raw?: string | null): CloudProvider =>
  PROVIDER_CANONICAL[(raw ?? '').toUpperCase()] ?? 'AWS';

const formatIdentifierLabel = (candidate: TargetSourceCreationCandidateResponse): string => {
  const meta = candidate.metadata ?? {};
  switch (toCloudProvider(candidate.cloud_type)) {
    case 'AWS':
      return meta.aws_account_id ? `Payer ${meta.aws_account_id}` : '—';
    case 'Azure': {
      const tenant = meta.tenant_id ? `Tenant ${meta.tenant_id}` : '';
      const sub = meta.subscription_id ? ` · Sub ${meta.subscription_id}` : '';
      return `${tenant}${sub}` || '—';
    }
    case 'GCP':
      return meta.project_id ? `Project ${meta.project_id}` : '—';
    case 'IDC':
      return meta.description || '—';
    default:
      return '—';
  }
};

export interface PreviewRow {
  candidate: TargetSourceCreationCandidateResponse;
  dbType: string;
}

interface RegistrationPreviewCardListProps {
  rows: PreviewRow[];
}

const StatusBadge = ({ candidate }: { candidate: TargetSourceCreationCandidateResponse }) => {
  if (candidate.status === 'DUPLICATE') {
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
        {candidate.existing_target_source_id != null && (
          <Link
            href={integrationRoutes.targetSource(candidate.existing_target_source_id)}
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

const RegionChip = ({ candidate }: { candidate: TargetSourceCreationCandidateResponse }) => {
  if (toCloudProvider(candidate.cloud_type) !== 'AWS') return null;
  if (candidate.is_china_region) {
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

const InstallModeChip = ({ candidate }: { candidate: TargetSourceCreationCandidateResponse }) => {
  if (toCloudProvider(candidate.cloud_type) !== 'AWS') return null;
  if (candidate.grant_service_terraform_execution_permission) {
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

const SduTag = ({ candidate }: { candidate: TargetSourceCreationCandidateResponse }) =>
  candidate.is_sdu_type ? (
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
        const provider = toCloudProvider(row.candidate.cloud_type);
        return (
          <div
            key={`${row.dbType}-${idx}`}
            className={cn(
              'flex items-start gap-3 p-4 rounded-[12px] border',
              bgColors.surface,
              borderColors.default,
              row.candidate.status === 'DUPLICATE' && 'opacity-80',
            )}
          >
            <ProviderLogo provider={provider} isSdu={row.candidate.is_sdu_type === true} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-sm font-semibold', textColors.primary)}>
                  {provider}
                </span>
                <span className={cn('text-xs', textColors.tertiary)}>·</span>
                <span className={cn('text-xs font-medium', textColors.secondary)}>
                  {row.dbType}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <RegionChip candidate={row.candidate} />
                <InstallModeChip candidate={row.candidate} />
                <SduTag candidate={row.candidate} />
              </div>
              <div className={cn('mt-1.5 text-xs truncate', textColors.tertiary)}>
                {formatIdentifierLabel(row.candidate)}
              </div>
            </div>
            <StatusBadge candidate={row.candidate} />
          </div>
        );
      })}
    </div>
  );
};
