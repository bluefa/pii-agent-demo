'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PostBoardCard } from '@/app/notices/_components/PostBoardCard';
import { listPosts } from '@/app/lib/api/posts';
import { passRoutes } from '@/lib/routes';
import { cn, textColors } from '@/lib/theme';
import { parsePostType, type PostSummary } from '@/lib/types/post';

/** Rows shown per card on the two-card view before 전체 보기 takes over. */
const CARD_ROWS = 5;

export const NoticeBoardView = () => {
  // `?type=` switches the same screen between the side-by-side summary and one
  // full list. One route, one data source — the listing is not a second page
  // with its own fetching to keep in sync.
  const focus = parsePostType(useSearchParams().get('type'));

  const [posts, setPosts] = useState<PostSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    listPosts()
      .then((loaded) => { if (alive) setPosts(loaded); })
      .catch(() => { if (alive) setPosts([]); });
    return () => { alive = false; };
  }, []);

  // A row that 404s on expand was hidden after this list loaded. Drop it here
  // rather than leaving a row that opens to nothing.
  const dropPost = useCallback((postId: number) => {
    setPosts((current) => current?.filter((post) => post.id !== postId) ?? null);
  }, []);

  const byType = (type: 'NOTICE' | 'FAQ') =>
    posts === null ? null : posts.filter((post) => post.type === type);

  if (focus) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <Link
          href={passRoutes.notices}
          className={cn('text-xs font-medium hover:underline', textColors.tertiary)}
        >
          ← 공지사항 · FAQ
        </Link>
        <div className="mt-4">
          <PostBoardCard
            title={focus === 'NOTICE' ? '공지사항' : 'FAQ'}
            type={focus}
            posts={byType(focus)}
            onGone={dropPost}
          />
        </div>
      </div>
    );
  }

  return (
    // 2 equal columns. min-w-0 lives on the card so a long title truncates
    // instead of widening its own column and squeezing the other one.
    <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-6 py-8">
      <PostBoardCard
        title="공지사항"
        type="NOTICE"
        posts={byType('NOTICE')}
        limit={CARD_ROWS}
        onGone={dropPost}
      />
      <PostBoardCard
        title="FAQ"
        type="FAQ"
        posts={byType('FAQ')}
        limit={CARD_ROWS}
        onGone={dropPost}
      />
    </div>
  );
};
