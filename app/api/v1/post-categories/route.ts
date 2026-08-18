import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parsePostType } from '@/lib/types/post';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// GET /install/v1/post-categories?type → PostCategory[] (inactive excluded).
export const GET = withV1(async (request) => {
  const type = parsePostType(new URL(request.url).searchParams.get('type'));
  return NextResponse.json(await bff.posts.listCategories(type));
}, { expectedDuration: '100ms ~ 300ms' });
