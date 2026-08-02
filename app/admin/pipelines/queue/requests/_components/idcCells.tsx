'use client';

/**
 * P3 IDC 리소스 셀 — the app-side IDC step-1 cells (`_components/idc/cells.tsx`)
 * ported to admin tokens: the same request should read the same whether the service
 * owner or the admin is looking at it, but step 1's cells hard-code the app palette
 * (#0064FF / gray-400), so this is the grammar, not an import.
 *
 * What step 1 decides, and this keeps:
 *  - a host/IP is the row's identity → mono, ellipsis, copy on hover, full value in
 *    the title tip;
 *  - a multi-IP endpoint collapses to its first address behind a 더보기 toggle,
 *    rather than joining every address into one unreadable run;
 *  - the Oracle SID rides UNDER Database Type instead of claiming a column — only
 *    Oracle rows have one, so as a column it was an em-dash four rows out of five.
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';

const { idcCell, appTable } = tqStyles;

/** Mono value + copy-on-hover. `tone` carries the row's resting tier and hover lift. */
function MonoValue({
  value,
  label,
  tone,
  className,
  maxWidthClass = 'max-w-[240px]',
}: {
  value: string;
  label: string;
  tone: string;
  className?: string;
  maxWidthClass?: string;
}): ReactElement {
  const toast = usePlToast();
  return (
    <span className={cn('group/val inline-flex min-w-0 items-center gap-1.5', maxWidthClass)}>
      <span className={cn(className ?? idcCell.host, tone)} title={value}>
        {value}
      </span>
      <button
        type="button"
        className={cn(appTable.resId.copy, 'shrink-0 opacity-0 group-hover/val:opacity-100')}
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          toast.show('복사했어요');
        }}
        title="복사"
        aria-label={`${label} 복사`}
      >
        <Icon name="copy" size="sm" />
      </button>
    </span>
  );
}

/** 연동 대상 — host(s) only, no port. Multiple IPs collapse behind a toggle. */
export function IdcEndpointCell({
  hosts,
  tone,
}: {
  hosts: readonly string[];
  tone: string;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);

  if (hosts.length === 0) return <span className={appTable.cellDim}>—</span>;
  if (hosts.length === 1) {
    return <MonoValue value={hosts[0]} label="연동 대상" tone={tone} maxWidthClass="max-w-[280px]" />;
  }

  return (
    <span className="flex flex-col items-start gap-0.5">
      <MonoValue value={hosts[0]} label="연동 대상" tone={tone} maxWidthClass="max-w-[280px]" />
      {expanded &&
        hosts
          .slice(1)
          .map((host) => (
            <MonoValue key={host} value={host} label="연동 대상" tone={tone} maxWidthClass="max-w-[280px]" />
          ))}
      <button type="button" onClick={() => setExpanded((v) => !v)} className={idcCell.epToggle}>
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
  tone: string;
}): ReactElement {
  return (
    <span className="flex flex-col items-start gap-1">
      <span className={cn('text-[12px]', tone)}>{label}</span>
      {oracleSid && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className={idcCell.sidKey}>SID</span>
          <MonoValue
            value={oracleSid}
            label="Oracle SID"
            tone={appTable.cellDim}
            className={idcCell.sidValue}
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
  tone: string;
}): ReactElement {
  // Blank, not an em-dash: the BDC assigns source IPs to integration targets only, so
  // an empty value means the row is not one — the same reason a 대상 row's 제외 사유
  // cell is blank. An em-dash would read as "this should have had one and it is missing".
  if (sourceIps.length === 0) return <span />;
  return (
    <span className="flex flex-col gap-0.5">
      {sourceIps.map((ip) => (
        <MonoValue key={ip} value={ip} label="Source IP" tone={tone} maxWidthClass="max-w-[150px]" />
      ))}
    </span>
  );
}
