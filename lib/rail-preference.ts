/**
 * The guide rail's fold preference — the one thing the server and the client both have
 * to agree on, so it lives outside both.
 *
 * It is a COOKIE, not `localStorage`, and that is the whole point. The rail's width is
 * decided during the first paint, and only a cookie rides along with the request that
 * produces it. With `localStorage` the server could do nothing but guess from a media
 * query, so a reader who had folded the rail watched it paint open at 320px and then
 * snap to the strip once hydration delivered the real answer.
 *
 * ⛔ Do not move this back to `localStorage` "because it is simpler". The flash is not a
 * polish item; it is what happens when the first paint cannot see the preference.
 */

/** `path=/` because the app is served under a basePath and the rail spans all of it. */
export const RAIL_COOKIE_NAME = 'pii-rail-guide';

/** The width at or above which the rail starts open when nothing has been stored. */
export const RAIL_OPEN_MIN_WIDTH = 1360;

/**
 * `null` = no preference; the caller falls back to the width default.
 *
 * Exactly two strings mean anything. Anything else — an older build, a truncated value,
 * a hand-edited cookie — resolves to `null` rather than being coerced into a boolean: a
 * restored value that skipped the gesture's invariants is how a rail comes back in a
 * state no press could have produced.
 */
export const parseRailCookie = (raw: string | undefined | null): boolean | null =>
  raw === '1' ? true : raw === '0' ? false : null;

/** One year. The preference is about how someone likes to work, not about this visit. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Serialised for `document.cookie`. `secure` only on https, so dev over http still writes. */
export const serialiseRailCookie = (collapsed: boolean, isSecure: boolean): string =>
  `${RAIL_COOKIE_NAME}=${collapsed ? '1' : '0'}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax${
    isSecure ? '; secure' : ''
  }`;
