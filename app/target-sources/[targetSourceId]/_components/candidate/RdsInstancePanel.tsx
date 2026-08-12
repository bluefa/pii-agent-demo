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
 * RDS cluster member instances — the accordion band the cluster row opens under itself.
 *
 * The instances are NOT rows of the OUTER table. Three of its seven columns say nothing about
 * an instance (Resource ID, 설치 구분, 제외 사유 belong to the cluster), and the two things the
 * user actually compares — the endpoint and the AZ — have no column at all, so as outer rows
 * they were a wide band of blanks. Inside the band they get their OWN three columns and fill
 * every one of them.
 *
 * It sits DIRECTLY under its cluster, not in a right-docked panel. A detached panel failed on
 * both counts that matter here: nothing on the row advertised that the cluster was configurable,
 * and the panel opened away from the row it belonged to (owner, 2026-08-12). The accordion says
 * both with one control — the chevron is the app's existing "there is more here" signal, and the
 * band cannot appear anywhere but against its own row.
 *
 * ONE LINE PER INSTANCE, and the band's height is whatever that adds up to. An Aurora cluster
 * can carry a writer and fifteen readers; a fixed card grid turned that into three ragged rows
 * of tiles, which is a layout pretending the count is small (owner: "instance가 8개면 어떻게
 * 하려고 그러냐"). A list just gets longer, and the columns stay aligned so scanning down eight
 * AZs or eight endpoints is one eye movement instead of eight.
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
  /** The cluster's engine — the one thing an instance line cannot say for itself. */
  engineLabel: string | null;
  onSelect: (instanceResourceId: string) => void;
}

/**
 * Instance line grid — identity (radio · name · role) | AZ · engine | endpoint.
 *
 * The role chip rides the NAME rather than taking a column of its own (owner: "Reader/Writer가
 * Instance와 최대한 가까웠으면 한다"). Everything else is a column, because a column is what
 * makes eight of them comparable.
 */
const LINE_GRID = 'grid grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,6fr)] items-center gap-4';

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
      {/* Bottom margin is deliberately larger than the top one (owner, 2026-08-12): the band
          belongs to the cluster ABOVE it, so sitting closer to that row and further from the
          next resource is what says so. 12 → 24, both on the spacing set. */}
      <div className="mx-6 mt-3 mb-6">
        <div className={cn('overflow-hidden rounded-xl border shadow-sm', borderColors.default, bgColors.surface)}>
          <div className={cn('border-b px-5 py-3', borderColors.default, bgColors.muted)}>
            <span className={cn('text-[14px] font-semibold', textColors.primary)}>
              {`연결할 인스턴스 · ${instances.length}건`}
            </span>
            <span className={cn('ml-2 text-[12px]', textColors.secondary)}>
              {selectable
                ? 'Agent가 접속할 인스턴스 1개를 고르세요. 기본값은 부하가 적은 Reader예요.'
                : '이 클러스터를 연동 대상으로 선택하면 접속할 인스턴스를 고를 수 있어요.'}
            </span>
          </div>

          <div className={cn('px-5 py-2 text-[12px]', LINE_GRID, textColors.tertiary)}>
            <span>인스턴스</span>
            <span>가용 영역</span>
            <span>엔드포인트</span>
          </div>

          <div>
            {instances.map((instance) => {
              const identifier = rdsInstanceLabel(instance);
              const chosen = instance.resource_id === chosenResourceId;
              const endpoint = typeof instance.host === 'string' && instance.host
                ? `${instance.host}${instance.port ? `:${instance.port}` : ''}`
                : null;

              const body = (
                <>
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
                  <span className={cn('flex min-w-0 items-baseline gap-2 text-[12px]', textColors.secondary)}>
                    <span className="truncate font-mono">{instance.availability_zone ?? '—'}</span>
                    {engineLabel && <span className="shrink-0">{engineLabel}</span>}
                  </span>
                  <span className={cn('truncate font-mono text-[12px]', textColors.tertiary)}>
                    {endpoint ?? '—'}
                  </span>
                </>
              );

              // The rule rides each line rather than `divide-y` on the list: `divide-*` colours
              // through the children's inherited border-color, which preflight has already set
              // to the default grey — the token on the container would be silently ignored.
              const lineClass = cn(
                LINE_GRID,
                'border-t px-5 py-3',
                borderColors.light,
                chosen ? primaryColors.bgLight : bgColors.mutedHover,
              );

              // No radio → nothing to label, so the line is a plain block rather than a
              // `<label>` pointing at an input that does not exist.
              return selectable ? (
                <label key={instance.resource_id} className={cn(lineClass, 'cursor-pointer')}>
                  {body}
                </label>
              ) : (
                <div key={instance.resource_id} className={lineClass}>
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
