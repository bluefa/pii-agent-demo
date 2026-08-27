/** IAM role-name rule (AWS: [\w+=,.@-]{1,64}) — shared by the ops role PUT routes and the edit modal. */
export const AWS_ROLE_NAME_RE = /^[\w+=,.@-]{1,64}$/;

/**
 * Full role-ARN rule for the upsert routes — the exact shape the edit modal
 * composes (awsRoleArnPrefix + name), aws and aws-cn partitions.
 */
export const AWS_ROLE_ARN_RE = /^arn:aws(-cn)?:iam::\d{12}:role\/[\w+=,.@-]{1,64}$/;

/** ARN partition by region type — China accounts live in the aws-cn partition. */
export const awsPartition = (isChinaRegion: boolean): 'aws' | 'aws-cn' =>
  isChinaRegion ? 'aws-cn' : 'aws';

/** IAM role ARN prefix for an account, e.g. `arn:aws:iam::123456789012:role/`. */
export const awsRoleArnPrefix = (accountId: string, isChinaRegion: boolean): string =>
  `arn:${awsPartition(isChinaRegion)}:iam::${accountId}:role/`;

const ROLE_SEGMENT = ':role/';

/**
 * Display form for a role ARN in tight slots (ops strip): always just the role name,
 * whatever the prefix says (owner, 2026-08-27).
 *
 * This retires the older rule, which kept the full ARN whenever the prefix disagreed
 * with the target's own account or partition, on the grounds that the prefix was the
 * only evidence of the mismatch. That premise no longer holds: the strip now stands a
 * copy button carrying the full ARN, the value's `title` spells it out, and 「상세 정보」
 * prints it in full with its own copy. The evidence lives in three places, so the one
 * slot that exists to be *read* is free to be short — and both providers' rows shorten
 * by the same rule (`gcpServiceAccountDisplay`).
 *
 * A string with no `:role/` segment is returned whole: the cell never renders empty.
 */
export const awsRoleArnDisplay = (arn: string): string => {
  const at = arn.indexOf(ROLE_SEGMENT);
  if (at === -1) return arn;
  return arn.slice(at + ROLE_SEGMENT.length) || arn;
};
