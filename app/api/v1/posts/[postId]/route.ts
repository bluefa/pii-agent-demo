import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// GET /install/v1/posts/{postId} → Post (body included). Called when an
// accordion row opens and on a deep link. A hidden post answers 404, not 403 —
// 403 would confirm it exists.
export const GET = withV1(async (_request, ctx) => {
  return NextResponse.json(await bff.posts.get(Number(ctx.params.postId)));
}, { expectedDuration: '100ms ~ 300ms' });
