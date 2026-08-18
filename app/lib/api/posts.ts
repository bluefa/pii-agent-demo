/**
 * FAQ & Notices — CSR API client.
 *
 * Contract: docs/bff-api/tag-guides/faq-notices.md (Draft; hand types in
 * lib/types/post.ts stand in for the generated schema).
 *
 * List calls never carry bodies. `getPost` is the one that does, and the
 * screens call it lazily — when a row opens, once per row.
 */

import { fetchInfraJson } from '@/app/lib/api/infra';
import type {
  AdminPost,
  AdminPostCategory,
  AdminPostSummary,
  ImageUploadResponse,
  Post,
  PostCategory,
  PostCategoryCreateRequest,
  PostCreateRequest,
  PostSummary,
  PostType,
  PostUpdateRequest,
} from '@/lib/types/post';

const typeQuery = (type?: PostType): string => (type ? `?type=${type}` : '');

// --- User ---

export const listPosts = (type?: PostType): Promise<PostSummary[]> =>
  fetchInfraJson<PostSummary[]>(`/posts${typeQuery(type)}`);

/** 404 here means the post was hidden after the list was fetched (§5 본문 로딩). */
export const getPost = (postId: number): Promise<Post> =>
  fetchInfraJson<Post>(`/posts/${postId}`);

export const listPostCategories = (type?: PostType): Promise<PostCategory[]> =>
  fetchInfraJson<PostCategory[]>(`/post-categories${typeQuery(type)}`);

// --- Admin ---

export const listAdminPosts = (type?: PostType): Promise<AdminPostSummary[]> =>
  fetchInfraJson<AdminPostSummary[]>(`/admin/posts${typeQuery(type)}`);

export const getAdminPost = (postId: number): Promise<AdminPost> =>
  fetchInfraJson<AdminPost>(`/admin/posts/${postId}`);

export const createPost = (body: PostCreateRequest): Promise<AdminPost> =>
  fetchInfraJson<AdminPost>('/admin/posts', { method: 'POST', body });

/** Full replacement — send all four localized values even when one changed. */
export const updatePost = (postId: number, body: PostUpdateRequest): Promise<AdminPost> =>
  fetchInfraJson<AdminPost>(`/admin/posts/${postId}`, { method: 'PUT', body });

export const setPostHidden = (postId: number, hidden: boolean): Promise<AdminPost> =>
  fetchInfraJson<AdminPost>(`/admin/posts/${postId}/hidden`, { method: 'PUT', body: { hidden } });

export const setPostPinned = (postId: number, pinned: boolean): Promise<AdminPost> =>
  fetchInfraJson<AdminPost>(`/admin/posts/${postId}/pinned`, { method: 'PUT', body: { pinned } });

export const listAdminPostCategories = (type?: PostType): Promise<AdminPostCategory[]> =>
  fetchInfraJson<AdminPostCategory[]>(`/admin/post-categories${typeQuery(type)}`);

export const createPostCategory = (body: PostCategoryCreateRequest): Promise<AdminPostCategory> =>
  fetchInfraJson<AdminPostCategory>('/admin/post-categories', { method: 'POST', body });

export const deletePostCategory = async (categoryId: number): Promise<void> => {
  await fetchInfraJson<void>(`/admin/post-categories/${categoryId}`, { method: 'DELETE' });
};

/**
 * One file, one request. Goes through `fetchInfraJson` like every other call —
 * it now passes FormData to fetch untouched, so the multipart boundary survives.
 *
 * Hand-rolling this on raw fetch is what it replaces, and that version was
 * missing three things the wrapper already owns: the 30s timeout (a hung BFF
 * left the editor spinning with no way out), the TypeError → NETWORK
 * translation (a dead BFF surfaced the browser's own "Failed to fetch" in a
 * Korean UI), and status-derived `retriable` (every failure was stamped
 * non-retriable BAD_REQUEST, so a 503 read as "this file is bad").
 *
 * UNSUPPORTED_IMAGE_TYPE (400) and IMAGE_TOO_LARGE (413) still reach the editor
 * as their ProblemDetails `detail` — `parseErrorResponse` reads that field.
 */
export const uploadPostImage = (file: File): Promise<ImageUploadResponse> => {
  const form = new FormData();
  form.append('file', file);
  return fetchInfraJson<ImageUploadResponse>('/admin/posts/images', {
    method: 'POST',
    body: form,
  });
};
