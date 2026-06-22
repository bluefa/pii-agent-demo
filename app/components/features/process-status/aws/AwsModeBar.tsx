'use client';

import { cn, tabStyles } from '@/lib/theme';
import type { AwsInstallationMode } from '@/lib/types';

interface AwsModeBarProps {
  value: AwsInstallationMode;
  onChange: (mode: AwsInstallationMode) => void;
}

const MODE_LABELS: Record<AwsInstallationMode, string> = {
  AUTO: '자동 설치',
  MANUAL: '수동 설치',
};

const MODE_ORDER: readonly AwsInstallationMode[] = ['AUTO', 'MANUAL'];

/**
 * AWS install-mode sub-toggle (Step 4, AWS only) — mirrors v16 `.aws-mode-bar`.
 *
 * A label ("AWS 설치 모드 <strong>{current}</strong>") plus a segmented control
 * that switches the install card between AUTO and MANUAL views. Reuses the
 * shared `.seg-toggle` visual via `tabStyles.segmented`.
 */
export const AwsModeBar = ({ value, onChange }: AwsModeBarProps) => (
  <div className="flex items-center justify-between gap-4">
    <div className="text-[13px] font-semibold tracking-[-0.01em] text-[#4E5968]">
      AWS 설치 모드
      <strong className="ml-1 font-bold text-[#191F28]">{MODE_LABELS[value]}</strong>
    </div>
    <div
      role="group"
      aria-label="AWS 설치 모드"
      className={cn(tabStyles.segmented.container, tabStyles.segmented.containerBg)}
    >
      {MODE_ORDER.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(mode)}
            className={cn(tabStyles.segmented.item, active && tabStyles.segmented.itemActive)}
          >
            {MODE_LABELS[mode]}
          </button>
        );
      })}
    </div>
  </div>
);
