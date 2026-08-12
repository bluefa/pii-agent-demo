import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// PUT /install/v1/admin/posts/{postId}/pinned → AdminPost.
// Pinning moves a post into the top group; ordering within a group stays by
// publishedAt. Idempotent, like hidden.
export const PUT = withV1(async (request, ctx) => {
  const { pinned } = await request.json() as { pinned: boolean };
  return NextResponse.json(await bff.posts.setPinned(Number(ctx.params.postId), pinned));
}, { expectedDuration: '100ms ~ 500ms' });
