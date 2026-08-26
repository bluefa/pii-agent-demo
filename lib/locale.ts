/**
 * UI language preference — ko / en.
 *
 * A COOKIE, not `localStorage`, for the same reason as `lib/rail-preference.ts`:
 * the first paint decides which language every string renders in, and only a
 * cookie rides along with the request that produces that paint. With
 * `localStorage` a reader who chose English would watch the page paint Korean
 * and then flip once hydration delivered the real answer.
 */

export const LOCALES = ['ko', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ko';

/** `path=/` because the app is served under a basePath and the preference spans all of it. */
export const LOCALE_COOKIE_NAME = 'pii-locale';

/** Anything but an exact known value resolves to the default rather than being coerced. */
export const parseLocaleCookie = (raw: string | undefined | null): Locale =>
  (LOCALES as readonly string[]).includes(raw ?? '') ? (raw as Locale) : DEFAULT_LOCALE;

/** One year. A language choice is about the reader, not this visit. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Serialised for `document.cookie`. `secure` only on https, so dev over http still writes. */
export const serialiseLocaleCookie = (locale: Locale, isSecure: boolean): string =>
  `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax${
    isSecure ? '; secure' : ''
  }`;
