import { memberRole, memberRoleLabel } from '@/lib/rds-instances';
import { cn, primaryColors, statusColors, tagStyles } from '@/lib/theme';

const CHIP_BASE = 'shrink-0 rounded-full px-2 py-0.5 text-xs';

/**
 * Marks the row as an RDS cluster rather than a single instance — the distinction that explains
 * why this one row has instances hanging under it.
 *
 * A FACT tag, not a status: it rides the `resourceKind` tier shared with the EC2 tag — a violet
 * surface carrying grey text, so "what this row IS" is one colour family that can never be read
 * as a verdict beside the row's real one, while the letters stay quieter than the name they
 * introduce. Sits before the name in the identity cell and stays `shrink-0` + `text-xs`
 * so it never eats the name's width. Same component in steps 1·2·3 so the three read identically.
 */
export const ResourceKindTag = ({ children }: { children: string }) => (
  <span className={cn(CHIP_BASE, 'font-sans font-medium', tagStyles.resourceKind)}>{children}</span>
);

export const RdsClusterTag = () => <ResourceKindTag>RDS Cluster</ResourceKindTag>;

/**
 * EC2 인스턴스. RDS Cluster 와 같은 층의 사실 태그 — 그 행이 관리형 DB가 아니라 사용자가
 * 직접 DB를 올려 쓰는 인스턴스임을 말한다. 판정은 `isEc2Instance(resourceType)` 으로,
 * 1~7단계와 Admin 어디서든 같은 행에 같은 태그가 붙는다.
 */
export const Ec2InstanceTag = () => <ResourceKindTag>EC2</ResourceKindTag>;

/**
 * An RDS cluster instance's Reader/Writer role.
 *
 * Warm = Writer (the instance the service writes through — pointing the agent at it puts scan
 * load on the primary), cool = Reader. The neutral tier covers a `cluster_member_role` the
 * contract left blank or sent unrecognised, which must not borrow either signal's colour.
 * Shared by step 1 and steps 2·3 so the same instance is the same colour wherever reviewed.
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
 * Quiet primary-tint marker on the instance the cluster connects through. Read-only surfaces
 * only (step 1 read-only, steps 2·3, admin): where radios exist, the checked radio says it.
 */
export const RdsSelectionChip = () => (
  <span className={cn(CHIP_BASE, primaryColors.bgLight, primaryColors.textOnLight)}>선택됨</span>
);
