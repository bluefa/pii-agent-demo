'use client';

import { cn, textColors, bgColors, borderColors, providerColors } from '@/lib/theme';

// auto → grant_service_terraform_execution_permission=true (서비스가 Terraform 자동 실행)
// manual → false (관리자가 설치 스크립트를 직접 실행)
export type AwsInstallMode = 'auto' | 'manual';

interface InstallModeOption {
  value: AwsInstallMode;
  title: string;
  description: string;
}

const OPTIONS: InstallModeOption[] = [
  { value: 'auto', title: '자동 설치', description: 'Terraform 실행 권한 위임' },
  { value: 'manual', title: '수동 설치', description: '설치 스크립트 직접 실행' },
];

interface AwsInstallModeToggleProps {
  value: AwsInstallMode | null;
  onChange: (value: AwsInstallMode) => void;
}

export const AwsInstallModeToggle = ({ value, onChange }: AwsInstallModeToggleProps) => (
  <div role="radiogroup" aria-label="AWS 설치 방식" className="grid grid-cols-2 gap-2">
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
