/**
 * FAQ & Notices — domain types.
 *
 * Spec: docs/bff-api/tag-guides/faq-notices.md §2.
 *
 * CONTRACT GAP: this Tag is Draft and absent from docs/swagger/install-v1.yaml,
 * so there is no generated schema to type it with (same situation as
 * `bff.aws.searchEc2Resources`). These hand types mirror the tag guide's
 * schemas exactly and are replaced by `schemas.*` once the swagger catches up.
 */

export const POST_TYPES = ['FAQ', 'NOTICE'] as const;

export type PostType = (typeof POST_TYPES)[number];

/**
 * Screens print `yy-mm-dd` — the format the tag guide's `publishedAt`
 * description fixes. Slicing the ISO string keeps the date from shifting
 * a day under a timezone conversion.
 */
export const formatPostDate = (iso: string): string => iso.slice(2, 10);

/** `?type=` reader. An unknown value means "no filter", not an error. */
export const parsePostType = (raw: string | null): PostType | undefined =>
  (POST_TYPES as readonly string[]).includes(raw ?? '') ? (raw as PostType) : undefined;

/** ko/en pair. Both values always present — the save path rejects a blank side. */
export interface LocalizedText {
  ko: string;
  en: string;
}

/**
 * List-row post. Carries NO `contents`: a list response must not grow with
 * `게시글 수 × 2개 언어`, and there is no pagination to cap it (§5 본문 로딩).
 */
export interface PostSummary {
  id: number;
  type: PostType;
  /** null for an uncategorised post. */
  categoryId: number | null;
  categoryName: string | null;
  titles: LocalizedText;
  /** First publish time. An edit does not move it. */
  publishedAt: string;
  updatedAt: string;
  pinned: boolean;
}

/** Single post, body included. Fetched when an accordion row opens. */
export interface Post extends PostSummary {
  contents: LocalizedText;
}

export interface AdminPostSummary extends PostSummary {
  hidden: boolean;
  /** Last time it was hidden; null while visible. */
  hiddenAt: string | null;
}

export interface AdminPost extends AdminPostSummary {
  contents: LocalizedText;
  createdBy: string;
  updatedBy: string;
}

export interface PostCategory {
  id: number;
  type: PostType;
  name: string;
  displayOrder: number;
}

export interface AdminPostCategory extends PostCategory {
  active: boolean;
  /** Remaining posts, hidden ones included — deletion needs this to be 0. */
  postCount: number;
}

export interface ImageUploadResponse {
  url: string;
  width: number;
  height: number;
}

export interface PostCreateRequest {
  type: PostType;
  categoryId?: number | null;
  titles: LocalizedText;
  contents: LocalizedText;
}

/**
 * Full replacement, not a patch. An omitted field is emptied, not kept — the
 * edit screen opens pre-filled and re-sends every value (§5 수정).
 */
export interface PostUpdateRequest {
  categoryId?: number | null;
  titles: LocalizedText;
  contents: LocalizedText;
}

export interface PostCategoryCreateRequest {
  type: PostType;
  name: string;
}

/**
 * List order: `pinned` desc, then `publishedAt` desc — two separate groups,
 * time-ordered only WITHIN a group. Sorting everything by time would make
 * pinning meaningless (§5 정렬).
 */
export const comparePosts = (a: PostSummary, b: PostSummary): number => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.publishedAt.localeCompare(a.publishedAt);
};
