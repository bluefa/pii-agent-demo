'use client';

import { useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  textColors,
  tossShadow,
} from '@/lib/theme';

interface PostLinkBubbleProps {
  editor: Editor;
  /** 편집 — 두 값(글자·주소)을 다 받는 모달을 연다. */
  onEdit: () => void;
}

/**
 * 캐럿이 링크 안에 있을 때 링크 위에 뜨는 띠.
 *
 * 여기서는 아무것도 고치지 않는다 — 링크가 어디로 가는지 보여 주고, 고칠 곳(모달)과
 * 뗄 방법을 준다. 주소 칸을 이 띠 안에 뒀던 때는 주소만 고칠 수 있었고, 정작 화면에
 * 보이는 글자는 본문에서 따로 고쳐야 해서 한 링크를 두 군데서 만져야 했다.
 */
export const PostLinkBubble = ({ editor, onEdit }: PostLinkBubbleProps) => {
  // 렌더 중에 그냥 읽으면 안 된다 — 부모는 트랜잭션마다 다시 그리지 않으므로 캐럿이
  // 다른 링크로 옮겨 가도 이 값이 처음 잡은 주소에 머문다. 띠는 옆 링크의 주소를
  // 보여 주고, 그 상태로 "편집"을 누르면 엉뚱한 주소가 모달에 실린다.
  const href = useEditorState({
    editor,
    selector: ({ editor: instance }) => String(instance.getAttributes('link').href ?? ''),
  });

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: instance }) => instance.isActive('link')}
      className={cn(
        'flex items-center gap-1 rounded-lg border px-1.5 py-1.5',
        borderColors.default,
        bgColors.surface,
        tossShadow.md,
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        title={href}
        className={cn('max-w-[240px] truncate px-1.5 text-xs underline', primaryColors.textOnLight)}
      >
        {href}
      </a>
      <span className={cn('mx-0.5 h-4 w-px', bgColors.divider)} />
      <button type="button" onClick={onEdit} className={cn(bubbleButton, textColors.secondary)}>
        편집
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
        className={cn(bubbleButton, textColors.secondary)}
      >
        링크 해제
      </button>
    </BubbleMenu>
  );
};

const bubbleButton = cn(
  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
  bgColors.panelHover,
);
