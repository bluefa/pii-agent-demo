'use client';

import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { PinBadge } from '@/app/notices/_components/PinBadge';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  tableRowLift,
  textColors,
  tossShadow,
} from '@/lib/theme';
import type { AdminPostSummary, PostType } from '@/lib/types/post';

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
}: PostAdminCardProps) => (
  <section className={cn('flex min-w-0 flex-col rounded-xl', bgColors.surface, tossShadow.sm)}>
    <header
      className={cn('flex items-center justify-between border-b px-5 py-4', borderColors.light)}
    >
      <h2 className={cn('text-base font-bold', textColors.primary)}>{title}</h2>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onManageCategories}
          className={cn('text-xs font-medium hover:underline', textColors.tertiary)}
        >
          Category 관리
        </button>
        <Button onClick={onCreate} className="px-3 py-1.5 text-xs">게시글 등록</Button>
      </div>
    </header>

    {posts === null && (
      <ul>
        {[0, 1, 2].map((row) => (
          <li key={row} className={cn('border-b px-5 py-4 last:border-b-0', borderColors.light)}>
            <div className={cn('h-4 w-3/4 animate-pulse rounded', bgColors.panel)} />
          </li>
        ))}
      </ul>
    )}

    {posts?.length === 0 && (
      <p className={cn('px-5 py-10 text-center text-sm', textColors.tertiary)}>
        등록된 게시글이 없습니다.
      </p>
    )}

    {posts !== null && posts.length > 0 && (
      <ul>
        {posts.map((post) => (
          <li
            key={post.id}
            className={cn(
              'flex items-center gap-2 border-b px-5 py-3 last:border-b-0',
              borderColors.light,
              tableRowLift.base,
              tableRowLift.target,
            )}
          >
            {post.pinned && <PinBadge />}
            {/* Hidden is the only removal this feature has, so the row stays
                and says so rather than disappearing. */}
            {post.hidden && <Badge variant="neutral">숨김</Badge>}
            {post.categoryName && (
              <span className={cn('shrink-0 text-xs font-medium', primaryColors.textOnLight)}>
                {post.categoryName}
              </span>
            )}
            <button
              type="button"
              onClick={() => onEdit(post.id)}
              className={cn(
                'min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline',
                post.hidden ? textColors.tertiary : textColors.primary,
              )}
            >
              {post.titles.ko}
            </button>
            <span className={cn('shrink-0 text-xs tabular-nums', textColors.tertiary)}>
              {post.publishedAt.slice(0, 10)}
            </span>
            <button
              type="button"
              onClick={() => onTogglePinned(post)}
              className={cn('shrink-0 text-xs font-medium hover:underline', textColors.tertiary)}
            >
              {post.pinned ? '고정 해제' : '고정'}
            </button>
            <button
              type="button"
              onClick={() => onToggleHidden(post)}
              className={cn('shrink-0 text-xs font-medium hover:underline', textColors.tertiary)}
            >
              {post.hidden ? '복구' : '숨김'}
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);
