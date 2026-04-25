/**
 * Guide CMS — pure presentational card.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md §Step 3
 * and docs/reports/guide-cms/spec.md §6.5.
 *
 * Accepts a raw HTML string, validates via `validateGuideHtml`, and
 * either renders the resulting AST through `renderGuideAst` (the only
 * path that reaches the DOM — never `dangerouslySetInnerHTML`) or
 * delegates to `GuideCardInvalidState`. The admin preview surface
 * passes `invalidVariant="admin"` to surface diagnostic detail; every
 * other caller falls through to the generic `'enduser'` default.
 */

import { cardStyles, cn } from '@/lib/theme';
import { GuideCardInvalidState } from '@/app/components/features/process-status/GuideCard/GuideCardInvalidState';
import { renderGuideAst } from '@/app/components/features/process-status/GuideCard/render-guide-ast';
import { GuideIcon } from '@/app/components/ui/icons';
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
  const result = validateGuideHtml(content);
  if (!result.valid) {
    return <GuideCardInvalidState errors={result.errors} variant={invalidVariant} />;
  }

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm overflow-hidden',
        cardStyles.warmVariant.container,
      )}
    >
      {showHeader && <CardHeader />}
      <div
        className={cn(
          'px-6 py-5 prose-guide text-[13px] leading-[1.72]',
          cardStyles.warmVariant.body,
        )}
      >
        {renderGuideAst(result.ast)}
      </div>
    </div>
  );
};
