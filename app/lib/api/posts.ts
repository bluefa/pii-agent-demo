/**
 * FAQ & Notices — CSR API client.
 *
 * Contract: docs/bff-api/tag-guides/faq-notices.md (Draft; hand types in
 * lib/types/post.ts stand in for the generated schema).
 *
 * List calls never carry bodies. `getPost` is the one that does, and the
 * screens call it lazily — when a row opens, once per row.
 */

import { fetchInfra, fetchInfraJson } from '@/app/lib/api/infra';
import { AppError } from '@/lib/errors';
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
 * One file, one request. `fetchInfraJson` would JSON-stringify the body, so
 * this goes through the raw fetch — FormData must reach fetch intact for the
 * multipart boundary to be generated.
 */
export const uploadPostImage = async (file: File): Promise<ImageUploadResponse> => {
  const form = new FormData();
  form.append('file', file);

  const response = await fetchInfra('/admin/posts/images', { method: 'POST', body: form });
  if (!response.ok) {
    // UNSUPPORTED_IMAGE_TYPE (400) and IMAGE_TOO_LARGE (413) both mean "this
    // file is not acceptable", so the detail is what the editor shows.
    const body = await response.json().catch(() => ({})) as { detail?: unknown };
    throw new AppError({
      code: 'BAD_REQUEST',
      message: typeof body.detail === 'string' ? body.detail : '이미지 업로드에 실패했습니다',
      status: response.status,
      retriable: false,
    });
  }
  return await response.json() as ImageUploadResponse;
};
