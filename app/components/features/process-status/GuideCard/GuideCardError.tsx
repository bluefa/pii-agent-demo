/**
 * Guide CMS — network/fetch failure state.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md §Step 4.5.
 *
 * Rendered by `GuideCardContainer` when `useGuide` surfaces an error.
 * `onRetry` wires back to `refresh()` so transient failures do not
 * require a full page reload.
 */

import { cardStyles, cn, primaryColors } from '@/lib/theme';

interface Props {
  onRetry?: () => void;
}

export const GuideCardError = ({ onRetry }: Props) => (
  <div
    className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      cardStyles.warmVariant.container,
    )}
  >
    <div className={cn('px-6 py-5 space-y-3', cardStyles.warmVariant.body)}>
      <p className="text-[13px] font-medium">가이드를 불러오지 못했습니다.</p>
      <p className="text-[12px] opacity-70">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'inline-flex items-center rounded-md px-3 py-1.5 text-[12px] text-white shadow-sm transition-colors',
            primaryColors.bg,
            primaryColors.bgHover,
          )}
        >
          다시 시도
        </button>
      )}
    </div>
  </div>
);
