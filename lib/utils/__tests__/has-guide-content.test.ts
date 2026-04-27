/**
 * Tests for `hasGuideContent` — the client-side gate that prevents the
 * Guide CMS save button from POSTing markup the BFF would reject as
 * EMPTY_CONTENT. The cases mirror the empty-content tests in
 * `validate-guide-html.test.ts` so a regression in the wrapped validator
 * surfaces here too.
 */

import { describe, expect, it } from 'vitest';

import { hasGuideContent } from '@/lib/utils/has-guide-content';

describe('hasGuideContent — empty inputs (must return false)', () => {
  it('rejects empty string', () => {
    expect(hasGuideContent('')).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(hasGuideContent('   \n\t  ')).toBe(false);
  });

  it('rejects empty paragraph (Tiptap default for cleared editor)', () => {
    expect(hasGuideContent('<p></p>')).toBe(false);
  });

  it('rejects paragraph with only whitespace', () => {
    expect(hasGuideContent('<p>   </p>')).toBe(false);
  });

  it('rejects empty list item inside ul', () => {
    expect(hasGuideContent('<ul><li></li></ul>')).toBe(false);
  });
});

describe('hasGuideContent — populated inputs (must return true)', () => {
  it('accepts paragraph with text', () => {
    expect(hasGuideContent('<p>hello</p>')).toBe(true);
  });

  it('accepts inline-formatted text', () => {
    expect(hasGuideContent('<p><strong>bold</strong></p>')).toBe(true);
  });

  it('accepts text inside a list item', () => {
    expect(hasGuideContent('<ul><li>item</li></ul>')).toBe(true);
  });
});

describe('hasGuideContent — has visible text but other validation errors', () => {
  it('returns true when content has visible text but a disallowed tag', () => {
    // Defers other validity issues (DISALLOWED_TAG, INVALID_URL_SCHEME, ...)
    // to the BFF — this gate only blocks the EMPTY_CONTENT path.
    expect(hasGuideContent('<script>boom</script><p>visible</p>')).toBe(true);
  });
});
