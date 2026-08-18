import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { mockPosts } from '@/lib/bff/mock/posts';
import { isMock } from '@/lib/env';

/**
 * MOCK ONLY — serves the bytes `POST ../images` kept in memory.
 *
 * This route is not in the tag guide and has no upstream counterpart: a real
 * deployment stores uploads in object storage and `img.src` points there
 * directly. It exists so the mock can round-trip an upload through a URL that
 * passes the `img.src` prefix check, instead of inlining base64 into the body.
 */
export const GET = withV1(async (_request, ctx) => {
  if (!isMock()) {
    return problemResponse(
      createProblem('POST_NOT_FOUND', 'Images are served from storage', ctx.requestId),
    );
  }

  const image = mockPosts.readImage(ctx.params.imageId);
  if (!image) {
    return problemResponse(
      createProblem('POST_NOT_FOUND', `Image ${ctx.params.imageId} not found`, ctx.requestId),
    );
  }

  return new NextResponse(image.bytes, {
    headers: { 'content-type': image.contentType, 'cache-control': 'no-store' },
  });
}, { expectedDuration: '100ms' });
