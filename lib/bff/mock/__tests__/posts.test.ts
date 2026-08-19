/**
 * FAQ & Notices mock store — the rules from the tag guide that a screen
 * cannot check for itself.
 *
 * The store hangs off `globalThis` (not the module), so `vi.resetModules()`
 * alone does NOT reset it — each test also clears the global slot to start
 * from the seed. The module reset is still needed for its own reason: it
 * keeps the BffError class identity consistent inside one test (see
 * `asBffError`).
 */

import { describe, expect, it, vi } from 'vitest';

type MockPosts = typeof import('@/lib/bff/mock/posts')['mockPosts'];

const freshStore = async (): Promise<MockPosts> => {
  vi.resetModules();
  globalThis.__piiAgentPostsMock = undefined;
  return (await import('@/lib/bff/mock/posts')).mockPosts;
};

/** Byte buffer of a given size — the MIME string is what the type check reads. */
const pngBytes = (size = 64): Uint8Array<ArrayBuffer> => new Uint8Array(new ArrayBuffer(size));

/**
 * A buffer no other `distinctBytes` call produces. The save folds identical
 * bytes into one file, so tests that need N separate files must not hand it
 * N identical buffers.
 */
const distinctBytes = (seed: number, size = 64): Uint8Array<ArrayBuffer> => {
  const bytes = pngBytes(size);
  bytes[0] = seed % 256;
  bytes[1] = Math.floor(seed / 256) % 256;
  return bytes;
};

/** A `files` part as the route hands it to the store: filename is the cid key. */
const part = (
  key: string,
  bytes: Uint8Array<ArrayBuffer> = pngBytes(),
  contentType = 'image/png',
) => ({ key, bytes, contentType });

const cidTag = (key: string) => `<p><img src="cid:${key}" alt="i" /></p>`;

/**
 * Asserts the thrown value is a BffError by shape, not by `instanceof`:
 * `vi.resetModules()` re-imports `lib/bff/errors` for the store under test, so
 * the class the store throws is not the class this file imported.
 */
const asBffError = (error: unknown): { status: number; code: string } => {
  expect(error).toMatchObject({ name: 'BffError' });
  return error as { status: number; code: string };
};

describe('sorting', () => {
  it('puts every pinned post above every unpinned one, newest first inside each group', async () => {
    const posts = await freshStore();
    const list = await posts.list();

    const pinnedCount = list.filter((post) => post.pinned).length;
    // The two groups must not interleave.
    expect(list.slice(0, pinnedCount).every((post) => post.pinned)).toBe(true);
    expect(list.slice(pinnedCount).every((post) => !post.pinned)).toBe(true);

    const dates = (group: typeof list) => group.map((post) => post.publishedAt);
    const desc = (values: string[]) => [...values].sort().reverse();
    expect(dates(list.slice(0, pinnedCount))).toEqual(desc(dates(list.slice(0, pinnedCount))));
    expect(dates(list.slice(pinnedCount))).toEqual(desc(dates(list.slice(pinnedCount))));
  });

  it('ranks a pinned older post above an unpinned newer one (§5 worked example)', async () => {
    const posts = await freshStore();
    const list = await posts.list();

    // FAQ A 08-12 pinned, 공지 B 08-10 pinned, FAQ C 08-11 plain, 공지 D 08-09 plain.
    const pinnedOlder = list.find((post) => post.pinned && post.publishedAt.startsWith('2026-08-10'));
    const plainNewer = list.find((post) => !post.pinned && post.publishedAt.startsWith('2026-08-11'));
    expect(pinnedOlder).toBeDefined();
    expect(plainNewer).toBeDefined();
    expect(list.indexOf(pinnedOlder!)).toBeLessThan(list.indexOf(plainNewer!));
  });
});

describe('hidden posts', () => {
  it('never appears in the user list but stays in the admin list', async () => {
    const posts = await freshStore();
    const userIds = (await posts.list()).map((post) => post.id);
    const adminIds = (await posts.listAdmin()).map((post) => post.id);

    const hiddenIds = (await posts.listAdmin())
      .filter((post) => post.hidden)
      .map((post) => post.id);

    expect(hiddenIds.length).toBeGreaterThan(0);
    for (const id of hiddenIds) {
      expect(userIds).not.toContain(id);
      expect(adminIds).toContain(id);
    }
  });

  it('answers 404 on direct read, not 403 — 403 would confirm it exists', async () => {
    const posts = await freshStore();
    const hidden = (await posts.listAdmin()).find((post) => post.hidden)!;

    const error = asBffError(await posts.get(hidden.id).catch((cause: unknown) => cause));
    expect(error.status).toBe(404);
    expect(error.code).toBe('POST_NOT_FOUND');
  });

  it('is idempotent — hiding an already hidden post is not an error', async () => {
    const posts = await freshStore();
    const hidden = (await posts.listAdmin()).find((post) => post.hidden)!;

    const again = await posts.setHidden(hidden.id, true);
    expect(again.hidden).toBe(true);
  });

  it('restores into the user list', async () => {
    const posts = await freshStore();
    const hidden = (await posts.listAdmin()).find((post) => post.hidden)!;

    await posts.setHidden(hidden.id, false);
    expect((await posts.list()).map((post) => post.id)).toContain(hidden.id);
  });
});

describe('update', () => {
  it('moves updatedAt but never publishedAt', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const after = await posts.update(1, {
      categoryId: before.categoryId,
      titles: before.titles,
      contents: before.contents,
    }, []);

    expect(after.publishedAt).toBe(before.publishedAt);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });

  it('empties the category when categoryId is omitted — PUT is not a patch', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);
    expect(before.categoryId).not.toBeNull();

    const after = await posts.update(1, { titles: before.titles, contents: before.contents }, []);
    expect(after.categoryId).toBeNull();
  });

  it('rejects a body whose one language is blank', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const error = asBffError(
      await posts
        .update(1, { titles: before.titles, contents: { ko: before.contents.ko, en: '  ' } }, [])
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('VALIDATION_FAILED');
  });
});

describe('body images — the save request settles everything (handoff §3.3)', () => {
  it('stores a cid-referenced part and rewrites the body to its URL', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const saved = await posts.update(1, {
      titles: before.titles,
      contents: { ko: cidTag('imgkey01'), en: before.contents.en },
    }, [part('imgkey01')]);

    // The stored body never contains cid: — it left as the real URL.
    expect(saved.contents.ko).toContain('/pass/api/v1/admin/posts/images/');
    expect(saved.contents.ko).not.toContain('cid:');
    expect(saved.images).toEqual([
      { url: expect.stringContaining('/admin/posts/images/'), bytes: 64 },
    ]);
    expect(posts.readImage(saved.images[0].url.split('/').pop()!)).not.toBeNull();
  });

  it('rejects a cid the parts do not carry — a broken image must not be stored', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const error = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: { ko: cidTag('imgkey01'), en: before.contents.en },
        }, [])
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('POST_IMAGE_REF_MISSING');
  });

  it('rejects a part no body references — a silent frontend bug otherwise', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const error = asBffError(
      await posts
        .update(1, { titles: before.titles, contents: before.contents }, [part('imgkey01')])
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('POST_IMAGE_UNREFERENCED');
  });

  it('rejects a URL this post does not own, and a new post owns nothing (§10.4)', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);
    const foreign = '<p><img src="/pass/api/v1/admin/posts/images/ghost.png" alt="x" /></p>';

    const updateError = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: { ko: foreign, en: before.contents.en },
        }, [])
        .catch((cause: unknown) => cause),
    );
    expect(updateError.code).toBe('POST_IMAGE_REF_UNKNOWN');

    const createError = asBffError(
      await posts
        .create({
          type: 'FAQ',
          titles: before.titles,
          contents: { ko: foreign, en: before.contents.en },
        }, [])
        .catch((cause: unknown) => cause),
    );
    expect(createError.code).toBe('POST_IMAGE_REF_UNKNOWN');
  });

  it('rejects a body image whose src passes no allowed prefix', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const error = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: {
            ko: '<p><img src="https://evil.example.com/a.png" alt="x" /></p>',
            en: before.contents.en,
          },
        }, [])
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('POST_CONTENT_INVALID');
  });

  it('rejects a part outside png / jpeg / webp', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const error = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: { ko: cidTag('imgkey01'), en: before.contents.en },
        }, [part('imgkey01', pngBytes(), 'image/gif')])
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('UNSUPPORTED_IMAGE_TYPE');
  });

  it('rejects a part over 5MB', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const error = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: { ko: cidTag('imgkey01'), en: before.contents.en },
        }, [part('imgkey01', pngBytes(5 * 1024 * 1024 + 1))])
        .catch((cause: unknown) => cause),
    );
    expect(error.status).toBe(413);
    expect(error.code).toBe('IMAGE_TOO_LARGE');
  });

  it('caps a post at 10 images counted across ko and en together', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const keys = Array.from({ length: 11 }, (_, index) => `imgkey${String(index).padStart(2, '0')}`);
    const parts = keys.map((key, index) => part(key, distinctBytes(index)));

    // 6 in ko + 5 in en = 11 for the post, though neither language alone is over.
    const error = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: {
            ko: keys.slice(0, 6).map(cidTag).join(''),
            en: keys.slice(6).map(cidTag).join(''),
          },
        }, parts)
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('POST_IMAGE_LIMIT_EXCEEDED');
  });

  it('caps a post at 10MB even when every file is under the 5MB per-file cap', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const keys = ['imgkey01', 'imgkey02', 'imgkey03'];
    const parts = keys.map((key, index) => part(key, distinctBytes(index, 4 * 1024 * 1024)));

    const error = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: { ko: keys.map(cidTag).join(''), en: before.contents.en },
        }, parts)
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('POST_SIZE_LIMIT_EXCEEDED');
  });

  it('folds identical bytes into one file — ko and en share one screenshot', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    // The bilingual flow inserts the same picture twice under two keys; the
    // save must not spend two slots or store the bytes twice.
    const saved = await posts.update(1, {
      titles: before.titles,
      contents: { ko: cidTag('imgkey01'), en: cidTag('imgkey02') },
    }, [part('imgkey01', pngBytes(2048)), part('imgkey02', pngBytes(2048))]);

    expect(saved.images).toHaveLength(1);
    const url = saved.images[0].url;
    expect(saved.contents.ko).toContain(url);
    expect(saved.contents.en).toContain(url);
  });

  it('deletes an owned file the new body dropped — the save IS the cleanup', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const withImage = await posts.update(1, {
      titles: before.titles,
      contents: { ko: cidTag('imgkey01'), en: before.contents.en },
    }, [part('imgkey01')]);
    const imageId = withImage.images[0].url.split('/').pop()!;
    expect(posts.readImage(imageId)).not.toBeNull();

    const without = await posts.update(1, {
      titles: before.titles,
      contents: before.contents,
    }, []);
    expect(without.images).toEqual([]);
    expect(posts.readImage(imageId)).toBeNull();
  });

  it('keeps an owned file the body still references, without resending bytes', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const first = await posts.update(1, {
      titles: before.titles,
      contents: { ko: cidTag('imgkey01'), en: before.contents.en },
    }, [part('imgkey01')]);
    const url = first.images[0].url;

    // The edit round-trip: the stored body (with the real URL) goes back out.
    const second = await posts.update(1, {
      titles: first.titles,
      contents: first.contents,
    }, []);
    expect(second.images).toEqual(first.images);
    expect(posts.readImage(url.split('/').pop()!)).not.toBeNull();
  });
});

describe('categories', () => {
  it('scopes names to a type — FAQ and Notice may hold the same name', async () => {
    const posts = await freshStore();

    await posts.createCategory({ type: 'NOTICE', name: '공통' });
    await expect(posts.createCategory({ type: 'FAQ', name: '공통' })).resolves.toBeDefined();
  });

  it('rejects a duplicate name inside one type', async () => {
    const posts = await freshStore();

    await posts.createCategory({ type: 'NOTICE', name: '중복' });
    const error = asBffError(
      await posts.createCategory({ type: 'NOTICE', name: '중복' }).catch((cause: unknown) => cause),
    );
    expect(error.status).toBe(409);
    expect(error.code).toBe('CATEGORY_NAME_DUPLICATED');
  });

  it('refuses deletion while posts remain, counting hidden posts too', async () => {
    const posts = await freshStore();
    const used = (await posts.listAdminCategories()).find((category) => category.postCount > 0)!;

    // Hide every post in the category — that must NOT unlock deletion.
    for (const post of await posts.listAdmin()) {
      if (post.categoryId === used.id) await posts.setHidden(post.id, true);
    }

    const error = asBffError(await posts.deleteCategory(used.id).catch((cause: unknown) => cause));
    expect(error.status).toBe(409);
    expect(error.code).toBe('CATEGORY_IN_USE');
  });

  it('deletes an empty category', async () => {
    const posts = await freshStore();
    const created = await posts.createCategory({ type: 'FAQ', name: '빈 카테고리' });

    await expect(posts.deleteCategory(created.id)).resolves.toBeUndefined();
  });
});
