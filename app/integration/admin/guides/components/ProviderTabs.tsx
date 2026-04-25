'use client';

import { useCallback, useRef } from 'react';

import { useToast } from '@/app/components/ui/toast/useToast';
import {
  ALL_PROVIDER_TABS,
  ENABLED_PROVIDERS,
  PROVIDER_LABELS,
  isDisabledProvider,
} from '@/app/integration/admin/guides/types';
import {
  borderColors,
  cn,
  interactiveColors,
  primaryColors,
  textColors,
} from '@/lib/theme';

import type { ProviderTab } from '@/app/integration/admin/guides/types';

interface ProviderTabsProps {
  value: ProviderTab;
  onChange: (provider: ProviderTab) => void;
}

const disabledToastMessage = (provider: ProviderTab): string =>
  `${PROVIDER_LABELS[provider]} 가이드는 Step 구조 확정 후 별도 wave 에서 지원됩니다.`;

export const ProviderTabs = ({ value, onChange }: ProviderTabsProps) => {
  const toast = useToast();
  // Last toast id per disabled provider — refs mutate in place; no spread.
  const activeDisabledToastRef = useRef<Partial<Record<ProviderTab, string>>>({});
  const tabRefs = useRef<Partial<Record<ProviderTab, HTMLButtonElement | null>>>({});

  const focusTab = useCallback((provider: ProviderTab) => {
    tabRefs.current[provider]?.focus();
  }, []);

  const handleDisabledClick = useCallback(
    (provider: ProviderTab) => {
      const existingId = activeDisabledToastRef.current[provider];
      if (existingId) toast.dismiss(existingId);
      const id = toast.info(disabledToastMessage(provider), { durationMs: 4200 });
      activeDisabledToastRef.current[provider] = id;
    },
    [toast],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, current: ProviderTab) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentIndex = ENABLED_PROVIDERS.indexOf(current as never);
        if (currentIndex === -1) {
          focusTab(ENABLED_PROVIDERS[0]);
          return;
        }
        const direction = e.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + direction + ENABLED_PROVIDERS.length) % ENABLED_PROVIDERS.length;
        const next = ENABLED_PROVIDERS[nextIndex];
        onChange(next);
        focusTab(next);
      } else if (e.key === 'Home') {
        e.preventDefault();
        onChange(ENABLED_PROVIDERS[0]);
        focusTab(ENABLED_PROVIDERS[0]);
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = ENABLED_PROVIDERS[ENABLED_PROVIDERS.length - 1];
        onChange(last);
        focusTab(last);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isDisabledProvider(current)) {
          handleDisabledClick(current);
        } else {
          onChange(current);
        }
      }
    },
    [onChange, focusTab, handleDisabledClick],
  );

  return (
    <div
      role="tablist"
      aria-label="클라우드 프로바이더"
      className={cn('flex border-b', borderColors.default)}
    >
      {ALL_PROVIDER_TABS.map((provider) => {
        const isDisabled = isDisabledProvider(provider);
        const isSelected = value === provider;

        return (
          <button
            key={provider}
            role="tab"
            type="button"
            ref={(el) => {
              tabRefs.current[provider] = el;
            }}
            aria-selected={isSelected}
            aria-disabled={isDisabled ? 'true' : undefined}
            tabIndex={isSelected ? 0 : -1}
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
            {PROVIDER_LABELS[provider]}
          </button>
        );
      })}
    </div>
  );
};
