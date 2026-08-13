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
 * Used by every surface that shows a cluster's members: step 1 (choose one, radios), steps 2·3
 * and the admin request queue (review the choice, no radios, `선택됨` chip instead).
 *
 * The instances are NOT rows of the OUTER table. Half of its columns say nothing about an
 * instance (Resource ID, the verdict, 제외 사유 all belong to the cluster — one decision, not
 * one per member), and the two things the user actually compares — the endpoint and the AZ —
 * have no column at all: as outer rows they were a wide band of blanks, and the review surfaces
 * ended up filing the AZ under a "Region" header to have somewhere to put it. Inside the body
 * they get their OWN three columns and fill every one of them.
 *
 * It is an ACCORDION, not a card floating under the row: no margin, no rounded box, no shadow.
 * The body is flush against its cluster and shares that row's open tint, so the pair reads as one
 * block that opened rather than a panel that appeared somewhere below. The indent is the app's
 * own tier step, the same one a grouped child row hangs at.
 *
 * ONE LINE PER INSTANCE, and the body's height is whatever that adds up to — an Aurora cluster
 * carries a writer and up to fifteen readers, so any fixed grid is a layout that assumes the
 * count is small. A list just gets longer, and the columns stay aligned so scanning down eight
 * AZs is one eye movement instead of eight.
 *
 * Rejected shapes and the owner sessions behind them: `docs/ux/benchmark/step1-resource-table.md`.
 */

interface RdsInstancePanelProps {
  /** The cluster the body belongs to — scopes the radio group. */
  clusterId: string;
  /**
   * Whether the host table opens with a checkbox column. This sets the INDENT only: the body
   * hangs off the name column's left edge, and the checkbox column is what moves it.
   */
  showCheckboxColumn: boolean;
  /** Columns to span — passed, not derived: the three host tables run 7 / 6 / 6 wide. */
  colSpan: number;
  /** Display order (Reader-first) — the caller sorts, the wire order is what the payload echoes. */
  instances: readonly RdsInstanceCandidate[];
  /** The cluster's effective selection; undefined while the cluster is left out of the request. */
  chosenResourceId: string | undefined;
  /** Radios exist only inside a checked cluster in the editable table (absent, not disabled). */
  selectable: boolean;
  readonly: boolean;
  /** Answers the radio, so it is required by `selectable` and by nothing else — a review
   *  surface (steps 2·3, the admin queue) renders no radio to answer. */
  onSelect?: (instanceResourceId: string) => void;
}

/**
 * Instance line grid — identity (radio · name · role) | AZ | endpoint.
 *
 * No engine column: every member of a cluster runs the cluster's engine, so repeating it on
 * each line said the same word N times and the cluster row's own Database Type cell already
 * says it once (owner, 2026-08-12).
 *
 * The role chip rides the NAME rather than taking a column of its own (owner: Reader/Writer has to sit as
 * close to the instance as it can). Everything else is a column, because a column is what
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

/**
 * The band is a TABLE, said in roles rather than in `<table>` markup.
 *
 * Three labelled columns whose whole point is comparing values down them have to be a table to a
 * screen reader too — without the roles the header strip is three loose words followed by bare
 * strings, and nothing ties an AZ to the instance it belongs to. Roles rather than a nested
 * `<table>` because the alignment comes from ONE grid template shared by the header and every
 * line (`LINE_GRID`); real table layout would have to re-derive that with fixed widths and would
 * change what the columns do at narrow widths.
 *
 * Exported so a test names the band the way a screen reader finds it, instead of reaching for
 * the colspan cell by class.
 */
export const RDS_INSTANCE_BAND_LABEL = '접속 인스턴스 목록';

export const RdsInstancePanel = ({
  clusterId,
  showCheckboxColumn,
  colSpan,
  instances,
  chosenResourceId,
  selectable,
  readonly,
  onSelect,
}: RdsInstancePanelProps) => (
  <tr>
    <td colSpan={colSpan} className="px-0 py-0">
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
        role="table"
        aria-label={RDS_INSTANCE_BAND_LABEL}
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
          role="row"
        >
          <span role="columnheader">인스턴스</span>
          <span role="columnheader">가용 영역</span>
          <span role="columnheader">엔드포인트</span>
        </div>

        <div role="rowgroup">
          {instances.map((instance, index) => {
            const identifier = rdsInstanceLabel(instance);
            const chosen = instance.resource_id === chosenResourceId;
            const endpoint = typeof instance.host === 'string' && instance.host
              ? `${instance.host}${instance.port ? `:${instance.port}` : ''}`
              : null;

            const body = (
              <>
                <span role="cell" className="relative flex min-w-0 items-center gap-2">
                  {selectable && (
                    <input
                      type="radio"
                      name={`rds-instance-${clusterId}`}
                      value={instance.resource_id}
                      checked={chosen}
                      onChange={() => onSelect?.(instance.resource_id)}
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
                <span role="cell" className={cn('truncate font-mono text-[12px]', textColors.secondary)}>
                  {instance.availability_zone ?? '—'}
                </span>
                <span role="cell" className={cn('truncate font-mono text-[12px]', textColors.secondary)}>
                  {endpoint ?? '—'}
                </span>
              </>
            );

            // A line carries NO fill of its own — not for the chosen one, and not on hover. The
            // radio says which instance is chosen, and where there is no radio (read-only) the
            // 선택됨 chip does. A fill would also break the role chip: it is a grey pill
            // (`statusColors.pending.bg`), the SAME grey as this body's surface, so the one
            // lifted line would be the only one whose chip stopped reading as a chip.
            //
            // The rule rides each line rather than `divide-y` on the list: `divide-*` colours
            // through the children's inherited border-color, which preflight has already set
            // to the default grey — the token on the container would be silently ignored.
            const lineClass = cn(
              LINE_GRID,
              'border-t py-3 pr-3',
              borderColors.default,
              idcStyles.table.instanceBand.line,
              index === instances.length - 1 && idcStyles.table.instanceBand.lineLast,
            );

            // No radio → nothing to label, so the line is a plain block rather than a
            // `<label>` pointing at an input that does not exist.
            return selectable ? (
              <label key={instance.resource_id} role="row" className={cn(lineClass, 'cursor-pointer')}>
                {body}
              </label>
            ) : (
              <div key={instance.resource_id} role="row" className={lineClass}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </td>
  </tr>
);
