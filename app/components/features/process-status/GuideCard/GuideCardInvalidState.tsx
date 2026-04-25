/**
 * Guide CMS — invalid content state.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md §Step 5.
 *
 * Rendered by `GuideCardPure` when `validateGuideHtml` rejects the
 * content, and by the admin preview (W3-c) when it wants to surface the
 * exact error list to the editor. End-user surface shows only a generic
 * message so invalid markup never leaks diagnostic detail.
 */

import { cardStyles, cn } from '@/lib/theme';

import type { ValidationError } from '@/lib/utils/validate-guide-html';

interface Props {
  errors: ValidationError[];
  variant?: 'admin' | 'enduser';
}

const formatError = (error: ValidationError): string =>
  `${error.code}: ${error.message}${error.path ? ` (${error.path})` : ''}`;

export const GuideCardInvalidState = ({ errors, variant = 'enduser' }: Props) => {
  if (variant === 'enduser') {
    return (
      <div
        className={cn(
          'rounded-xl border shadow-sm overflow-hidden',
          cardStyles.warmVariant.container,
        )}
      >
        <div className={cn('px-6 py-5 text-[13px] opacity-70', cardStyles.warmVariant.body)}>
          가이드를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm overflow-hidden',
        cardStyles.warmVariant.container,
      )}
    >
      <div className={cn('px-6 py-5 space-y-2', cardStyles.warmVariant.body)}>
        <p className="text-[13px] font-medium">가이드 콘텐츠 검증 실패</p>
        <pre className="text-[11px] font-mono whitespace-pre-wrap break-words opacity-80">
          {errors.map(formatError).join('\n')}
        </pre>
      </div>
    </div>
  );
};
