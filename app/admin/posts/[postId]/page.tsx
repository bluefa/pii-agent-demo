import { PostEditorForm } from '@/app/admin/posts/_components/PostEditorForm';

/**
 * 게시글 수정. `type` 은 불러온 게시글이 정하므로 여기서 넘기는 값은 첫 렌더용
 * 자리값일 뿐이다 — 계약이 type 변경을 지원하지 않는다.
 */
export default async function EditPostPage(
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  return <PostEditorForm type="NOTICE" postId={Number(postId)} />;
}
