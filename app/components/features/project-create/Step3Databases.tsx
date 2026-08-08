'use client';

import {
  DB_TYPES_BY_PROVIDER,
  type DbType,
} from '@/lib/constants/db-types';
import { CheckIcon } from '@/app/components/ui/icons';
import { PROVIDER_CHIP_BY_KEY, type ProviderChipKey } from '@/lib/constants/provider-mapping';
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

interface Step3DatabasesProps {
  providerKey: ProviderChipKey;
  selected: DbType[];
  onToggle: (value: DbType) => void;
  othersSelected: boolean;
  onOthersToggle: () => void;
  /** Set once 다음 has been refused with nothing selected. */
  showError: boolean;
}

export const Step3Databases = ({
  providerKey,
  selected,
  onToggle,
  othersSelected,
  onOthersToggle,
  showError,
}: Step3DatabasesProps) => {
  // 기타 환경 has no vendor to name, so the sentence talks about the environment itself.
  const scopeName = providerKey === 'other' ? '해당 환경' : PROVIDER_CHIP_BY_KEY[providerKey].label;

  return (
    <div>
      <h2 className={cn('text-lg font-bold', textColors.primary)}>
        사용 중인 Database를 확인해 주세요
      </h2>
      <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>
        {scopeName}에서 사용 중인 Database를 모두 선택해 주세요.{' '}
        <span className={cn('font-semibold', textColors.secondary)}>
          선택 개수와 등록 건수는 무관해요.
        </span>
      </p>

      <div
        role="group"
        aria-label="사용 중인 Database"
        className="grid max-w-[640px] grid-cols-4 gap-2"
      >
        {DB_TYPES_BY_PROVIDER[providerKey].map((db) => {
          const isSelected = selected.includes(db.value);
          return (
            <button
              key={db.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(db.value)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-[10px] border-2 px-2 py-2.5 text-sm font-semibold transition-colors',
                isSelected
                  ? cn(primaryColors.border, primaryColors.bgLight, primaryColors.textOnLight)
                  : cn(
                      borderColors.default,
                      bgColors.surface,
                      textColors.secondary,
                      interactiveColors.unselectedBorder,
                    ),
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded border-2',
                  isSelected
                    ? cn(primaryColors.border, primaryColors.bg, textColors.inverse)
                    : borderColors.strong,
                )}
              >
                {isSelected && <CheckIcon className="h-3 w-3" />}
              </span>
              {db.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-pressed={othersSelected}
        onClick={onOthersToggle}
        className={cn(
          'mt-2.5 w-full max-w-[640px] rounded-[10px] border-2 px-3.5 py-2.5 text-left text-sm transition-colors',
          othersSelected
            ? cn(primaryColors.border, primaryColors.bgLight, primaryColors.textOnLight)
            : cn('border-dashed', borderColors.strong, textColors.secondary),
        )}
      >
        {othersSelected ? (
          <>
            <span className="font-semibold">✓ Others</span> — 목록에 없는 Database를 사용하고 있어요
          </>
        ) : (
          <>
            찾으시는 DB가 없으신가요?{' '}
            <span className={cn('font-semibold', primaryColors.textOnLight)}>Others로 선택 →</span>
          </>
        )}
      </button>

      {showError ? (
        <p className={cn('mt-2.5 max-w-[640px] text-xs', statusColors.error.textDark)}>
          사용 중인 Database를 1개 이상 선택해 주세요. 목록에 없다면 Others를 선택해 주세요.
        </p>
      ) : (
        <p className={cn('mt-2.5 max-w-[640px] text-xs', textColors.tertiary)}>
          선택하신 Database는 연동 구성을 판단하는 데 사용해요.
        </p>
      )}
    </div>
  );
};
