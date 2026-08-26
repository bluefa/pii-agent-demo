import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALES,
  parseLocaleCookie,
  serialiseLocaleCookie,
} from '@/lib/locale';

/**
 * Same shape as `rail-preference.test.ts`: the client writes, the server reads, and a
 * disagreement raises no error — the page just paints the default language.
 */
const valueOf = (cookie: string) => cookie.split(';')[0]?.split('=')[1];

describe('locale — the cookie survives its own round trip', () => {
  it.each(LOCALES)('reads back exactly what it wrote — %s', (locale) => {
    expect(parseLocaleCookie(valueOf(serialiseLocaleCookie(locale, false)))).toBe(locale);
  });
});

describe('locale — anything else means the default', () => {
  // ⛔ Not coerced. An unknown value is the default, never a third language.
  it.each([
    ['absent', undefined],
    ['explicitly null', null],
    ['cleared', ''],
    ['a region tag', 'ko-KR'],
    ['upper case', 'EN'],
    ['whitespace', ' ko'],
    ['unknown', 'ja'],
  ])('resolves %s to the default', (_name, raw) => {
    expect(parseLocaleCookie(raw)).toBe(DEFAULT_LOCALE);
  });
});

describe('locale — the cookie outlives the visit', () => {
  it('scopes to the whole app and survives the session', () => {
    const cookie = serialiseLocaleCookie('en', false);
    expect(cookie.startsWith(`${LOCALE_COOKIE_NAME}=`)).toBe(true);
    expect(cookie).toContain('path=/');
    expect(cookie).toContain('samesite=lax');
    expect(cookie).toContain(`max-age=${60 * 60 * 24 * 365}`);
  });

  it('adds secure on https and omits it on http', () => {
    expect(serialiseLocaleCookie('en', true)).toContain('; secure');
    expect(serialiseLocaleCookie('en', false)).not.toContain('secure');
  });
});
