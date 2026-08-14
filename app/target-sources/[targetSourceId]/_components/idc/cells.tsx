'use client';

import { useState } from 'react';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { cn, idcStyles, primaryColors, textColors, verdictText } from '@/lib/theme';
import { ExcludedIcon } from '@/app/components/ui/icons';
import { IDC_ACCESS_ALLOWED, IDC_ACCESS_DENIED, IDC_SOURCE_LABEL } from '@/lib/constants/idc';
import { CELL_LIFT } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import type {
  IdcHealth,
  IdcInstallStatus,
  IdcKind,
  IdcResourceView,
} from '@/app/lib/api/idc';

/**
 * Domain 행에만 붙는 태그 — IP 행은 아무것도 달지 않는다(null).
 *
 * 값 자체가 이미 자기 종류를 말한다: `10.20.30.40` 을 보고 IP 가 아니라고 읽을 사람은 없다.
 * 모든 행에 'IP'를 달면 표의 기본값을 매 줄 반복하는 것이고, 그러면 정작 다른 하나인
 * Domain 이 그 반복 속에 묻힌다. 태그는 **예외**에만 붙을 때 예외를 가리킨다.
 *
 * EC2 태그와 같은 규칙이기도 하다 — 그 태그도 EC2 인 행에만 붙지 RDS 행에 'RDS'를 달지
 * 않는다. 면과 글자색도 그 태그의 토큰(`tagStyles.resourceKind`)을 그대로 참조한다.
 */
export const IdcKindBadge = ({ kind }: { kind: IdcKind }) =>
  kind === 'DOMAIN' ? (
    <span className={cn(idcStyles.kindBadge.base, idcStyles.kindBadge.fill)}>Domain</span>
  ) : null;

/**
 * Long host/SID/IP: ellipsis + copy-on-hover + full-value tooltip (res-id-cell pattern).
 *
 * Same tooltip contract as the CSP ResourceIdCell: `truncatedOnly`, so a value that already
 * fits its cell has nothing to reveal and stays inert, and the light `value` variant with a
 * labelled body — a bare dark string repeats what is already on screen without naming the
 * field it belongs to.
 */
const HostCell = ({
  value,
  label,
  maxWidthClass = 'max-w-[200px]',
  textClassName = textColors.primary,
}: {
  value: string;
  label: string;
  maxWidthClass?: string;
  /** 값 글자색 — 기본은 이 표의 본문 색. 강조가 필요한 열만 바꿔 넣는다. */
  textClassName?: string;
}) => (
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
          'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12.5px] text-left [direction:ltr]',
          textClassName,
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

/** 접속 주소 cell — host(s) only (no port). Multiple IP collapses behind a toggle. */
export const IdcEndpointCell = ({ resource }: { resource: IdcResourceView }) => {
  const [expanded, setExpanded] = useState(false);
  const { hosts, kind } = resource;

  // Steps 2·3 read excluded rows from ExcludedResourceInfoDto, which carries no endpoint fields
  // at all — an em-dash says "the contract does not report this", where a blank cell read as a
  // rendering bug. See toIdcResourceViewFromExcluded.
  if (hosts.length === 0) return <span className={textColors.tertiary}>—</span>;

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

/**
 * 접속 주소 — Domain 행이면 태그가 주소 **위에** 얹힌다. 태그는 주소 옆에 설 동렬이 아니라
 * 주소를 소개하는 줄이다: EC2·RDS Cluster 태그가 Resource Name 위에 서는 그 2줄 정체성이다.
 *
 * IP 행은 태그가 없으므로 한 줄이고, 스택도 리프트도 필요 없다 — 리프트는 태그 줄 높이를
 * 되돌리는 보정이라 태그 없는 행에 걸면 주소만 이웃 칸 위로 12px 뜬다. 그래서 조건은
 * 정확히 '태그가 그려지는 행'이고, 그건 DOMAIN 뿐이다(`IdcKindBadge`).
 * DOMAIN 은 언제나 주소 한 줄이라 MULTIPLE_IP 의 '더보기로 자라는' 예외와 겹치지 않는다.
 */
export const IdcEndpointWithKindCell = ({ resource }: { resource: IdcResourceView }) => {
  if (resource.kind !== 'DOMAIN') return <IdcEndpointCell resource={resource} />;
  // 끝점이 없는 행은 종류도 없다 — 어댑터의 기본값을 모양으로 단언하지 않는다.
  if (resource.hosts.length === 0) return <IdcEndpointCell resource={resource} />;
  return (
    <span
      className={cn(
        'flex min-w-0 flex-col items-start gap-1',
        idcStyles.table.stackedIdentityLift,
      )}
    >
      <IdcKindBadge kind={resource.kind} />
      <IdcEndpointCell resource={resource} />
    </span>
  );
};

export const IdcDbTypeCell = ({ resource }: { resource: IdcResourceView }) => (
  <div className="flex flex-col items-start gap-1">
    {/* Plain text, matching the CSP approval table: the engine name is an attribute,
        not a state, so a chip per row spends emphasis on the least decisive column. */}
    {/* CELL_LIFT is inert unless the row carries `group` (the CSP approval skin), so the same
        cell serves both table skins. */}
    <span className={cn('text-[12px]', textColors.secondary, CELL_LIFT)}>
      {resource.databaseTypeLabel}
    </span>
    {resource.oracleSid ? (
      <span className="group/sid inline-flex items-center gap-1 min-w-0 max-w-[170px]">
        <span className={idcStyles.sidKey}>SID</span>
        <Tooltip
          content={<IdentifierTip label="Oracle SID" value={resource.oracleSid} />}
          variant="value"
          size="md"
          triggerClassName="min-w-0 overflow-hidden"
          truncatedOnly
        >
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

export const IdcSourceIpCell = ({
  sourceIps,
  emphasis = false,
}: {
  sourceIps: string[];
  /** 이 열이 화면의 주어인 단계(step 4)에서만 켠다. */
  emphasis?: boolean;
}) => {
  // Blank, not an em-dash. The BDC assigns source IPs to integration targets only, so an empty
  // value means the row is not one — the same reason the 제외 사유 cell of a 대상 row is blank.
  // An em-dash would read as "this row should have had one and it is missing".
  if (sourceIps.length === 0) return null;
  return (
    <span className="flex flex-col gap-0.5">
      {sourceIps.map((ip) => (
        <HostCell
          key={ip}
          value={ip}
          label={IDC_SOURCE_LABEL}
          maxWidthClass="max-w-[150px]"
          {...(emphasis && {
            // hover 리프트를 같이 건다 — #0064FF 는 흰 바탕 4.92:1 이지만 행 hover 틴트
            // 위에서 4.46:1 로 AA 아래다 (primaryColors.textGroupHover 주석 참조).
            textClassName: cn('font-semibold', primaryColors.text, primaryColors.textGroupHover),
          })}
        />
      ))}
    </span>
  );
};

/**
 * Step-4 per-row firewall badge, driven by the installation-status
 * `firewall_check.status` of the SAME resource (joined by resource_id).
 * Anything that is not exactly COMPLETED/FAIL/IN_PROGRESS (UNKNOWN, SKIP, a
 * missing join, or an unrecognized value) renders the neutral "BDC측 확인 필요".
 *
 * 어휘는 방화벽이 아니라 접근 허용이다 — 이 화면을 읽는 사람은 방화벽을 만지는 사람이
 * 아니라 "우리 DB에 저 주소가 닿게 해 달라"고 요청하는 사람이다. 문구는
 * `IDC_ACCESS_*`(lib/constants/idc) 한 곳에서만 나온다: 가이드 본문이 이 배지 글자를
 * 인용하므로 둘이 갈라지면 안내가 없는 상태를 가리키게 된다.
 */
export const IdcFirewallBadge = ({ status }: { status: IdcInstallStatus | undefined }) => {
  switch (status) {
    case 'COMPLETED':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.green)}>{IDC_ACCESS_ALLOWED}</span>;
    case 'FAIL':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.red)}>{IDC_ACCESS_DENIED}</span>;
    case 'IN_PROGRESS':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.orange)}>허용 확인 중</span>;
    default:
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>BDC측 확인 필요</span>;
  }
};

/**
 * Per-resource health badge. There is no per-resource health API source
 * (`health` is null), so a null value renders a neutral em-dash placeholder
 * instead of a fabricated Healthy/Unhealthy state.
 */
export const IdcHealthBadge = ({ health }: { health: IdcHealth | null }) => {
  if (health === null) return <span className={textColors.tertiary}>—</span>;
  const healthy = health !== 'UNHEALTHY';
  const tone = healthy ? idcStyles.status.healthy : idcStyles.status.unhealthy;
  return (
    <span className={cn(idcStyles.status.base, tone.text)}>
      <span className={cn(idcStyles.status.dot, tone.dot)} />
      {healthy ? 'Healthy' : 'Unhealthy'}
    </span>
  );
};

/**
 * 이전 요청 불러오기 모달 전용 판정 — 공유 `TargetPill` 과 같은 형태(아이콘 + 글자, verdictText)를
 * 쓰되 어휘는 이 화면의 것(비대상)을 유지한다. 어휘 통일은 별건이다.
 */
export const IdcTargetPill = ({ excluded }: { excluded: boolean }) =>
  excluded ? (
    <span className={cn(verdictText.base, verdictText.excluded)}>
      <ExcludedIcon className={verdictText.icon} />
      비대상
    </span>
  ) : (
    <span className={cn(verdictText.base, verdictText.target)}>대상</span>
  );

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
