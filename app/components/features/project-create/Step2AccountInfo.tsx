'use client';

import { ProviderCredentialForm } from '@/app/components/features/project-create/ProviderCredentialForm';
import type { AwsInstallMode } from '@/app/components/features/project-create/wizard-model';
import { isCspChip, type ProviderChipKey } from '@/lib/constants/provider-mapping';
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

// 자동 sits on the right and is the default: it is the path we recommend, and a
// segmented pair reads left→right as "the other option, then the one we mean".
const INSTALL_OPTIONS: Array<{ value: AwsInstallMode; title: string; description: string }> = [
  { value: 'manual', title: '수동 설치', description: '제공되는 스크립트를 직접 실행해요.' },
  { value: 'auto', title: '자동 설치', description: '권한을 위임하면 모듈을 자동으로 설치해요.' },
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
}: Step2AccountInfoProps) => (
  <div>
    <h2 className={cn('text-lg font-bold', textColors.primary)}>
      {isCspChip(providerKey) ? '계정 정보를 알려주세요' : '인프라 정보를 알려주세요'}
    </h2>
    <p className={cn('mt-1 mb-5 text-sm', textColors.tertiary)}>
      연결할 계정을 확인하는 데 사용해요.
    </p>

    <ProviderCredentialForm
      chipKey={providerKey}
      values={values}
      onChange={onChange}
      showRequiredErrors={showRequiredErrors}
    />

    {providerKey === 'aws' && (
      <fieldset className="mt-5 border-0 p-0">
        <legend className={cn('mb-2 block text-sm font-semibold', textColors.secondary)}>
          설치 방식 <span className={statusColors.error.text}>*</span>
        </legend>
        <div
          role="radiogroup"
          aria-label="설치 방식"
          className="grid max-w-[520px] grid-cols-2 gap-2"
        >
          {INSTALL_OPTIONS.map((option) => {
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
