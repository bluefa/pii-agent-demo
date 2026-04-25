/**
 * Guide CMS — empty-language placeholder.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md §Step 4.5.
 *
 * Rendered by `GuideCardContainer` when the guide detail has been
 * fetched successfully but the requested language body is whitespace.
 * Distinct from the invalid state — the content is *structurally* fine,
 * just not yet translated.
 */

import { cardStyles, cn } from '@/lib/theme';

interface Props {
  lang: 'ko' | 'en';
}

const MESSAGES: Record<Props['lang'], string> = {
  ko: '한국어 본문이 아직 작성되지 않았습니다.',
  en: '영어 본문이 아직 작성되지 않았습니다.',
};

export const GuideCardEmptyLang = ({ lang }: Props) => (
  <div
    className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      cardStyles.warmVariant.container,
    )}
  >
    <div className={cn('px-6 py-5 text-[13px] opacity-70', cardStyles.warmVariant.body)}>
      {MESSAGES[lang]}
    </div>
  </div>
);
