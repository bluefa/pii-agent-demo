/**
 * FAQ & Notices mock store — the rules from the tag guide that a screen
 * cannot check for itself.
 *
 * The store is module-level, so each test re-imports it through
 * `vi.resetModules()` and starts from the seed.
 */

import { describe, expect, it, vi } from 'vitest';

type MockPosts = typeof import('@/lib/bff/mock/posts')['mockPosts'];

const freshStore = async (): Promise<MockPosts> => {
  vi.resetModules();
  return (await import('@/lib/bff/mock/posts')).mockPosts;
};

/** Byte buffer of a given size — the MIME string is what the type check reads. */
const pngBytes = (size = 64): Uint8Array<ArrayBuffer> => new Uint8Array(new ArrayBuffer(size));

/**
 * A buffer no other `distinctBytes` call produces. Upload dedupes on content,
 * so tests that need N separate files must not hand it N identical buffers.
 */
const distinctBytes = (seed: number, size = 64): Uint8Array<ArrayBuffer> => {
  const bytes = pngBytes(size);
  bytes[0] = seed % 256;
  bytes[1] = Math.floor(seed / 256) % 256;
  return bytes;
};

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
    });

    expect(after.publishedAt).toBe(before.publishedAt);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });

  it('empties the category when categoryId is omitted — PUT is not a patch', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);
    expect(before.categoryId).not.toBeNull();

    const after = await posts.update(1, { titles: before.titles, contents: before.contents });
    expect(after.categoryId).toBeNull();
  });

  it('rejects a body whose one language is blank', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const error = asBffError(
      await posts
        .update(1, { titles: before.titles, contents: { ko: before.contents.ko, en: '  ' } })
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('VALIDATION_FAILED');
  });
});

describe('body images', () => {
  it('rejects a file type outside png / jpeg / webp', async () => {
    const posts = await freshStore();

    const error = asBffError(
      await posts
        .uploadImage({ bytes: pngBytes(), contentType: 'image/gif' })
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('UNSUPPORTED_IMAGE_TYPE');
  });

  it('rejects a file over 5MB', async () => {
    const posts = await freshStore();

    const error = asBffError(
      await posts
        .uploadImage({ bytes: pngBytes(5 * 1024 * 1024 + 1), contentType: 'image/png' })
        .catch((cause: unknown) => cause),
    );
    expect(error.status).toBe(413);
    expect(error.code).toBe('IMAGE_TOO_LARGE');
  });

  it('rejects a body image whose src is not an upload URL', async () => {
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
        })
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('POST_CONTENT_INVALID');
  });

  it('caps a post at 10 images counted across ko and en together', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const uploads = [];
    for (let index = 0; index < 11; index += 1) {
      uploads.push(
        await posts.uploadImage({ bytes: distinctBytes(index), contentType: 'image/png' }),
      );
    }
    const tag = (url: string) => `<p><img src="${url}" alt="i" /></p>`;

    // 6 in ko + 5 in en = 11 for the post, though neither language alone is over.
    const error = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: {
            ko: uploads.slice(0, 6).map((upload) => tag(upload.url)).join(''),
            en: uploads.slice(6).map((upload) => tag(upload.url)).join(''),
          },
        })
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('POST_IMAGE_LIMIT_EXCEEDED');
  });

  it('returns the same URL for identical bytes — ko and en share one screenshot', async () => {
    const posts = await freshStore();

    const first = await posts.uploadImage({ bytes: pngBytes(2048), contentType: 'image/png' });
    const second = await posts.uploadImage({ bytes: pngBytes(2048), contentType: 'image/png' });

    // Without this the natural bilingual flow — insert into ko, switch tab,
    // insert into en — spends two slots and twice the bytes on one picture.
    expect(second.url).toBe(first.url);
  });

  it('still separates genuinely different files', async () => {
    const posts = await freshStore();

    const first = await posts.uploadImage({ bytes: distinctBytes(1, 2048), contentType: 'image/png' });
    const second = await posts.uploadImage({ bytes: distinctBytes(2, 2048), contentType: 'image/png' });

    expect(second.url).not.toBe(first.url);
  });

  it('counts a URL used in both languages once — storage holds one file', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const uploaded = await posts.uploadImage({ bytes: pngBytes(), contentType: 'image/png' });
    const tag = `<p><img src="${uploaded.url}" alt="i" /></p>`;

    const saved = await posts.update(1, {
      titles: before.titles,
      contents: { ko: tag, en: tag },
    });
    expect(saved.contents.ko).toContain(uploaded.url);
  });

  it('caps a post at 10MB even when every file is under the 5MB per-file cap', async () => {
    const posts = await freshStore();
    const before = await posts.getAdmin(1);

    const uploads = [];
    for (let index = 0; index < 3; index += 1) {
      uploads.push(
        await posts.uploadImage({
          bytes: distinctBytes(index, 4 * 1024 * 1024),
          contentType: 'image/png',
        }),
      );
    }

    const error = asBffError(
      await posts
        .update(1, {
          titles: before.titles,
          contents: {
            ko: uploads.map((upload) => `<p><img src="${upload.url}" alt="i" /></p>`).join(''),
            en: before.contents.en,
          },
        })
        .catch((cause: unknown) => cause),
    );
    expect(error.code).toBe('POST_SIZE_LIMIT_EXCEEDED');
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
