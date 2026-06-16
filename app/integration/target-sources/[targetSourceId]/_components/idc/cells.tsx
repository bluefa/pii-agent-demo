'use client';

import { useState } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { cn, tagStyles, textColors } from '@/lib/theme';
import type {
  IdcConnState,
  IdcHealth,
  IdcKind,
  IdcResourceView,
} from '@/app/lib/api/idc';

const KIND_LABEL: Record<IdcKind, string> = {
  SINGLE: 'Single',
  MULTIPLE_IP: 'Multiple IP',
  DOMAIN: 'Domain',
};
const KIND_STYLE: Record<IdcKind, string> = {
  SINGLE: tagStyles.blue,
  MULTIPLE_IP: tagStyles.orange,
  DOMAIN: tagStyles.indigo,
};

export const IdcKindBadge = ({ kind }: { kind: IdcKind }) => (
  <span
    className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold',
      KIND_STYLE[kind],
    )}
  >
    {KIND_LABEL[kind]}
  </span>
);

/** Long host/SID/IP: ellipsis + copy-on-hover + full-value tooltip (res-id-cell pattern). */
const HostCell = ({
  value,
  label,
  maxWidthClass = 'max-w-[200px]',
}: {
  value: string;
  label: string;
  maxWidthClass?: string;
}) => (
  <span className={cn('group/host inline-flex items-center gap-1 min-w-0', maxWidthClass)}>
    <Tooltip content={value} size="md">
      <span className={cn('truncate font-mono text-[12.5px]', textColors.secondary)}>{value}</span>
    </Tooltip>
    <CopyButton
      value={value}
      label={`${label} 복사`}
      className="shrink-0 opacity-0 group-hover/host:opacity-100"
    />
  </span>
);

/** 연동 대상 cell — host(s) only (no port). Multiple IP collapses behind a toggle. */
export const IdcEndpointCell = ({ resource }: { resource: IdcResourceView }) => {
  const [expanded, setExpanded] = useState(false);
  const { hosts, kind } = resource;

  if (kind !== 'MULTIPLE_IP') {
    return <HostCell value={hosts[0] ?? ''} label="Host" />;
  }

  const extra = hosts.length - 1;
  return (
    <span className="flex flex-col items-start gap-0.5">
      <HostCell value={hosts[0] ?? ''} label="Host" />
      {expanded && hosts.slice(1).map((host, i) => <HostCell key={i} value={host} label="Host" />)}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn('text-[11.5px] font-medium hover:underline', textColors.tertiary)}
      >
        {expanded ? '접기 ▴' : `IP ${extra}개 더보기 ▾`}
      </button>
    </span>
  );
};

export const IdcDbTypeCell = ({ resource }: { resource: IdcResourceView }) => (
  <div className="flex flex-col items-start gap-1">
    <Badge variant="info" size="sm">{resource.databaseTypeLabel}</Badge>
    {resource.oracleSid ? (
      <span className="group/sid inline-flex items-center gap-1 min-w-0 max-w-[170px]">
        <span className={cn('rounded px-1 text-[10.5px] font-bold', tagStyles.neutral)}>SID</span>
        <Tooltip content={resource.oracleSid} size="md">
          <span className={cn('truncate font-mono text-[11.5px]', textColors.tertiary)}>
            {resource.oracleSid}
          </span>
        </Tooltip>
        <CopyButton
          value={resource.oracleSid}
          label="Oracle SID 복사"
          className="shrink-0 opacity-0 group-hover/sid:opacity-100"
        />
      </span>
    ) : null}
  </div>
);

export const IdcSourceIpCell = ({ sourceIps }: { sourceIps: string[] }) => {
  if (sourceIps.length === 0) return <span className={textColors.quaternary}>—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {sourceIps.map((ip) => (
        <HostCell key={ip} value={ip} label="Source IP" maxWidthClass="max-w-[150px]" />
      ))}
    </span>
  );
};

export const IdcFirewallBadge = ({ open }: { open: boolean }) =>
  open ? (
    <Badge variant="success" size="sm">방화벽 오픈</Badge>
  ) : (
    <Badge variant="error" size="sm">방화벽 오픈되지 않음</Badge>
  );

export const IdcConnBadge = ({ state }: { state: IdcConnState }) =>
  state === 'SUCCESS' ? (
    <Badge variant="success" size="sm">Success</Badge>
  ) : (
    <Badge variant="warning" size="sm">Pending</Badge>
  );

export const IdcHealthBadge = ({ health }: { health: IdcHealth }) =>
  health === 'UNHEALTHY' ? (
    <Badge variant="error" size="sm" dot>Unhealthy</Badge>
  ) : (
    <Badge variant="success" size="sm" dot>Healthy</Badge>
  );

export const IdcTargetPill = ({ excluded }: { excluded: boolean }) =>
  excluded ? (
    <Badge variant="neutral" size="sm" dot>비대상</Badge>
  ) : (
    <Badge variant="success" size="sm" dot>대상</Badge>
  );
