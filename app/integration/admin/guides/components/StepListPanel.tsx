'use client';

import { useCallback, useMemo, useRef } from 'react';

import {
  ENABLED_PROVIDERS,
  PLACEMENT_PROVIDER_BY_TAB,
} from '@/app/integration/admin/guides/types';
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import {
  bgColors,
  borderColors,
  chipStyles,
  cn,
  numericFeatures,
  primaryColors,
  textColors,
} from '@/lib/theme';

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
  variantLabel: 'AUTO' | 'MANUAL' | null;
  isShared: boolean;
  sharedCount: number;
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

// Group slots for a step by guideName. When AUTO and MANUAL resolve to
// the same guide (steps 1/2/3/5/6/7 in AWS), collapse to a single row;
// the variant chip and the row split only appear when the step has
// genuinely divergent guides (step 4 — AUTO_INSTALLING vs MANUAL_INSTALLING).
const buildRows = (provider: ProviderTab): StepRow[] => {
  if (!isEnabledProvider(provider)) return [];
  const placementProvider = PLACEMENT_PROVIDER_BY_TAB[provider];

  const slotsByStep = new Map<number, Array<{ key: GuideSlotKey; slot: GuideSlot }>>();
  for (const [rawKey, slot] of Object.entries(GUIDE_SLOTS)) {
    if (slot.placement.kind !== 'process-step') continue;
    if (slot.placement.provider !== placementProvider) continue;
    const step = slot.placement.step;
    const bucket = slotsByStep.get(step) ?? [];
    bucket.push({ key: rawKey as GuideSlotKey, slot });
    slotsByStep.set(step, bucket);
  }

  const rows: StepRow[] = [];
  for (const [, bucket] of [...slotsByStep.entries()].sort(([a], [b]) => a - b)) {
    const uniqueGuideNames = new Set(bucket.map((entry) => entry.slot.guideName));
    const isDivergent = uniqueGuideNames.size > 1;

    if (!isDivergent) {
      // Same guide for AUTO and MANUAL — emit one row, no variant chip.
      // Prefer the AUTO entry as the canonical row when present.
      const autoEntry = bucket.find(
        (e) => 'variant' in e.slot.placement && e.slot.placement.variant === 'AUTO',
      );
      const repr = autoEntry ?? bucket[0];
      const sharedCount = SLOT_COUNT_BY_NAME.get(repr.slot.guideName) ?? bucket.length;
      rows.push({
        key: repr.key,
        slot: repr.slot,
        variantLabel: null,
        isShared: sharedCount >= 2,
        sharedCount,
      });
      continue;
    }

    // Divergent step (e.g. AWS step 4) — emit one row per slot with chip.
    const sortedBucket = [...bucket].sort((a, b) => {
      const aVar = 'variant' in a.slot.placement ? a.slot.placement.variant ?? '' : '';
      const bVar = 'variant' in b.slot.placement ? b.slot.placement.variant ?? '' : '';
      return aVar.localeCompare(bVar);
    });
    for (const entry of sortedBucket) {
      const variant =
        'variant' in entry.slot.placement ? entry.slot.placement.variant ?? null : null;
      const sharedCount = SLOT_COUNT_BY_NAME.get(entry.slot.guideName) ?? 1;
      rows.push({
        key: entry.key,
        slot: entry.slot,
        variantLabel: variant,
        isShared: sharedCount >= 2,
        sharedCount,
      });
    }
  }

  return rows;
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
      className={cn(
        'h-full overflow-y-auto border-r flex flex-col gap-0.5 px-2 py-2',
        borderColors.default,
      )}
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
              'relative grid grid-cols-[28px_1fr_auto] items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer border transition-colors duration-[100ms]',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline',
              primaryColors.focusRing,
              isSelected
                ? cn(primaryColors.bg50, primaryColors.border100)
                : cn('border-transparent', bgColors.mutedHover),
            )}
          >
            {isSelected && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 top-2 bottom-2 w-[3px] rounded-full',
                  primaryColors.bg,
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold shrink-0 transition-colors',
                numericFeatures.tabular,
                isSelected
                  ? cn(primaryColors.bg, primaryColors.border, 'text-white')
                  : cn(bgColors.surface, 'border-[1.5px]', borderColors.strong, textColors.tertiary),
              )}
            >
              {step}
            </span>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span
                className={cn(
                  'text-[13px] truncate font-medium',
                  isSelected ? cn(primaryColors.text, 'font-semibold') : textColors.primary,
                )}
              >
                {stepLabel}
              </span>
              {row.variantLabel && (
                <span
                  className={cn(
                    chipStyles.base,
                    row.variantLabel === 'AUTO'
                      ? chipStyles.variant.auto
                      : chipStyles.variant.manual,
                  )}
                >
                  {row.variantLabel}
                </span>
              )}
            </div>
            {row.isShared && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10.5px]',
                  textColors.tertiary,
                )}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {row.sharedCount}곳 공유
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
