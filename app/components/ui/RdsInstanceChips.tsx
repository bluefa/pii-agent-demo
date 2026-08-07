import { memberRole, memberRoleLabel } from '@/lib/rds-instances';
import { cn, primaryColors, statusColors, tagStyles } from '@/lib/theme';

const CHIP_BASE = 'shrink-0 rounded-full px-2 py-0.5 text-xs';

/**
 * Marks the row as an RDS cluster rather than a single instance — the distinction that explains
 * why this one row has instances hanging under it.
 *
 * A FACT tag, not a status: it rides the neutral `tagStyles` tier the resource tables already
 * use for repeating attributes, so it cannot be read as a verdict beside the row's real one.
 * Sits before the name in the identity cell and stays `shrink-0` + `text-xs` so it never eats
 * the name's width. Same component in steps 1·2·3 so the three read identically.
 */
export const RdsClusterTag = () => (
  <span className={cn(CHIP_BASE, 'font-sans font-medium', tagStyles.neutral)}>RDS Cluster</span>
);

/**
 * An RDS cluster instance's Reader/Writer role.
 *
 * Warm = Writer (the instance the service writes through — pointing the agent at it puts scan
 * load on the primary), cool = Reader. The neutral tier covers a `member` the contract left
 * blank, which must not borrow either signal's colour. Shared by step 1 and steps 2·3 so the
 * same instance is the same colour wherever it is reviewed.
 */
export const RdsMemberChip = ({ role }: { role?: string }) => {
  const known = memberRole(role);
  const tone =
    known === 'writer'
      ? cn(statusColors.warning.bg, statusColors.warning.textDark)
      : known === 'reader'
        ? cn(statusColors.info.bg, statusColors.info.textDark)
        : cn(statusColors.pending.bg, statusColors.pending.textDark);
  // The contract's canonical values are WRITER / READER; a chip does not shout.
  return <span className={cn(CHIP_BASE, 'font-medium', tone)}>{memberRoleLabel(role)}</span>;
};

/**
 * Quiet primary-tint marker on the instance the cluster actually uses — `기본` while the
 * table's own default still stands (step 1), `선택됨` on a read-only surface where the radios
 * are gone (step 1 read-only, steps 2·3).
 */
export const RdsSelectionChip = ({ label }: { label: string }) => (
  <span className={cn(CHIP_BASE, primaryColors.bgLight, primaryColors.textOnLight)}>{label}</span>
);
