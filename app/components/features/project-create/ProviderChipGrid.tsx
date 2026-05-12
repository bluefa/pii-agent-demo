'use client';

import type { FC } from 'react';
import { AwsIcon, AzureIcon, GcpIcon } from '@/app/components/ui/CloudProviderIcon';
import {
  cn,
  textColors,
  bgColors,
  borderColors,
  interactiveColors,
  providerColors,
} from '@/lib/theme';
import {
  PROVIDER_CHIPS,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';

const IdcIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
    <line x1="7" y1="17" x2="7.01" y2="17" />
  </svg>
);

const OtherIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CHIP_ICON: Record<ProviderChipKey, FC<{ className?: string }>> = {
  aws: AwsIcon,
  azure: AzureIcon,
  gcp: GcpIcon,
  idc: IdcIcon,
  other: OtherIcon,
};

// Selected-state palette per chip. Uses the existing provider-color tokens
// for the cloud providers; IDC/Other fall back to neutral tokens (no spec
// brand color).
const selectedClass = (key: ProviderChipKey): string => {
  switch (key) {
    case 'aws':
      return cn(providerColors.AWS.border, providerColors.AWS.bg, providerColors.AWS.text);
    case 'azure':
      return cn(providerColors.Azure.border, providerColors.Azure.bg, providerColors.Azure.text);
    case 'gcp':
      return cn(providerColors.GCP.border, providerColors.GCP.bg, providerColors.GCP.text);
    case 'idc':
      return cn(providerColors.IDC.border, providerColors.IDC.bg, providerColors.IDC.text);
    case 'other':
      return cn(borderColors.strong, bgColors.muted, textColors.secondary);
  }
};

interface ProviderChipGridProps {
  value: ProviderChipKey;
  onChange: (key: ProviderChipKey) => void;
}

export const ProviderChipGrid = ({ value, onChange }: ProviderChipGridProps) => (
  <div role="radiogroup" aria-label="Provider 선택" className="grid grid-cols-5 gap-2">
    {PROVIDER_CHIPS.map((chip) => {
      const Icon = CHIP_ICON[chip.key];
      const isSelected = value === chip.key;
      return (
        <button
          key={chip.key}
          type="button"
          role="radio"
          aria-checked={isSelected}
          onClick={() => onChange(chip.key)}
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-3 text-sm font-medium transition-all',
            isSelected
              ? selectedClass(chip.key)
              : cn(borderColors.default, bgColors.surface, textColors.secondary, interactiveColors.unselectedBorder),
          )}
        >
          <Icon className="w-5 h-5" />
          <span className="leading-tight">{chip.label}</span>
        </button>
      );
    })}
  </div>
);
