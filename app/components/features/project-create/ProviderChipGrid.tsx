'use client';

import { cn, textColors, bgColors, borderColors, tagStyles, providerColors } from '@/lib/theme';
import {
  PROVIDER_CHIPS,
  type ProviderChipDef,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';

interface ProviderChipGridProps {
  value: ProviderChipKey;
  onChange: (key: ProviderChipKey) => void;
}

const selectedClassName = (chip: ProviderChipDef) => {
  if (chip.cloudProvider === 'AWS') return `${providerColors.AWS.border} ${providerColors.AWS.bg} ${providerColors.AWS.text}`;
  if (chip.cloudProvider === 'Azure') return `${providerColors.Azure.border} ${providerColors.Azure.bg} ${providerColors.Azure.text}`;
  if (chip.cloudProvider === 'GCP') return `${providerColors.GCP.border} ${providerColors.GCP.bg} ${providerColors.GCP.text}`;
  return `${borderColors.default} ${bgColors.muted}`;
};

export const ProviderChipGrid = ({ value, onChange }: ProviderChipGridProps) => {
  return (
    <div className="grid grid-cols-7 gap-2">
      {PROVIDER_CHIPS.map((chip) => {
        const isSelected = chip.enabled && value === chip.key;
        const baseClass = cn(
          'relative flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 py-3 text-center text-sm font-medium transition-all',
          chip.enabled
            ? isSelected
              ? selectedClassName(chip)
              : cn(borderColors.default, textColors.secondary, 'bg-white hover:border-gray-400')
            : cn(borderColors.default, bgColors.muted, textColors.quaternary, 'opacity-50 cursor-not-allowed'),
        );

        return (
          <button
            key={chip.key}
            type="button"
            disabled={!chip.enabled}
            onClick={chip.enabled ? () => onChange(chip.key) : undefined}
            title={chip.enabled ? undefined : '추후 지원 예정'}
            className={baseClass}
          >
            <span className="leading-tight">{chip.label}</span>
            {chip.sublabel && (
              <span className={cn('text-[11px] leading-tight', textColors.tertiary)}>
                {chip.sublabel}
              </span>
            )}
            {!chip.enabled && (
              <span
                className={cn(
                  'absolute -top-2 right-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  tagStyles.gray,
                )}
              >
                준비중
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
