'use client';

import { cn, borderColors, statusColors, textColors } from '@/lib/theme';

export type RegistrationRowStatus = 'in-progress' | 'done' | 'failed';

export interface RegistrationRow {
  key: string;
  label: string;
  meta: string;
  status: RegistrationRowStatus;
  error?: string;
}

const RowStatus = ({ status }: { status: RegistrationRowStatus }) => {
  if (status === 'done') {
    return (
      <span className={cn('ml-auto text-xs font-bold', statusColors.success.textDark)}>
        등록 완료
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className={cn('ml-auto text-xs font-bold', statusColors.error.textDark)}>등록 실패</span>
    );
  }
  return (
    <span
      aria-label="등록 중"
      className={cn(
        'ml-auto h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-t-transparent motion-safe:animate-spin',
        statusColors.info.border,
      )}
    />
  );
};

interface Step5ResultProps {
  rows: RegistrationRow[];
  complete: boolean;
  failedCount: number;
}

export const Step5Result = ({ rows, complete, failedCount }: Step5ResultProps) => (
  <div>
    <h2 className={cn('text-lg font-bold', textColors.primary)}>
      {complete ? '등록을 완료했어요' : '인프라를 등록하고 있어요'}
    </h2>
    <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>
      {complete
        ? '등록이 끝났어요.'
        : '계정 연결과 자격증명 검증을 진행해요. 잠시만 기다려 주세요.'}
    </p>

    <div className="flex max-w-[640px] flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn('flex items-center gap-2.5 rounded-xl border px-4 py-3', borderColors.default)}
        >
          <span className={cn('text-sm font-bold', textColors.primary)}>{row.label}</span>
          <span className={cn('min-w-0 truncate text-xs', textColors.tertiary)}>{row.meta}</span>
          <RowStatus status={row.status} />
        </div>
      ))}
    </div>

    {rows.some((row) => row.error) && (
      <ul className="mt-3 flex max-w-[640px] flex-col gap-1">
        {rows
          .filter((row) => row.error)
          .map((row) => (
            <li key={`${row.key}-error`} className={cn('text-xs', statusColors.error.textDark)}>
              {row.label} — {row.error}
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
