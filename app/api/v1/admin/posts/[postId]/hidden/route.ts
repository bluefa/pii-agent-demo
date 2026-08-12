import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// PUT /install/v1/admin/posts/{postId}/hidden → AdminPost.
// There is no delete API; hiding is the only removal. Idempotent — setting the
// state a post already holds is a 200, not a conflict.
export const PUT = withV1(async (request, ctx) => {
  const { hidden } = await request.json() as { hidden: boolean };
  return NextResponse.json(await bff.posts.setHidden(Number(ctx.params.postId), hidden));
}, { expectedDuration: '100ms ~ 500ms' });
