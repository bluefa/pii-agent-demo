'use client';

import { ProviderGlyphTile } from '@/app/components/features/project-create/ProviderGlyphTile';
import type { OperatingRegion } from '@/app/components/features/project-create/wizard-model';
import { CheckIcon } from '@/app/components/ui/icons';
import {
  PROVIDER_CHIPS,
  hasChinaRegion,
  isCspChip,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

// China first, Global second: the two cards sit on one row and the default lands right.
// Only AWS and Azure reach this list (`hasChinaRegion`), so the console host can name
// the account the operator is actually looking at.
const regionOptions = (
  providerKey: ProviderChipKey,
): Array<{ value: OperatingRegion; title: string; description: string }> => {
  const host =
    providerKey === 'azure'
      ? { china: 'portal.azure.cn', global: 'portal.azure.com' }
      : { china: 'console.amazonaws.cn', global: 'console.aws.amazon.com' };
  return [
    {
      value: 'china',
      title: 'China',
      description: `중국 계정인 경우 선택해 주세요. (${host.china})`,
    },
    {
      value: 'global',
      title: 'Global',
      description: `글로벌 상용 계정인 경우 선택해 주세요. (${host.global})`,
    },
  ];
};

interface Step1CloudAccountProps {
  providerKey: ProviderChipKey;
  onProviderChange: (key: ProviderChipKey) => void;
  region: OperatingRegion;
  onRegionChange: (region: OperatingRegion) => void;
}

export const Step1CloudAccount = ({
  providerKey,
  onProviderChange,
  region,
  onRegionChange,
}: Step1CloudAccountProps) => (
  <div>
    <h2 className={cn('text-lg font-bold', textColors.primary)}>어떤 클라우드를 사용하시나요?</h2>
    <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>
      운영 환경에 맞는 연동 방식을 안내해 드려요.
    </p>

    <fieldset className="mb-5 border-0 p-0">
      <legend className={cn('mb-2 block text-sm font-semibold', textColors.secondary)}>
        클라우드 선택 <span className={statusColors.error.text}>*</span>
      </legend>
      <div role="radiogroup" aria-label="클라우드 선택" className="grid grid-cols-5 gap-2">
        {PROVIDER_CHIPS.map((chip) => {
          const isSelected = providerKey === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onProviderChange(chip.key)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 pt-3.5 pb-3 transition-colors',
                isSelected
                  ? cn(primaryColors.border, primaryColors.bgLight)
                  : cn(borderColors.default, bgColors.surface, interactiveColors.unselectedBorder),
              )}
            >
              <ProviderGlyphTile
                providerKey={chip.key}
                className="h-9 w-9"
                glyphClassName="h-[22px] w-[22px]"
              />
              <span
                className={cn(
                  'text-sm font-semibold',
                  isSelected ? primaryColors.textOnLight : textColors.secondary,
                )}
              >
                {chip.label}
              </span>
              <span
                className={cn(
                  'text-center text-xs leading-tight',
                  isSelected ? primaryColors.textOnLight : textColors.tertiary,
                )}
              >
                {chip.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>

    {/* GCP has no China partition, so it is never asked — a radio pair whose answer is
        fixed is not a choice. The 안내 line below stays on every CSP, though: it is
        about the whole form, not about the region. */}
    {hasChinaRegion(providerKey) && isCspChip(providerKey) && (
      <fieldset className="mb-1.5 border-0 p-0">
        <legend className={cn('mb-2 block text-sm font-semibold', textColors.secondary)}>
          운영 리전 <span className={statusColors.error.text}>*</span>
        </legend>
        <div
          role="radiogroup"
          aria-label="운영 리전"
          className="grid max-w-[520px] grid-cols-2 gap-2"
        >
          {regionOptions(providerKey).map((option) => {
            const isSelected = region === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onRegionChange(option.value)}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left transition-colors',
                  isSelected
                    ? cn(primaryColors.border, primaryColors.bgLight)
                    : cn(borderColors.default, bgColors.surface, interactiveColors.unselectedBorder),
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1 h-4 w-4 flex-shrink-0 rounded-full',
                    // The filled dot IS a 5px ring, not a 2px ring with a dot inside —
                    // declared as one class each so the two widths never both apply.
                    isSelected
                      ? cn('border-[5px]', primaryColors.border)
                      : cn('border-2', borderColors.strong),
                  )}
                />
                <span>
                  <span
                    className={cn(
                      'block text-sm font-semibold',
                      isSelected ? primaryColors.textOnLight : textColors.primary,
                    )}
                  >
                    {option.title}
                  </span>
                  <span
                    className={cn(
                      'block text-xs',
                      isSelected ? primaryColors.textOnLight : textColors.tertiary,
                    )}
                  >
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    )}

    {/* IDC/기타 reach the same wire field, so they keep the card shape the CSP pair
        wears — but the control is a checkbox, not a radio. There is no console host to
        name and no second account to choose between: this is one fact to declare, not a
        fork to take. Hence a single card and no required marker. */}
    {hasChinaRegion(providerKey) && !isCspChip(providerKey) && (
      <fieldset className="mb-1.5 border-0 p-0">
        <legend className={cn('mb-2 block text-sm font-semibold', textColors.secondary)}>
          운영 리전
        </legend>
        <div className="grid max-w-[520px] grid-cols-2 gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={region === 'china'}
            onClick={() => onRegionChange(region === 'china' ? 'global' : 'china')}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left transition-colors',
              region === 'china'
                ? cn(primaryColors.border, primaryColors.bgLight)
                : cn(borderColors.default, bgColors.surface, interactiveColors.unselectedBorder),
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-1 inline-flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded border-2',
                region === 'china'
                  ? cn(primaryColors.border, primaryColors.bg, textColors.inverse)
                  : borderColors.strong,
              )}
            >
              {region === 'china' && <CheckIcon className="h-3 w-3" />}
            </span>
            <span>
              <span
                className={cn(
                  'block text-sm font-semibold',
                  region === 'china' ? primaryColors.textOnLight : textColors.primary,
                )}
              >
                China
              </span>
              <span
                className={cn(
                  // break-keep: Korean otherwise wraps mid-word — this line breaks between words.
                  'block break-keep text-xs',
                  region === 'china' ? primaryColors.textOnLight : textColors.tertiary,
                )}
              >
                중국 지역에서 운영 중인 경우에만 선택해 주세요
              </span>
            </span>
          </button>
        </div>
      </fieldset>
    )}

    {isCspChip(providerKey) && (
      <p className={cn('max-w-[520px] text-xs', textColors.tertiary)}>
        입력하신 내용을 바탕으로 알맞은 PII 모니터링 연동 방식을 안내해 드려요. 「등록 내용 확인」
        단계에서 확인할 수 있어요.
      </p>
    )}
  </div>
);
