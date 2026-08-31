'use client';

import { CandidateCard } from '@/app/components/features/project-create/CandidateCard';
import { candidateTitle } from '@/app/components/features/project-create/candidate-display';
import type { AwsInstallMode } from '@/app/components/features/project-create/wizard-model';
import { useLocale } from '@/app/components/LocaleProvider';
import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
import { COPY } from '@/lib/copy';
import { cn, statusColors, textColors } from '@/lib/theme';

export type RegistrationRowStatus = 'in-progress' | 'done' | 'failed';

export interface RegistrationRow {
  key: string;
  candidate: TargetSourceCreationCandidateResponse;
  status: RegistrationRowStatus;
  error?: string;
}

const RowStatus = ({ status }: { status: RegistrationRowStatus }) => {
  const { locale } = useLocale();
  const t = COPY[locale].wizard;

  if (status === 'done') {
    return (
      <span className={cn('text-xs font-bold', statusColors.success.textDark)}>{t.s5Done}</span>
    );
  }
  if (status === 'failed') {
    return (
      <span className={cn('text-xs font-bold', statusColors.error.textDark)}>{t.s5Failed}</span>
    );
  }
  return (
    <span
      aria-label={t.s5Busy}
      className={cn(
        'block h-3.5 w-3.5 rounded-full border-2 border-t-transparent motion-safe:animate-spin',
        statusColors.info.border,
      )}
    />
  );
};

interface Step5ResultProps {
  rows: RegistrationRow[];
  installMode: AwsInstallMode;
  complete: boolean;
  failedCount: number;
}

export const Step5Result = ({ rows, installMode, complete, failedCount }: Step5ResultProps) => {
  const { locale } = useLocale();
  const t = COPY[locale].wizard;

  return (
    <div>
      <h2 className={cn('text-lg font-bold', textColors.primary)}>
        {complete ? t.s5TitleDone : t.s5TitleBusy}
      </h2>
      <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>
        {complete ? t.s5SubDone : t.s5SubBusy}
      </p>

      {/* Same cards as 등록 내용 확인 — the user is watching the very rows they just
          approved, so re-rendering them in a different anatomy would read as a
          different set. Only the status on the right is new. */}
      <div className="flex max-w-[640px] flex-col gap-2.5">
        {rows.map((row) => (
          <CandidateCard
            key={row.key}
            candidate={row.candidate}
            installMode={installMode}
            trailing={<RowStatus status={row.status} />}
          />
        ))}
      </div>

      {rows.some((row) => row.error) && (
        <ul className="mt-3 flex max-w-[640px] flex-col gap-1">
          {rows
            .filter((row) => row.error)
            .map((row) => (
              <li key={`${row.key}-error`} className={cn('text-xs', statusColors.error.textDark)}>
                {candidateTitle(t, row.candidate)} — {row.error}
              </li>
            ))}
        </ul>
      )}

      {complete && (
        <div
          className={cn(
            'mt-4 max-w-[640px] rounded-xl px-4 py-3.5 text-sm font-semibold',
            failedCount === 0
              ? cn(statusColors.success.bg, statusColors.success.textDark)
              : cn(statusColors.warning.bg, statusColors.warning.textDark),
          )}
        >
          {failedCount === 0 ? t.s5AllOk : t.s5SomeFailed}
        </div>
      )}
    </div>
  );
};
