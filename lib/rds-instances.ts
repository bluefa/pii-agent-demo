/**
 * AWS RDS cluster → member instance selection.
 *
 * A cluster resource carries `metadata.rds_instance_candidates` (its member instances) and
 * `metadata.selected_rds_instance_resource_id` (exactly one of them, by resource id — the
 * instance's ARN). The agent connects through that one instance, so Step 1 has to let the
 * user pick it and echo the choice back.
 *
 * `metadata.selected_rds_instance_role` (WRITER | READER) also exists on the wire. The SERVER
 * derives and stores it from the candidates; the frontend neither computes nor sends it, and
 * does not read it yet — the confirmed screen is a follow-up. Nothing here may write that key.
 *
 * The candidate array is opaque to us beyond the six fields below: it is echoed VERBATIM in
 * the approval payload, in its original order. Sorting here is a display concern only.
 */

/**
 * One member instance, exactly as the `/resources` response wrote it.
 *
 * The six named fields are what the contract promises and all the UI reads. The index
 * signature is what makes the echo VERBATIM: a server that adds a seventh field gets it back
 * unchanged instead of silently losing it on the round trip. For the same reason the parse
 * does not coerce the optional fields — a `port` that arrives as a string rides through as a
 * string, which is right for an echo, so the readers below guard their own types.
 */
export interface RdsInstanceCandidate {
  /** The instance's ARN. Identity — the selection is sent as this value. */
  resource_id: string;
  resource_name?: string;
  /** Connection endpoint, rendered as `host:port` in the instance band. */
  host?: string;
  port?: number;
  availability_zone?: string;
  /** Canonically WRITER | READER, but casing is not guaranteed — read it through `memberRole`. */
  cluster_member_role?: string;
  [key: string]: unknown;
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

/**
 * Reads `cluster_member_role`. Canonically uppercase, but casing is not guaranteed — and the
 * verbatim parse does not coerce, so a non-string is possible and must not throw here.
 */
export const memberRole = (role: unknown): 'reader' | 'writer' | null => {
  if (typeof role !== 'string') return null;
  const normalized = role.trim().toLowerCase();
  if (normalized === 'reader') return 'reader';
  if (normalized === 'writer') return 'writer';
  return null;
};

/** Chip text: WRITER shouts, Writer does not. An unrecognised role prints as sent. */
export const memberRoleLabel = (role: unknown): string => {
  switch (memberRole(role)) {
    case 'writer': return 'Writer';
    case 'reader': return 'Reader';
    default: return typeof role === 'string' && role ? role : '—';
  }
};

/**
 * Parse of `metadata.rds_instance_candidates`. The ONLY thing that disqualifies an entry is a
 * missing `resource_id` — without it nothing can be selected and nothing can be sent back.
 *
 * Everything else passes through untouched, including keys this build has never heard of:
 * the array handed back here is the one the approval payload echoes, so dropping a field
 * would make our echo differ from what the server sent. That is why the known fields are not
 * coerced either; the readers in this file guard their own types instead.
 */
export const parseRdsInstanceCandidates = (value: unknown): RdsInstanceCandidate[] => {
  if (!Array.isArray(value)) return [];
  const candidates: RdsInstanceCandidate[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const resourceId = record.resource_id;
    if (typeof resourceId !== 'string' || resourceId === '') continue;
    // The spread is `unknown`-typed per key; only `resource_id` is proven, and it is the only
    // field any caller may rely on being a string.
    candidates.push({ ...record, resource_id: resourceId } as RdsInstanceCandidate);
  }
  return candidates;
};

/**
 * The cluster pair a read-only approval row needs, read straight off a wire item's `metadata`.
 * The generated metadata schema is loose (partial + passthrough), so both keys arrive typed as
 * `unknown` and every display adapter would otherwise re-derive the same guards. Spreads into
 * the row: an empty result means "not a cluster", which leaves the row exactly as it was.
 *
 * Gated on the TYPE as well as the candidates, matching step 1's predicate. Carrying an
 * `rds_instance_candidates` array is not what makes a row a cluster — a future sibling type
 * (a global cluster, say) could carry one too and would otherwise be tagged and expanded as
 * if the step-1 radio grammar applied to it.
 */
export const readRdsInstanceMetadata = (
  metadata: unknown,
  resourceType: string | null | undefined,
): {
  rdsInstanceCandidates?: RdsInstanceCandidate[];
  selectedRdsInstanceResourceId?: string;
} => {
  if (!isRdsCluster(resourceType ?? '')) return {};
  if (typeof metadata !== 'object' || metadata === null) return {};
  const record = metadata as Record<string, unknown>;
  const rdsInstanceCandidates = parseRdsInstanceCandidates(record.rds_instance_candidates);
  const selected = record.selected_rds_instance_resource_id;
  return {
    ...(rdsInstanceCandidates.length > 0 ? { rdsInstanceCandidates } : {}),
    ...(typeof selected === 'string' && selected
      ? { selectedRdsInstanceResourceId: selected }
      : {}),
  };
};

// Readers first: connecting the agent to a reader keeps scan load off the writer. An
// instance whose role the contract left blank sorts last — it is not known to be safe.
const MEMBER_RANK: Record<'reader' | 'writer', number> = { reader: 0, writer: 1 };
const rank = (candidate: RdsInstanceCandidate): number => {
  const role = memberRole(candidate.cluster_member_role);
  return role ? MEMBER_RANK[role] : 2;
};

/**
 * Display order: Reader first, then `resource_id` lexicographic. Non-mutating — the wire
 * order is what the payload echoes.
 */
export const sortRdsInstances = (
  candidates: readonly RdsInstanceCandidate[],
): RdsInstanceCandidate[] =>
  [...candidates].sort((a, b) => {
    const byRole = rank(a) - rank(b);
    if (byRole !== 0) return byRole;
    return a.resource_id.localeCompare(b.resource_id);
  });

/**
 * The instance the cluster connects through: the server's choice when it names one the
 * cluster actually has, otherwise the sorted-top instance. A server id absent from the
 * candidates is dropped — no radio could render it, and the group would end up unselected.
 */
export const defaultRdsInstanceResourceId = (
  candidates: readonly RdsInstanceCandidate[],
  serverSelectedResourceId?: string,
): string | undefined => {
  if (
    serverSelectedResourceId
    && candidates.some((candidate) => candidate.resource_id === serverSelectedResourceId)
  ) {
    return serverSelectedResourceId;
  }
  return sortRdsInstances(candidates)[0]?.resource_id;
};

/**
 * Display name; falls back to the ARN's trailing segment, then the whole ARN. Type-guards
 * `resource_name` because the verbatim parse does not coerce it.
 */
export const rdsInstanceLabel = (candidate: RdsInstanceCandidate): string => {
  const name = candidate.resource_name;
  if (typeof name === 'string' && name) return name;
  return candidate.resource_id.split(':').pop() || candidate.resource_id;
};
