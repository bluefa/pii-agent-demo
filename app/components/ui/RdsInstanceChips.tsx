import {
  memberRole,
  memberRoleLabel,
  rdsInstanceLabel,
  type RdsInstanceCandidate,
} from '@/lib/rds-instances';
import {
  cn,
  primaryColors,
  statusColors,
  tableRowLift,
  tagStyles,
  textColors,
} from '@/lib/theme';

// `chipEdge` is inert outside a `tableRowLift.base` row — it is a `group-hover:` rule, so a
// chip rendered anywhere without that ancestor draws no ring. Every chip here can appear in a
// resource-table row, and in one they all go equiluminant with the tint; see the token.
const CHIP_BASE = cn('shrink-0 rounded-full px-2 py-0.5 text-xs', tableRowLift.chipEdge);

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
 * ONE grey surface, and the role lives in the letters alone: warm = Writer (the instance the
 * service writes through — pointing the agent at it puts scan load on the primary), cool =
 * Reader, neutral for a `cluster_member_role` the contract left blank or sent unrecognised.
 * Two filled tints made every instance row carry a coloured block, and a list of them read as
 * a column of statuses next to the cluster's real verdict; on grey the distinction is still
 * there for anyone reading the row, and invisible to anyone scanning past it.
 * Shared by step 1, steps 2·3 and admin so the same instance reads the same wherever reviewed.
 */
export const RdsMemberChip = ({ role }: { role?: string }) => {
  const known = memberRole(role);
  const tone =
    known === 'writer'
      ? statusColors.warning.textDark
      : known === 'reader'
        ? statusColors.info.textDark
        : statusColors.pending.textDark;
  // The contract's canonical values are WRITER / READER; a chip does not shout.
  return (
    <span className={cn(CHIP_BASE, 'font-medium', statusColors.pending.bg, tone)}>
      {memberRoleLabel(role)}
    </span>
  );
};

/**
 * Quiet primary-tint marker on the instance the cluster connects through. Read-only surfaces
 * only (step 1 read-only, steps 2·3, admin): where radios exist, the checked radio says it.
 */
export const RdsSelectionChip = () => (
  <span className={cn(CHIP_BASE, primaryColors.bgLight, primaryColors.textOnLight)}>선택됨</span>
);

/**
 * The cluster identity's third line — the member the agent connects through.
 *
 * Which instance was picked is the whole point of a cluster row, and folding the band away must
 * not delete it, so the row states it whether the band is open or shut. Shared by steps 1·2·3
 * and the admin queue (owner, 2026-08-13: "Step2 이상부터는 접었을 때도 instance 정보가 step1
 * 처럼"): a review surface is where that choice is checked, so it cannot be the one place that
 * only counts.
 *
 * The line names the SELECTION, never a tally. A parent that counts its members says what the
 * open band already says one line at a time, and that summary is what this table rejected in
 * PR #630. `총` only stands in when there is NO selection — an excluded cluster submits no
 * instance, so the count is the honest thing left to say.
 *
 * The role rides directly beside the name (owner: "정말 중요한 정보"), not in a column of its own.
 */
export const RdsChosenInstanceLine = ({
  chosen,
  total,
}: {
  chosen: RdsInstanceCandidate | undefined;
  total: number;
}) => (
  <span className={cn('flex min-w-0 max-w-full items-center gap-1.5 text-[12px]', textColors.secondary)}>
    <span aria-hidden="true">↳</span>
    {chosen ? (
      <>
        <RdsMemberChip role={chosen.cluster_member_role} />
        <span className="min-w-0 truncate font-mono">{rdsInstanceLabel(chosen)}</span>
      </>
    ) : (
      <span className="whitespace-nowrap">{`인스턴스 ${total}건`}</span>
    )}
  </span>
);
