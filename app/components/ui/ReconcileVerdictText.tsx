/**
 * The 판정 cell of a reconciled resource list — icon + word, never a filled badge.
 *
 * A verdict that repeats down every row is read as a column, so it wears the same text
 * grammar the install status uses one table over: colour carries "is anything left to do",
 * and the icon lets the answer survive a greyscale print. A difference is not an error —
 * both difference words take the warn tone, and neither takes the error red.
 */
import type { ReactElement } from 'react';
import { CheckIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import { cn } from '@/lib/theme';
import type { ReconcileVerdict } from '@/lib/types/reconcile';

/** Column header for the verdict this component renders. */
export const RECONCILE_COLUMN_LABEL = '판정';

const SPEC: Record<ReconcileVerdict, { label: string; tone: string }> = {
  match: { label: '일치', tone: 'text-[var(--pl-ok-text)]' },
  missingConfirmed: { label: '확정 없음', tone: 'text-[var(--pl-warn-text)]' },
  missingApproved: { label: '승인 없음', tone: 'text-[var(--pl-warn-text)]' },
};

export function ReconcileVerdictText({ verdict }: { verdict: ReconcileVerdict }): ReactElement {
  const { label, tone } = SPEC[verdict];
  const Glyph = verdict === 'match' ? CheckIcon : StatusWarningIcon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold leading-[1.4]',
        tone,
      )}
    >
      <Glyph className="h-3.5 w-3.5 flex-none" />
      {label}
    </span>
  );
}
