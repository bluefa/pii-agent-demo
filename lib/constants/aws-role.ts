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
