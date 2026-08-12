'use client';

import Link from 'next/link';
import { PostAccordionRow } from '@/app/notices/_components/PostAccordionRow';
import { bgColors, borderColors, cn, primaryColors, textColors, tossShadow } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import type { PostSummary, PostType } from '@/lib/types/post';

interface PostBoardCardProps {
  title: string;
  type: PostType;
  posts: PostSummary[] | null;
  /** Rows past this are behind 전체 보기. Omit to show every row. */
  limit?: number;
  onGone: (postId: number) => void;
}

export const PostBoardCard = ({ title, type, posts, limit, onGone }: PostBoardCardProps) => {
  const visible = posts === null ? null : (limit === undefined ? posts : posts.slice(0, limit));

  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl', bgColors.surface, tossShadow.sm)}>
      <header
        className={cn('flex items-center justify-between border-b px-5 py-4', borderColors.light)}
      >
        <h2 className={cn('text-base font-bold', textColors.primary)}>{title}</h2>
        {limit !== undefined && (
          <Link
            href={`${passRoutes.notices}?type=${type}`}
            className={cn('text-xs font-medium hover:underline', primaryColors.textOnLight)}
          >
            전체 보기
          </Link>
        )}
      </header>

      {visible === null && (
        <ul>
          {[0, 1, 2].map((row) => (
            <li key={row} className={cn('border-b px-5 py-4 last:border-b-0', borderColors.light)}>
              <div className={cn('h-4 w-3/4 animate-pulse rounded', bgColors.panel)} />
            </li>
          ))}
        </ul>
      )}

      {visible !== null && visible.length === 0 && (
        <p className={cn('px-5 py-10 text-center text-sm', textColors.tertiary)}>
          등록된 게시글이 없습니다.
        </p>
      )}

      {visible !== null && visible.length > 0 && (
        <ul>
          {visible.map((post) => (
            <PostAccordionRow key={post.id} post={post} onGone={onGone} />
          ))}
        </ul>
      )}
    </section>
  );
};
