import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parsePostType, type PostCategoryCreateRequest } from '@/lib/types/post';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// GET /install/v1/admin/post-categories?type → AdminPostCategory[] (inactive included,
// `postCount` counts hidden posts too because they still block deletion).
export const GET = withV1(async (request) => {
  const type = parsePostType(new URL(request.url).searchParams.get('type'));
  return NextResponse.json(await bff.posts.listAdminCategories(type));
}, { expectedDuration: '100ms ~ 300ms' });

// POST /install/v1/admin/post-categories → AdminPostCategory (201).
// Names are unique per `type`; FAQ and Notice do not share categories.
export const POST = withV1(async (request) => {
  const body = await request.json() as PostCategoryCreateRequest;
  return NextResponse.json(await bff.posts.createCategory(body), { status: 201 });
}, { expectedDuration: '200ms ~ 500ms' });
