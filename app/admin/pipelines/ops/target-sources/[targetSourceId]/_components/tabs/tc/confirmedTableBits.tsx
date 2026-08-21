'use client';

/**
 * 확정 리소스 표의 공용 문법 — Step 6·7 확정 표의 스켈레톤을 admin 토큰으로 번역한
 * 것(ConfirmedInfoCard 원 주석). 연결 테스트 탭의 확정 정보 표와 관리자 승인 탭의
 * 읽기 전용 검토 표가 같은 리소스를 같은 옷으로 그리도록 여기 한 곳에 둔다 —
 * 두 표가 다른 상수를 들면 같은 사실이 자리마다 다른 옷을 입는다.
 */
import type { ReactElement } from 'react';
import { cn, idcStyles } from '@/lib/theme';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { isEc2Instance } from '@/lib/types';
import { isRdsCluster } from '@/lib/rds-instances';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { Ec2InstanceTag, RdsClusterTag } from '@/app/components/ui/RdsInstanceChips';
import { IdcEndpointCell } from '@/app/admin/pipelines/queue/requests/_components/idcCells';
import { toIdcResourceViewFromConfirmed } from '@/app/lib/api/idc';
import {
  Dash,
  TcPill,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import type { TcVerdict } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** Spacing/alignment straight from the Step 6·7 table (18/16, pale header band). */
export const CONFIRMED_HEAD_CELL =
  'whitespace-nowrap px-[18px] py-3 text-left text-[12px] font-medium text-[var(--pl-text-weak)]';
export const CONFIRMED_CELL =
  'border-b border-[var(--pl-gray-100)] px-[18px] py-4 align-middle text-[14px] text-[var(--pl-text-strong)]';

/**
 * 연결 상태 cell — the run's own verdict for this resource, or — if it had none.
 * 네 값 중 하나만 한국어였다(Success / Failed / 진행 중 / Unknown): 같은 열이 같은 질문에
 * 두 언어로 답하고 있었으므로, 사용자 화면 Step 5 가 쓰는 말로 맞춘다.
 */
export function ConnCell({ verdict }: { verdict: TcVerdict | undefined }): ReactElement {
  if (!verdict) return <Dash />;
  if (verdict === 'SUCCESS') return <TcPill tone="ok" label="성공" />;
  if (verdict === 'FAIL') return <TcPill tone="err" label="실패" />;
  if (verdict === 'RUNNING') return <TcPill tone="warn" label="진행 중" />;
  return <TcPill tone="off" label="알 수 없음" />;
}

/**
 * Resource Name — the Step 6·7 confirmed table's identity stack: a cluster or EC2 row
 * says WHAT it is in a tag above the name, and the name itself is truncated to one line
 * with the full value in a tip (which only appears once it is actually cut). Only tagged
 * rows run two lines, so only those are lifted, keeping the name on the row's alignment
 * line with its neighbouring columns.
 */
export function ResourceNameCell({
  value,
  resourceType,
}: {
  value: string | null;
  resourceType: string;
}): ReactElement {
  const cluster = isRdsCluster(resourceType);
  const ec2 = isEc2Instance(resourceType);
  const name = value ? (
    <Tooltip
      content={<IdentifierTip label="Resource Name" value={value} />}
      variant="value"
      size="md"
      triggerClassName="min-w-0 max-w-[200px] block"
      truncatedOnly
    >
      <span className="block truncate font-mono text-[14px]">{value}</span>
    </Tooltip>
  ) : (
    <Dash />
  );
  if (!cluster && !ec2) return name;
  return (
    <span
      className={cn(
        'flex min-w-0 flex-col items-start gap-1',
        idcStyles.table.stackedIdentityLift,
      )}
    >
      {cluster ? <RdsClusterTag /> : <Ec2InstanceTag />}
      {name}
    </span>
  );
}

/**
 * 접속 주소 — an IDC row's identity, in place of the Resource Name + Resource ID pair.
 * Neither of those exists for IDC: no scan names an on-prem DB (the service owner types
 * its address in), and its `resource_id` is an internal key that stays off the screen
 * (design-spec §8). Same cell the queue's IDC table uses, so 확정 정보 and 연동 요청
 * name a row the same way.
 */
export function IdcIdentityCell({
  row,
}: {
  row: ConfirmedIntegrationResourceItem;
}): ReactElement {
  const view = toIdcResourceViewFromConfirmed(row);
  if (view.hosts.length === 0) return <Dash />;
  return <IdcEndpointCell hosts={view.hosts} kind={view.kind} />;
}

/** Row label for modals — the address for IDC, the name (then id) otherwise. */
export const confirmedRowLabel = (row: ConfirmedIntegrationResourceItem): string =>
  row.resource_name
  || (row.idc_host_format != null
    ? toIdcResourceViewFromConfirmed(row).hosts.join(', ')
    : '')
  || row.resource_id;
