'use client';

/**
 * Guide CMS — ko/en language tab strip for the editor pane.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-b-editor.md §Step 3 +
 * design/guide-cms/components.md §2 ③.
 *
 * Each tab shows a "filled / empty" dot derived from the parent draft
 * lengths. Roving tabindex (`Tab` enters the active tab; `←/→` switch)
 * matches the existing ProviderTabs / StepListPanel keyboard model.
 */

import { useCallback, useRef } from 'react';

import {
  bgColors,
  cn,
  primaryColors,
  segmentedControlStyles,
} from '@/lib/theme';

export type EditorLanguage = 'ko' | 'en';

interface EditLanguageTabsProps {
  value: EditorLanguage;
  onChange: (lang: EditorLanguage) => void;
  koFilled: boolean;
  enFilled: boolean;
}

const LANG_ORDER: readonly EditorLanguage[] = ['ko', 'en'] as const;

const LANG_LABEL: Record<EditorLanguage, string> = {
  ko: '한국어',
  en: 'English',
};

export const EditLanguageTabs = ({
  value,
  onChange,
  koFilled,
  enFilled,
}: EditLanguageTabsProps) => {
  const tabRefs = useRef<Partial<Record<EditorLanguage, HTMLButtonElement | null>>>({});

  const focusTab = useCallback((lang: EditorLanguage) => {
    tabRefs.current[lang]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, current: EditorLanguage) => {
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

  const filledByLang: Record<EditorLanguage, boolean> = { ko: koFilled, en: enFilled };

  return (
    <div
      role="tablist"
      aria-label="가이드 언어"
      className={cn(segmentedControlStyles.container)}
    >
      {LANG_ORDER.map((lang) => {
        const isSelected = value === lang;
        const isFilled = filledByLang[lang];
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
              segmentedControlStyles.item,
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline',
              primaryColors.focusRing,
              isSelected && segmentedControlStyles.itemActive,
            )}
            aria-label={`${LANG_LABEL[lang]} ${isFilled ? '작성됨' : '미작성'}`}
          >
            <span>{LANG_LABEL[lang]}</span>
            <span
              aria-hidden="true"
              className={cn(
                'inline-block w-1.5 h-1.5 rounded-full',
                isFilled ? primaryColors.bg : bgColors.strong,
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
