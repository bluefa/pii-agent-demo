/**
 * Tests for the Guide CMS mock namespace.
 *
 * Spec: docs/reports/guide-cms/spec.md §4 + §4.5 (drift).
 *
 * Coverage:
 *  - GET  valid seeded name
 *  - GET  invalid name → 404 problem+json
 *  - GET  drift (valid name, store cleared via __reset) → 200 + empty + epoch
 *  - PUT  valid ko + en
 *  - PUT  invalid name → 404 problem+json
 *  - PUT  non-object body → 400 VALIDATION_FAILED
 *  - PUT  body missing contents → 400 VALIDATION_FAILED
 *  - PUT  ko empty → 400 GUIDE_CONTENT_INVALID + errors.ko EMPTY_CONTENT
 *  - PUT  ko has <script> → 400 GUIDE_CONTENT_INVALID + errors.ko DISALLOWED_TAG
 *  - PUT  both ko and en valid HTML → 200 with fresh updatedAt
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockGuideStore, mockGuides } from '@/lib/bff/mock/guides';
import type { GuideDetail } from '@/lib/types/guide';
import type { ValidationError } from '@/lib/utils/validate-guide-html';

interface ProblemBody {
  code: string;
  status: number;
  title: string;
  detail: string;
  type: string;
  retriable: boolean;
  requestId: string;
  errors?: { ko?: ValidationError[]; en?: ValidationError[] };
}

const VALID_HTML_KO = '<h4>제목</h4><p>본문</p>';
const VALID_HTML_EN = '<h4>Title</h4><p>Body</p>';

beforeEach(() => {
  __resetMockGuideStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe('mockGuides.get', () => {
  it('returns 200 + GuideDetail for a valid seeded name', async () => {
    const res = await mockGuides.get('AZURE_APPLYING');
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDetail;
    expect(body.name).toBe('AZURE_APPLYING');
    expect(typeof body.contents.ko).toBe('string');
    expect(body.contents.ko.length).toBeGreaterThan(0);
    expect(body.contents.en).toBe('');
    expect(body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns 404 GUIDE_NOT_FOUND with application/problem+json for an invalid name', async () => {
    const res = await mockGuides.get('NOT_A_NAME');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type') ?? '').toContain('application/problem+json');
    const body = (await res.json()) as ProblemBody;
    expect(body.code).toBe('GUIDE_NOT_FOUND');
    expect(body.status).toBe(404);
    expect(body.retriable).toBe(false);
    expect(body.type).toContain('GUIDE_NOT_FOUND');
  });

  it('drift: valid name with empty store seeds empty contents (200) and warns', async () => {
    // `__reset` cleared both the store and the seeded flag. The next
    // get() should re-seed from guides-seed.ts, so to produce a drift
    // we seed, then clear the store but leave seeded=true by calling
    // get() once first. Easiest: call get, clear only the store entry,
    // call again.
    await mockGuides.get('AWS_TARGET_CONFIRM');
    // Monkey-trigger drift by monkey-patching: the simplest way to
    // force the empty path is to request a guide that was skipped
    // during seed. Our seed always covers all 22 names, so instead we
    // verify the drift branch works in isolation by resetting the seed
    // while leaving the "already seeded" flag alone — we reset then
    // call with a name our guides-seed.ts intentionally omits. Since
    // the seed is exhaustive, we instead assert the epoch + warn on a
    // deliberate drift: pre-populate guides-seed with an exception is
    // out of scope, so simulate drift by mutating through the reset +
    // a second call path. We call __reset, then invoke get which seeds
    // everything; then we clear just one entry by deleting via a
    // re-reset and asserting the re-seed path restores it (not drift).
    //
    // To exercise the true drift branch we read the private module
    // and clear the store only (not the `seeded` flag) — because the
    // public API doesn't expose that surgical reset, we replicate by
    // spying on console.warn and removing the stored entry through the
    // exported reset + selective re-seed trick: reset fully, then call
    // get() once to populate via seed, then call __resetMockGuideStore
    // on a second entry to keep one empty. This isn't possible with
    // the current public API, so we just confirm that an unseeded name
    // would take the drift path by replacing the seed module at module
    // boundary. Instead, cover drift semantics directly below.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Simulate a drift by reaching into the module: the mock file
    // exports __resetMockGuideStore so tests can force the empty path.
    // After reset, seeded flag flips, and the next get() re-seeds
    // BEFORE returning — so the store will always have the entry.
    // The drift path only triggers if the seed file itself lacks a
    // name. Our guides-seed.ts covers all 22, making this branch
    // unreachable in steady state. We still assert the branch here by
    // temporarily mocking the seed to omit one name.
    vi.resetModules();
    vi.doMock('@/lib/bff/mock/guides-seed', () => ({ guidesSeed: {} }));
    const fresh = await import('@/lib/bff/mock/guides');
    fresh.__resetMockGuideStore();
    const res = await fresh.mockGuides.get('AWS_TARGET_CONFIRM');
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDetail;
    expect(body.contents).toEqual({ ko: '', en: '' });
    expect(body.updatedAt).toBe('1970-01-01T00:00:00Z');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('drift'));
    vi.doUnmock('@/lib/bff/mock/guides-seed');
  });
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

describe('mockGuides.put', () => {
  it('returns 200 + GuideDetail with a fresh updatedAt on valid body', async () => {
    const before = Date.now();
    const res = await mockGuides.put('AWS_APPLYING', {
      contents: { ko: VALID_HTML_KO, en: VALID_HTML_EN },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDetail;
    expect(body.name).toBe('AWS_APPLYING');
    expect(body.contents).toEqual({ ko: VALID_HTML_KO, en: VALID_HTML_EN });
    const savedAt = Date.parse(body.updatedAt);
    expect(Number.isFinite(savedAt)).toBe(true);
    expect(savedAt).toBeGreaterThanOrEqual(before);

    // Round-trip: subsequent GET returns the saved value.
    const roundtrip = await mockGuides.get('AWS_APPLYING');
    const rtBody = (await roundtrip.json()) as GuideDetail;
    expect(rtBody.contents).toEqual({ ko: VALID_HTML_KO, en: VALID_HTML_EN });
  });

  it('returns 404 GUIDE_NOT_FOUND for an invalid name', async () => {
    const res = await mockGuides.put('NOPE', {
      contents: { ko: VALID_HTML_KO, en: VALID_HTML_EN },
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type') ?? '').toContain('application/problem+json');
    const body = (await res.json()) as ProblemBody;
    expect(body.code).toBe('GUIDE_NOT_FOUND');
  });

  it('returns 400 VALIDATION_FAILED when body is not an object', async () => {
    const res = await mockGuides.put('AWS_APPLYING', null);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type') ?? '').toContain('application/problem+json');
    const body = (await res.json()) as ProblemBody;
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 VALIDATION_FAILED when body is missing contents', async () => {
    const res = await mockGuides.put('AWS_APPLYING', { foo: 'bar' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ProblemBody;
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 GUIDE_CONTENT_INVALID with errors.ko EMPTY_CONTENT when ko is empty', async () => {
    const res = await mockGuides.put('AWS_APPLYING', {
      contents: { ko: '', en: VALID_HTML_EN },
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type') ?? '').toContain('application/problem+json');
    const body = (await res.json()) as ProblemBody;
    expect(body.code).toBe('GUIDE_CONTENT_INVALID');
    expect(body.errors?.ko?.some((e) => e.code === 'EMPTY_CONTENT')).toBe(true);
    expect(body.errors?.en).toBeUndefined();
  });

  it('returns 400 GUIDE_CONTENT_INVALID with errors.ko DISALLOWED_TAG when ko has <script>', async () => {
    const res = await mockGuides.put('AWS_APPLYING', {
      contents: {
        ko: '<h4>t</h4><p>x</p><script>alert(1)</script>',
        en: VALID_HTML_EN,
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ProblemBody;
    expect(body.code).toBe('GUIDE_CONTENT_INVALID');
    expect(body.errors?.ko?.some((e) => e.code === 'DISALLOWED_TAG')).toBe(true);
  });

  it('returns 400 GUIDE_CONTENT_INVALID with errors for BOTH ko and en when both fail', async () => {
    const res = await mockGuides.put('AWS_APPLYING', {
      contents: { ko: '', en: '<iframe></iframe>' },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ProblemBody;
    expect(body.code).toBe('GUIDE_CONTENT_INVALID');
    expect(body.errors?.ko).toBeDefined();
    expect(body.errors?.en).toBeDefined();
  });

  it('accepts both ko + en with allowed inline formatting', async () => {
    const res = await mockGuides.put('GCP_INSTALLING', {
      contents: {
        ko: '<h4>제목</h4><p><strong>굵게</strong>와 <em>기울임</em></p><ul><li>항목</li></ul>',
        en: '<h4>Title</h4><p>Body with <code>inline code</code></p>',
      },
    });
    expect(res.status).toBe(200);
  });

  it('rejects a non-object body that is actually an array', async () => {
    const res = await mockGuides.put('AWS_APPLYING', [] as unknown);
    // Arrays are typeof 'object' with non-null, but lack contents.ko/en
    // strings — should fall through to VALIDATION_FAILED.
    expect(res.status).toBe(400);
    const body = (await res.json()) as ProblemBody;
    expect(body.code).toBe('VALIDATION_FAILED');
  });
});
