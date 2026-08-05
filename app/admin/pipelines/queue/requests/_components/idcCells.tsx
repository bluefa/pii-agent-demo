'use client';

/**
 * P3 IDC 리소스 셀 — the app-side IDC step-1 cells (`_components/idc/cells.tsx`).
 * The admin and the service owner look at the same request, so these use the SAME
 * primitives step 1 uses (Tooltip / IdentifierTip / CopyButton / idcStyles), not a
 * re-skin of them: same tip card, same copy affordance, same type ramp.
 *
 * Not imported outright only because step 1's versions take an `IdcResourceView`,
 * a step-1 form model with a dozen fields (persisted, connection, firewallOpen …)
 * that a queue row does not have and must not fabricate.
 */
import type { ReactElement } from 'react';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { cn, idcStyles, primaryColors, textColors } from '@/lib/theme';
// The badge itself IS shared — it takes only a kind, so none of the model mismatch
// above applies to it, and the two surfaces must not drift on what "Multi" looks like.
import { IdcKindBadge } from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import type { IdcKind } from '@/app/lib/api/idc';

/**
 * Long host/SID/IP: ellipsis + copy-on-hover + full-value tooltip (res-id-cell pattern).
 * `truncatedOnly`, so a value that already fits has nothing to reveal and stays inert.
 */
function HostCell({
  value,
  label,
  tone,
  textClassName,
  maxWidthClass = 'max-w-[200px]',
}: {
  value: string;
  label: string;
  /** Resting tier + the row's hover lift, supplied by the cell. */
  tone?: string;
  textClassName?: string;
  maxWidthClass?: string;
}): ReactElement {
  return (
    <span className={cn('group/host inline-flex items-center gap-1.5 min-w-0', maxWidthClass)}>
      <Tooltip
        content={<IdentifierTip label={label} value={value} />}
        variant="value"
        size="md"
        triggerClassName="min-w-0 overflow-hidden"
        truncatedOnly
      >
        <span
          className={cn(
            'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-left [direction:ltr]',
            textClassName ?? 'text-[12.5px]',
            tone ?? textColors.primary,
          )}
        >
          {value}
        </span>
      </Tooltip>
      <CopyButton
        value={value}
        label={`${label} 복사`}
        className="shrink-0 opacity-0 group-hover/host:opacity-100"
      />
    </span>
  );
}

/**
 * 접속 주소 — one address per line, all of them always visible.
 *
 * The extra IPs used to sit behind a "n개 더보기" toggle: an admin reading "which
 * addresses am I about to open" needs all of them at once, so row height grows with the
 * address count — the honest shape of a multi-IP target. The port has a column of its
 * own; every address on a row answers on the same one, so pinning it to each line only
 * repeated it down the cell.
 *
 * 14px + the hover lift, the two things WaitingApprovalTable gives its Resource Name —
 * this is the same thing, the row's identity, and at 12.5px it was rendering SMALLER
 * than the attributes beside it. Weight is deliberately left at 400: the sibling table
 * tried 600 on its identity column and removed it, because colour plus weight on one
 * cell reads as shouting. One axis per column, and the hover lift is it.
 *
 * The Single/Multi/Domain badge sits above the addresses rather than in a 구분 column of
 * its own — the column was deleted for saying what the value already said, and as a
 * caption it labels the block it describes instead of re-stating it a column away. Same
 * badge step 1 shows the service owner, so both sides read one classification.
 */
export function IdcEndpointCell({
  hosts,
  kind,
  dimmed = false,
  tone,
}: {
  hosts: readonly string[];
  /** null for non-IDC rows — the badge is simply omitted. */
  kind?: IdcKind | null;
  /**
   * Excluded row. Stated by the caller rather than inferred from `tone` being set:
   * a filled badge is the loudest thing in a muted row, and the row's own dimming is
   * a text colour that a background-coloured badge does not inherit. opacity-50 is
   * step 1's own value for the same excluded cell.
   */
  dimmed?: boolean;
  tone?: string;
}): ReactElement | null {
  if (hosts.length === 0) return null;
  return (
    <span className="flex flex-col items-start gap-1">
      {kind && (
        <span className={cn(dimmed && 'opacity-50')}>
          <IdcKindBadge kind={kind} />
        </span>
      )}
      {hosts.map((host) => (
        <HostCell
          key={host}
          value={host}
          label="접속 주소"
          tone={cn(tone ?? textColors.primary, primaryColors.textGroupHover)}
          textClassName="text-[14px]"
          maxWidthClass="max-w-[200px]"
        />
      ))}
    </span>
  );
}

/** Database Type, with the Oracle SID as a second line rather than a second column. */
export function IdcDbTypeCell({
  label,
  oracleSid,
  tone,
}: {
  label: string;
  oracleSid: string | null;
  tone?: string;
}): ReactElement {
  return (
    <span className="flex flex-col items-start gap-1">
      <span className={cn('text-[12px]', tone ?? textColors.secondary)}>{label}</span>
      {oracleSid && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className={idcStyles.sidKey}>SID</span>
          <HostCell
            value={oracleSid}
            label="Oracle SID"
            tone={tone ?? textColors.tertiary}
            // 500, one step over the 400 the other mono values rest at: the SID is an
            // identifier the admin matches against, and at 11.5px tertiary it was the
            // faintest text in the row.
            textClassName="text-[11.5px] font-medium"
            maxWidthClass="max-w-[150px]"
          />
        </span>
      )}
    </span>
  );
}

/** Source IP — one line per address, each with its own tip and copy. */
export function IdcSourceIpCell({
  sourceIps,
  tone,
}: {
  sourceIps: readonly string[];
  tone?: string;
}): ReactElement | null {
  // Blank, not an em-dash: the BDC assigns source IPs to integration targets only, so
  // an empty value means the row is not one — the same reason a 대상 row's 제외 사유
  // cell is blank. An em-dash would read as "this should have had one and it is missing".
  if (sourceIps.length === 0) return null;
  return (
    <span className="flex flex-col gap-0.5">
      {sourceIps.map((ip) => (
        <HostCell key={ip} value={ip} label="Source IP" tone={tone} maxWidthClass="max-w-[150px]" />
      ))}
    </span>
  );
}
