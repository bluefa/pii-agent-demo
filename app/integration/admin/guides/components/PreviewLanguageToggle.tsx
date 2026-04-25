'use client';

/**
 * Guide CMS — preview-pane ko/en toggle.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-c-preview.md §Step 3 +
 * design/guide-cms/components.md §2 ④ + interactions.md §1.
 *
 * Independent from the editor's `EditLanguageTabs`: an editor on the ko
 * tab can still preview the en draft (and vice versa). Roving tabindex
 * + ←/→ navigation matches the editor tabs so keyboard mental model is
 * consistent across the panel.
 */

import { useCallback, useRef } from 'react';

import { borderColors, cn, interactiveColors, primaryColors } from '@/lib/theme';

export type PreviewLanguage = 'ko' | 'en';

interface Props {
  value: PreviewLanguage;
  onChange: (next: PreviewLanguage) => void;
}

const LANG_ORDER: readonly PreviewLanguage[] = ['ko', 'en'] as const;

const LANG_LABEL: Record<PreviewLanguage, string> = {
  ko: '한국어',
  en: 'English',
};

export const PreviewLanguageToggle = ({ value, onChange }: Props) => {
  const tabRefs = useRef<Partial<Record<PreviewLanguage, HTMLButtonElement | null>>>({});

  const focusTab = useCallback((lang: PreviewLanguage) => {
    tabRefs.current[lang]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, current: PreviewLanguage) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const currentIndex = LANG_ORDER.indexOf(current);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + LANG_ORDER.length) % LANG_ORDER.length;
      const next = LANG_ORDER[nextIndex];
      onChange(next);
      focusTab(next);
    },
    [onChange, focusTab],
  );

  return (
    <div
      role="tablist"
      aria-label="미리보기 언어"
      className={cn('flex gap-1 border-b', borderColors.default)}
    >
      {LANG_ORDER.map((lang) => {
        const isSelected = value === lang;
        return (
          <button
            key={lang}
            role="tab"
            type="button"
            ref={(el) => {
              tabRefs.current[lang] = el;
            }}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(lang)}
            onKeyDown={(event) => handleKeyDown(event, lang)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-[120ms] motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline',
              primaryColors.focusRing,
              isSelected
                ? cn(primaryColors.border, primaryColors.text)
                : interactiveColors.inactiveTab,
            )}
          >
            {LANG_LABEL[lang]}
          </button>
        );
      })}
    </div>
  );
};
