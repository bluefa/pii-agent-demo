'use client';

import { useMemo } from 'react';

import { GuideCardChrome } from '@/app/components/features/process-status/GuideCard/GuideCardChrome';
import { GuideCardInvalidState } from '@/app/components/features/process-status/GuideCard/GuideCardInvalidState';
import { renderGuideAst } from '@/app/components/features/process-status/GuideCard/render-guide-ast';
import { GuideIcon } from '@/app/components/ui/icons';
import { cardStyles, cn } from '@/lib/theme';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

interface Props {
  content: string;
  showHeader?: boolean;
  invalidVariant?: 'admin' | 'enduser';
}

const CardHeader = () => (
  <div className={cn('px-6 py-4', cardStyles.warmVariant.header)}>
    {/* v16 guide title inherits `.card-header h2`: 26px / 800 / -0.045em / 1.2 */}
    <h2
      className={cn(
        'inline-flex items-center gap-[9px] text-[26px] font-extrabold tracking-[-0.045em] leading-[1.2]',
        cardStyles.warmVariant.titleText,
      )}
    >
      <span
        className={cn(
          'w-[26px] h-[26px] rounded-full inline-grid place-items-center shrink-0 shadow-sm',
          cardStyles.warmVariant.icon,
        )}
      >
        <GuideIcon className="w-3.5 h-3.5" />
      </span>
      가이드
    </h2>
  </div>
);

export const GuideCardPure = ({
  content,
  showHeader = true,
  invalidVariant = 'enduser',
}: Props) => {
  // Provider pages re-render on status polls; memo keeps DOM parsing
  // and AST allocation off the hot path while content is unchanged.
  const result = useMemo(() => validateGuideHtml(content), [content]);
  const rendered = useMemo(
    () => (result.valid ? renderGuideAst(result.ast) : null),
    [result],
  );

  if (!result.valid) {
    return <GuideCardInvalidState errors={result.errors} variant={invalidVariant} />;
  }

  return (
    <GuideCardChrome>
      {showHeader && <CardHeader />}
      <div
        className={cn(
          // v16 .guide-content: 13px / line-height 1.72 / color --fg-2 (gray-700 #374151)
          'px-6 py-5 prose-guide text-[13px] leading-[1.72] text-[#374151]',
        )}
      >
        {rendered}
      </div>
    </GuideCardChrome>
  );
};
