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
    <h2
      className={cn(
        'inline-flex items-center gap-2.5 text-sm font-semibold',
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
          'px-6 py-5 prose-guide text-[13px] leading-[1.72]',
          cardStyles.warmVariant.body,
        )}
      >
        {rendered}
      </div>
    </GuideCardChrome>
  );
};
