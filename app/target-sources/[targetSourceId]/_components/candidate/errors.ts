import { AppError } from '@/lib/errors';

/**
 * `fallback` rather than a literal: this module decides WHICH message a failure gets —
 * the upstream one when there is a user-facing one, otherwise the generic line — and the
 * caller's dictionary supplies the wording for that generic line. Same split as
 * `credential-fields.ts` and `lib/validation/infra-credentials.ts`.
 */
export const getCandidateErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
};
