'use client';

/**
 * Guide CMS — preview placeholder when the chosen language has no body.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-c-preview.md §Step 4 +
 * design/guide-cms/components.md §2 + interactions.md §4.7.
 */

import { bgColors, borderColors, cn, textColors } from '@/lib/theme';

import type { PreviewLanguage } from '@/app/integration/admin/guides/components/PreviewLanguageToggle';

interface Props {
  lang: PreviewLanguage;
}

const MESSAGE: Record<PreviewLanguage, string> = {
  ko: '한국어 본문이 아직 작성되지 않았습니다',
  en: '영어 본문이 아직 작성되지 않았습니다',
};

export const PreviewEmptyLang = ({ lang }: Props) => (
  <div
    role="status"
    className={cn(
      'flex items-center justify-center h-40 rounded-lg border border-dashed text-sm',
      borderColors.default,
      bgColors.muted,
      textColors.tertiary,
    )}
  >
    {MESSAGE[lang]}
  </div>
);
