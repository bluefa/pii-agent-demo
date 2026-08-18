import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// DELETE /install/v1/admin/post-categories/{categoryId} → 204.
// Only deletable at zero remaining posts; a hidden post still counts, so
// hiding everything in a category does not unlock deletion.
export const DELETE = withV1(async (_request, ctx) => {
  await bff.posts.deleteCategory(Number(ctx.params.categoryId));
  return new NextResponse(null, { status: 204 });
}, { expectedDuration: '200ms ~ 500ms' });
