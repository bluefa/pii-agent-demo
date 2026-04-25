'use client';

import { useRef, useCallback } from 'react';
import { cn, primaryColors, textColors, borderColors, interactiveColors } from '@/lib/theme';
import { useToast } from '@/app/components/ui/toast/useToast';
import { ENABLED_PROVIDERS, DISABLED_PROVIDERS, PROVIDER_LABELS } from '@/app/integration/admin/guides/types';
import type { ProviderTab } from '@/app/integration/admin/guides/types';

interface ProviderTabsProps {
  value: ProviderTab;
  onChange: (provider: ProviderTab) => void;
}

/** Returns the toast message for a disabled provider tab. */
const disabledToastMessage = (provider: ProviderTab): string =>
  `${PROVIDER_LABELS[provider]} 가이드는 Step 구조 확정 후 별도 wave 에서 지원됩니다.`;

export const ProviderTabs = ({ value, onChange }: ProviderTabsProps) => {
  const toast = useToast();
  // Track last shown toast id per disabled provider to prevent duplicates.
  const activeDisabledToastRef = useRef<Partial<Record<ProviderTab, string>>>({});
  const tabRefs = useRef<Partial<Record<ProviderTab, HTMLButtonElement | null>>>({});

  const allTabs: ProviderTab[] = [...ENABLED_PROVIDERS, ...DISABLED_PROVIDERS];

  const focusTab = useCallback((provider: ProviderTab) => {
    tabRefs.current[provider]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, current: ProviderTab) => {
      const enabledList = ENABLED_PROVIDERS;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentIndex = enabledList.indexOf(current);
        if (currentIndex === -1) {
          // Disabled tab: move to nearest enabled
          focusTab(enabledList[0]);
          return;
        }
        const direction = e.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + direction + enabledList.length) % enabledList.length;
        const nextProvider = enabledList[nextIndex];
        onChange(nextProvider);
        focusTab(nextProvider);
      } else if (e.key === 'Home') {
        e.preventDefault();
        onChange(enabledList[0]);
        focusTab(enabledList[0]);
      } else if (e.key === 'End') {
        e.preventDefault();
        onChange(enabledList[enabledList.length - 1]);
        focusTab(enabledList[enabledList.length - 1]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (DISABLED_PROVIDERS.includes(current)) {
          handleDisabledClick(current);
        } else {
          onChange(current);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, focusTab],
  );

  const handleDisabledClick = (provider: ProviderTab) => {
    const existingId = activeDisabledToastRef.current[provider];
    // Dismiss previous toast for this provider before showing new one (dedupe).
    if (existingId) {
      toast.dismiss(existingId);
    }
    const id = toast.info(disabledToastMessage(provider), { durationMs: 4200 });
    activeDisabledToastRef.current = { ...activeDisabledToastRef.current, [provider]: id };
  };

  return (
    <div
      role="tablist"
      aria-label="클라우드 프로바이더"
      className={cn('flex border-b', borderColors.default)}
    >
      {allTabs.map((provider) => {
        const isDisabled = DISABLED_PROVIDERS.includes(provider);
        const isSelected = value === provider;
        const label = PROVIDER_LABELS[provider];

        return (
          <button
            key={provider}
            role="tab"
            type="button"
            ref={(el) => { tabRefs.current[provider] = el; }}
            aria-selected={isSelected}
            aria-disabled={isDisabled ? 'true' : undefined}
            tabIndex={isSelected || (!ENABLED_PROVIDERS.includes(value) && provider === ENABLED_PROVIDERS[0]) ? 0 : -1}
            onClick={() => {
              if (isDisabled) {
                handleDisabledClick(provider);
              } else {
                onChange(provider);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, provider)}
            className={cn(
              'px-5 py-3 text-sm font-medium border-b-2 transition-all duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2',
              primaryColors.focusRing,
              'focus-visible:outline',
              isSelected
                ? cn(primaryColors.border, primaryColors.text)
                : isDisabled
                  ? cn('border-transparent cursor-not-allowed', textColors.quaternary)
                  : interactiveColors.inactiveTab,
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
