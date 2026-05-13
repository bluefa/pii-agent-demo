'use client';

import { cn, textColors, bgColors, borderColors, providerColors } from '@/lib/theme';

export type AwsRegion = 'global' | 'china';

interface RegionOption {
  value: AwsRegion;
  title: string;
  description: string;
}

const OPTIONS: RegionOption[] = [
  { value: 'global', title: 'Global', description: 'aws.amazon.com' },
  { value: 'china', title: 'China', description: 'amazonaws.cn' },
];

interface AwsRegionToggleProps {
  value: AwsRegion;
  onChange: (value: AwsRegion) => void;
}

export const AwsRegionToggle = ({ value, onChange }: AwsRegionToggleProps) => (
  <div role="radiogroup" aria-label="AWS Region" className="grid grid-cols-2 gap-2">
    {OPTIONS.map((option) => {
      const isSelected = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={isSelected}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex flex-col items-start gap-0.5 rounded-lg border-2 px-3 py-2.5 text-left transition-colors',
            isSelected
              ? cn(providerColors.AWS.border, providerColors.AWS.bg, providerColors.AWS.text)
              : cn(borderColors.default, bgColors.surface, textColors.secondary),
          )}
        >
          <span className="text-sm font-semibold leading-tight">{option.title}</span>
          <span className={cn('text-[11px] leading-tight', isSelected ? textColors.tertiary : textColors.quaternary)}>
            {option.description}
          </span>
        </button>
      );
    })}
  </div>
);
