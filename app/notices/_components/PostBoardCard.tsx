'use client';

import Link from 'next/link';
import { PostAccordionRow } from '@/app/notices/_components/PostAccordionRow';
import { bgColors, cn, postStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import type { PostSummary, PostType } from '@/lib/types/post';

interface PostBoardCardProps {
  title: string;
  type: PostType;
  posts: PostSummary[] | null;
  /** 이 수를 넘는 행은 전체보기 뒤에 둔다. 생략하면 전부 그린다. */
  limit?: number;
  onGone: (postId: number) => void;
}

export const PostBoardCard = ({ title, type, posts, limit, onGone }: PostBoardCardProps) => {
  const visible = posts === null ? null : (limit === undefined ? posts : posts.slice(0, limit));

  return (
    <section className={cn('flex min-w-0 flex-col', postStyles.card)}>
      <header className={postStyles.cardHeader}>
        <h2 className={postStyles.cardTitle}>{title}</h2>
        {/* 건수가 있어야 "전체보기"에 누를 이유가 생긴다. 5건만 보이는데
            전체가 몇 건인지 말하지 않으면 링크가 그냥 장식이다. */}
        {posts !== null && <span className={postStyles.cardCount}>{posts.length}</span>}
      </header>

      {visible === null && (
        <ul>
          {[0, 1, 2].map((row) => (
            <li key={row} className={cn(postStyles.row, 'block')}>
              <div className={cn('h-4 w-3/4 animate-pulse rounded', bgColors.divider)} />
            </li>
          ))}
        </ul>
      )}

      {visible !== null && visible.length === 0 && (
        <p className="px-[22px] py-10 text-center text-[14px] text-[#6B7280]">
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

      {limit !== undefined && (
        <Link href={`${passRoutes.notices}?type=${type}`} className={postStyles.cardMore}>
          전체보기 →
        </Link>
      )}
    </section>
  );
};
