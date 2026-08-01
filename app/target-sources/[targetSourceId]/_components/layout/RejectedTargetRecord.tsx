import type { ReactNode } from 'react';
import { formatDate } from '@/lib/utils/date';
import { ChevronDownIcon } from '@/app/components/ui/icons';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import { bgColors, borderColors, cn, primaryColors, textColors } from '@/lib/theme';

interface RejectedTargetRecordProps {
  totalCount: number;
  selectedCount: number;
  excludedCount: number;
  /** Submission meta from the closed request. Null when the response carried none. */
  request: { requestedAt: string; requestedBy: string } | null;
  /** The stats + toolbar + table + pagination block, revealed on open. */
  children: ReactNode;
}

/**
 * Step 2, rejected — the requested targets as a collapsed record.
 *
 * A closed request's targets are a record, not a worklist: the verdict is already made, so leading
 * with tiles-as-filters + search + a full table put ~800px of interactive-looking surface after the
 * one decision the screen asks for. Native `<details>` — no state to hold — and the summary answers
 * what the list would have been scanned for anyway: how many, from whom, when.
 */
export const RejectedTargetRecord = ({
  totalCount,
  selectedCount,
  excludedCount,
  request,
  children,
}: RejectedTargetRecordProps) => (
  // mx-1: the card body runs at px-6 while its header runs at px-[28px]. The bordered tiles hid
  // that 4px, but this block opens with plain text directly under the header's, so the two text
  // edges have to line up.
  <details className={cn('group mx-1 mt-4 border-t pt-4', borderColors.light)}>
    {/* Three tiers, one per line: what this block is (14/600), the reference facts (MetaField, 12),
        and the way in (brand blue). */}
    <summary className="flex cursor-pointer list-none flex-col gap-2.5 [&::-webkit-details-marker]:hidden">
      <div className="flex items-center justify-between gap-4">
        <span className={cn('text-[14px] font-semibold', textColors.secondary)}>
          이 요청에 포함된 연동 대상
        </span>
        {/* Blue: this is the only action in the block, and the neutral gray it used to carry read
            as another label rather than something to click. */}
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[13px] font-semibold',
            primaryColors.text,
          )}
        >
          <span className="group-open:hidden">목록 보기</span>
          <span className="hidden group-open:inline">접기</span>
          <ChevronDownIcon className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </span>
      </div>
      {/* Inline pairs, not stacked: five stacked label-over-value columns in one row read as a run —
          "요청자 / 관리자 / 요청일시 / …" binds the wrong way. Beside its value, each label owns
          exactly one thing. The two kinds are then split by a rule rather than by gap alone. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Dropped once open: the stat tiles below carry the same three numbers, and showing them
            twice is what made the old screen read as duplicated. */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 group-open:hidden">
          <MetaField inline label="전체" value={`${totalCount}건`} />
          <MetaField inline label="연동 대상" value={`${selectedCount}건`} />
          <MetaField inline label="제외" value={`${excludedCount}건`} />
        </div>
        {request && (
          <>
            <span
              aria-hidden
              className={cn('h-3 w-px shrink-0 group-open:hidden', bgColors.divider)}
            />
            {/* 일시 → 사람. Every meta pair on this screen reads in that order (반려일시/처리자,
                pending header's 요청일시/요청자) — a group that flips it makes the reader re-parse
                which field is which. */}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <MetaField inline label="요청일시" value={formatDate(request.requestedAt, 'datetime')} />
              <MetaField inline label="요청자" value={request.requestedBy} />
            </div>
          </>
        )}
      </div>
    </summary>
    <div className="mt-4">{children}</div>
  </details>
);
