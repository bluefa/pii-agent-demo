'use client';

import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { ProviderGlyphTile } from '@/app/components/features/project-create/ProviderGlyphTile';
import {
  candidateMetaLine,
  candidateProviderKey,
  candidateTitle,
  isSduCandidate,
} from '@/app/components/features/project-create/candidate-display';
import { PROVIDER_CHIP_BY_KEY } from '@/lib/constants/provider-mapping';
import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

const SDU_EXPLAINER =
  'Self Data Upload — PII Agent를 설치하는 대신, 데이터를 직접 업로드해 모니터링하는 방식이에요.';

const SduBadge = () => (
  <>
    <Tooltip content={SDU_EXPLAINER}>
      <button
        type="button"
        aria-describedby="sdu-badge-explainer"
        className={cn(
          'inline-flex cursor-help items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold',
          statusColors.warning.bg,
          statusColors.warning.textDark,
        )}
      >
        SDU ⓘ
      </button>
    </Tooltip>
    {/* The visual tip is portaled, so it carries no id a trigger can point at. This
        copy of the sentence is what a screen reader announces. */}
    <span id="sdu-badge-explainer" className="sr-only">
      {SDU_EXPLAINER}
    </span>
  </>
);

interface Step4ReviewProps {
  candidates: TargetSourceCreationCandidateResponse[];
  /** Labels of the databases picked in step 3, already joined for display. */
  dbSummary: string;
  busy: boolean;
  error: string | null;
}

export const Step4Review = ({ candidates, dbSummary, busy, error }: Step4ReviewProps) => {
  const addCount = candidates.filter((candidate) => candidate.status === 'ADD').length;

  return (
    <div>
      <h2 className={cn('text-lg font-bold', textColors.primary)}>이대로 등록할까요?</h2>
      <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>
        입력하신 내용으로 아래 연동 구성을 추천해요.
      </p>

      {busy && (
        <div className={cn('flex items-center gap-2 py-10 text-sm', textColors.tertiary)}>
          <LoadingSpinner />
          연동 구성을 확인하고 있어요.
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
            총 {addCount}개의 계정이 등록됩니다.
          </p>

          <div className="flex max-w-[640px] flex-col gap-2.5">
            {candidates.map((candidate, idx) => {
              const providerKey = candidateProviderKey(candidate.cloud_type);
              const isSdu = isSduCandidate(candidate);
              const isDuplicate = candidate.status !== 'ADD';

              return (
                <div
                  key={`${candidate.cloud_type ?? 'candidate'}-${idx}`}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4',
                    borderColors.default,
                    isDuplicate ? bgColors.muted : bgColors.surface,
                  )}
                >
                  <ProviderGlyphTile
                    providerKey={providerKey}
                    isSdu={isSdu}
                    className={cn('h-[34px] w-[34px]', isDuplicate && 'opacity-60')}
                    glyphClassName="h-[18px] w-[18px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-bold',
                          isDuplicate ? textColors.tertiary : textColors.primary,
                        )}
                      >
                        {candidateTitle(candidate)}
                      </span>
                      {isDuplicate ? null : isSdu ? (
                        <SduBadge />
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold',
                            primaryColors.bgLight,
                            primaryColors.textOnLight,
                          )}
                        >
                          PII Agent 설치
                        </span>
                      )}
                    </div>
                    <div className={cn('mt-0.5 text-xs', textColors.tertiary)}>
                      {isSdu
                        ? `${PROVIDER_CHIP_BY_KEY[providerKey].label} 계정과 함께 등록돼요`
                        : candidateMetaLine(candidate, dbSummary)}
                    </div>
                    <div
                      className={cn(
                        'mt-2 rounded-lg px-2.5 py-2 text-xs',
                        bgColors.muted,
                        textColors.secondary,
                      )}
                    >
                      {isDuplicate
                        ? '이미 등록된 계정이라 제외돼요.'
                        : isSdu
                          ? 'PII Agent 설치 방식을 지원하지 않는 Region·Cloud·Database가 포함되어 있어 Self Data Upload 방식을 추천했어요.'
                          : '선택하신 계정에 PII Agent를 설치해 모니터링해요.'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className={cn('mt-3.5 max-w-[640px] text-xs', textColors.tertiary)}>
            구성이 예상과 다르다면 이전 단계로 돌아가 입력을 수정할 수 있어요.
          </p>
        </>
      )}
    </div>
  );
};
