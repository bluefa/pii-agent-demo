import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parsePostType } from '@/lib/types/post';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// GET /install/v1/posts?type&categoryId → PostSummary[] (hidden excluded, no body).
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const categoryId = params.get('categoryId');

  return NextResponse.json(
    await bff.posts.list(
      parsePostType(params.get('type')),
      categoryId ? Number(categoryId) : undefined,
    ),
  );
}, { expectedDuration: '100ms ~ 300ms' });
