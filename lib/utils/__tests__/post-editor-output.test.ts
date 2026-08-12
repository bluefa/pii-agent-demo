/**
 * The editor writes the body; the allow-list decides whether it can be saved.
 * Those are two independent pieces of code, and nothing in the type system
 * connects them — so these lock the shapes Tiptap's `getHTML()` actually
 * produces against the validator.
 *
 * The samples below are the literal output of the configured editor, not
 * hand-written HTML: Tiptap wraps list item text in `<p>`, and its Link
 * extension adds `target`/`rel` on its own. Both looked like allow-list
 * violations until checked.
 *
 * If the editor's extension set changes, these are what catch a body that
 * writes fine and then refuses to save.
 */

import { describe, expect, it } from 'vitest';

import { validatePostContent } from '@/lib/utils/validate-post-content';

const IMAGE_PREFIX = '/pass/api/v1/admin/posts/images/';

/** Both languages carry the same sample — the validator checks each. */
const validate = (html: string) =>
  validatePostContent({
    contents: { ko: html, en: html },
    imageSrcPrefixes: [IMAGE_PREFIX],
  });

describe('editor output is savable', () => {
  it.each([
    ['paragraph', '<p>본문 한 줄</p>'],
    ['bold and italic', '<p><strong>굵게</strong> 그리고 <em>기울임</em></p>'],
    ['inline code', '<p><code>npm run dev</code></p>'],
    ['h4 heading', '<h4>소제목</h4><p>본문</p>'],
    ['hard break', '<p>첫 줄<br>둘째 줄</p>'],
    // Tiptap wraps list item content in a paragraph.
    ['bullet list', '<ul><li><p>하나</p></li><li><p>둘</p></li></ul>'],
    ['ordered list', '<ol><li><p>하나</p></li></ol>'],
    // The Link extension supplies target and rel itself.
    [
      'link with tiptap defaults',
      '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">링크</a></p>',
    ],
    ['site-relative link', '<p><a href="/pass/services">서비스 목록</a></p>'],
    ['image node', `<img src="${IMAGE_PREFIX}mock-1.png" alt="스크린샷">`],
    [
      'image with intrinsic size',
      `<p>앞</p><img src="${IMAGE_PREFIX}mock-1.png" alt="x" width="240" height="240"><p>뒤</p>`,
    ],
  ])('accepts %s', (_label, html) => {
    expect(validate(html).valid).toBe(true);
  });

  it('rejects the empty document Tiptap starts with', () => {
    // `<p></p>` is what an untouched editor returns. It must not save as a
    // post body — a blank side of a bilingual post is exactly what the
    // required-both-languages rule exists to stop.
    const result = validate('<p></p>');
    expect(result.valid).toBe(false);
  });

  it('still rejects a tag the toolbar cannot produce', () => {
    // The toolbar offers no blockquote, but a paste could carry one, so the
    // validator stays the gate rather than trusting the editor's restraint.
    expect(validate('<blockquote><p>인용</p></blockquote>').valid).toBe(false);
  });

  it('still rejects an image from outside the upload host', () => {
    expect(validate('<img src="https://evil.example.com/a.png" alt="x">').valid).toBe(false);
  });
});
