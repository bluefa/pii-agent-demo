import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import {
  RAIL_COOKIE_NAME,
  RAIL_OPEN_MIN_WIDTH,
  parseRailCookie,
  serialiseRailCookie,
} from '@/lib/rail-preference';

/**
 * The fold preference is written by the client and read by the server, so the two ends
 * are in different runtimes and only agree by convention. Nothing else in the app reads
 * this cookie, which means a disagreement between `serialiseRailCookie` and
 * `parseRailCookie` produces no error anywhere — the value simply parses to `null`, the
 * caller falls back to the width default, and below 1360px the rail quietly refuses to
 * stay open. The reader looks like they never pressed the button.
 *
 * ⛔ The round trip is the point. Asserting the write alone was what let this through:
 * `collapsed ? '1' : 'false'` is a green diff against a test that only ever folds.
 */

/** `name=value; path=/; …` — the cookie value as the browser would later hand it back. */
const valueOf = (cookie: string) => cookie.split(';')[0]?.split('=')[1];

describe('rail preference — the cookie survives its own round trip', () => {
  it.each([true, false])('reads back exactly what it wrote — collapsed=%s', (collapsed) => {
    expect(parseRailCookie(valueOf(serialiseRailCookie(collapsed, false)))).toBe(collapsed);
  });

  // The two ends are separated by a reload, so the wire values are a stored format, not
  // an implementation detail: changing them silently retires every preference already in
  // a reader's browser. Both must be pinned — pinning only '1' is how the false branch
  // drifted in the first place.
  it('writes the two states as distinct one-character values', () => {
    expect(valueOf(serialiseRailCookie(true, false))).toBe('1');
    expect(valueOf(serialiseRailCookie(false, false))).toBe('0');
  });
});

describe('rail preference — anything else means "no preference"', () => {
  // ⛔ Not coerced. A restored value that skipped the gesture's invariants brings the
  // rail back in a state no press could have produced; `null` sends the caller to the
  // width default instead, which is a state the rail can actually be in.
  it.each([
    ['absent', undefined],
    ['cleared', ''],
    ['an older build', 'true'],
    ['the other older build', 'false'],
    ['truncated', '1; path=/'],
    ['hand-edited', 'yes'],
    ['whitespace', ' 1'],
    ['explicitly null', null],
  ])('resolves %s to null', (_name, raw) => {
    expect(parseRailCookie(raw)).toBeNull();
  });
});

describe('rail preference — the cookie outlives the visit', () => {
  it('scopes to the whole app and survives the session', () => {
    const cookie = serialiseRailCookie(true, false);

    // ⛔ `path=/`, not the basePath. The app is served under /pass but the cookie is read
    // by every route below it, and a path-scoped cookie would be invisible to some of them.
    expect(cookie).toContain('path=/');
    expect(cookie).toContain('samesite=lax');
    // One year. The preference is about how someone likes to work, not about this visit —
    // a session cookie would make the rail forget between mornings.
    expect(cookie).toContain(`max-age=${60 * 60 * 24 * 365}`);
  });

  // Dev is served over http, so an unconditional `secure` would mean the preference never
  // persists locally and the flash it exists to prevent shows up only in production.
  it('adds secure on https and omits it on http', () => {
    expect(serialiseRailCookie(true, true)).toContain('; secure');
    expect(serialiseRailCookie(true, false)).not.toContain('secure');
  });

  it('names the cookie once, for both ends', () => {
    expect(serialiseRailCookie(true, false).startsWith(`${RAIL_COOKIE_NAME}=`)).toBe(true);
  });
});

describe('rail preference — the width fallback', () => {
  /**
   * When no cookie was sent, two different mechanisms decide the same thing: the server
   * paints a `min-[1360px]:` Tailwind variant, and the client effect compares
   * `innerWidth` against this constant. They have to name the same number or the frame
   * the breakpoint paints is not the one the effect resolves to — which is the flash,
   * arriving by the other door.
   *
   * ⛔ Tailwind cannot read a JS constant, so the literal in the class is unavoidable and
   * this is the only thing holding the two in step.
   */
  it('agrees with the breakpoint the unresolved frame is painted with', async () => {
    const source = await readFile(
      new URL(
        '../../app/target-sources/[targetSourceId]/_components/common/GuidePanel.tsx',
        import.meta.url,
      ),
      'utf8',
    );

    expect(RAIL_OPEN_MIN_WIDTH).toBe(1360);
    expect(source).toContain(`min-[${RAIL_OPEN_MIN_WIDTH}px]:`);
  });
});
