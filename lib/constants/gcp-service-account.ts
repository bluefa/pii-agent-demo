/**
 * Display form for a service account in tight slots (ops strip): always just the account
 * name, whatever project the address belongs to (owner, 2026-08-27).
 *
 * This retires the older rule, which kept the full address for an account borrowed from
 * another project, on the grounds that the suffix was the only evidence of that mismatch.
 * That premise no longer holds: the strip stands a copy button carrying the full address,
 * the value's `title` spells it out, and 「상세 정보」 prints it in full with its own copy.
 *
 * Same rule as `awsRoleArnDisplay`, so the two providers' rows read alike — one grammar,
 * the short name to read and the full value to hand over.
 *
 * A string with no local part before `@` is returned whole: the cell never renders empty.
 */
export const gcpServiceAccountDisplay = (serviceAccount: string): string => {
  const at = serviceAccount.indexOf('@');
  return at > 0 ? serviceAccount.slice(0, at) : serviceAccount;
};
