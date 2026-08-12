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
 * The store is module-level and seeded lazily — importing this file (which
 * `lib/bff/client.ts` does in every mode) must not build state.
 */

import { BffError } from '@/lib/bff/errors';
import {
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_MIME_TYPES,
  POST_IMAGE_SRC_PREFIXES,
} from '@/lib/constants/post-images';
import {
  comparePosts,
  type AdminPost,
  type AdminPostCategory,
  type AdminPostSummary,
  type ImageUploadResponse,
  type LocalizedText,
  type Post,
  type PostCategory,
  type PostCategoryCreateRequest,
  type PostCreateRequest,
  type PostSummary,
  type PostType,
  type PostUpdateRequest,
} from '@/lib/types/post';
import { validatePostContent } from '@/lib/utils/validate-post-content';
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

const posts = new Map<number, StoredPost>();
const categories = new Map<number, StoredCategory>();
/** Uploaded image bytes, keyed by the filename in the returned URL. */
const images = new Map<string, { bytes: Uint8Array<ArrayBuffer>; contentType: string }>();

let nextPostId = 1;
let nextCategoryId = 1;
let nextImageId = 1;
let seeded = false;

const ensureSeeded = (): void => {
  if (seeded) return;
  seeded = true;
  for (const category of postCategoriesSeed) {
    categories.set(category.id, category);
    nextCategoryId = Math.max(nextCategoryId, category.id + 1);
  }
  for (const post of postsSeed) {
    posts.set(post.id, post);
    nextPostId = Math.max(nextPostId, post.id + 1);
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
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MOCK_ACTOR = 'mock-admin';

const blank = (text: LocalizedText | undefined): boolean =>
  !text || text.ko.trim() === '' || text.en.trim() === '';

/**
 * Runs the same body checks the BFF would: allow-list, image count, total
 * bytes. `imageBytesByUrl` is what the store actually holds, so the byte cap
 * is measured against real uploads rather than a number the client sent.
 */
const assertContentValid = (contents: LocalizedText): void => {
  const bytesByUrl = new Map<string, number>();
  for (const [id, image] of images) {
    bytesByUrl.set(imageUrl(id), image.bytes.byteLength);
  }

  const result = validatePostContent({
    contents,
    imageSrcPrefixes: POST_IMAGE_SRC_PREFIXES,
    imageBytesByUrl: bytesByUrl,
  });
  if (result.valid) return;

  // All three post-content codes are 400; the code carries which rule broke.
  const [first] = result.errors;
  throw new BffError(400, first.code, first.message);
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

  create: async (body: PostCreateRequest): Promise<AdminPost> => {
    ensureSeeded();
    if (blank(body.titles) || blank(body.contents)) {
      throw new BffError(400, 'VALIDATION_FAILED', 'titles / contents 의 ko·en 이 모두 필요합니다');
    }
    assertCategoryUsable(body.categoryId, body.type);
    assertContentValid(body.contents);

    const now = new Date().toISOString();
    const post: StoredPost = {
      id: nextPostId++,
      type: body.type,
      categoryId: body.categoryId ?? null,
      categoryName: categoryName(body.categoryId ?? null),
      titles: body.titles,
      contents: body.contents,
      publishedAt: now,
      updatedAt: now,
      pinned: false,
      hidden: false,
      hiddenAt: null,
      createdBy: MOCK_ACTOR,
      updatedBy: MOCK_ACTOR,
    };
    posts.set(post.id, post);
    return toAdminPost(post);
  },

  /** Full replacement. `publishedAt` does not move; only `updatedAt` does. */
  update: async (postId: number, body: PostUpdateRequest): Promise<AdminPost> => {
    ensureSeeded();
    const post = requirePost(postId);
    if (blank(body.titles) || blank(body.contents)) {
      throw new BffError(400, 'VALIDATION_FAILED', 'titles / contents 의 ko·en 이 모두 필요합니다');
    }
    assertCategoryUsable(body.categoryId, post.type);
    assertContentValid(body.contents);

    const updated: StoredPost = {
      ...post,
      categoryId: body.categoryId ?? null,
      titles: body.titles,
      contents: body.contents,
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

  uploadImage: async (file: {
    bytes: Uint8Array<ArrayBuffer>;
    contentType: string;
  }): Promise<ImageUploadResponse> => {
    ensureSeeded();
    if (!(POST_IMAGE_MIME_TYPES as readonly string[]).includes(file.contentType)) {
      throw new BffError(
        400,
        'UNSUPPORTED_IMAGE_TYPE',
        `${file.contentType} 은 지원하지 않습니다 (png / jpeg / webp)`,
      );
    }
    if (file.bytes.byteLength > POST_IMAGE_MAX_BYTES) {
      throw new BffError(413, 'IMAGE_TOO_LARGE', '파일 1개당 최대 5MB 입니다');
    }

    const extension = file.contentType.split('/')[1];
    const imageId = `mock-${nextImageId++}.${extension}`;
    images.set(imageId, { bytes: file.bytes, contentType: file.contentType });

    // The real BFF reads the pixel size off the decoded image. There is no
    // decoder here, so the mock reports a fixed size — the value only feeds
    // width/height on the img tag, which CSS overrides anyway.
    return { url: imageUrl(imageId), width: 800, height: 450 };
  },

  /** Mock-only: serves what `uploadImage` stored. Real uploads live in storage. */
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
      id: nextCategoryId++,
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
