'use client';

import { useId, useState } from 'react';
import { CategoryBadge, PinBadge } from '@/app/notices/_components/PostBadge';
import { renderGuideAst } from '@/app/components/features/process-status/GuideCard/render-guide-ast';
import { getPost } from '@/app/lib/api/posts';
import { POST_IMAGE_SRC_PREFIXES } from '@/lib/constants/post-images';
import { bgColors, cn, postStyles } from '@/lib/theme';
import { formatPostDate, type PostSummary } from '@/lib/types/post';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

interface PostAccordionRowProps {
  post: PostSummary;
  /** 행을 열었더니 숨김 처리된 글이었다 — 목록에서 뺀다. */
  onGone: (postId: number) => void;
}

export const PostAccordionRow = ({ post, onGone }: PostAccordionRowProps) => {
  const [open, setOpen] = useState(false);
  // 본문은 한 번만 받아 두고 유지한다. 접었다 펴도 다시 요청하지 않는다(§5 본문 로딩).
  const [body, setBody] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const panelId = useId();

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || body !== null) return;

    try {
      const detail = await getPost(post.id);
      setBody(detail.contents.ko);
    } catch (error) {
      // 404 = 목록을 받은 뒤 숨김 처리된 글. 독자에게 보일 오류가 아니라
      // 그냥 없는 행이다.
      if (error instanceof Error && 'status' in error && error.status === 404) {
        onGone(post.id);
        return;
      }
      setFailed(true);
    }
  };

  const parsed = body === null
    ? null
    : validateGuideHtml(body, { allowImages: true, imageSrcPrefixes: POST_IMAGE_SRC_PREFIXES });

  return (
    <li className="border-b border-[#F3F4F6] last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        // 캐럿은 눈에 보이는 지시자, aria-controls 는 그 접근성 등가물이다. 한 쌍이라
        // 하나만 두면 화면 읽는 사람에게는 상태만 있고 대상이 없다.
        aria-controls={panelId}
        className={cn(
          'w-full focus-visible:outline-2 focus-visible:outline-[#0064FF] focus-visible:-outline-offset-2',
          postStyles.row,
          'border-b-0',
          postStyles.rowHover,
          open && postStyles.rowOpen,
        )}
      >
        <span className={postStyles.rowMain}>
          <span className={postStyles.rowMeta}>
            {post.pinned && <PinBadge />}
            {post.categoryName && <CategoryBadge name={post.categoryName} />}
          </span>
          {/* 배지줄과 제목이 다른 줄에 있어야 제목이 행의 주어가 된다 —
              한 줄에 나란하면 크기 한 단 차이뿐이라 계층이 서지 않는다. */}
          <span className={cn(postStyles.rowTitle, open && postStyles.rowTitleOpen)}>
            {post.titles.ko}
          </span>
        </span>

        {/* 날짜 위, 캐럿 아래 — 레일이 행 높이를 다 쓰므로 space-between 이 둘을 벌린다. */}
        <span className={postStyles.rowSide}>
          <span className={postStyles.rowDate}>{formatPostDate(post.publishedAt)}</span>
          <span className={cn(postStyles.caret, open && postStyles.caretOpen)} />
        </span>
      </button>

      <div
        id={panelId}
        className={cn(postStyles.panelGrid, open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="overflow-hidden">
          <div className={cn(postStyles.panelBg, postStyles.panelBody)}>
            {failed && <p>본문을 불러오지 못했습니다.</p>}
            {!failed && body === null && (
              <div className={cn('h-4 w-2/3 animate-pulse rounded', bgColors.divider)} />
            )}
            {/* 본문 서식은 `.prose-guide` 가 단일 출처 — 목록·에디터·가이드가 같은 규칙으로 그린다. */}
            {parsed?.valid && <div className="prose-guide">{renderGuideAst(parsed.ast)}</div>}
            {parsed && !parsed.valid && <p>본문 형식이 올바르지 않아 표시할 수 없습니다.</p>}
          </div>
        </div>
      </div>
    </li>
  );
};
