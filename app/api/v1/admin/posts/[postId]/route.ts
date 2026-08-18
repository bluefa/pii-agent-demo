import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import type { PostUpdateRequest } from '@/lib/types/post';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// GET /install/v1/admin/posts/{postId} → AdminPost. Hidden posts ARE readable
// here: the edit screen is how a hidden post gets fixed.
export const GET = withV1(async (_request, ctx) => {
  return NextResponse.json(await bff.posts.getAdmin(Number(ctx.params.postId)));
}, { expectedDuration: '100ms ~ 300ms' });

// PUT /install/v1/admin/posts/{postId} → AdminPost. Full replacement, not a
// patch — an omitted field is emptied. `publishedAt` does not move.
export const PUT = withV1(async (request, ctx) => {
  const body = await request.json() as PostUpdateRequest;
  return NextResponse.json(await bff.posts.update(Number(ctx.params.postId), body));
}, { expectedDuration: '200ms ~ 800ms' });
