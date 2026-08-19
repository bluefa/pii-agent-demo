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

/**
 * Display form for a role ARN in tight slots (ops meta rail): just the role name
 * when the ARN sits under this target's own prefix. Anything else — a cross-account
 * role, a partition mismatch (aws vs aws-cn) — keeps the full ARN: the prefix IS the
 * only evidence of the mismatch, so a naive `split(':role/')` would erase it.
 */
export const awsRoleArnDisplay = (arn: string, accountId: string, isChinaRegion: boolean): string => {
  const prefix = awsRoleArnPrefix(accountId, isChinaRegion);
  return arn.startsWith(prefix) ? arn.slice(prefix.length) : arn;
};
