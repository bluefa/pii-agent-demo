'use client';

import { useMemo } from 'react';

import { GuideCardChrome } from '@/app/components/features/process-status/GuideCard/GuideCardChrome';
import { GuideCardInvalidState } from '@/app/components/features/process-status/GuideCard/GuideCardInvalidState';
import { renderGuideAst } from '@/app/components/features/process-status/GuideCard/render-guide-ast';
import { GuideIcon } from '@/app/components/ui/icons';
import { cardStyles, cn } from '@/lib/theme';
import { GUIDE_VALIDATE_OPTIONS, validateGuideHtml } from '@/lib/utils/validate-guide-html';

interface Props {
  content: string;
  showHeader?: boolean;
  /** Render prose only — no amber chrome/header/padding. The host surface (e.g. GuidePanel) owns them. */
  bare?: boolean;
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
  bare = false,
  invalidVariant = 'enduser',
}: Props) => {
  // Provider pages re-render on status polls; memo keeps DOM parsing
  // and AST allocation off the hot path while content is unchanged.
  const result = useMemo(() => validateGuideHtml(content, GUIDE_VALIDATE_OPTIONS), [content]);
  const rendered = useMemo(
    // `steps: true` — a step guide's ordered list is a procedure, and the source draws it
    // with a numbered circle per step. Posts render the same AST without it.
    () => (result.valid ? renderGuideAst(result.ast, { steps: true }) : null),
    [result],
  );

  if (!result.valid) {
    return <GuideCardInvalidState errors={result.errors} variant={invalidVariant} />;
  }

  if (bare) {
    return (
      // T2 of the guide rail's three tiers (오너 2026-08-24: 12 / 14 / 16, one leading per
      // group). It was 13px/1.72 — a size off the app's scale carrying most of the panel's
      // text, at a leading that grew with every step up. 14/20 is the pair `theme.ts` already
      // uses most for body (`text-[14px] leading-[1.4]` → 19.6, snapped to the 4px grid) and
      // the one Carbon, Atlassian, Material and Cloudscape all give 14px reading text.
      //
      // Bigger type, LESS height: measured in the browser, a step-4 guide body went 358 →
      // 315px, because 1.72 → 1.43 gives back more than 13 → 14 costs.
      //
      // `tracking` is declared here rather than inherited: `letter-spacing` passes down as a
      // computed LENGTH, so `body`'s −0.288px was −0.022em on this text and −0.024em on the
      // 12px rows beside it — tightest where it should be loosest.
      //
      // ⛔ `prose-guide-rail` is what keeps these numbers off the admin post editor, which
      // shares `.prose-guide`. `bare` has exactly one caller and it is the rail.
      // `break-keep`: 271px of column is narrow enough that Korean's default
      // break-anywhere was splitting words mid-어절 (「인프라 스 / 캔을」), and 14px wraps
      // more often than 13 did. Latin runs still break at their own boundaries.
      <div className="prose-guide prose-guide-rail break-keep text-[14px] leading-[20px] tracking-[-0.01em] text-[var(--fg-2)]">
        {rendered}
      </div>
    );
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
