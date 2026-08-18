'use client';

import { useEffect, useId, useState } from 'react';
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
  /**
   * Category 그룹 안에 놓인 행은 배지를 숨긴다 — 그룹 머리가 이미 말한 것을
   * 행마다 다시 말하면 같은 사실이 자리를 두 번 쓴다.
   */
  showCategory?: boolean;
  /**
   * 처음부터 펼쳐 둔다. 목록의 첫 글에만 붙는다 — 빈 목록 칸을 글로 채우는 것이
   * 목적이라 한 건이면 된다.
   */
  defaultOpen?: boolean;
}

export const PostAccordionRow = ({
  post,
  onGone,
  showCategory = true,
  defaultOpen = false,
}: PostAccordionRowProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [body, setBody] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const panelId = useId();

  /**
   * 본문 요청을 누르는 동작이 아니라 **펼쳐진 상태**에 매단다. 처음부터 펼친 행은
   * 누른 적이 없어서, 요청이 toggle 안에 있으면 본문이 영영 오지 않는다.
   *
   * 받아 둔 본문은 유지한다 — 접었다 펴도 `body` 가 남아 있어 다시 요청하지
   * 않는다(§5 본문 로딩).
   */
  useEffect(() => {
    if (!open || body !== null || failed) return;
    let alive = true;
    getPost(post.id)
      .then((detail) => { if (alive) setBody(detail.contents.ko); })
      .catch((error) => {
        if (!alive) return;
        // 404 = 목록을 받은 뒤 숨김 처리된 글. 독자에게 보일 오류가 아니라
        // 그냥 없는 행이다.
        if (error instanceof Error && 'status' in error && error.status === 404) {
          onGone(post.id);
          return;
        }
        setFailed(true);
      });
    return () => { alive = false; };
  }, [open, body, failed, post.id, onGone]);

  const parsed = body === null
    ? null
    : validateGuideHtml(body, { allowImages: true, imageSrcPrefixes: POST_IMAGE_SRC_PREFIXES });

  return (
    <li className="border-b border-[#F3F4F6] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        // 캐럿은 눈에 보이는 지시자, aria-controls 는 그 접근성 등가물이다. 한 쌍이라
        // 하나만 두면 화면 읽는 사람에게는 상태만 있고 대상이 없다.
        aria-controls={panelId}
        className={cn(
          'focus-visible:outline-2 focus-visible:outline-[#0064FF] focus-visible:-outline-offset-2',
          postStyles.entryRow,
          'border-b-0',
          open && postStyles.entryRowOpen,
        )}
      >
        <span
          aria-hidden
          className={cn(
            postStyles.entryRail,
            post.pinned && postStyles.entryRailPinned,
            open && postStyles.entryRailOn,
          )}
        />

        <span className={postStyles.entryDate}>{formatPostDate(post.publishedAt)}</span>

        <span className={postStyles.entryMain}>
          {/* 배지줄과 제목이 다른 줄에 있어야 제목이 행의 주어가 된다 —
              한 줄에 나란하면 크기 한 단 차이뿐이라 계층이 서지 않는다. */}
          {(post.pinned || (showCategory && post.categoryName)) && (
            <span className={postStyles.rowMeta}>
              {post.pinned && <PinBadge />}
              {showCategory && post.categoryName && <CategoryBadge name={post.categoryName} />}
            </span>
          )}
          <span className={cn(postStyles.entryTitle, open && postStyles.entryTitleOpen)}>
            {post.titles.ko}
          </span>
        </span>

        <span className={postStyles.entryCaretSlot}>
          <span className={cn(postStyles.caret, open && postStyles.caretOpen)} />
        </span>
      </button>

      <div
        id={panelId}
        className={cn(postStyles.panelGrid, open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              postStyles.panelBg,
              postStyles.panelBody,
              postStyles.panelEdge,
              postStyles.panelFade,
              open ? postStyles.panelFadeOn : postStyles.panelFadeOff,
            )}
          >
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
