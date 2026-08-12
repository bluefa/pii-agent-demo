'use client';

import { useState } from 'react';
import { PinBadge } from '@/app/notices/_components/PinBadge';
import { renderGuideAst } from '@/app/components/features/process-status/GuideCard/render-guide-ast';
import { getPost } from '@/app/lib/api/posts';
import { POST_IMAGE_SRC_PREFIXES } from '@/lib/constants/post-images';
import { bgColors, borderColors, cn, primaryColors, tableRowLift, textColors } from '@/lib/theme';
import type { PostSummary } from '@/lib/types/post';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

/** yyyy-mm-dd, sliced off the ISO string so it does not shift with timezone. */
const publishDate = (iso: string): string => iso.slice(0, 10);

interface PostAccordionRowProps {
  post: PostSummary;
  /** The row was opened and the post turned out to be hidden — drop it. */
  onGone: (postId: number) => void;
}

export const PostAccordionRow = ({ post, onGone }: PostAccordionRowProps) => {
  const [open, setOpen] = useState(false);
  // Body is fetched once and kept. Collapsing does not discard it, so
  // reopening a row costs nothing (§5 본문 로딩).
  const [body, setBody] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || body !== null) return;

    try {
      const detail = await getPost(post.id);
      setBody(detail.contents.ko);
    } catch (error) {
      // 404 = hidden between the list load and this click. That is not an
      // error the reader should see; the row simply no longer exists.
      if (error instanceof Error && 'status' in error && error.status === 404) {
        onGone(post.id);
        return;
      }
      setFailed(true);
    }
  };

  const parsed = body === null
    ? null
    : validateGuideHtml(body, { allowImages: true, imageSrcPrefixes: POST_IMAGE_SRC_PREFIXES });

  return (
    <li className={cn('border-b last:border-b-0', borderColors.light)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 px-5 py-4 text-left focus-visible:outline-none',
          tableRowLift.base,
          tableRowLift.target,
        )}
      >
        {post.pinned && <PinBadge />}
        {post.categoryName && (
          <span className={cn('shrink-0 text-xs font-medium', primaryColors.textOnLight)}>
            {post.categoryName}
          </span>
        )}
        <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', textColors.primary)}>
          {post.titles.ko}
        </span>
        {/* Pushed to the far right so every row's date sits on one rule. */}
        <span className={cn('shrink-0 text-xs tabular-nums', textColors.tertiary)}>
          {publishDate(post.publishedAt)}
        </span>
      </button>

      {/* 0fr → 1fr animates to the content's own height without measuring it. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          {/* pb is 10px past the top padding — a body that ends flush against
              the next row reads as clipped rather than finished. */}
          <div className={cn('px-5 pt-2 pb-[26px]', textColors.secondary)}>
            {failed && <p className="text-sm">본문을 불러오지 못했습니다.</p>}
            {!failed && body === null && (
              <div className={cn('h-4 w-2/3 animate-pulse rounded', bgColors.panel)} />
            )}
            {/* Same body styling as every other guide surface — bullets, link
                colour and image sizing already live in `.prose-guide`. */}
            {parsed?.valid && (
              <div className="prose-guide text-sm leading-relaxed">
                {renderGuideAst(parsed.ast)}
              </div>
            )}
            {parsed && !parsed.valid && (
              <p className="text-sm">본문 형식이 올바르지 않아 표시할 수 없습니다.</p>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={toggle}
                className={cn('text-xs font-medium hover:underline', textColors.tertiary)}
              >
                접기
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};
