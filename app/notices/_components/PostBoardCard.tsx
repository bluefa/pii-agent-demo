'use client';

import Link from 'next/link';
import { useLocale } from '@/app/components/LocaleProvider';
import { POST_COPY } from '@/app/notices/_components/copy';
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
  /** 배너가 지목한 글. 5행 밖에 있어도 이 카드는 그 한 행을 마저 그린다. */
  openId?: number | null;
}

export const PostBoardCard = ({
  title,
  type,
  posts,
  limit,
  onGone,
  openId = null,
}: PostBoardCardProps) => {
  const t = POST_COPY[useLocale().locale];
  const capped = posts === null ? null : (limit === undefined ? posts : posts.slice(0, limit));
  // 잘린 뒤에 지목된 글이면 붙여 준다 — 없는 행으로는 스크롤도 펼침도 갈 데가 없다.
  const beyond = capped === null || openId === null || capped.some((post) => post.id === openId)
    ? undefined
    : posts?.find((post) => post.id === openId);
  const visible = capped === null ? null : (beyond ? [...capped, beyond] : capped);

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
        <p className={postStyles.emptyRow}>{t.empty}</p>
      )}

      {visible !== null && visible.length > 0 && (
        <ul>
          {visible.map((post) => (
            // 지목된 행만 `key` 가 달라진다 — 펼침은 행이 들고 있는 상태라, 다시
            // 세워야 `defaultOpen` 이 다시 읽힌다. 배너를 눌러 이미 화면에 있는
            // 행을 열 수 있는 유일한 방법이다.
            <PostAccordionRow
              key={post.id === openId ? `${post.id}-open` : post.id}
              post={post}
              onGone={onGone}
              defaultOpen={post.id === openId}
            />
          ))}
        </ul>
      )}

      {limit !== undefined && (
        <Link href={`${passRoutes.notices}?type=${type}`} className={postStyles.cardMore}>
          {t.viewAll}
        </Link>
      )}
    </section>
  );
};
