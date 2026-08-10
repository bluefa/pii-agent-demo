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
 * Display form of a role ARN: the name alone when the ARN is the one this
 * target's own account and partition would compose — the same unit
 * `RoleEditModal` edits, and the account is already stated a line above it.
 *
 * INVARIANT: a prefix that does NOT match is returned whole. A role in another
 * account, or an `aws-cn` ARN on a global target, differs from this target in
 * exactly the part being cut, so trimming it would erase the only evidence of
 * the mismatch. Callers must still carry the full value (a `title`) —
 * shortening is for reading, never for replacing.
 */
export const awsRoleArnDisplay = (
  arn: string,
  accountId: string | null | undefined,
  isChinaRegion: boolean,
): string => {
  if (!accountId) return arn;
  const prefix = awsRoleArnPrefix(accountId, isChinaRegion);
  return arn.startsWith(prefix) ? arn.slice(prefix.length) : arn;
};
