'use client';

import { RdsMemberChip, RdsSelectionChip } from '@/app/components/ui/RdsInstanceChips';
import { rdsInstanceLabel, type RdsInstanceCandidate } from '@/lib/rds-instances';
import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

/**
 * RDS cluster member instances — the accordion body the cluster row opens.
 *
 * The instances are NOT rows of the OUTER table. Three of its seven columns say nothing about
 * an instance (Resource ID, 설치 구분, 제외 사유 belong to the cluster), and the two things the
 * user actually compares — the endpoint and the AZ — have no column at all, so as outer rows
 * they were a wide band of blanks. Inside the body they get their OWN three columns and fill
 * every one of them.
 *
 * It is an ACCORDION, not a card floating under the row: no margin, no rounded box, no shadow.
 * The body is flush against its cluster and shares that row's open tint, so the header and the
 * body read as one block that opened — a detached card read as "a panel appeared somewhere
 * below", which is what the owner kept rejecting (2026-08-12). The indent is the app's own tier
 * step, the same one a grouped child row hangs at, so "this belongs to that" is said the way
 * this table already says it.
 *
 * ONE LINE PER INSTANCE, and the body's height is whatever that adds up to. An Aurora cluster
 * can carry a writer and fifteen readers; a fixed card grid turned that into ragged rows of
 * tiles, which is a layout pretending the count is small (owner: "instance가 8개면 어떻게 하려고
 * 그러냐"). A list just gets longer, and the columns stay aligned so scanning down eight AZs or
 * eight endpoints is one eye movement instead of eight.
 */

interface RdsInstancePanelProps {
  /** The cluster the body belongs to — scopes the radio group. */
  clusterId: string;
  /** Editable table = checkbox + 5 data columns + 제외 사유; read-only drops the two. */
  showCheckboxColumn: boolean;
  /** Display order (Reader-first) — the caller sorts, the wire order is what the payload echoes. */
  instances: readonly RdsInstanceCandidate[];
  /** The cluster's effective selection; undefined while the cluster is left out of the request. */
  chosenResourceId: string | undefined;
  /** Radios exist only inside a checked cluster in the editable table (absent, not disabled). */
  selectable: boolean;
  readonly: boolean;
  onSelect: (instanceResourceId: string) => void;
}

/**
 * Instance line grid — identity (radio · name · role) | AZ | endpoint.
 *
 * No engine column: every member of a cluster runs the cluster's engine, so repeating it on
 * each line said the same word N times and the cluster row's own Database Type cell already
 * says it once (owner, 2026-08-12).
 *
 * The role chip rides the NAME rather than taking a column of its own (owner: "Reader/Writer가
 * Instance와 최대한 가까웠으면 한다"). Everything else is a column, because a column is what
 * makes eight of them comparable.
 */
const LINE_GRID = 'grid grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,6fr)] items-center gap-4';

/**
 * Where the body's content starts, measured off the table's own tier geometry (`idcStyles.
 * table.group`): the leading checkbox column is 52px (18 + 16 + 18), the name column's own left
 * edge is +30, and a child hangs one 24px tier below that. 52 + 54 = 106; read-only tables drop
 * the checkbox column, leaving 54. This is the x an Athena database name lands on, and the
 * instance names land on it too — the radio hangs to its left rather than pushing it right
 * (`idcStyles.table.instanceBand.radio`).
 */
const INDENT_WITH_CHECKBOX = 'pl-[106px]';
const INDENT_WITHOUT_CHECKBOX = 'pl-[54px]';

export const RdsInstancePanel = ({
  clusterId,
  showCheckboxColumn,
  instances,
  chosenResourceId,
  selectable,
  readonly,
  onSelect,
}: RdsInstancePanelProps) => (
  <tr>
    <td colSpan={showCheckboxColumn ? 7 : 5} className="px-0 py-0">
      {/* Bottom padding is deliberately larger than the top one (owner, 2026-08-12): the body
          belongs to the cluster ABOVE it, so sitting tight under that row and leaving room
          before the next resource is what says so. 16 → 24, both on the spacing set. The top
          16 rides the header strip rather than this box, so the rail can be drawn through it —
          on the container the trunk would start below the padding and leave a gap under the
          cluster's own segment. */}
      <div
        className={cn(
          'border-b pr-[18px] pb-6',
          borderColors.default,
          // gray-100, not gray-50: the open state has to be SEEN, and gray-50 measures ΔE00 1.20
          // from white — under the ~2.3 at which two colours read as different at all, so the
          // body and the header would have been bound by a tint nobody can see. `bgColors.panel`
          // carries a contract with it: nothing on this surface may sit at `tertiary` (4.37:1,
          // under AA), which is why the labels and the endpoint below read at `secondary`.
          bgColors.panel,
          showCheckboxColumn ? INDENT_WITH_CHECKBOX : INDENT_WITHOUT_CHECKBOX,
        )}
      >
        {/* No title strip. The row above already names the cluster and the count, and the
            guidance repeated what the checked radio and the Reader-first order say by
            themselves — the body opens straight into the list (owner, 2026-08-12). */}
        <div
          className={cn(
            'pt-4 pb-2 text-[12px]',
            LINE_GRID,
            idcStyles.table.instanceBand.headerStrip,
            textColors.secondary,
          )}
        >
          <span>인스턴스</span>
          <span>가용 영역</span>
          <span>엔드포인트</span>
        </div>

        <div>
          {instances.map((instance, index) => {
            const identifier = rdsInstanceLabel(instance);
            const chosen = instance.resource_id === chosenResourceId;
            const endpoint = typeof instance.host === 'string' && instance.host
              ? `${instance.host}${instance.port ? `:${instance.port}` : ''}`
              : null;

            const body = (
              <>
                <span className="relative flex min-w-0 items-center gap-2">
                  {selectable && (
                    <input
                      type="radio"
                      name={`rds-instance-${clusterId}`}
                      value={instance.resource_id}
                      checked={chosen}
                      onChange={() => onSelect(instance.resource_id)}
                      aria-label={`접속 인스턴스 ${identifier} 선택`}
                      className={cn(
                        idcStyles.table.instanceBand.radio,
                        statusColors.pending.border,
                        primaryColors.text,
                        primaryColors.focusRing,
                      )}
                    />
                  )}
                  <span className={cn('min-w-0 truncate font-mono text-[14px]', textColors.primary)}>
                    {identifier}
                  </span>
                  <RdsMemberChip role={instance.cluster_member_role} />
                  {readonly && chosen && <RdsSelectionChip />}
                </span>
                <span className={cn('truncate font-mono text-[12px]', textColors.secondary)}>
                  {instance.availability_zone ?? '—'}
                </span>
                <span className={cn('truncate font-mono text-[12px]', textColors.secondary)}>
                  {endpoint ?? '—'}
                </span>
              </>
            );

            // The chosen line gets NO fill of its own (owner, 2026-08-12). The radio already
            // says which one it is — and where there is no radio (read-only), the 선택됨 chip
            // does. A tint on top of that was a third voice saying the same thing, and it cost
            // more than it said: the role chip is a grey pill (`statusColors.pending.bg`), which
            // is the SAME grey as this body's surface, so it flattened into the background on
            // every line except the tinted one. One line in the list looking like the only one
            // with a real chip is a difference the eye reads as meaning, and it meant nothing.
            //
            // The rule rides each line rather than `divide-y` on the list: `divide-*` colours
            // through the children's inherited border-color, which preflight has already set
            // to the default grey — the token on the container would be silently ignored.
            const lineClass = cn(
              LINE_GRID,
              'border-t py-3 pr-3',
              borderColors.default,
              bgColors.surfaceHover,
              idcStyles.table.instanceBand.line,
              index === instances.length - 1 && idcStyles.table.instanceBand.lineLast,
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
    </td>
  </tr>
);
