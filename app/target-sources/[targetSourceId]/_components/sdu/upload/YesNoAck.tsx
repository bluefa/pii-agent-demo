'use client';

import { useLocale } from '@/app/components/LocaleProvider';
import {
  SDU_COPY,
  type SduUploadCopy,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
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

const options = (t: SduUploadCopy): readonly { label: string; confirmed: boolean }[] => [
  { label: t.yes, confirmed: true },
  { label: t.no, confirmed: false },
];

/**
 * The one question a block ends with. Both answers are written — 아니오 is what takes an
 * earlier 예 back, which is the whole reason a finished block folds instead of locking.
 *
 * 아니오 adds a note and nothing else: it does not open the next block, does not hide the
 * body, does not scroll. The gate is already closed; saying so twice would be theatre.
 */
export const YesNoAck = ({ question, value, onAnswer, busy }: YesNoAckProps) => {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].upload;

  return (
    <div className={cn('mt-5 flex flex-col', stackGap.related)}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn(textStyles.bodyStrong, textColors.primary)}>{question}</span>
        <span className="flex items-center gap-2">
          {options(t).map((option) => {
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
        <p className={cn(textStyles.caption, textColors.tertiary)}>{t.answerNoNote}</p>
      )}
    </div>
  );
};
