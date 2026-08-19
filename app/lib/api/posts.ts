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
  Post,
  PostCategory,
  PostCategoryCreateRequest,
  PostCreateRequest,
  PostImagePart,
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

/**
 * The save is the only request that carries image bytes (handoff §3.2): the
 * body JSON rides the `post` part, each new image rides a `files` part whose
 * filename is the cid key the body cites. `fetchInfraJson` passes FormData to
 * fetch untouched, so the multipart boundary survives.
 */
const saveForm = (
  body: PostCreateRequest | PostUpdateRequest,
  files: readonly PostImagePart[],
): FormData => {
  const form = new FormData();
  form.append('post', new Blob([JSON.stringify(body)], { type: 'application/json' }));
  for (const { key, file } of files) form.append('files', file, key);
  return form;
};

/** A save can carry 10MB of images — the 30s default is sized for JSON. */
const SAVE_TIMEOUT_MS = 120_000;

export const createPost = (
  body: PostCreateRequest,
  files: readonly PostImagePart[] = [],
): Promise<AdminPost> =>
  fetchInfraJson<AdminPost>('/admin/posts', {
    method: 'POST',
    body: saveForm(body, files),
    timeout: SAVE_TIMEOUT_MS,
  });

/** Full replacement — send all four localized values even when one changed. */
export const updatePost = (
  postId: number,
  body: PostUpdateRequest,
  files: readonly PostImagePart[] = [],
): Promise<AdminPost> =>
  fetchInfraJson<AdminPost>(`/admin/posts/${postId}`, {
    method: 'PUT',
    body: saveForm(body, files),
    timeout: SAVE_TIMEOUT_MS,
  });

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

