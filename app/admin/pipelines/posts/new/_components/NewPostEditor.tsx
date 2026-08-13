'use client';

import { useSearchParams } from 'next/navigation';
import { PostEditorForm } from '@/app/admin/pipelines/posts/_components/PostEditorForm';
import { parsePostType } from '@/lib/types/post';

/** `?type=` 로 어느 카드의 "게시글 등록"에서 왔는지 받는다. 없으면 공지사항. */
export const NewPostEditor = () => {
  const type = parsePostType(useSearchParams().get('type')) ?? 'NOTICE';
  return <PostEditorForm type={type} />;
};
