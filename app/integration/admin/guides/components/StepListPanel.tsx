'use client';

import { useRef, useCallback, useMemo } from 'react';
import { cn, primaryColors, textColors, borderColors, bgColors } from '@/lib/theme';
import { GUIDE_SLOTS, findSlotsForGuide } from '@/lib/constants/guide-registry';
import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { GuideSlot, GuideName } from '@/lib/types/guide';
import type { ProviderTab } from '@/app/integration/admin/guides/types';

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

/** Builds the ordered row list for a given provider. Disabled providers yield empty. */
const buildRows = (provider: ProviderTab): StepRow[] => {
  const providerUpper = provider.toUpperCase();
  const rows: StepRow[] = [];

  for (const [rawKey, slot] of Object.entries(GUIDE_SLOTS)) {
    if (slot.placement.kind !== 'process-step') continue;
    if (slot.placement.provider !== providerUpper) continue;

    const key = rawKey as GuideSlotKey;
    const variant = 'variant' in slot.placement ? slot.placement.variant ?? null : null;
    const sharedCount = findSlotsForGuide(slot.guideName as GuideName).length;

    // AWS step 4 is the only step where AUTO/MANUAL diverge — render both.
    // Other AWS steps (1-3, 5-7) share one guideName across AUTO/MANUAL, so
    // we keep only AUTO to avoid duplicate rows.
    if (providerUpper === 'AWS' && slot.placement.step !== 4 && variant === 'MANUAL') {
      continue;
    }

    rows.push({
      key,
      slot,
      variantLabel:
        providerUpper === 'AWS' && slot.placement.step === 4 ? variant : null,
      isShared: sharedCount >= 2,
    });
  }

  return rows.sort((a, b) => {
    if (a.slot.placement.kind !== 'process-step' || b.slot.placement.kind !== 'process-step') {
      return 0;
    }
    const stepDiff = a.slot.placement.step - b.slot.placement.step;
    if (stepDiff !== 0) return stepDiff;
    // Same step → AUTO before MANUAL (AWS step 4).
    const aVar = 'variant' in a.slot.placement ? a.slot.placement.variant ?? '' : '';
    const bVar = 'variant' in b.slot.placement ? b.slot.placement.variant ?? '' : '';
    return aVar.localeCompare(bVar);
  });
};

/** Builds the accessible label for a step row. */
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
        const next = rows[Math.min(currentIndex + 1, rows.length - 1)];
        focusRow(next.key);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = rows[Math.max(currentIndex - 1, 0)];
        focusRow(prev.key);
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
            ref={(el) => { rowRefs.current[row.key] = el; }}
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
