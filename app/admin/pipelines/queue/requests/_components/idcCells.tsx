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
import { useState, type ReactElement } from 'react';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { cn, idcStyles, textColors } from '@/lib/theme';

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

/** 연동 대상 — host(s) only, no port. Multiple IPs collapse behind a toggle. */
export function IdcEndpointCell({
  hosts,
  tone,
}: {
  hosts: readonly string[];
  tone?: string;
}): ReactElement | null {
  const [expanded, setExpanded] = useState(false);

  if (hosts.length === 0) return null;
  if (hosts.length === 1) {
    return <HostCell value={hosts[0]} label="연동 대상" tone={tone} maxWidthClass="max-w-[280px]" />;
  }

  return (
    <span className="flex flex-col items-start gap-0.5">
      <HostCell value={hosts[0]} label="연동 대상" tone={tone} maxWidthClass="max-w-[280px]" />
      {expanded &&
        hosts
          .slice(1)
          .map((host) => (
            <HostCell key={host} value={host} label="연동 대상" tone={tone} maxWidthClass="max-w-[280px]" />
          ))}
      <button type="button" onClick={() => setExpanded((v) => !v)} className={idcStyles.epToggle}>
        {expanded ? '접기 ▴' : `IP ${hosts.length - 1}개 더보기 ▾`}
      </button>
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
            textClassName="text-[11.5px]"
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
