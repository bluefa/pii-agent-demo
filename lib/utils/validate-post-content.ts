/**
 * FAQ & Notices — post body validation (ko/en pair + per-post image limits).
 *
 * Contract: docs/bff-api/tag-guides/faq-notices.md §5.
 *
 * Wraps the shared allow-list validator with the two rules that only make
 * sense once both languages are considered together:
 *
 *  - a post carries at most {@link POST_MAX_IMAGES} images
 *  - a post's images weigh at most {@link POST_MAX_TOTAL_BYTES}
 *
 * Both count `contents.ko` and `contents.en` as one post, and count a URL
 * once however often it appears — the same upload is one file in storage.
 *
 * The server stays authoritative. This runs in the editor so an author sees
 * the limit while writing instead of losing a save to it.
 */

import {
  validateGuideHtml,
  type GuideNode,
  type ValidationError,
} from '@/lib/utils/validate-guide-html';

export const POST_MAX_IMAGES = 10;
export const POST_MAX_TOTAL_BYTES = 10 * 1024 * 1024;

export type PostLanguage = 'ko' | 'en';

export interface LocalizedContent {
  ko: string;
  en: string;
}

export type PostContentErrorCode =
  | 'POST_CONTENT_INVALID'
  | 'POST_IMAGE_LIMIT_EXCEEDED'
  | 'POST_SIZE_LIMIT_EXCEEDED';

export interface PostContentError {
  code: PostContentErrorCode;
  message: string;
  /** Set when the failure belongs to one language rather than the post. */
  lang?: PostLanguage;
  /** Present for POST_CONTENT_INVALID — the underlying allow-list errors. */
  causes?: ValidationError[];
}

export interface ValidatePostContentInput {
  contents: LocalizedContent;
  /** URL prefixes an image may come from — the upload storage host. */
  imageSrcPrefixes: readonly string[];
  /**
   * Byte size of each uploaded image, keyed by the URL the upload API
   * returned. A URL missing from this map contributes 0 to the total: the
   * editor knows the sizes it just uploaded, and the server — which owns
   * every size — is the one that can reject on weight.
   */
  imageBytesByUrl?: ReadonlyMap<string, number>;
}

export interface PostContentUsage {
  /** Distinct image URLs across both languages. */
  imageCount: number;
  /** Summed bytes of those distinct URLs. */
  totalBytes: number;
}

export type ValidatePostContentResult =
  | { valid: true; usage: PostContentUsage; asts: Record<PostLanguage, GuideNode[]> }
  | { valid: false; errors: PostContentError[]; usage: PostContentUsage };

const LANGS: readonly PostLanguage[] = ['ko', 'en'];

/** Exported for the mock BFF, which partitions the srcs into cid/URL refs. */
export const collectImageSrcs = (ast: GuideNode[], into: Set<string>): void => {
  for (const node of ast) {
    if (node.type === 'img') {
      into.add(node.src);
      continue;
    }
    if (node.type === 'text' || node.type === 'br') continue;
    collectImageSrcs(node.children, into);
  }
};

export function validatePostContent(
  input: ValidatePostContentInput,
): ValidatePostContentResult {
  const { contents, imageSrcPrefixes, imageBytesByUrl } = input;
  const errors: PostContentError[] = [];
  const asts = {} as Record<PostLanguage, GuideNode[]>;
  const srcs = new Set<string>();

  for (const lang of LANGS) {
    const result = validateGuideHtml(contents[lang], {
      allowImages: true,
      imageSrcPrefixes,
    });
    if (result.valid) {
      asts[lang] = result.ast;
      collectImageSrcs(result.ast, srcs);
    } else {
      errors.push({
        code: 'POST_CONTENT_INVALID',
        lang,
        message:
          lang === 'ko'
            ? '한국어 본문이 허용된 서식 규칙을 만족하지 않습니다'
            : '영어 본문이 허용된 서식 규칙을 만족하지 않습니다',
        causes: result.errors,
      });
    }
  }

  // Usage is reported even when a language failed to parse, so the editor can
  // still show the counter rather than blanking it on the first typo.
  let totalBytes = 0;
  for (const src of srcs) totalBytes += imageBytesByUrl?.get(src) ?? 0;
  const usage: PostContentUsage = { imageCount: srcs.size, totalBytes };

  if (usage.imageCount > POST_MAX_IMAGES) {
    errors.push({
      code: 'POST_IMAGE_LIMIT_EXCEEDED',
      message: `이미지는 게시글당 최대 ${POST_MAX_IMAGES}개입니다 (현재 ${usage.imageCount}개)`,
    });
  }
  if (usage.totalBytes > POST_MAX_TOTAL_BYTES) {
    errors.push({
      code: 'POST_SIZE_LIMIT_EXCEEDED',
      message: `게시글 총 용량은 최대 ${formatMib(POST_MAX_TOTAL_BYTES)}입니다 (현재 ${formatMib(usage.totalBytes)})`,
    });
  }

  return errors.length === 0
    ? { valid: true, usage, asts }
    : { valid: false, errors, usage };
}

const formatMib = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
