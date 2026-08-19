import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { readPostSaveForm } from '@/app/api/_lib/post-save-form';
import { bff } from '@/lib/bff/client';
import { parsePostType, type PostCreateRequest } from '@/lib/types/post';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md +
// docs/bff-api/requests/2026-08-19-faq-notices-be-handoff.md (multipart save).
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

// POST /install/v1/admin/posts (multipart/form-data) → AdminPost (201).
// The `post` part is the old JSON body unchanged; `files` parts carry the new
// images the body cites via `cid:<key>` — nothing is uploaded before this.
export const POST = withV1(async (request) => {
  const { post, files } = await readPostSaveForm<PostCreateRequest>(request);
  return NextResponse.json(await bff.posts.create(post, files), { status: 201 });
}, { expectedDuration: '200ms ~ 800ms' });
