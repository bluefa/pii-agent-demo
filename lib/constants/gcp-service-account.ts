/** GCP service-account address suffix for a project — `@{project}.iam.gserviceaccount.com`. */
export const gcpServiceAccountSuffix = (projectId: string): string =>
  `@${projectId}.iam.gserviceaccount.com`;

/**
 * Display form for a service account in tight slots (ops meta rail): just the account
 * name when the address sits under this target's own project. Anything else — an account
 * borrowed from another project — keeps the full address: the suffix IS the only evidence
 * of that mismatch, so a naive `split('@')` would erase it.
 *
 * Same rule as `awsRoleArnDisplay`, so the two providers' rows read alike: a short name
 * when everything lines up, the full value the moment it does not.
 */
export const gcpServiceAccountDisplay = (serviceAccount: string, projectId: string): string => {
  if (!projectId) return serviceAccount;
  const suffix = gcpServiceAccountSuffix(projectId);
  return serviceAccount.endsWith(suffix)
    ? serviceAccount.slice(0, -suffix.length)
    : serviceAccount;
};
