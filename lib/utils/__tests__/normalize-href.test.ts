/**
 * Tests for the editor's href repair (`normalizeHref`).
 *
 * The whole point of this function is what it does NOT touch. Prefixing an
 * input that already declares its own scheme — or that starts with `/` —
 * turns the allow-list from a gate into a rewrite, so every "rejected" case
 * below is a case where a bug would have produced a link that passes.
 */

import { describe, expect, it } from 'vitest';
import { isAllowedHref, normalizeHref } from '@/lib/utils/validate-guide-html';

/** What the editor actually does: repair, then judge. */
const accepts = (raw: string): string | null => {
  const href = normalizeHref(raw);
  return isAllowedHref(href) ? href : null;
};

describe('normalizeHref', () => {
  it('adds the scheme a person left off', () => {
    expect(accepts('example.com/release-notes')).toBe('https://example.com/release-notes');
    expect(accepts('  example.com  ')).toBe('https://example.com');
  });

  it('reads a bare mail address as mailto:', () => {
    expect(accepts('someone@example.com')).toBe('mailto:someone@example.com');
  });

  it('leaves an already-valid href alone', () => {
    expect(accepts('https://example.com')).toBe('https://example.com');
    expect(accepts('http://example.com')).toBe('http://example.com');
    expect(accepts('mailto:someone@example.com')).toBe('mailto:someone@example.com');
    expect(accepts('/services')).toBe('/services');
  });

  it('refuses a protocol-relative host instead of repairing it', () => {
    // https:////evil.example.com would pass isAllowedHref — the repair must not run.
    expect(normalizeHref('//evil.example.com')).toBe('//evil.example.com');
    expect(accepts('//evil.example.com')).toBeNull();
  });

  it('refuses a disallowed scheme instead of repairing it', () => {
    for (const raw of ['javascript:void 0', 'data:text/html,x', 'ftp://host/file', 'file:///etc/passwd']) {
      expect(normalizeHref(raw)).toBe(raw);
      expect(accepts(raw)).toBeNull();
    }
  });

  it('leaves an empty value empty', () => {
    expect(normalizeHref('   ')).toBe('');
    expect(accepts('   ')).toBeNull();
  });
});
