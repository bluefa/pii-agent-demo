'use client';

import { useMemo, useState } from 'react';
import {
  PostFilterButton,
  type VisibilityFilter,
} from '@/app/admin/pipelines/posts/_components/PostFilterButton';
import { CategoryBadge, HiddenBadge, PinBadge } from '@/app/notices/_components/PostBadge';
import { Button } from '@/app/components/ui/Button';
import { bgColors, cn, postStyles } from '@/lib/theme';
import { formatPostDate, type AdminPostSummary, type PostType } from '@/lib/types/post';

interface PostAdminCardProps {
  title: string;
  type: PostType;
  posts: AdminPostSummary[] | null;
  onCreate: () => void;
  onEdit: (postId: number) => void;
  onManageCategories: () => void;
  onTogglePinned: (post: AdminPostSummary) => void;
  onToggleHidden: (post: AdminPostSummary) => void;
}

export const PostAdminCard = ({
  title,
  posts,
  onCreate,
  onEdit,
  onManageCategories,
  onTogglePinned,
  onToggleHidden,
}: PostAdminCardProps) => {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [visibility, setVisibility] = useState<VisibilityFilter>(undefined);

  const categories = useMemo(
    () => [...new Set((posts ?? []).map((post) => post.categoryName).filter(Boolean))] as string[],
    [posts],
  );

  const shown = posts?.filter((post) => {
    if (category !== undefined && post.categoryName !== category) return false;
    if (visibility === 'visible' && post.hidden) return false;
    if (visibility === 'hidden' && !post.hidden) return false;
    return true;
  }) ?? null;

  const hiddenCount = posts?.filter((post) => post.hidden).length ?? 0;

  const action = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-[#E5E7EB] px-[11px] py-1.5 text-[12px] font-semibold text-[#4E5968] transition-colors hover:bg-[#F9FAFB]"
    >
      {label}
    </button>
  );

  return (
    <section className={cn('relative flex min-w-0 flex-col', postStyles.card)}>
      <header className={cn(postStyles.cardHeader, 'relative')}>
        <h2 className={postStyles.cardTitle}>{title}</h2>
        {/* 아래 목록의 건수다 — 전체 건수가 아니라. 필터를 걸면 목록은 1행인데 필이
            3을 말하고 있어서, 못 본 2건이 어딘가 있는 것처럼 읽혔다. */}
        {shown !== null && <span className={postStyles.cardCount}>{shown.length}</span>}
        {/* 숨김 건수는 계약 추가 없이 센다 — Admin 목록은 전량을 받는다. */}
        {hiddenCount > 0 && (
          <span className="text-[12px] text-[#6B7280] tabular-nums">숨김 {hiddenCount}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <PostFilterButton
            categories={categories}
            category={category}
            visibility={visibility}
            onCategory={setCategory}
            onVisibility={setVisibility}
          />
          <button
            type="button"
            onClick={onManageCategories}
            className="rounded-md border border-[#E5E7EB] px-[11px] py-1.5 text-[12px] font-semibold text-[#4E5968] transition-colors hover:bg-[#F9FAFB]"
          >
            Category 관리
          </button>
          <Button onClick={onCreate} className="px-3 py-1.5 text-[12px]">＋ 게시글 등록</Button>
        </div>
      </header>

      {shown === null && (
        <ul>
          {[0, 1, 2].map((row) => (
            <li key={row} className={cn(postStyles.row, 'block')}>
              <div className={cn('h-4 w-3/4 animate-pulse rounded', bgColors.divider)} />
            </li>
          ))}
        </ul>
      )}

      {shown !== null && shown.length === 0 && (
        <p className="px-[22px] py-10 text-center text-[14px] text-[#6B7280]">
          {posts?.length ? '조건에 맞는 게시글이 없습니다.' : '등록된 게시글이 없습니다.'}
        </p>
      )}

      {shown !== null && shown.length > 0 && (
        <ul>
          {shown.map((post) => (
            <li
              key={post.id}
              // 숨김은 이 도메인의 유일한 삭제라 그 행이 목록에 영구히 남는다.
              // 배지 하나로는 스캔에 안 걸려서 면 전체로 말한다.
              className={cn(postStyles.row, post.hidden && postStyles.rowHidden)}
            >
              <div className={postStyles.rowMain}>
                <div className={postStyles.rowMeta}>
                  {post.pinned && <PinBadge />}
                  {post.hidden && <HiddenBadge />}
                  {post.categoryName && <CategoryBadge name={post.categoryName} />}
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(post.id)}
                  className={cn(
                    'truncate text-left hover:underline',
                    postStyles.rowTitle,
                    post.hidden && postStyles.rowTitleMuted,
                  )}
                >
                  {post.titles.ko}
                </button>
              </div>

              <div className={postStyles.rowSide}>
                <span className={postStyles.rowDate}>{formatPostDate(post.publishedAt)}</span>
                <span className="flex gap-1.5">
                  {/* 숨긴 글에는 고정을 걸 자리가 없다 — 목록에 없는 글을 그 목록의
                      맨 위로 올리는 버튼이라, 눌러도 화면에서 아무 일도 안 일어난다.
                      숨김을 풀면 고정 버튼이 원래 상태 그대로 돌아온다. */}
                  {!post.hidden &&
                    action(post.pinned ? '고정 해제' : '고정', () => onTogglePinned(post))}
                  {action(post.hidden ? '숨김 해제' : '숨김', () => onToggleHidden(post))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
