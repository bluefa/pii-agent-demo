'use client';

import { RdsMemberChip, RdsSelectionChip } from '@/app/components/ui/RdsInstanceChips';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { rdsInstanceLabel, type RdsInstanceCandidate } from '@/lib/rds-instances';
import {
  bgColors,
  cn,
  ec2Styles,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { TS_COPY } from '@/app/target-sources/[targetSourceId]/_components/copy';

/**
 * RDS cluster member instances — the rows a cluster row opens under itself.
 *
 * Used by every surface that shows a cluster's members: step 1 (choose one, radios), steps 2·3
 * and the admin request queue (review the choice, no radios, `선택됨` chip instead).
 *
 * The instances ARE rows of the host table. They were a colspan cell holding its own 3-column
 * grid until 2026-09-03, and that shape put every value it showed on an axis of its own: the
 * band's columns started at x 450 / 831.8 / 1067.3 while the table's started at 396 / 674.9 /
 * 954.2 / 1096.2 / 1252.2 / 1364.2, so an instance's AZ rendered inside the Resource ID column
 * while the Athena child row one row above rendered its region 268.7px away under the Region
 * header — the same class of value, twice, in two places. A child row inherits its parent's
 * column structure; the host table's `table-fixed` ledger is what aligns them, and nothing here
 * re-derives it. Measurements and references: `docs/ux/benchmark/step1-rds-instance-rows.md`.
 *
 * The columns an instance does NOT answer stay empty, exactly as an Athena child's do:
 * the Resource ID is the parent's path plus the child's name, and the verdict, the exclusion
 * reason and the engine are the cluster's one decision — not one per member.
 *
 * It is an ACCORDION, not a card floating under the row: the open cluster row and these rows
 * share `bgColors.panel`, with no margin, radius, shadow or gap between them, so the block
 * reads as a row that opened rather than a panel that appeared. That shape was rejected as a
 * floating card three times; see the benchmark note.
 *
 * ONE ROW PER INSTANCE, and the block's height is whatever that adds up to — an Aurora cluster
 * carries a writer and up to fifteen readers, so any fixed grid is a layout that assumes the
 * count is small.
 *
 * Rejected shapes and the owner sessions behind them: `docs/ux/benchmark/step1-resource-table.md`.
 */

/**
 * What each column of the HOST table holds for an instance, in host column order.
 *
 * Declared by the caller, never derived here: the three hosts run 7 / 5 / 6 / 6 columns wide
 * and only they know which of theirs is the Region column. A guess would put the AZ back where
 * this shape was built to move it from.
 */
export type RdsInstanceHostColumn =
  /** The host's leading checkbox gutter — a structural lead-in, so it casts no seam band. */
  | 'select'
  /** Resource Name — the tier indent, the radio, the instance name and its endpoint. */
  | 'name'
  /** Region — the instance's availability zone. */
  | 'availabilityZone'
  /** Anything the cluster answers for, or has no instance-level value: left empty. */
  | 'blank';

interface RdsInstancePanelProps {
  /** The cluster the rows belong to — scopes the radio group. */
  clusterId: string;
  /** The host table's column layout, in order. */
  columns: readonly RdsInstanceHostColumn[];
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

export const RdsInstancePanel = ({
  clusterId,
  columns,
  instances,
  chosenResourceId,
  selectable,
  readonly,
  onSelect,
}: RdsInstancePanelProps) => {
  const { locale } = useLocale();
  const t = TS_COPY[locale].shared;

  return (
    <>
      {instances.map((instance, index) => {
        const identifier = rdsInstanceLabel(instance);
        const chosen = instance.resource_id === chosenResourceId;
        const last = index === instances.length - 1;
        const endpoint = typeof instance.host === 'string' && instance.host
          ? `${instance.host}${instance.port ? `:${instance.port}` : ''}`
          : null;

        // The identity stack. Two lines, the grammar the manually added EC2 row already uses:
        // what the row IS on top, the value that qualifies it underneath.
        //
        // No fill on the chosen row — not for the selection, not on hover. The radio says which
        // instance is chosen, and where there is no radio (read-only) the 선택됨 chip does. A
        // fill would also break the role chip: it is a grey pill (`statusColors.pending.bg`),
        // the SAME grey as this surface, so the one lifted row would be the only one whose chip
        // stopped reading as a chip.
        const identity = (
          <span className={cn(ec2Styles.rowStack, 'w-full')}>
            <span className="flex w-full min-w-0 items-center gap-2">
              {selectable && (
                <input
                  type="radio"
                  name={`rds-instance-${clusterId}`}
                  value={instance.resource_id}
                  checked={chosen}
                  onChange={() => onSelect?.(instance.resource_id)}
                  aria-label={t.selectInstance(identifier)}
                  className={cn(
                    idcStyles.table.instanceBand.radio,
                    statusColors.pending.border,
                    primaryColors.text,
                    primaryColors.focusRing,
                  )}
                />
              )}
              {/* The name is what the radio selects by, and the 54px tier plus the role chip
                  leave it clipping in a 250px Name column (measured 117 of 133px at 1512px:
                  three members all reading `demo-aurora-my…`). Same recipe as the endpoint
                  below and as every other truncating identity cell in these tables — the tip
                  carries the whole string, and only when it is actually cut. */}
              <Tooltip
                content={<IdentifierTip label={t.instance} value={identifier} />}
                variant="value"
                size="md"
                // `min-w-0` only, no display utility: the Tooltip's own wrapper is
                // `relative inline-flex`, and `cn` is a plain join — a second display class
                // here would be settled by stylesheet order. Same recipe as `NAME_TRIGGER`,
                // which the host tables' name cells use for exactly this reason.
                triggerClassName="min-w-0"
                truncatedOnly
              >
                <span className={cn('block truncate font-mono text-[14px]', textColors.primary)}>
                  {identifier}
                </span>
              </Tooltip>
              <RdsMemberChip role={instance.cluster_member_role} />
              {readonly && chosen && <RdsSelectionChip />}
            </span>
            {/* The endpoint is the longest value on the row and the reason a member is worth
                naming at all, so truncation must not be where it disappears — the app's own
                truncated-value tip carries the whole string, and only when it is clipped. */}
            <span className={cn('block w-full min-w-0 font-mono text-[12px]', textColors.secondary)}>
              {endpoint ? (
                <Tooltip
                  content={<IdentifierTip label={t.endpoint} value={endpoint} />}
                  variant="value"
                  size="md"
                  triggerClassName="block min-w-0 max-w-full"
                  truncatedOnly
                >
                  <span className="block truncate">{endpoint}</span>
                </Tooltip>
              ) : (
                '—'
              )}
            </span>
          </span>
        );

        return (
          <tr
            key={instance.resource_id}
            className={cn(bgColors.panel, selectable && 'cursor-pointer')}
            // The WHOLE row picks the instance, as the band's `<label>` line did before these
            // became rows: the name cell is 250px of a ~1040px row, so a label on it alone
            // leaves most of an 84px row inert. A `<tr>` cannot be a label, so this is a
            // click handler — and it may fire alongside the radio's own `onChange` when the
            // radio itself is pressed, which is harmless: `onSelect` sets the selection to
            // this id either way.
            //
            // A drag that ends inside the row is a text selection, not a press.
            onClick={
              selectable
                ? () => {
                    if (window.getSelection()?.isCollapsed === false) return;
                    onSelect?.(instance.resource_id);
                  }
                : undefined
            }
          >
            {columns.map((column, columnIndex) => {
              const key = `${column}-${columnIndex}`;

              if (column === 'select') {
                // data-static-col: the gutter is the row's lead-in, not a column values are
                // compared across — no rail, no seam band (`consoleGrid`). The checkbox is the
                // CLUSTER's verdict, so there is nothing to put here.
                return <td key={key} data-static-col="" className={idcStyles.table.approvalCell} />;
              }

              if (column === 'name') {
                return (
                  <td
                    key={key}
                    className={cn(
                      idcStyles.table.approvalCell,
                      idcStyles.table.consoleCell,
                      // The tree rail and the 54px tier — an Athena database's own cell token,
                      // so an instance name and a database name land on ONE x. The radio
                      // variant differs by its elbow alone (`instanceBand.nameCell`): a full
                      // duplicate rather than a modifier, because `cn` is a plain join and two
                      // `after:w-*` utilities would be settled by stylesheet order.
                      selectable
                        ? idcStyles.table.instanceBand.nameCell
                        : idcStyles.table.group.childCell,
                      last && idcStyles.table.group.childCellLast,
                    )}
                  >
                    {/* No radio → nothing to label, so the cell holds a plain span rather than
                        a `<label>` pointing at an input that does not exist. */}
                    {selectable ? (
                      <label className="flex cursor-pointer">{identity}</label>
                    ) : (
                      identity
                    )}
                  </td>
                );
              }

              if (column === 'availabilityZone') {
                return (
                  <td
                    key={key}
                    className={cn(
                      idcStyles.table.approvalCell,
                      idcStyles.table.consoleCell,
                      // The host's own Region-cell dress. The AZ is read DOWN this column
                      // against the regions above it, so it is typeset as one of them rather
                      // than as a footnote to the instance name. No `tableRowLift.cellText`
                      // though: that is a `group-hover:` rule, and an instance row carries no
                      // `tableRowLift.base` group for it to answer — the old band lines had no
                      // hover state either.
                      'whitespace-nowrap font-mono text-[14px]',
                      textColors.secondary,
                    )}
                  >
                    {instance.availability_zone ?? '—'}
                  </td>
                );
              }

              return (
                <td key={key} className={cn(idcStyles.table.approvalCell, idcStyles.table.consoleCell)} />
              );
            })}
          </tr>
        );
      })}
    </>
  );
};
