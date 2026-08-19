/**
 * Post body image constraints (docs/bff-api/tag-guides/faq-notices.md §5 본문 이미지).
 *
 * Client-safe: the editor checks these before uploading so a 5MB file is
 * rejected at the file picker rather than after the bytes are on the wire.
 * The server checks them again — this module is a courtesy, not the gate.
 */

/** One file per request, 5MB each. This cap is what makes chunked upload unnecessary. */
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const POST_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const POST_IMAGE_ACCEPT = POST_IMAGE_MIME_TYPES.join(',');

/**
 * `img.src` must start with one of these. An arbitrary external URL is rejected
 * with POST_CONTENT_INVALID, so a post can never hotlink somewhere we do not own.
 *
 * The mock serves uploads from the upload route itself; a real deployment sets
 * NEXT_PUBLIC_POST_IMAGE_BASE_URL to the storage host and that value is added here.
 */
export const POST_IMAGE_SRC_PREFIXES: readonly string[] = [
  '/pass/api/v1/admin/posts/images/',
  ...(process.env.NEXT_PUBLIC_POST_IMAGE_BASE_URL
    ? [process.env.NEXT_PUBLIC_POST_IMAGE_BASE_URL]
    : []),
];

/**
 * How a REQUEST body points at an image that has no URL yet (RFC 2392, handoff
 * §3.2). The server rewrites `cid:<key>` to the real URL while saving, so a
 * STORED body never contains it — which is why it is not in the list above.
 */
export const POST_IMAGE_CID_PREFIX = 'cid:';

/** The cid key format — shared by the body reference and the part filename. */
export const POST_IMAGE_KEY_PATTERN = /^[a-z0-9]{8,32}$/;

/**
 * What the EDITOR accepts as an img src. A new image lives as a local blob:
 * preview until save, when it turns into `cid:` — the render/save paths keep
 * using POST_IMAGE_SRC_PREFIXES and never see a blob.
 */
export const EDITOR_IMAGE_SRC_PREFIXES: readonly string[] = [
  ...POST_IMAGE_SRC_PREFIXES,
  'blob:',
];
