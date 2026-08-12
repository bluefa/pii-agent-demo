'use client';

import { useCallback, useEffect, useState } from 'react';
import { CategoryModal } from '@/app/admin/posts/_components/CategoryModal';
import { PostAdminCard } from '@/app/admin/posts/_components/PostAdminCard';
import { PostEditorModal } from '@/app/admin/posts/_components/PostEditorModal';
import { listAdminPosts, setPostHidden, setPostPinned } from '@/app/lib/api/posts';
import { cn, textColors } from '@/lib/theme';
import type { AdminPostSummary, PostType } from '@/lib/types/post';

/** Which modal is open, if any. */
type Dialog =
  | { kind: 'editor'; type: PostType; postId?: number }
  | { kind: 'categories'; type: PostType }
  | null;

export const PostAdminView = () => {
  const [posts, setPosts] = useState<AdminPostSummary[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const reload = useCallback(() => {
    listAdminPosts()
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);

  useEffect(reload, [reload]);

  const byType = (type: PostType) =>
    posts === null ? null : posts.filter((post) => post.type === type);

  // Both toggles are idempotent server-side, so a double click is harmless;
  // reloading afterwards keeps the sort (pinned first) authoritative.
  const togglePinned = async (post: AdminPostSummary) => {
    await setPostPinned(post.id, !post.pinned);
    reload();
  };

  const toggleHidden = async (post: AdminPostSummary) => {
    await setPostHidden(post.id, !post.hidden);
    reload();
  };

  const cardProps = (type: PostType) => ({
    type,
    posts: byType(type),
    onCreate: () => setDialog({ kind: 'editor', type }),
    onEdit: (postId: number) => setDialog({ kind: 'editor', type, postId }),
    onManageCategories: () => setDialog({ kind: 'categories', type }),
    onTogglePinned: togglePinned,
    onToggleHidden: toggleHidden,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <h1 className={cn('mb-6 text-xl font-bold', textColors.primary)}>게시글 관리</h1>

      <div className="grid grid-cols-2 gap-6">
        <PostAdminCard title="공지사항" {...cardProps('NOTICE')} />
        <PostAdminCard title="FAQ" {...cardProps('FAQ')} />
      </div>

      {dialog?.kind === 'editor' && (
        <PostEditorModal
          type={dialog.type}
          postId={dialog.postId}
          onClose={() => setDialog(null)}
          onSaved={reload}
        />
      )}

      {dialog?.kind === 'categories' && (
        <CategoryModal
          type={dialog.type}
          onClose={() => setDialog(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
};
