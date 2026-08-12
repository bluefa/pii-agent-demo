'use client';

import { RdsMemberChip, RdsSelectionChip } from '@/app/components/ui/RdsInstanceChips';
import { rdsInstanceLabel, type RdsInstanceCandidate } from '@/lib/rds-instances';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

/**
 * RDS cluster member instances — the band the cluster row opens under itself.
 *
 * The instances are NOT rows. Three of the table's seven columns say nothing about an instance
 * (Resource ID, 설치 구분, 제외 사유 belong to the cluster), and the two things the user actually
 * compares — the endpoint and the AZ — have no column at all, so as rows they were a wide band
 * of blanks that pushed the resources still needing a decision off screen.
 *
 * It sits DIRECTLY under its cluster, not in a right-docked panel. A detached panel failed on
 * both counts that matter here: nothing on the row advertised that the cluster was configurable,
 * and the panel opened away from the row it belonged to (owner, 2026-08-12). The accordion says
 * both with one control — the chevron is the app's existing "there is more here" signal, and the
 * band cannot appear anywhere but against its own row.
 *
 * Closed on load; the cluster row's chevron opens it, the same grammar the Athena group uses.
 * Card chrome (mx-6 my-3 inset · rounded-xl · px-5 py-3 header · p-5 body) is VmDatabaseConfigPanel's,
 * the band this table already had — minus its gradient, which has no token.
 */

interface RdsInstancePanelProps {
  /** The cluster the band belongs to — scopes the radio group. */
  clusterId: string;
  /** Column count of the host table so the band spans the full row width. */
  colSpan: number;
  /** Display order (Reader-first) — the caller sorts, the wire order is what the payload echoes. */
  instances: readonly RdsInstanceCandidate[];
  /** The cluster's effective selection; undefined while the cluster is left out of the request. */
  chosenResourceId: string | undefined;
  /** Radios exist only inside a checked cluster in the editable table (absent, not disabled). */
  selectable: boolean;
  readonly: boolean;
  /** The cluster's engine — the one thing an instance card cannot say for itself. */
  engineLabel: string | null;
  onSelect: (instanceResourceId: string) => void;
}

export const RdsInstancePanel = ({
  clusterId,
  colSpan,
  instances,
  chosenResourceId,
  selectable,
  readonly,
  engineLabel,
  onSelect,
}: RdsInstancePanelProps) => (
  <tr>
    <td colSpan={colSpan} className="px-0 py-0">
      <div className="mx-6 my-3">
        <div className={cn('overflow-hidden rounded-xl border shadow-sm', borderColors.default, bgColors.muted)}>
          <div className={cn('border-b px-5 py-3', borderColors.default)}>
            <span className={cn('text-[14px] font-semibold', textColors.primary)}>
              {`연결할 인스턴스 · ${instances.length}건`}
            </span>
            <span className={cn('ml-2 text-[12px]', textColors.secondary)}>
              {selectable
                ? 'Agent가 접속할 인스턴스 1개를 고르세요. 기본값은 부하가 적은 Reader예요.'
                : '이 클러스터를 연동 대상으로 선택하면 접속할 인스턴스를 고를 수 있어요.'}
            </span>
          </div>

          {/* Side by side, not stacked: the instances are compared against each other, and a
              column each puts the role, the AZ and the endpoint of all three on one eye line. */}
          <div className="grid grid-cols-3 gap-3 p-5">
            {instances.map((instance) => {
              const identifier = rdsInstanceLabel(instance);
              const chosen = instance.resource_id === chosenResourceId;
              const endpoint = typeof instance.host === 'string' && instance.host
                ? `${instance.host}${instance.port ? `:${instance.port}` : ''}`
                : null;

              const body = (
                <>
                  {/* 역할은 이름 바로 옆 — 어느 인스턴스에 붙은 역할인지가 이 화면에서 가장
                      중요한 사실이라 이름과 떼어놓지 않는다(오너 지시). 카드는 폭이 균등해서
                      칩이 이름 길이를 따라 흔들려도 세 카드의 비교가 흐트러지지 않는다. */}
                  <span className="flex min-w-0 items-center gap-2">
                    {selectable && (
                      <input
                        type="radio"
                        name={`rds-instance-${clusterId}`}
                        value={instance.resource_id}
                        checked={chosen}
                        onChange={() => onSelect(instance.resource_id)}
                        aria-label={`접속 인스턴스 ${identifier} 선택`}
                        className={cn('h-4 w-4 shrink-0', statusColors.pending.border, primaryColors.text, primaryColors.focusRing)}
                      />
                    )}
                    <span className={cn('min-w-0 truncate font-mono text-[14px]', textColors.primary)}>
                      {identifier}
                    </span>
                    <RdsMemberChip role={instance.cluster_member_role} />
                    {readonly && chosen && <RdsSelectionChip />}
                  </span>
                  <span className={cn('flex items-center gap-2 text-[12px]', textColors.secondary)}>
                    <span className="font-mono">{instance.availability_zone ?? '—'}</span>
                    {engineLabel && <span>{engineLabel}</span>}
                  </span>
                  {endpoint && (
                    <span className={cn('truncate font-mono text-[12px]', textColors.tertiary)}>
                      {endpoint}
                    </span>
                  )}
                </>
              );

              const cardClass = cn(
                'flex min-w-0 flex-col gap-1.5 rounded-[10px] border px-3.5 py-3 text-left',
                chosen
                  ? cn(primaryColors.border, primaryColors.bgLight)
                  : cn(borderColors.default, bgColors.surface, bgColors.mutedHover),
              );

              // No radio → nothing to label, so the card is a plain block rather than a
              // `<label>` pointing at an input that does not exist.
              return selectable ? (
                <label key={instance.resource_id} className={cn(cardClass, 'cursor-pointer')}>
                  {body}
                </label>
              ) : (
                <div key={instance.resource_id} className={cardClass}>
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </td>
  </tr>
);
