'use client';

import { useState } from 'react';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { cn, idcStyles, textColors } from '@/lib/theme';
import type {
  IdcConnState,
  IdcHealth,
  IdcKind,
  IdcResourceView,
} from '@/app/lib/api/idc';

const KIND_LABEL: Record<IdcKind, string> = {
  SINGLE: 'Single',
  MULTIPLE_IP: 'Multi',
  DOMAIN: 'Domain',
};
const KIND_STYLE: Record<IdcKind, string> = {
  SINGLE: idcStyles.kindBadge.single,
  MULTIPLE_IP: idcStyles.kindBadge.multi,
  DOMAIN: idcStyles.kindBadge.domain,
};

export const IdcKindBadge = ({ kind }: { kind: IdcKind }) => (
  <span className={cn(idcStyles.kindBadge.base, KIND_STYLE[kind])}>{KIND_LABEL[kind]}</span>
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
  <span className={cn('group/host inline-flex items-center gap-1.5 min-w-0', maxWidthClass)}>
    <Tooltip content={value} size="md" triggerClassName="min-w-0 overflow-hidden">
      <span
        className={cn(
          'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12.5px] text-left [direction:ltr]',
          textColors.primary,
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
      {expanded && hosts.slice(1).map((host) => <HostCell key={host} value={host} label="Host" />)}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={idcStyles.epToggle}
      >
        {expanded ? '접기 ▴' : `IP ${extra}개 더보기 ▾`}
      </button>
    </span>
  );
};

export const IdcDbTypeCell = ({ resource }: { resource: IdcResourceView }) => (
  <div className="flex flex-col items-start gap-1">
    <span className={cn(idcStyles.tag.base, idcStyles.tag.blue)}>{resource.databaseTypeLabel}</span>
    {resource.oracleSid ? (
      <span className="group/sid inline-flex items-center gap-1 min-w-0 max-w-[170px]">
        <span className={idcStyles.sidKey}>SID</span>
        <Tooltip content={resource.oracleSid} size="md" triggerClassName="min-w-0 overflow-hidden">
          <span
            className={cn(
              'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11.5px] text-left',
              textColors.tertiary,
            )}
          >
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
    <span className={cn(idcStyles.tag.base, idcStyles.tag.green)}>방화벽 오픈</span>
  ) : (
    <span className={cn(idcStyles.tag.base, idcStyles.tag.red)}>방화벽 오픈되지 않음</span>
  );

export const IdcConnBadge = ({ state }: { state: IdcConnState }) =>
  state === 'SUCCESS' ? (
    <span className={cn(idcStyles.tag.base, idcStyles.tag.green)}>Success</span>
  ) : (
    <span className={cn(idcStyles.tag.base, idcStyles.tag.orange)}>Pending</span>
  );

export const IdcHealthBadge = ({ health }: { health: IdcHealth }) => {
  const healthy = health !== 'UNHEALTHY';
  const tone = healthy ? idcStyles.status.healthy : idcStyles.status.unhealthy;
  return (
    <span className={cn(idcStyles.status.base, tone.text)}>
      <span className={cn(idcStyles.status.dot, tone.dot)} />
      {healthy ? 'Healthy' : 'Unhealthy'}
    </span>
  );
};

export const IdcTargetPill = ({ excluded }: { excluded: boolean }) => {
  const variant = excluded ? idcStyles.targetPill.no : idcStyles.targetPill.yes;
  return (
    <span className={cn(idcStyles.targetPill.base, variant.box)}>
      <span className={cn(idcStyles.targetPill.dot, variant.dot)} />
      {excluded ? '비대상' : '대상'}
    </span>
  );
};

const SELECT_CHEVRON =
  "#fff url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\") right 9px center no-repeat";

/** DB Credential `<select>` — v16 `.idc-cred-select` (step 5/6). Options are the
 *  target-source secrets loaded from `GET .../secrets` (not a hardcoded list). The
 *  current value is always shown even if absent from `options` (a stored credential
 *  must remain selectable). */
export const IdcCredSelectCell = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
}) => {
  const choices = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ background: SELECT_CHEVRON }}
      className={cn(idcStyles.credSelect, !value && idcStyles.credSelectEmpty)}
      aria-label="DB Credential 선택"
    >
      <option value="">자격 증명 선택</option>
      {choices.map((cred) => (
        <option key={cred} value={cred}>
          {cred}
        </option>
      ))}
    </select>
  );
};

/** Credential-aware connection status — reflects the live test-connection result:
 *  no cred -> credential-required; SUCCESS -> green; FAIL -> red; RUNNING -> orange;
 *  else Pending (gray). */
export const IdcConnStatusCell = ({ resource }: { resource: IdcResourceView }) => {
  if (!resource.credentialId) {
    return <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>자격 증명 필요</span>;
  }
  switch (resource.connection) {
    case 'SUCCESS':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.green)}>Success</span>;
    case 'FAIL':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.red)}>Fail</span>;
    case 'RUNNING':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.orange)}>Running</span>;
    default:
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>Pending</span>;
  }
};

/** Logical-DB manage button (the "set" action) — disabled until credential set AND connection SUCCESS. */
export const IdcLogicalButtonCell = ({
  resource,
  onOpen,
}: {
  resource: IdcResourceView;
  onOpen: () => void;
}) => {
  const enabled = !!resource.credentialId && resource.connection === 'SUCCESS';
  return (
    <button type="button" disabled={!enabled} onClick={onOpen} className={idcStyles.triggerBtn.ghostSm}>
      설정
    </button>
  );
};
