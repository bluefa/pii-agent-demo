'use client';

import { useCallback, useMemo, useRef } from 'react';

import {
  ENABLED_PROVIDERS,
  PLACEMENT_PROVIDER_BY_TAB,
} from '@/app/integration/admin/guides/types';
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import { bgColors, borderColors, cn, primaryColors, textColors } from '@/lib/theme';

import type { ProviderTab } from '@/app/integration/admin/guides/types';
import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { GuideName, GuideSlot } from '@/lib/types/guide';

interface StepListPanelProps {
  provider: ProviderTab;
  selectedKey: GuideSlotKey | null;
  onSelect: (key: GuideSlotKey) => void;
}

interface StepRow {
  key: GuideSlotKey;
  slot: GuideSlot;
  variantLabel: string | null;
  isShared: boolean;
}

// Precompute slot count per guide name once at module load — used to
// flag shared guides ("공유" badge) and to drop duplicate AUTO/MANUAL
// rows where a guide isn't actually forked.
const SLOT_COUNT_BY_NAME = ((): ReadonlyMap<GuideName, number> => {
  const map = new Map<GuideName, number>();
  for (const slot of Object.values(GUIDE_SLOTS)) {
    map.set(slot.guideName, (map.get(slot.guideName) ?? 0) + 1);
  }
  return map;
})();

type EnabledProvider = (typeof ENABLED_PROVIDERS)[number];

const isEnabledProvider = (tab: ProviderTab): tab is EnabledProvider =>
  (ENABLED_PROVIDERS as readonly ProviderTab[]).includes(tab);

const buildRows = (provider: ProviderTab): StepRow[] => {
  if (!isEnabledProvider(provider)) return [];
  const placementProvider = PLACEMENT_PROVIDER_BY_TAB[provider];
  const rows: StepRow[] = [];

  for (const [rawKey, slot] of Object.entries(GUIDE_SLOTS)) {
    if (slot.placement.kind !== 'process-step') continue;
    if (slot.placement.provider !== placementProvider) continue;

    const variant = 'variant' in slot.placement ? slot.placement.variant ?? null : null;
    const sharedCount = SLOT_COUNT_BY_NAME.get(slot.guideName) ?? 0;

    // Drop the MANUAL row when the guide isn't actually forked at this
    // step (sharedCount < 2 means AUTO and MANUAL collapse to one entry).
    if (variant === 'MANUAL' && sharedCount < 2) continue;

    rows.push({
      key: rawKey as GuideSlotKey,
      slot,
      variantLabel: sharedCount >= 2 ? variant : null,
      isShared: sharedCount >= 2,
    });
  }

  return rows.sort((a, b) => {
    if (a.slot.placement.kind !== 'process-step' || b.slot.placement.kind !== 'process-step') {
      return 0;
    }
    const stepDiff = a.slot.placement.step - b.slot.placement.step;
    if (stepDiff !== 0) return stepDiff;
    const aVar = 'variant' in a.slot.placement ? a.slot.placement.variant ?? '' : '';
    const bVar = 'variant' in b.slot.placement ? b.slot.placement.variant ?? '' : '';
    return aVar.localeCompare(bVar);
  });
};

const rowAriaLabel = (row: StepRow): string => {
  if (row.slot.placement.kind !== 'process-step') return '';
  const { provider, step, stepLabel } = row.slot.placement;
  const variant = 'variant' in row.slot.placement ? row.slot.placement.variant : undefined;
  const variantText = variant ? ` ${variant === 'AUTO' ? '자동' : '수동'}` : '';
  return `${provider} ${step}단계 ${stepLabel}${variantText}`;
};

export const StepListPanel = ({ provider, selectedKey, onSelect }: StepListPanelProps) => {
  const rows = useMemo(() => buildRows(provider), [provider]);
  const rowRefs = useRef<Partial<Record<GuideSlotKey, HTMLDivElement | null>>>({});

  const focusRow = useCallback((key: GuideSlotKey) => {
    rowRefs.current[key]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, currentKey: GuideSlotKey) => {
      const currentIndex = rows.findIndex((r) => r.key === currentKey);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusRow(rows[Math.min(currentIndex + 1, rows.length - 1)].key);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusRow(rows[Math.max(currentIndex - 1, 0)].key);
      } else if (e.key === 'Home') {
        e.preventDefault();
        focusRow(rows[0].key);
      } else if (e.key === 'End') {
        e.preventDefault();
        focusRow(rows[rows.length - 1].key);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(currentKey);
      }
    },
    [rows, focusRow, onSelect],
  );

  return (
    <div
      role="list"
      aria-label="단계 목록"
      className={cn('h-full overflow-y-auto border-r', borderColors.default)}
    >
      {rows.map((row) => {
        const isSelected = selectedKey === row.key;
        const step = row.slot.placement.kind === 'process-step' ? row.slot.placement.step : 0;
        const stepLabel = row.slot.placement.kind === 'process-step' ? row.slot.placement.stepLabel : '';

        return (
          <div
            key={row.key}
            role="button"
            tabIndex={0}
            ref={(el) => {
              rowRefs.current[row.key] = el;
            }}
            aria-label={rowAriaLabel(row)}
            aria-pressed={isSelected}
            onClick={() => onSelect(row.key)}
            onKeyDown={(e) => handleKeyDown(e, row.key)}
            className={cn(
              'relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-[100ms] border-b',
              borderColors.default,
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline',
              primaryColors.focusRing,
              isSelected
                ? cn(primaryColors.bgLight, primaryColors.text)
                : cn(textColors.secondary, bgColors.mutedHover),
            )}
          >
            {isSelected && (
              <span
                aria-hidden="true"
                className={cn('absolute left-0 top-0 bottom-0 w-[3px]', primaryColors.bg)}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0',
                isSelected
                  ? cn(primaryColors.bg, 'text-white')
                  : cn(bgColors.muted, textColors.tertiary),
              )}
            >
              {isSelected ? '◉' : step}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium truncate', isSelected ? primaryColors.text : textColors.primary)}>
                  {stepLabel}
                </span>
                {row.variantLabel && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      bgColors.muted,
                      textColors.tertiary,
                    )}
                  >
                    {row.variantLabel}
                  </span>
                )}
              </div>
              {row.isShared && (
                <span className={cn('text-[11px] mt-0.5 inline-block', textColors.quaternary)}>
                  공유
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
