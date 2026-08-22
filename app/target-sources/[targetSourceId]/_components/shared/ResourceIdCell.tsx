'use client';

import { CopyButton } from '@/app/components/ui/CopyButton';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { cn, idcStyles, textColors } from '@/lib/theme';

interface ResourceIdCellProps {
  value: string;
  /** Field name, e.g. "Resource ID" — titles the tooltip and prefixes the copy-button aria label. */
  label: string;
  maxWidthClass?: string;
  /** Text classes on the id text. When given it REPLACES the default secondary resting color
   *  (`cn` is a plain join, so stacking two text colors would leave the winner to CSS order) —
   *  the approval table passes its own resting tier plus the row-hover contrast lift. */
  textClassName?: string;
  /** Id text size. Defaults to 12px; the 연동 대상 tables pass 14px so every string in a
   *  resource row reads at one size. Kept out of `textClassName` because `cn` is a plain
   *  join — a size stacked on the default would leave the winner to CSS order. */
  sizeClass?: string;
  /** Covered-clip grammar (confirmed tables, round 4): cut the id mid-letter at the box edge
   *  instead of drawing an ellipsis. The … says "shortened here"; the cut says "continues
   *  underneath", matching cells whose overflow the column stroke visibly covers.
   *  Round 11: this mode also re-seats the copy button as a hover OVERLAY. The flex row
   *  reserved tail space for it, which made the id's cut land ~46px before the boundary
   *  while every other covered cell cuts AT it — the next column read as covering the id
   *  deeper than its neighbours. Now the TD owns the cut (like the Resource Name cell)
   *  and the button anchors to the boundary, carrying its own opaque chip so it covers
   *  the tail instead of fading it (round 15 — the fade read as the id degrading). */
  hardClip?: boolean;
}

/**
 * Long Resource ID / ARN / ARM-id cell — ellipsis truncation + copy-on-hover +
 * full-value tooltip. v15 `.res-id-cell` / `.res-id-text` (5743). Mirrors the IDC
 * `HostCell` so cloud tables truncate long ids the same way IDC truncates hosts.
 */
export const ResourceIdCell = ({
  value,
  label,
  maxWidthClass = 'max-w-[260px]',
  textClassName,
  sizeClass = 'text-[12px]',
  hardClip = false,
}: ResourceIdCellProps) => (
  <span
    className={cn(
      'group/resid min-w-0',
      // hardClip: block + relative, no gap column — the text owns the full run to the
      // boundary and the button positions against the boundary, not against a reserve.
      hardClip ? 'relative block' : 'inline-flex items-center gap-1.5',
      maxWidthClass,
    )}
  >
    {/* Long ids are the norm here, but short ones exist — no tooltip when the value already fits. */}
    <Tooltip
      content={<IdentifierTip label={label} value={value} />}
      variant="value"
      size="md"
      // hardClip: the TD is the clipper (round 4) — the trigger only bounds the
      // truncation probe, the same recipe as the Resource Name cell beside it. An
      // overflow-hidden trigger here would move the cut back to the content box.
      triggerClassName={hardClip ? 'min-w-0 w-full' : 'min-w-0 overflow-hidden'}
      truncatedOnly
    >
      {/* Truncates from the RIGHT, like the Resource Name cell beside it: one
          abbreviation grammar per table (`Prefix…`). The full value is one hover
          away and the copy button hands over the exact string.

          Truncation box and text are ONE element on purpose — the browser draws the
          ellipsis in the box's own font and colour, so a styled child under a plain
          wrapper gets an inherited grey `…` detached from the mono id. */}
      <span
        className={cn(
          'block min-w-0 text-left font-mono',
          hardClip ? 'whitespace-nowrap' : 'truncate',
          sizeClass,
          textClassName ?? textColors.secondary,
        )}
      >
        {value}
      </span>
    </Tooltip>
    <CopyButton
      value={value}
      label={`${label} 복사`}
      className={cn(
        'opacity-0 group-hover/resid:opacity-100',
        // right-2 keeps the 22px button clear of the seam's ±8px resize/tracer zone.
        // The chip's own surface is what covers the tail underneath it — round 15
        // removed the mask that used to fade the id instead (see the token).
        hardClip
          ? cn('absolute right-2 top-1/2 -translate-y-1/2', idcStyles.table.copyOverlayChip)
          : 'shrink-0',
      )}
    />
  </span>
);
