'use client';

import { ProviderGlyphTile } from '@/app/components/features/project-create/ProviderGlyphTile';
import type { OperatingRegion } from '@/app/components/features/project-create/wizard-model';
import { useLocale } from '@/app/components/LocaleProvider';
import { CheckIcon } from '@/app/components/ui/icons';
import {
  PROVIDER_CHIPS,
  hasChinaRegion,
  isCspChip,
  type ProviderChipDef,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';
import { COPY } from '@/lib/copy';
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

/** The wizard dictionary, so the maps below can take it as a parameter. */
type WizardCopy = (typeof COPY)['ko']['wizard'];

// China first, Global second: the two cards sit on one row and the default lands right.
// Only AWS and Azure reach this list (`hasChinaRegion`), so the console host can name
// the account the operator is actually looking at.
// The host stays here rather than in the dictionary — a console hostname is not a
// translatable string.
const regionOptions = (
  providerKey: ProviderChipKey,
  t: WizardCopy,
): Array<{ value: OperatingRegion; title: string; description: string }> => {
  const host =
    providerKey === 'azure'
      ? { china: 'portal.azure.cn', global: 'portal.azure.com' }
      : { china: 'console.amazonaws.cn', global: 'console.aws.amazon.com' };
  return [
    {
      value: 'china',
      title: 'China',
      description: `${t.regionChinaDesc} (${host.china})`,
    },
    {
      value: 'global',
      title: 'Global',
      description: `${t.regionGlobalDesc} (${host.global})`,
    },
  ];
};

// `provider-mapping.ts` is a plain constants module and stays locale-agnostic, so the two
// chips carrying Korean copy (`idc`, `other`) are localized here, at the render site. The
// three CSP chips carry brand names, which read the same in both languages.
const chipCopy = (
  chip: ProviderChipDef,
  t: WizardCopy,
): { label: string; description: string } => {
  if (chip.key === 'idc') return { label: t.idcLabel, description: t.idcDesc };
  if (chip.key === 'other') return { label: t.otherLabel, description: t.otherDesc };
  return { label: chip.label, description: chip.description };
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
}: Step1CloudAccountProps) => {
  const { locale } = useLocale();
  const t = COPY[locale].wizard;

  return (
    <div>
      <h2 className={cn('text-lg font-bold', textColors.primary)}>{t.s1Title}</h2>
      <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>{t.s1Sub}</p>

      <fieldset className="mb-5 border-0 p-0">
        <legend className={cn('mb-2 block text-sm font-semibold', textColors.secondary)}>
          {t.cloudChoice} <span className={statusColors.error.text}>*</span>
        </legend>
        <div role="radiogroup" aria-label={t.cloudChoice} className="grid grid-cols-5 gap-2">
          {PROVIDER_CHIPS.map((chip) => {
            const isSelected = providerKey === chip.key;
            const copy = chipCopy(chip, t);
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
                  {copy.label}
                </span>
                <span
                  className={cn(
                    'text-center text-xs leading-tight',
                    isSelected ? primaryColors.textOnLight : textColors.tertiary,
                  )}
                >
                  {copy.description}
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
            {t.region} <span className={statusColors.error.text}>*</span>
          </legend>
          <div
            role="radiogroup"
            aria-label={t.region}
            className="grid max-w-[520px] grid-cols-2 gap-2"
          >
            {regionOptions(providerKey, t).map((option) => {
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
            {t.region}
          </legend>
          {/* One column, not two: this branch renders exactly ONE card. At grid-cols-2 the
              card was stuck at (520 - 8) / 2 = 256px and its text box at 203px, which the
              description overflowed in both languages. 360px leaves a 307px text box
              (360 - 28 px-3.5 - 15 checkbox - 10 gap-2.5). */}
          <div className="grid max-w-[360px] grid-cols-1 gap-2">
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
                  {t.chinaOnly}
                </span>
              </span>
            </button>
          </div>
        </fieldset>
      )}

      {isCspChip(providerKey) && (
        // One line. The cap, not the column, was forcing the wrap: the content column
        // inside the modal is 644px (1000 shell - 32 p-4 - 248 rail - 16 gap-4 - 60
        // px-[30px]) and this sentence measures under that in both languages.
        <p className={cn('whitespace-nowrap text-xs', textColors.tertiary)}>{t.s1Footer}</p>
      )}
    </div>
  );
};
