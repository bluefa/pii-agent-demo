'use client';

import { cn, textColors, bgColors, borderColors, statusColors } from '@/lib/theme';

export type InstallMode = 'auto' | 'manual';

interface InstallModeOption {
  value: InstallMode;
  title: string;
  description: string;
}

const OPTIONS: InstallModeOption[] = [
  {
    value: 'auto',
    title: '자동 설치',
    description: 'CloudFormation으로 Agent · IAM Role을 자동 배포',
  },
  {
    value: 'manual',
    title: '수동 설치',
    description: '제공된 가이드를 따라 직접 권한 · Agent를 설치',
  },
];

interface InstallModeToggleProps {
  value: InstallMode;
  onChange: (value: InstallMode) => void;
}

export const InstallModeToggle = ({ value, onChange }: InstallModeToggleProps) => (
  <div role="radiogroup" aria-label="설치 모드" className="grid grid-cols-2 gap-2">
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
              ? cn(statusColors.info.border, statusColors.info.bg, statusColors.info.textDark)
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
