'use client';

import { useId, type ReactNode } from 'react';
import { CheckIcon, ChevronDownIcon } from '@/app/components/ui/icons';
import { useLocale } from '@/app/components/LocaleProvider';
import {
  SDU_COPY,
  type SduUploadCopy,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import {
  borderColors,
  cardStyles,
  cn,
  statusColors,
  textColors,
  textStyles,
} from '@/lib/theme';

export type GateState = 'done' | 'current' | 'waiting';

const stateLabels = (t: SduUploadCopy): Record<GateState, string> => ({
  done: t.stateDone,
  current: t.stateCurrent,
  waiting: t.stateWaiting,
});

const STATE_PILL: Record<GateState, string> = {
  done: cn(statusColors.success.bg, statusColors.success.textDark),
  current: cn(statusColors.info.bgLight, statusColors.info.textDark),
  waiting: cn(statusColors.pending.bg, statusColors.pending.textDark),
};

export interface GateBlockProps {
  /** 1..4 — the marker a not-done block wears. A done block wears a check instead. */
  index: number;
  title: string;
  state: GateState;
  open: boolean;
  /**
   * Reopen / fold. Omitted where there is nothing to toggle: the current block is already
   * open and is where the work is, and a waiting block has no body to show yet. A head that
   * responds to a click with no pixel change is not a control.
   */
  onToggle?: () => void;
  /** The one line a folded block leaves behind — "US · EU", "박지원 외 2명". */
  summary?: string;
  /** Secondary action on the right of a FOLDED row. Going back must be possible, not urged. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * One of Step 4's four gates: head that is always visible, body only while open.
 *
 * The gates block FORWARD only. A finished block is folded, never locked — the reasons to
 * return are real (a cloud provider changes its destination IPs, the person who should get
 * the key changes), and an owner with no way back leaves the screen to find a person.
 *
 * The three states differ by marker, pill and whether the body is up. They deliberately do
 * NOT differ by border colour: a status-coloured edge around a block turns the card into a
 * traffic light and the four boxes stop reading as one sequence.
 */
export const GateBlock = ({
  index,
  title,
  state,
  open,
  onToggle,
  summary,
  action,
  children,
}: GateBlockProps) => {
  const { locale } = useLocale();
  const stateLabel = stateLabels(SDU_COPY[locale].upload);
  const bodyId = useId();
  const head = (
    <>
      <span
        aria-hidden
        className={cn(
          'inline-grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[12px] font-bold',
          state === 'done'
            ? cn(statusColors.success.bg, statusColors.success.textDark)
            : state === 'current'
              ? cn(statusColors.info.bgLight, statusColors.info.textDark)
              : cn(statusColors.pending.bg, statusColors.pending.textDark),
        )}
      >
        {state === 'done' ? <CheckIcon className="h-3.5 w-3.5" /> : index}
      </span>
      <span
        className={cn(
          textStyles.cardTitle,
          state === 'waiting' ? textColors.tertiary : textColors.primary,
        )}
      >
        {title}
      </span>
      <span className={cn(cardStyles.stepBadge, 'flex-shrink-0', STATE_PILL[state])}>
        {stateLabel[state]}
      </span>
      {!open && summary && (
        <span className={cn('min-w-0 truncate', textStyles.body, textColors.secondary)}>
          {summary}
        </span>
      )}
      {onToggle && (
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'ml-auto h-4 w-4 flex-shrink-0 transition-transform',
            textColors.tertiary,
            open && 'rotate-180',
          )}
        />
      )}
    </>
  );

  return (
    <section className={cn('rounded-xl border bg-white', borderColors.default)}>
      <div className="flex items-center gap-3 px-5 py-4">
        <h3 className="flex min-w-0 flex-1">
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-controls={bodyId}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              {head}
            </button>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-3">{head}</span>
          )}
        </h3>
        {!open && action && <span className="flex-shrink-0">{action}</span>}
      </div>
      {open && (
        <div id={bodyId} className={cn('border-t px-5 py-5', borderColors.light)}>
          {children}
        </div>
      )}
    </section>
  );
};
