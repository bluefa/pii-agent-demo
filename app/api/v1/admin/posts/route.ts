import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parsePostType, type PostCreateRequest } from '@/lib/types/post';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md.
// GET /install/v1/admin/posts?type&hidden → AdminPostSummary[] (hidden included, no body).
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const hidden = params.get('hidden');

  return NextResponse.json(
    await bff.posts.listAdmin(
      parsePostType(params.get('type')),
      hidden === null ? undefined : hidden === 'true',
    ),
  );
}, { expectedDuration: '100ms ~ 300ms' });

// POST /install/v1/admin/posts → AdminPost (201).
export const POST = withV1(async (request) => {
  const body = await request.json() as PostCreateRequest;
  return NextResponse.json(await bff.posts.create(body), { status: 201 });
}, { expectedDuration: '200ms ~ 800ms' });
