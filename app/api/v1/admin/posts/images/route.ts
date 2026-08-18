import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { bff } from '@/lib/bff/client';

// DRAFT CONTRACT — docs/bff-api/tag-guides/faq-notices.md §5 본문 이미지.
// POST /install/v1/admin/posts/images (multipart/form-data) → ImageUploadResponse (201).
//
// One file per request, 5MB each. `multipart/form-data` here means "a standard
// content-type carrying one file" — NOT chunked/resumable upload. The size cap
// is exactly what keeps this a single request.
//
// The static `images` segment wins over the sibling `[postId]` route.
export const POST = withV1(async (request, ctx) => {
  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'file 파트가 필요합니다', ctx.requestId),
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await bff.posts.uploadImage({ bytes, contentType: file.type });
  return NextResponse.json(uploaded, { status: 201 });
}, { expectedDuration: '800ms' });
