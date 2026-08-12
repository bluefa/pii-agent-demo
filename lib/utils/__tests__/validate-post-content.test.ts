/**
 * Tests for post body validation — the ko/en pair and the per-post limits.
 *
 * Coverage buckets:
 *  - image allow-list gating   (guides reject <img>, posts accept it)
 *  - image src prefix          (storage host only)
 *  - image attributes          (width/height parsing, style/class rejected)
 *  - image-only body           (counts as content, not EMPTY_CONTENT)
 *  - per-post image count      (ko+en combined, duplicate URLs counted once)
 *  - per-post byte total       (same combining rules)
 *  - both languages reported   (one bad language does not mask the other)
 */

import { describe, expect, it } from 'vitest';

import { validateGuideHtml } from '@/lib/utils/validate-guide-html';
import {
  POST_MAX_IMAGES,
  POST_MAX_TOTAL_BYTES,
  validatePostContent,
} from '@/lib/utils/validate-post-content';

const HOST = 'https://storage.example.com/pass/posts/';
const PREFIXES = [HOST];

const img = (n: number) => `<p><img src="${HOST}${n}.png" alt="shot ${n}" /></p>`;

const run = (ko: string, en: string, bytes?: ReadonlyMap<string, number>) =>
  validatePostContent({
    contents: { ko, en },
    imageSrcPrefixes: PREFIXES,
    imageBytesByUrl: bytes,
  });

const codesOf = (result: ReturnType<typeof run>) =>
  result.valid ? [] : result.errors.map((e) => e.code);

// ---------------------------------------------------------------------------
// Allow-list gating
// ---------------------------------------------------------------------------

describe('image allow-list is opt-in', () => {
  it('rejects <img> when the caller does not opt in — guides stay text-only', () => {
    const res = validateGuideHtml(`<p>본문</p>${img(1)}`);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.errors.map((e) => e.code)).toContain('DISALLOWED_TAG');
  });

  it('accepts <img> when the caller opts in', () => {
    const res = validateGuideHtml(`<p>본문</p>${img(1)}`, {
      allowImages: true,
      imageSrcPrefixes: PREFIXES,
    });
    expect(res.valid).toBe(true);
  });

  it('rejects every image when the prefix list is empty', () => {
    const res = validateGuideHtml(img(1), { allowImages: true, imageSrcPrefixes: [] });
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.errors.map((e) => e.code)).toContain('INVALID_IMAGE_SRC');
  });
});

describe('image src must come from the upload host', () => {
  it.each([
    'https://evil.example.com/a.png',
    'http://storage.example.com/pass/posts/1.png',
    'data:image/png;base64,iVBORw0KGgo=',
    '//storage.example.com/pass/posts/1.png',
  ])('rejects %s', (src) => {
    const res = validateGuideHtml(`<p><img src="${src}" alt="x" /></p>`, {
      allowImages: true,
      imageSrcPrefixes: PREFIXES,
    });
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.errors.map((e) => e.code)).toContain('INVALID_IMAGE_SRC');
  });
});

describe('image attributes', () => {
  const parse = (html: string) =>
    validateGuideHtml(html, { allowImages: true, imageSrcPrefixes: PREFIXES });

  it('keeps width/height as numbers', () => {
    const res = parse(`<p><img src="${HOST}1.png" alt="a" width="320" height="180" /></p>`);
    expect(res.valid).toBe(true);
    if (!res.valid) return;
    const p = res.ast.find((n) => n.type === 'p');
    expect(p && p.type === 'p' && p.children[0]).toMatchObject({
      type: 'img',
      width: 320,
      height: 180,
    });
  });

  it.each(['0', '-5', '12.5', 'wide', ''])('drops non-positive-integer width %p', (raw) => {
    const res = parse(`<p><img src="${HOST}1.png" alt="a" width="${raw}" /></p>`);
    expect(res.valid).toBe(true);
    if (!res.valid) return;
    const p = res.ast.find((n) => n.type === 'p');
    const node = p && p.type === 'p' ? p.children[0] : undefined;
    expect(node && node.type === 'img' && node.width).toBeUndefined();
  });

  it('defaults a missing alt to an empty string rather than dropping the node', () => {
    const res = parse(`<p><img src="${HOST}1.png" /></p>`);
    expect(res.valid).toBe(true);
    if (!res.valid) return;
    const p = res.ast.find((n) => n.type === 'p');
    expect(p && p.type === 'p' && p.children[0]).toMatchObject({ type: 'img', alt: '' });
  });

  it.each(['class="big"', 'style="float:left"', 'align="left"'])(
    'rejects the styling attribute %s',
    (attr) => {
      const res = parse(`<p><img src="${HOST}1.png" alt="a" ${attr} /></p>`);
      expect(res.valid).toBe(false);
      if (res.valid) return;
      expect(res.errors.map((e) => e.code)).toContain('DISALLOWED_ATTRIBUTE');
    },
  );
});

describe('an image alone is content', () => {
  it('does not report EMPTY_CONTENT for a body that is only an image', () => {
    const res = validateGuideHtml(img(1), {
      allowImages: true,
      imageSrcPrefixes: PREFIXES,
    });
    expect(res.valid).toBe(true);
  });

  it('still reports EMPTY_CONTENT for markup with neither text nor image', () => {
    const res = validateGuideHtml('<p></p><p>   </p>', {
      allowImages: true,
      imageSrcPrefixes: PREFIXES,
    });
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.errors.map((e) => e.code)).toContain('EMPTY_CONTENT');
  });
});

// ---------------------------------------------------------------------------
// Per-post limits
// ---------------------------------------------------------------------------

describe('image count is per post, not per language', () => {
  it('accepts exactly the limit split across ko and en', () => {
    const half = POST_MAX_IMAGES / 2;
    const ko = Array.from({ length: half }, (_, i) => img(i)).join('');
    const en = Array.from({ length: half }, (_, i) => img(i + half)).join('');
    const res = run(ko, en);
    expect(res.valid).toBe(true);
    expect(res.usage.imageCount).toBe(POST_MAX_IMAGES);
  });

  it('rejects one image over the limit', () => {
    const ko = Array.from({ length: POST_MAX_IMAGES + 1 }, (_, i) => img(i)).join('');
    const res = run(ko, '<p>en</p>');
    expect(codesOf(res)).toContain('POST_IMAGE_LIMIT_EXCEEDED');
    expect(res.usage.imageCount).toBe(POST_MAX_IMAGES + 1);
  });

  it('counts a URL used in both languages once — storage holds one file', () => {
    const shared = Array.from({ length: POST_MAX_IMAGES }, (_, i) => img(i)).join('');
    const res = run(shared, shared);
    expect(res.valid).toBe(true);
    expect(res.usage.imageCount).toBe(POST_MAX_IMAGES);
  });

  it('counts a URL repeated within one language once', () => {
    const res = run(img(1) + img(1) + img(1), '<p>en</p>');
    expect(res.usage.imageCount).toBe(1);
  });
});

describe('byte total is per post', () => {
  const sized = (entries: [number, number][]) =>
    new Map(entries.map(([n, bytes]) => [`${HOST}${n}.png`, bytes]));

  it('sums distinct images across both languages', () => {
    const res = run(img(1) + img(2), img(3), sized([[1, 1_000], [2, 2_000], [3, 3_000]]));
    expect(res.valid).toBe(true);
    expect(res.usage.totalBytes).toBe(6_000);
  });

  it('does not double-count a URL shared by both languages', () => {
    const bytes = sized([[1, 4_000]]);
    expect(run(img(1), img(1), bytes).usage.totalBytes).toBe(4_000);
  });

  it('rejects one byte over the limit', () => {
    const res = run(img(1), '<p>en</p>', sized([[1, POST_MAX_TOTAL_BYTES + 1]]));
    expect(codesOf(res)).toContain('POST_SIZE_LIMIT_EXCEEDED');
  });

  it('accepts exactly the limit', () => {
    const res = run(img(1), '<p>en</p>', sized([[1, POST_MAX_TOTAL_BYTES]]));
    expect(res.valid).toBe(true);
  });

  it('treats an unknown URL as zero bytes — the server owns the real sizes', () => {
    const res = run(img(1), '<p>en</p>');
    expect(res.valid).toBe(true);
    expect(res.usage.totalBytes).toBe(0);
  });

  it('reports count and size together when both are exceeded', () => {
    const many = Array.from({ length: POST_MAX_IMAGES + 1 }, (_, i) => img(i)).join('');
    const bytes = new Map([[`${HOST}0.png`, POST_MAX_TOTAL_BYTES + 1]]);
    expect(codesOf(run(many, '<p>en</p>', bytes))).toEqual(
      expect.arrayContaining(['POST_IMAGE_LIMIT_EXCEEDED', 'POST_SIZE_LIMIT_EXCEEDED']),
    );
  });
});

describe('both languages are validated', () => {
  it('reports a failure in each language separately', () => {
    const res = run('<p><script>x</script></p>', '<p></p>');
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.errors.filter((e) => e.code === 'POST_CONTENT_INVALID').map((e) => e.lang)).toEqual([
      'ko',
      'en',
    ]);
  });

  it('still reports usage when a language fails to validate', () => {
    const res = run(img(1) + '<p><script>x</script></p>', img(2));
    expect(res.valid).toBe(false);
    // ko failed to parse cleanly, so only en's image is counted.
    expect(res.usage.imageCount).toBe(1);
  });
});
