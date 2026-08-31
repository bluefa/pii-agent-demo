'use client';

import { CandidateCard } from '@/app/components/features/project-create/CandidateCard';
import type { AwsInstallMode } from '@/app/components/features/project-create/wizard-model';
import { useLocale } from '@/app/components/LocaleProvider';
import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
import { COPY } from '@/lib/copy';
import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

interface Step4ReviewProps {
  candidates: TargetSourceCreationCandidateResponse[];
  /** Fallback for the 설치 모드 chip when the response does not echo the permission. */
  installMode: AwsInstallMode;
  busy: boolean;
  error: string | null;
}

export const Step4Review = ({ candidates, installMode, busy, error }: Step4ReviewProps) => {
  const addCount = candidates.filter((candidate) => candidate.status === 'ADD').length;
  const { locale } = useLocale();
  const t = COPY[locale].wizard;

  return (
    <div>
      <h2 className={cn('text-lg font-bold', textColors.primary)}>{t.s4Title}</h2>
      <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>{t.s4Sub}</p>

      {busy && (
        // Mirrors the settled layout below — count line, then candidate cards at the
        // /services row geometry — so nothing reflows when the response lands. Two
        // frames because the outcome is at most two accounts; the skeleton must not
        // answer how many, so both stay identical and unnumbered.
        <div role="status" aria-busy="true" aria-label={t.s4Loading}>
          <div
            className={cn(
              idcStyles.skeletonBar,
              'mb-3.5 h-[42px] max-w-[640px] rounded-[10px]',
            )}
          />
          <div className="flex max-w-[640px] flex-col gap-2.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className={cn(
                  'flex items-center gap-3.5 rounded-[12px] border px-[21px] py-[19px]',
                  bgColors.surface,
                  borderColors.card,
                )}
              >
                <div className={cn(idcStyles.skeletonBar, 'h-16 w-16 shrink-0 rounded-[12px]')} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className={cn(idcStyles.skeletonBar, 'h-6 w-[300px] max-w-full rounded')} />
                  <div className={cn(idcStyles.skeletonBar, 'h-[21px] w-[240px] max-w-full rounded')} />
                  <div className={cn(idcStyles.skeletonBar, 'h-8 w-full rounded-lg')} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!busy && error && (
        <div
          className={cn(
            'max-w-[640px] rounded-xl border px-4 py-3 text-sm',
            statusColors.error.border,
            statusColors.error.bg,
            statusColors.error.textDark,
          )}
        >
          {error}
        </div>
      )}

      {!busy && !error && (
        <>
          <p
            className={cn(
              'mb-3.5 max-w-[640px] rounded-[10px] px-3.5 py-2.5 text-sm font-semibold',
              primaryColors.bgLight,
              primaryColors.textOnLight,
            )}
          >
            {t.s4Count(addCount)}
          </p>

          <div className="flex max-w-[640px] flex-col gap-2.5">
            {candidates.map((candidate, idx) => (
              <CandidateCard
                key={`${candidate.cloud_type ?? 'candidate'}-${idx}`}
                candidate={candidate}
                installMode={installMode}
              />
            ))}
          </div>

          <p className={cn('mt-3.5 max-w-[640px] text-xs', textColors.tertiary)}>
            {t.s4Footer}
          </p>
        </>
      )}
    </div>
  );
};
