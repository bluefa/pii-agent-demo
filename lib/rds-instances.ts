/**
 * AWS RDS cluster → member instance selection.
 *
 * A cluster resource carries `metadata.rds_instance_list` (its member instances) and
 * `metadata.selected_rds_instance_arn` (exactly one of them). The agent connects to that
 * one instance, so Step 1 has to let the user pick it and echo the choice back.
 *
 * The wire array is opaque to us beyond the four fields below: it is echoed VERBATIM in
 * the approval payload, in its original order. Sorting here is a display concern only.
 */

/** One member instance, exactly as the `/resources` response wrote it. */
export interface RdsInstanceWire {
  rds_instance_arn: string;
  rds_instance_identifier?: string;
  region?: string;
  member?: string;
}

/**
 * Cluster spellings: `AWS_DB_CLUSTER` is the current contract enum, `RDS_CLUSTER` is the
 * alias the demo seed and `normalizeResourceType` canonicalise to, and `AWS_RDS_CLUSTER`
 * is the spelling the owner named for the incoming contract revision (2026-08-06) — kept so
 * the UI survives whichever the backend lands. Exact match only: the near-miss
 * `AWS_RDS_GLOBAL_CLUSTER` is a different resource and must stay excluded.
 */
export const RDS_CLUSTER_TYPES: readonly string[] = [
  'AWS_DB_CLUSTER',
  'AWS_RDS_CLUSTER',
  'RDS_CLUSTER',
];

export const isRdsCluster = (type: string): boolean =>
  RDS_CLUSTER_TYPES.includes(type.trim().toUpperCase());

/** Reader/Writer casing is not guaranteed by the contract — compare case-insensitively. */
export const memberRole = (member: string | undefined): 'reader' | 'writer' | null => {
  const normalized = member?.trim().toLowerCase();
  if (normalized === 'reader') return 'reader';
  if (normalized === 'writer') return 'writer';
  return null;
};

/** Defensive parse of `metadata.rds_instance_list`: an entry without an ARN cannot be selected. */
export const parseRdsInstanceList = (value: unknown): RdsInstanceWire[] => {
  if (!Array.isArray(value)) return [];
  const instances: RdsInstanceWire[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const arn = record.rds_instance_arn;
    if (typeof arn !== 'string' || arn === '') continue;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    instances.push({
      rds_instance_arn: arn,
      ...(str(record.rds_instance_identifier) ? { rds_instance_identifier: str(record.rds_instance_identifier) } : {}),
      ...(str(record.region) ? { region: str(record.region) } : {}),
      ...(str(record.member) ? { member: str(record.member) } : {}),
    });
  }
  return instances;
};

/**
 * The cluster pair a read-only approval row needs, read straight off a wire item's `metadata`.
 * The generated metadata schema is loose (partial + passthrough), so both keys arrive typed as
 * `unknown` and every display adapter would otherwise re-derive the same guards. Spreads into
 * the row: an empty result means "not a cluster", which leaves the row exactly as it was.
 *
 * Gated on the TYPE as well as the list, matching step 1's predicate. Carrying an
 * `rds_instance_list` is not what makes a row a cluster — a future sibling type (a global
 * cluster, say) could carry one too and would otherwise be tagged and expanded as if the
 * step-1 radio grammar applied to it.
 */
export const readRdsInstanceMetadata = (
  metadata: unknown,
  resourceType: string | null | undefined,
): { rdsInstances?: RdsInstanceWire[]; selectedRdsInstanceArn?: string } => {
  if (!isRdsCluster(resourceType ?? '')) return {};
  if (typeof metadata !== 'object' || metadata === null) return {};
  const record = metadata as Record<string, unknown>;
  const rdsInstances = parseRdsInstanceList(record.rds_instance_list);
  const selected = record.selected_rds_instance_arn;
  return {
    ...(rdsInstances.length > 0 ? { rdsInstances } : {}),
    ...(typeof selected === 'string' && selected ? { selectedRdsInstanceArn: selected } : {}),
  };
};

// Readers first: connecting the agent to a reader keeps scan load off the writer. An
// instance whose member the contract left blank sorts last — it is not known to be safe.
const MEMBER_RANK: Record<'reader' | 'writer', number> = { reader: 0, writer: 1 };
const rank = (instance: RdsInstanceWire): number => {
  const role = memberRole(instance.member);
  return role ? MEMBER_RANK[role] : 2;
};

/** Display order: Reader first, then ARN lexicographic. Non-mutating — the wire order is the payload. */
export const sortRdsInstances = (
  instances: readonly RdsInstanceWire[],
): RdsInstanceWire[] =>
  [...instances].sort((a, b) => {
    const byMember = rank(a) - rank(b);
    if (byMember !== 0) return byMember;
    return a.rds_instance_arn.localeCompare(b.rds_instance_arn);
  });

/**
 * The instance the cluster connects through: the server's choice when it names one the
 * cluster actually has, otherwise the sorted-top instance. A server ARN absent from the
 * list is dropped — no radio could render it, and the group would end up with no selection.
 */
export const defaultRdsInstanceArn = (
  instances: readonly RdsInstanceWire[],
  serverSelectedArn?: string,
): string | undefined => {
  if (serverSelectedArn && instances.some((i) => i.rds_instance_arn === serverSelectedArn)) {
    return serverSelectedArn;
  }
  return sortRdsInstances(instances)[0]?.rds_instance_arn;
};

/** Identifier for display; falls back to the ARN's trailing segment, then the whole ARN. */
export const rdsInstanceLabel = (instance: RdsInstanceWire): string =>
  instance.rds_instance_identifier || instance.rds_instance_arn.split(':').pop() || instance.rds_instance_arn;
