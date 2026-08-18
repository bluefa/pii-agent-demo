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

interface PostImageBubbleProps {
  editor: Editor;
}

/**
 * 고른 이미지의 폭.
 *
 * 자유 드래그가 아니라 네 칸이다. 계약이 `img` 에 허용하는 것은 `src alt width
 * height` 뿐이라 폭은 픽셀 하나로 적히는데, 그걸 손으로 끌게 두면 한 글 안에서
 * 613px · 588px 같은 값이 섞이고 읽는 화면에서 사진마다 왼쪽 끝이 어긋난다.
 *
 * 값의 출처: medium 640 은 이 앱이 읽기 폭으로 쓰는 62ch(`postStyles.entryTitle`,
 * 14px 기준 ≈ 620px)에서 왔다. small 은 그 절반, large 는 1.5배다.
 */
const PRESETS = [
  { label: 'S', width: 320, title: '작게 (320px)' },
  { label: 'M', width: 640, title: '보통 (640px) — 읽기 폭' },
  { label: 'L', width: 960, title: '크게 (960px)' },
] as const;

export const PostImageBubble = ({ editor }: PostImageBubbleProps) => {
  const width = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      const value = instance.getAttributes('postImage').width;
      return typeof value === 'number' ? value : null;
    },
  });

  /**
   * 비율은 파일에서 읽는다. 속성에 적힌 width/height 는 방금 우리가 덮어쓴 값이라
   * 거기서 비율을 다시 구하면 조정할 때마다 반올림 오차가 쌓인다.
   */
  const resize = (next: number | null) => {
    const image = editor.view.dom.querySelector<HTMLImageElement>('img.ProseMirror-selectednode');
    const ratio =
      image && image.naturalWidth > 0 ? image.naturalHeight / image.naturalWidth : null;
    editor
      .chain()
      .focus()
      .updateAttributes('postImage', {
        width: next,
        // 원본으로 되돌릴 때 높이를 같이 지운다 — 폭 없이 높이만 남으면 그 높이가
        // 그림을 눌러 찌그러뜨린다.
        height: next === null || ratio === null ? null : Math.round(next * ratio),
      })
      .run();
  };

  const button = (label: string, on: boolean, title: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-xs font-medium transition-colors',
        on
          ? cn(primaryColors.bgLight, primaryColors.textOnLight)
          : cn(textColors.secondary, bgColors.panelHover),
      )}
    >
      {label}
    </button>
  );

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: instance }) => instance.isActive('postImage')}
      className={cn(
        'flex items-center gap-1 rounded-lg border px-1.5 py-1.5',
        borderColors.default,
        bgColors.surface,
        tossShadow.md,
      )}
    >
      {PRESETS.map((preset) =>
        button(preset.label, width === preset.width, preset.title, () => resize(preset.width)),
      )}
      <span className={cn('mx-0.5 h-4 w-px', bgColors.divider)} />
      {button('원본', width === null, '올린 그대로 (폭 지정 없음)', () => resize(null))}
    </BubbleMenu>
  );
};
