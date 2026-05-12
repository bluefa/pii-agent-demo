'use client';

import { cn, bgColors, borderColors, statusColors, textColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';

export type ProgressRowStatus = 'in-progress' | 'done' | 'failed';

export interface ProgressRow {
  key: string;
  cloudProvider: CloudProvider;
  isSdu: boolean;
  primaryLabel: string;
  secondaryLabel: string;
  status: ProgressRowStatus;
  error?: string;
}

interface RegistrationProgressListProps {
  rows: ProgressRow[];
  title: string;
  subtitle: string;
  tone: 'running' | 'success' | 'error';
}

const StatusIcon = ({ status }: { status: ProgressRowStatus }) => {
  if (status === 'done') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded-full',
          statusColors.success.bg,
          statusColors.success.textDark,
        )}
        aria-label="완료"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded-full',
          statusColors.error.bg,
          statusColors.error.textDark,
        )}
        aria-label="실패"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-full',
        statusColors.info.bg,
      )}
      aria-label="진행 중"
    >
      <span
        className={cn(
          'w-3 h-3 border-2 border-t-transparent rounded-full animate-spin',
          statusColors.info.border,
        )}
      />
    </span>
  );
};

export const RegistrationProgressList = ({
  rows,
  title,
  subtitle,
  tone,
}: RegistrationProgressListProps) => {
  const doneCount = rows.filter((r) => r.status === 'done').length;
  const failedCount = rows.filter((r) => r.status === 'failed').length;
  const totalCount = rows.length;
  const progressPct = totalCount > 0 ? Math.round(((doneCount + failedCount) / totalCount) * 100) : 0;

  const bannerPalette =
    tone === 'success'
      ? statusColors.success
      : tone === 'error'
        ? statusColors.error
        : statusColors.info;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-[12px] border',
          borderColors.default,
          bgColors.surface,
        )}
      >
        <span
          className={cn(
            'inline-flex items-center justify-center w-9 h-9 rounded-full',
            bannerPalette.bg,
            bannerPalette.textDark,
          )}
        >
          {tone === 'success' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : tone === 'error' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <span className={cn('w-4 h-4 border-2 border-t-transparent rounded-full animate-spin', bannerPalette.border)} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-semibold', textColors.primary)}>{title}</div>
          <div className={cn('text-xs', textColors.tertiary)}>{subtitle}</div>
        </div>
        <div className={cn('text-sm font-semibold', textColors.primary)}>
          {doneCount + failedCount}
          <span className={cn('text-xs font-normal ml-0.5', textColors.tertiary)}>/{totalCount}</span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="인프라 등록 진행률"
        className={cn('h-1.5 rounded-full overflow-hidden', bgColors.muted)}
      >
        <div
          className={cn('h-full transition-[width] duration-300', bannerPalette.dot)}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-[10px] border',
              borderColors.default,
              bgColors.surface,
            )}
          >
            <ProviderLogo provider={row.cloudProvider} isSdu={row.isSdu} className="w-9 h-9" />
            <div className="flex-1 min-w-0">
              <div className={cn('text-sm font-medium', textColors.primary)}>
                {row.primaryLabel}
              </div>
              <div className={cn('text-xs truncate', textColors.tertiary)}>
                {row.secondaryLabel}
              </div>
              {row.error && (
                <div className={cn('text-xs mt-0.5', statusColors.error.text)}>{row.error}</div>
              )}
            </div>
            <StatusIcon status={row.status} />
          </div>
        ))}
      </div>
    </div>
  );
};
