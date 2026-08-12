'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CategoryModal } from '@/app/admin/posts/_components/CategoryModal';
import { PostAdminCard } from '@/app/admin/posts/_components/PostAdminCard';
import { listAdminPosts, setPostHidden, setPostPinned } from '@/app/lib/api/posts';
import { passRoutes } from '@/lib/routes';
import { postStyles } from '@/lib/theme';
import type { AdminPostSummary, PostType } from '@/lib/types/post';

export const PostAdminView = () => {
  const router = useRouter();
  const [posts, setPosts] = useState<AdminPostSummary[] | null>(null);
  const [categoryModal, setCategoryModal] = useState<PostType | null>(null);

  const reload = useCallback(() => {
    listAdminPosts()
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);

  useEffect(reload, [reload]);

  const byType = (type: PostType) =>
    posts === null ? null : posts.filter((post) => post.type === type);

  // 두 전이 모두 서버에서 idempotent 하므로 더블클릭이 사고가 되지 않는다.
  // 뒤에 다시 불러오는 이유는 정렬(고정 먼저)의 주인이 서버이기 때문이다.
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
    onCreate: () => router.push(passRoutes.adminPostNew(type)),
    onEdit: (postId: number) => router.push(passRoutes.adminPostEdit(postId)),
    onManageCategories: () => setCategoryModal(type),
    onTogglePinned: togglePinned,
    onToggleHidden: toggleHidden,
  });

  return (
    <div className={postStyles.page}>
      <div>
        <h1 className={postStyles.pageTitle}>FAQ · 공지사항 관리</h1>
        <p className={postStyles.pageSub}>
          숨김 처리된 게시글을 포함해 전체를 확인할 수 있습니다.
        </p>
      </div>

      <div className={postStyles.dual}>
        <PostAdminCard title="공지사항" {...cardProps('NOTICE')} />
        <PostAdminCard title="FAQ" {...cardProps('FAQ')} />
      </div>

      {/* Category 는 드문 작업이라 모달로 남긴다 — 목록 화면의 일은 목록이다. */}
      {categoryModal && (
        <CategoryModal
          type={categoryModal}
          onClose={() => setCategoryModal(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
};
