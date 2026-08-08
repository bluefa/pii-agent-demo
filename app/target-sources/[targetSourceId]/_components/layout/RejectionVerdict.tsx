import type { ReactNode } from 'react';
import { formatDate } from '@/lib/utils/date';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import { cn, statusColors, textColors } from '@/lib/theme';

interface RejectionVerdictProps {
  /** The admin's words. Empty when the verdict carried no reason. */
  reason: string;
  processedAt: string;
  processedBy: string;
  /** The single way out of the rejected state — docked on the signature row. */
  action: ReactNode;
}

/**
 * Step 2, rejected — the admin's answer, as a quote.
 *
 * The reason used to sit in an `orange-50` well. A filled, rounded block at the card's own inner
 * width reads as a second card rather than a subsection, and its meta+action footer made a third
 * nesting level — so the block floated instead of belonging. Hanging it off a rule instead drops
 * the chromatic area from ~99,000px² to ~800px² for the same state.
 */
export const RejectionVerdict = ({
  reason,
  processedAt,
  processedBy,
  action,
}: RejectionVerdictProps) => {
  // Labelled pairs, not a bare "누가 · 언제" byline: an unlabelled line leaves the reader to infer
  // which date it is (반려일시? 요청일시?) on a screen that carries both. Two fields at 32px is the
  // pending header's row — safe stacked, unlike the five-field record row below it.
  const meta = (
    <div className="flex flex-wrap gap-8">
      {processedAt && <MetaField label="반려일시" value={formatDate(processedAt, 'datetime')} />}
      {processedBy && <MetaField label="처리자" value={processedBy} />}
    </div>
  );

  // Signature row: verdict meta left, the one way out right. Keeping the exit inside the rule makes
  // the verdict a self-contained unit — a standalone button under it read as a second block, which
  // is what the well was doing wrong.
  const signature = (
    <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      {meta}
      {action}
    </div>
  );

  // role="status" because the verdict only resolves after the fetch.
  return (
    <div className="mt-4" role="status">
      {reason ? (
        <div className={cn('border-l-[3px] pl-4', statusColors.warning.borderStrong)}>
          {/* A tag, not a heading. The old label was 16px semibold over a 14px reason — it
              outsized the very thing it labelled, which is what flattened the hierarchy.
              12px keeps it below its payload while still naming the block. */}
          <p
            className={cn('text-[12px] font-bold tracking-[0.02em]', statusColors.warning.textDark)}
          >
            반려 사유
          </p>
          {/* Body scale — the tag above stays smaller than its payload, and the primary tone
              (darkest on the card) carries the emphasis instead of size. */}
          <p className={cn('mt-1.5 text-[14px] font-medium leading-[1.5]', textColors.primary)}>
            {reason}
          </p>
          {signature}
        </div>
      ) : (
        <>
          {/* No reason → nothing to quote, so the sentence carries the verdict on its own. */}
          <p className={cn('text-[14px] font-medium leading-[1.55]', textColors.tertiary)}>
            관리자가 승인 요청을 반려했어요. 연동 대상을 다시 선택한 뒤 승인을 다시 요청해주세요.
          </p>
          {signature}
        </>
      )}
    </div>
  );
};
