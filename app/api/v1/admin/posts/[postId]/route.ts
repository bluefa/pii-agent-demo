import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { readPostSaveForm } from '@/app/api/_lib/post-save-form';
import { bff } from '@/lib/bff/client';
import type { PostUpdateRequest } from '@/lib/types/post';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md +
// docs/bff-api/requests/2026-08-19-faq-notices-be-handoff.md (multipart save).
// GET /install/v1/admin/posts/{postId} → AdminPost. Hidden posts ARE readable
// here: the edit screen is how a hidden post gets fixed. The response carries
// `images` — the edit screen's only source for existing images' byte sizes.
export const GET = withV1(async (_request, ctx) => {
  return NextResponse.json(await bff.posts.getAdmin(Number(ctx.params.postId)));
}, { expectedDuration: '100ms ~ 300ms' });

// PUT /install/v1/admin/posts/{postId} (multipart/form-data) → AdminPost.
// Full replacement, not a patch — an omitted field is emptied. `publishedAt`
// does not move. Owned files the new body no longer references are deleted.
export const PUT = withV1(async (request, ctx) => {
  const { post, files } = await readPostSaveForm<PostUpdateRequest>(request);
  return NextResponse.json(await bff.posts.update(Number(ctx.params.postId), post, files));
}, { expectedDuration: '200ms ~ 800ms' });
