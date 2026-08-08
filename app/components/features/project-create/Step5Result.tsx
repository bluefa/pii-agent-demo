'use client';

import { CandidateCard } from '@/app/components/features/project-create/CandidateCard';
import { candidateTitle } from '@/app/components/features/project-create/candidate-display';
import type { AwsInstallMode } from '@/app/components/features/project-create/wizard-model';
import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
import { cn, statusColors, textColors } from '@/lib/theme';

export type RegistrationRowStatus = 'in-progress' | 'done' | 'failed';

export interface RegistrationRow {
  key: string;
  candidate: TargetSourceCreationCandidateResponse;
  status: RegistrationRowStatus;
  error?: string;
}

const RowStatus = ({ status }: { status: RegistrationRowStatus }) => {
  if (status === 'done') {
    return (
      <span className={cn('text-xs font-bold', statusColors.success.textDark)}>등록 완료</span>
    );
  }
  if (status === 'failed') {
    return <span className={cn('text-xs font-bold', statusColors.error.textDark)}>등록 실패</span>;
  }
  return (
    <span
      aria-label="등록 중"
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

export const Step5Result = ({ rows, installMode, complete, failedCount }: Step5ResultProps) => (
  <div>
    <h2 className={cn('text-lg font-bold', textColors.primary)}>
      {complete ? '등록을 완료했어요' : '인프라를 등록하고 있어요'}
    </h2>
    <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>
      {complete
        ? '등록이 끝났어요.'
        : '계정 연결과 자격증명 검증을 진행해요. 잠시만 기다려 주세요.'}
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
              {candidateTitle(row.candidate)} — {row.error}
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
        {failedCount === 0
          ? '모든 인프라가 등록됐어요. 목록에서 연동 진행 상황을 확인할 수 있어요.'
          : '일부 인프라 등록에 실패했어요. 닫고 다시 시도해주세요.'}
      </div>
    )}
  </div>
);
