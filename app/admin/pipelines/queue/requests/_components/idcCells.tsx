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
            textClassName ?? 'text-[14px]',
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
 * 접속 주소 — the first address, with the rest of a multi-IP target behind step 1's own
 * "IP n개 더보기" toggle (idcStyles.epToggle, same label and caret).
 *
 * This cell previously listed every address unconditionally, on the argument that an
 * admin approving a request needs to see every address at once. Collapsing them again is
 * a deliberate reversal: a 30-row table where a handful of rows are six lines tall loses
 * the scan down the column, and the count in the toggle already states that more exist —
 * what it costs is one click on the rows that matter. The port has a column of its own;
 * every address on a row answers on the same one, so pinning it to each line only
 * repeated it down the cell.
 *
 * Only MULTIPLE_IP collapses. A DOMAIN row has one hostname and a SINGLE row one IP, so
 * there is nothing to hide and no toggle is drawn.
 *
 * The hover lift is what WaitingApprovalTable gives its Resource Name, and this is the
 * same thing — the row's identity. Size no longer separates it: every string in the row
 * reads at 14px. Weight is deliberately left at 400: the sibling table
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
  tone,
  suspectLabel,
  suspectAddresses,
}: {
  hosts: readonly string[];
  /** null for non-IDC rows — the badge is simply omitted. */
  kind?: IdcKind | null;
  tone?: string;
  /**
   * 이 행이 속한 '같은 데이터베이스 의심' 그룹의 이름 (@see _duplicateAddress). 구분 배지와
   * 같은 줄에 세운다 — 새 열이 아니라 행의 정체성에 붙는 표시다.
   */
  suspectLabel?: string;
  /** 다른 구성원과 인접한 주소 — 이 목록에 든 주소만 경고색으로 짚는다. */
  suspectAddresses?: readonly string[];
}): ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  if (hosts.length === 0) return null;
  const collapsible = kind === 'MULTIPLE_IP' && hosts.length > 1;
  const marked = new Set(suspectAddresses ?? []);
  // 걸린 주소를 맨 앞으로 올린다. 접힌 행은 첫 주소만 보이는데, 그게 근거가 아닌 주소면
  // (.11 이 보이고 정작 짝과 붙어 있는 건 .18) 옆에 세워 둔 행과 아무 관계없어 보인다.
  // IP Set 은 순서에 뜻이 없는 묶음이라 앞뒤를 바꿔도 잃는 정보가 없다.
  const ordered =
    marked.size > 0 ? [...hosts].sort((a, b) => Number(marked.has(b)) - Number(marked.has(a))) : hosts;
  const shown = collapsible && !expanded ? ordered.slice(0, 1) : ordered;
  return (
    <span className="flex flex-col items-start gap-1">
      {/* 제외 행이라고 배지를 흐리게 하지 않는다 — 제외는 행 왼쪽 레일이 말하고,
          opacity-50 은 그 배지 위 글자의 대비를 AA 아래로 떨어뜨렸다. */}
      <span className="inline-flex flex-wrap items-center gap-1">
        {kind && <IdcKindBadge kind={kind} />}
        {suspectLabel != null && (
          <span className={idcStyles.checkBadge}>확인 필요 {suspectLabel}</span>
        )}
      </span>
      {/* The addresses keep their own tighter rhythm; gap-1 above separates the caption
          from the block it captions. */}
      <span className="flex flex-col items-start gap-0.5">
        {shown.map((host, i) => (
          // The toggle rides on the LAST visible address rather than sitting under the
          // block. On its own line it added 18px to multi-IP rows and nothing to the
          // others, so a table of otherwise uniform 81px rows got one 99px row per
          // multi-IP target — the jaggedness the collapse was supposed to remove. An IP
          // is short enough that both fit the 224px the column leaves.
          <span key={host} className="inline-flex min-w-0 max-w-full items-center gap-2">
            <HostCell
              value={host}
              label="접속 주소"
              // 걸린 주소만 경고색으로 짚는다 — 여덟 줄짜리 IP Set 에서 "어느 주소를 두고
              // 하는 말인가"에 답하는 유일한 채널이다. hover 리프트는 넘기지 않는다:
              // 이 줄은 이미 자기 색을 들고 있고, 브랜드색으로 들리면 표시가 지워진다.
              tone={
                marked.has(host)
                  ? 'text-[var(--pl-warn-text)] font-medium'
                  : cn(tone ?? textColors.primary, primaryColors.textGroupHover)
              }
              textClassName="text-[14px]"
              maxWidthClass="max-w-[200px]"
            />
            {collapsible && i === shown.length - 1 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className={cn(idcStyles.epToggle, 'shrink-0 whitespace-nowrap')}
              >
                {expanded ? '접기 ▴' : `IP ${ordered.length - 1}개 더보기 ▾`}
              </button>
            )}
          </span>
        ))}
      </span>
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
      <span className={cn('text-[14px]', tone ?? textColors.secondary)}>{label}</span>
      {oracleSid && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className={idcStyles.sidKey}>SID</span>
          <HostCell
            value={oracleSid}
            label="Oracle SID"
            tone={tone ?? textColors.tertiary}
            // 500, one step over the 400 the other mono values rest at: the SID is an
            // identifier the admin matches against, and tertiary at the row's size would
            // leave it the faintest text there.
            textClassName="text-[14px] font-medium"
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
