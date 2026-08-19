/**
 * FAQ & Notices — mock namespace.
 *
 * Spec: docs/bff-api/tag-guides/faq-notices.md.
 *
 * Unlike `mockGuides` this namespace returns plain domain objects and throws
 * `BffError` on failure. `withV1` already maps a thrown BffError to the same
 * ProblemDetails body a NextResponse round-trip would produce, so the extra
 * wrap/unwrap pair earns nothing here.
 *
 * The store hangs off `globalThis` and is seeded lazily — importing this file
 * (which `lib/bff/client.ts` does in every mode) must not build state.
 */

import { createHash } from 'crypto';

import { BffError } from '@/lib/bff/errors';
import {
  POST_IMAGE_CID_PREFIX,
  POST_IMAGE_KEY_PATTERN,
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_MIME_TYPES,
  POST_IMAGE_SRC_PREFIXES,
} from '@/lib/constants/post-images';
import {
  comparePosts,
  type AdminPost,
  type AdminPostCategory,
  type AdminPostSummary,
  type LocalizedText,
  type Post,
  type PostCategory,
  type PostCategoryCreateRequest,
  type PostCreateRequest,
  type PostImageRef,
  type PostSaveFile,
  type PostSummary,
  type PostType,
  type PostUpdateRequest,
} from '@/lib/types/post';
import { collectImageSrcs, validatePostContent } from '@/lib/utils/validate-post-content';
import { postsSeed, postCategoriesSeed } from '@/lib/bff/mock/posts-seed';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Everything the store knows about one post. The API views are projections of this. */
export interface StoredPost extends AdminPost {
  contents: LocalizedText;
}

interface StoredCategory extends PostCategory {
  active: boolean;
}

interface PostsMockStore {
  posts: Map<number, StoredPost>;
  categories: Map<number, StoredCategory>;
  /** Stored image bytes, keyed by the filename in the owning post's URL. */
  images: Map<string, { bytes: Uint8Array<ArrayBuffer>; contentType: string }>;
  nextPostId: number;
  nextCategoryId: number;
  nextImageId: number;
  seeded: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __piiAgentPostsMock: PostsMockStore | undefined;
}

/**
 * The store hangs off `globalThis`, not off this module.
 *
 * Module-level state is per module *instance*, and a route that imports this
 * file directly does not get the instance `lib/bff/client.ts` built. The image
 * round-trip is where that showed: `POST .../images` answered 201 with a URL and
 * `GET` on that URL answered 404 forever, because the bytes were written into
 * one copy of `images` and read out of another. Every picture inserted in the
 * editor was a broken image.
 *
 * Counters live here too — split counters hand out ids that already exist.
 */
const store = (): PostsMockStore => {
  globalThis.__piiAgentPostsMock ??= {
    posts: new Map(),
    categories: new Map(),
    images: new Map(),
    nextPostId: 1,
    nextCategoryId: 1,
    nextImageId: 1,
    seeded: false,
  };
  return globalThis.__piiAgentPostsMock;
};

const { posts, categories, images } = store();

const ensureSeeded = (): void => {
  const state = store();
  if (state.seeded) return;
  state.seeded = true;
  for (const category of postCategoriesSeed) {
    categories.set(category.id, category);
    state.nextCategoryId = Math.max(state.nextCategoryId, category.id + 1);
  }
  for (const post of postsSeed) {
    posts.set(post.id, post);
    state.nextPostId = Math.max(state.nextPostId, post.id + 1);
  }
};

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

const categoryName = (categoryId: number | null): string | null =>
  categoryId === null ? null : (categories.get(categoryId)?.name ?? null);

const toSummary = (post: StoredPost): PostSummary => ({
  id: post.id,
  type: post.type,
  categoryId: post.categoryId,
  categoryName: categoryName(post.categoryId),
  titles: post.titles,
  publishedAt: post.publishedAt,
  updatedAt: post.updatedAt,
  pinned: post.pinned,
});

const toAdminSummary = (post: StoredPost): AdminPostSummary => ({
  ...toSummary(post),
  hidden: post.hidden,
  hiddenAt: post.hiddenAt,
});

const toAdminPost = (post: StoredPost): AdminPost => ({
  ...toAdminSummary(post),
  contents: post.contents,
  createdBy: post.createdBy,
  updatedBy: post.updatedBy,
  images: post.images,
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MOCK_ACTOR = 'mock-admin';

const blank = (text: LocalizedText | undefined): boolean =>
  !text || text.ko.trim() === '' || text.en.trim() === '';

/**
 * One save request settles an image's whole life (handoff §3.3).
 *
 * The body references images two ways — `cid:<key>` points at a `files` part
 * riding this request, a URL points at a file this post already owns. Once
 * every reference resolves and the caps hold, new files are written, `cid:`
 * is rewritten to the real URL, and owned files the new body dropped are
 * deleted. There is no orphan cleanup anywhere else because none can exist.
 */
const applyBodyImages = (
  contents: LocalizedText,
  files: readonly PostSaveFile[],
  owned: readonly PostImageRef[],
): { contents: LocalizedText; images: PostImageRef[] } => {
  // Allow-list, image count, and total bytes run through the same validator
  // the editor uses — the counter and the rejection cannot disagree. A cid
  // ref weighs what its part weighs; an owned URL weighs what the store holds.
  const bytesBySrc = new Map<string, number>();
  for (const file of files) {
    bytesBySrc.set(`${POST_IMAGE_CID_PREFIX}${file.key}`, file.bytes.byteLength);
  }
  for (const ref of owned) bytesBySrc.set(ref.url, ref.bytes);

  const result = validatePostContent({
    contents,
    imageSrcPrefixes: [...POST_IMAGE_SRC_PREFIXES, POST_IMAGE_CID_PREFIX],
    imageBytesByUrl: bytesBySrc,
  });
  // §3.3 is an order: allow-list (2) → references (3·4) → caps and per-file
  // rules (5). The validator folds allow-list and caps into one pass, so only
  // the structural error may throw here; cap errors wait until references are
  // checked — 11 cids riding 10 parts is REF_MISSING, not the count cap.
  const structural = result.valid
    ? undefined
    : result.errors.find((error) => error.code === 'POST_CONTENT_INVALID');
  if (structural) throw new BffError(400, structural.code, structural.message);

  const srcs = new Set<string>();
  for (const ast of Object.values(result.asts)) if (ast) collectImageSrcs(ast, srcs);

  // Every reference must resolve, in both directions — a cid without a part
  // is a broken image about to be stored, a part without a reference is a
  // frontend bug that must not pass silently.
  const ownedUrls = new Set(owned.map((ref) => ref.url));
  const referencedKeys = new Set<string>();
  for (const src of srcs) {
    if (src.startsWith(POST_IMAGE_CID_PREFIX)) {
      const key = src.slice(POST_IMAGE_CID_PREFIX.length);
      if (!POST_IMAGE_KEY_PATTERN.test(key) || !files.some((file) => file.key === key)) {
        throw new BffError(
          400,
          'POST_IMAGE_REF_MISSING',
          `본문의 cid:${key} 에 대응하는 파일 파트가 없습니다`,
        );
      }
      referencedKeys.add(key);
    } else if (!ownedUrls.has(src)) {
      throw new BffError(
        400,
        'POST_IMAGE_REF_UNKNOWN',
        `이 게시글이 소유하지 않은 이미지입니다: ${src}`,
      );
    }
  }
  for (const file of files) {
    if (!referencedKeys.has(file.key)) {
      throw new BffError(
        400,
        'POST_IMAGE_UNREFERENCED',
        `어떤 본문도 참조하지 않는 파일 파트입니다: ${file.key}`,
      );
    }
  }

  if (!result.valid) {
    // Only cap errors remain (the structural one threw above). The code
    // carries which rule broke; both are 400.
    const [first] = result.errors;
    throw new BffError(400, first.code, first.message);
  }

  // Per-file MIME and 5MB share step 5 with the caps — after references.
  for (const file of files) {
    if (!(POST_IMAGE_MIME_TYPES as readonly string[]).includes(file.contentType)) {
      throw new BffError(
        400,
        'UNSUPPORTED_IMAGE_TYPE',
        `${file.contentType} 은 지원하지 않습니다 (png / jpeg / webp): ${file.key}`,
      );
    }
    if (file.bytes.byteLength > POST_IMAGE_MAX_BYTES) {
      throw new BffError(413, 'IMAGE_TOO_LARGE', `파일 1개당 최대 5MB 입니다: ${file.key}`);
    }
  }

  // Identical bytes within one save fold into one stored file (§3.3-6). The
  // fold is storage-only — the caps above still counted each distinct key.
  const state = store();
  const urlByKey = new Map<string, string>();
  const idByDigest = new Map<string, string>();
  const added: PostImageRef[] = [];
  for (const file of files) {
    const digest = createHash('sha256').update(file.bytes).digest('hex');
    let imageId = idByDigest.get(digest);
    if (!imageId) {
      imageId = `mock-${state.nextImageId++}.${file.contentType.split('/')[1]}`;
      images.set(imageId, { bytes: file.bytes, contentType: file.contentType });
      idByDigest.set(digest, imageId);
      added.push({ url: imageUrl(imageId), bytes: file.bytes.byteLength });
    }
    urlByKey.set(file.key, imageUrl(imageId));
  }

  // The stored body never contains `cid:` — it leaves here as the real URL.
  const rewrite = (html: string): string =>
    html.replace(
      /src="cid:([a-z0-9]{8,32})"/g,
      (_match, key: string) => `src="${urlByKey.get(key)}"`,
    );

  // An owned file the new body no longer references dies with this save.
  const kept = owned.filter((ref) => srcs.has(ref.url));
  for (const ref of owned) {
    if (!srcs.has(ref.url)) images.delete(ref.url.split('/').pop()!);
  }

  return {
    contents: { ko: rewrite(contents.ko), en: rewrite(contents.en) },
    images: [...kept, ...added],
  };
};

const assertCategoryUsable = (categoryId: number | null | undefined, type: PostType): void => {
  if (categoryId === null || categoryId === undefined) return;
  const category = categories.get(categoryId);
  if (!category || category.type !== type) {
    throw new BffError(404, 'CATEGORY_NOT_FOUND', `Category ${categoryId} not found for ${type}`);
  }
};

const requirePost = (postId: number): StoredPost => {
  const post = posts.get(postId);
  if (!post) throw new BffError(404, 'POST_NOT_FOUND', `Post ${postId} not found`);
  return post;
};

const imageUrl = (imageId: string): string => `/pass/api/v1/admin/posts/images/${imageId}`;

// ---------------------------------------------------------------------------
// Namespace
// ---------------------------------------------------------------------------

export const mockPosts = {
  /** User list — hidden posts are never returned by any user-facing path. */
  list: async (type?: PostType, categoryId?: number): Promise<PostSummary[]> => {
    ensureSeeded();
    return [...posts.values()]
      .filter((post) => !post.hidden)
      .filter((post) => (type ? post.type === type : true))
      .filter((post) => (categoryId === undefined ? true : post.categoryId === categoryId))
      .map(toSummary)
      .sort(comparePosts);
  },

  get: async (postId: number): Promise<Post> => {
    ensureSeeded();
    const post = requirePost(postId);
    // Hidden → 404, not 403. See §5 숨김.
    if (post.hidden) throw new BffError(404, 'POST_NOT_FOUND', `Post ${postId} not found`);
    return { ...toSummary(post), contents: post.contents };
  },

  listCategories: async (type?: PostType): Promise<PostCategory[]> => {
    ensureSeeded();
    return [...categories.values()]
      .filter((category) => category.active)
      .filter((category) => (type ? category.type === type : true))
      .map(({ active: _active, ...category }) => category)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },

  listAdmin: async (type?: PostType, hidden?: boolean): Promise<AdminPostSummary[]> => {
    ensureSeeded();
    return [...posts.values()]
      .filter((post) => (type ? post.type === type : true))
      .filter((post) => (hidden === undefined ? true : post.hidden === hidden))
      .map(toAdminSummary)
      .sort(comparePosts);
  },

  getAdmin: async (postId: number): Promise<AdminPost> => {
    ensureSeeded();
    return toAdminPost(requirePost(postId));
  },

  create: async (body: PostCreateRequest, files: readonly PostSaveFile[]): Promise<AdminPost> => {
    ensureSeeded();
    if (blank(body.titles) || blank(body.contents)) {
      throw new BffError(400, 'VALIDATION_FAILED', 'titles / contents 의 ko·en 이 모두 필요합니다');
    }
    assertCategoryUsable(body.categoryId, body.type);
    // A new post owns nothing, so a URL reference is REF_UNKNOWN by
    // construction (handoff §3.10-③) — `owned` being empty encodes that.
    const saved = applyBodyImages(body.contents, files, []);

    const now = new Date().toISOString();
    const post: StoredPost = {
      id: store().nextPostId++,
      type: body.type,
      categoryId: body.categoryId ?? null,
      categoryName: categoryName(body.categoryId ?? null),
      titles: body.titles,
      contents: saved.contents,
      publishedAt: now,
      updatedAt: now,
      pinned: false,
      hidden: false,
      hiddenAt: null,
      createdBy: MOCK_ACTOR,
      updatedBy: MOCK_ACTOR,
      images: saved.images,
    };
    posts.set(post.id, post);
    return toAdminPost(post);
  },

  /** Full replacement. `publishedAt` does not move; only `updatedAt` does. */
  update: async (
    postId: number,
    body: PostUpdateRequest,
    files: readonly PostSaveFile[],
  ): Promise<AdminPost> => {
    ensureSeeded();
    const post = requirePost(postId);
    if (blank(body.titles) || blank(body.contents)) {
      throw new BffError(400, 'VALIDATION_FAILED', 'titles / contents 의 ko·en 이 모두 필요합니다');
    }
    assertCategoryUsable(body.categoryId, post.type);
    const saved = applyBodyImages(body.contents, files, post.images);

    const updated: StoredPost = {
      ...post,
      categoryId: body.categoryId ?? null,
      titles: body.titles,
      contents: saved.contents,
      images: saved.images,
      updatedAt: new Date().toISOString(),
      updatedBy: MOCK_ACTOR,
    };
    posts.set(postId, updated);
    return toAdminPost(updated);
  },

  /** Idempotent — setting the state it already has is a 200, not an error. */
  setHidden: async (postId: number, hidden: boolean): Promise<AdminPost> => {
    ensureSeeded();
    const post = requirePost(postId);
    const updated: StoredPost = {
      ...post,
      hidden,
      hiddenAt: hidden ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
      updatedBy: MOCK_ACTOR,
    };
    posts.set(postId, updated);
    return toAdminPost(updated);
  },

  setPinned: async (postId: number, pinned: boolean): Promise<AdminPost> => {
    ensureSeeded();
    const post = requirePost(postId);
    const updated: StoredPost = {
      ...post,
      pinned,
      updatedAt: new Date().toISOString(),
      updatedBy: MOCK_ACTOR,
    };
    posts.set(postId, updated);
    return toAdminPost(updated);
  },

  /** Mock-only: serves what a save request stored. Real files live in storage. */
  readImage: (imageId: string): { bytes: Uint8Array<ArrayBuffer>; contentType: string } | null =>
    images.get(imageId) ?? null,

  listAdminCategories: async (type?: PostType): Promise<AdminPostCategory[]> => {
    ensureSeeded();
    return [...categories.values()]
      .filter((category) => (type ? category.type === type : true))
      .map((category) => ({
        ...category,
        // Hidden posts count too — they still block deletion (§5 Category).
        postCount: [...posts.values()].filter((post) => post.categoryId === category.id).length,
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },

  createCategory: async (body: PostCategoryCreateRequest): Promise<AdminPostCategory> => {
    ensureSeeded();
    const name = body.name.trim();
    if (name === '') {
      throw new BffError(400, 'VALIDATION_FAILED', 'Category 이름이 비어 있습니다');
    }
    // Unique within a type only — FAQ and Notice do not share categories.
    const duplicated = [...categories.values()].some(
      (category) => category.type === body.type && category.name === name,
    );
    if (duplicated) {
      throw new BffError(409, 'CATEGORY_NAME_DUPLICATED', `이미 있는 Category 입니다: ${name}`);
    }

    const siblings = [...categories.values()].filter((category) => category.type === body.type);
    const category: StoredCategory = {
      id: store().nextCategoryId++,
      type: body.type,
      name,
      displayOrder: siblings.length + 1,
      active: true,
    };
    categories.set(category.id, category);
    return { ...category, postCount: 0 };
  },

  deleteCategory: async (categoryId: number): Promise<void> => {
    ensureSeeded();
    if (!categories.has(categoryId)) {
      throw new BffError(404, 'CATEGORY_NOT_FOUND', `Category ${categoryId} not found`);
    }
    const remaining = [...posts.values()].filter((post) => post.categoryId === categoryId).length;
    if (remaining > 0) {
      throw new BffError(
        409,
        'CATEGORY_IN_USE',
        `게시글 ${remaining}건이 남아 있어 삭제할 수 없습니다`,
      );
    }
    categories.delete(categoryId);
  },
};
