'use client';

import { ProviderCredentialForm } from '@/app/components/features/project-create/ProviderCredentialForm';
import type { AwsInstallMode } from '@/app/components/features/project-create/wizard-model';
import { useLocale } from '@/app/components/LocaleProvider';
import { isCspChip, type ProviderChipKey } from '@/lib/constants/provider-mapping';
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

/** The wizard dictionary, so the map below can take it as a parameter. */
type WizardCopy = (typeof COPY)['ko']['wizard'];

// 자동 sits on the right and is the default: it is the path we recommend, and a
// segmented pair reads left→right as "the other option, then the one we mean".
const installOptions = (
  t: WizardCopy,
): Array<{ value: AwsInstallMode; title: string; description: string }> => [
  {
    value: 'manual',
    title: t.manualInstall,
    description: t.manualInstallDesc,
  },
  {
    value: 'auto',
    title: t.autoInstall,
    description: t.autoInstallDesc,
  },
];

interface Step2AccountInfoProps {
  providerKey: ProviderChipKey;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  showRequiredErrors: boolean;
  installMode: AwsInstallMode;
  onInstallModeChange: (mode: AwsInstallMode) => void;
}

export const Step2AccountInfo = ({
  providerKey,
  values,
  onChange,
  showRequiredErrors,
  installMode,
  onInstallModeChange,
}: Step2AccountInfoProps) => {
  const { locale } = useLocale();
  const t = COPY[locale].wizard;

  return (
    <div>
      <h2 className={cn('text-lg font-bold', textColors.primary)}>
        {isCspChip(providerKey) ? t.s2TitleCsp : t.s2TitleOther}
      </h2>
      <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>{t.s2Sub}</p>

      <ProviderCredentialForm
        chipKey={providerKey}
        values={values}
        onChange={onChange}
        showRequiredErrors={showRequiredErrors}
      />

      {providerKey === 'aws' && (
        <fieldset className="mt-5 border-0 p-0">
          <legend className={cn('mb-2 block text-sm font-semibold', textColors.secondary)}>
            {t.installMethod} <span className={statusColors.error.text}>*</span>
          </legend>
          <div
            role="radiogroup"
            aria-label={t.installMethod}
            className="grid max-w-[520px] grid-cols-2 gap-2"
          >
            {installOptions(t).map((option) => {
              const isSelected = installMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onInstallModeChange(option.value)}
                  className={cn(
                    'rounded-xl border-2 px-3.5 py-3 text-left transition-colors',
                    isSelected
                      ? cn(primaryColors.border, primaryColors.bgLight)
                      : cn(borderColors.default, bgColors.surface, interactiveColors.unselectedBorder),
                  )}
                >
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
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
};
