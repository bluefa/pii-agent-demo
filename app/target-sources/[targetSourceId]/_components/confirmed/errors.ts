import { AppError } from '@/lib/errors';
import { TS_COPY } from '@/app/target-sources/[targetSourceId]/_components/copy';
import { DEFAULT_LOCALE, type Locale } from '@/lib/locale';

/** `locale` is optional so the existing callers and tests keep the Korean they asserted. */
export const getConfirmedErrorMessage = (
  error: unknown,
  locale: Locale = DEFAULT_LOCALE,
): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return TS_COPY[locale].common.confirmedLoadFailed;
};
