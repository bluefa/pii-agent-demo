'use client';

import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  stackGap,
  textColors,
  textStyles,
} from '@/lib/theme';

export interface YesNoAckProps {
  question: string;
  /** null while the owner has not answered — 아니오 is an answer, not the absence of one. */
  value: boolean | null;
  onAnswer: (confirmed: boolean) => void;
  /** A write is in flight; both buttons hold still until the server has the answer. */
  busy?: boolean;
}

const OPTIONS: readonly { label: string; confirmed: boolean }[] = [
  { label: '예', confirmed: true },
  { label: '아니오', confirmed: false },
];

/**
 * The one question a block ends with. Both answers are written — 아니오 is what takes an
 * earlier 예 back, which is the whole reason a finished block folds instead of locking.
 *
 * 아니오 adds a note and nothing else: it does not open the next block, does not hide the
 * body, does not scroll. The gate is already closed; saying so twice would be theatre.
 */
export const YesNoAck = ({ question, value, onAnswer, busy }: YesNoAckProps) => (
  <div className={cn('mt-5 flex flex-col', stackGap.related)}>
    <div className="flex flex-wrap items-center gap-3">
      <span className={cn(textStyles.bodyStrong, textColors.primary)}>{question}</span>
      <span className="flex items-center gap-2">
        {OPTIONS.map((option) => {
          const pressed = value === option.confirmed;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={pressed}
              disabled={busy}
              onClick={() => onAnswer(option.confirmed)}
              className={cn(
                'h-8 rounded-[10px] border px-4 text-[14px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                pressed
                  ? cn(primaryColors.border, primaryColors.bgLight, primaryColors.textOnLight)
                  : cn(borderColors.default, textColors.secondary, 'bg-white', bgColors.mutedHover),
              )}
            >
              {option.label}
            </button>
          );
        })}
      </span>
    </div>
    {value === false && (
      <p className={cn(textStyles.caption, textColors.tertiary)}>
        확인 후 예를 눌러주세요. 다음 블록은 열리지 않아요.
      </p>
    )}
  </div>
);
