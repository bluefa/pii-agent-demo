'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  statusColors,
  textColors,
  tossShadow,
} from '@/lib/theme';
import { isAllowedHref, normalizeHref } from '@/lib/utils/validate-guide-html';

interface PostLinkBubbleProps {
  editor: Editor;
  /** 툴바 버튼이나 Cmd+K 가 연 편집 모드. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

/**
 * Addressable so this component can drive the plugin directly. Left to its
 * default, BubbleMenu builds a fresh `PluginKey` that nothing outside it can
 * name.
 */
const BUBBLE_KEY = 'postLinkBubble';

/**
 * Link editing, anchored to the link itself.
 *
 * Replaces `window.prompt`, which could only ask one question ("what is the
 * URL?") and could not answer the two an author actually has — what is this
 * link pointing at, and how do I take it off. A prompt also loses the selection
 * behind a modal, so the text being linked is not on screen while its address
 * is being typed.
 *
 * Two modes on one surface, because they are two states of one object:
 *  - view — the caret is inside a link. Shows where it goes, and offers 편집 · 해제.
 *  - edit — an address field. Enter applies, Esc cancels.
 */
export const PostLinkBubble = ({ editor, editing, onEditingChange }: PostLinkBubbleProps) => {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 열리자마자 주소가 통째로 선택돼 있어야 한다 — 고치러 온 사람은 바로 덮어쓰고,
  // 새로 넣는 사람은 빈 칸을 만난다.
  useEffect(() => {
    if (!editing) return;
    // 패널이 DOM 에 붙는 시점은 floating-ui 의 위치 계산 promise 가 끝난 뒤다.
    // requestAnimationFrame 은 그보다 이르게 와서 아직 떨어져 있는 input 에
    // focus 를 걸고 조용히 실패한다 — 매크로태스크라야 microtask 뒤에 선다.
    const timer = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => window.clearTimeout(timer);
  }, [editing]);

  // 닫는 길이 여럿(Esc · 취소 · 적용 · 본문 클릭)이라 하나로 모은다. 오류를 여기서
  // 지우는 이유: 남겨 두면 잘못된 주소로 닫았다가 다시 연 사람이, 아직 아무것도
  // 입력하지 않았는데 빨간 문구부터 마주한다.
  const close = useCallback(() => {
    setError(null);
    onEditingChange(false);
  }, [onEditingChange]);

  // 편집 중에 본문의 다른 곳을 클릭하면 닫는다 — 패널이 캐럿을 따라다니면서
  // 열려 있으면, 어느 링크를 고치는 중인지 화면이 더 이상 말하지 못한다.
  useEffect(() => {
    if (!editing) return;
    editor.on('selectionUpdate', close);
    return () => { editor.off('selectionUpdate', close); };
  }, [editing, editor, close]);

  // BubbleMenu 는 선택이나 문서가 바뀐 트랜잭션에서만 shouldShow 를 다시 부른다
  // (`updateHandler` 의 `isSame` 게이트). 편집 모드는 둘 다 건드리지 않고 켜지므로
  // 이 신호가 없으면 툴바 버튼을 눌러도 패널이 영원히 안 뜬다.
  useEffect(() => {
    const visible = editing || editor.isActive('link');
    editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_KEY, visible ? 'show' : 'hide'));
  }, [editing, editor]);

  // 닫으면 커서를 본문으로 돌려준다. 닫는 손잡이(Esc · 취소) 안에서 focus() 를
  // 부르는 것으로는 부족하다 — 그 다음 커밋에서 React 가 focus 를 쥔 input 을
  // 떼어내고, focus 는 body 로 떨어진다. 주소 하나 고칠 때마다 본문을 다시
  // 클릭해야 하는 게 이 화면이 어려웠던 이유의 절반이다.
  const wasEditing = useRef(false);
  useEffect(() => {
    const closed = wasEditing.current && !editing;
    wasEditing.current = editing;
    if (!closed) return;
    // `editor.commands.focus()` 가 아니라 ProseMirror 를 직접 부른다: Tiptap 의
    // focus 커맨드는 `view.hasFocus()` 면 아무것도 하지 않고 돌아가는데, 이 시점의
    // 판정이 패널이 떨어져 나가며 생기는 blur 와 엇갈려서 그냥 반환하고 만다.
    const timer = window.setTimeout(() => editor.view.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [editing, editor]);

  const apply = () => {
    const href = normalizeHref(inputRef.current?.value ?? '');
    if (!isAllowedHref(href)) {
      setError('http · https · mailto · /경로 만 넣을 수 있습니다');
      return;
    }
    const { from, to } = editor.state.selection;
    const chain = editor.chain().focus();
    if (from === to && !editor.isActive('link')) {
      // 고를 글자가 없으면 주소가 곧 글자다.
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain.extendMarkRange('link').setLink({ href }).run();
    }
    close();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    close();
  };

  const href = String(editor.getAttributes('link').href ?? '');

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={BUBBLE_KEY}
      shouldShow={({ editor: instance }) => editing || instance.isActive('link')}
      className={cn(
        // relative: 오류 문구가 `absolute` 로 패널 아래에 붙는다.
        'relative flex items-center gap-1 rounded-lg border px-1.5 py-1.5',
        borderColors.default,
        bgColors.surface,
        tossShadow.md,
      )}
    >
      {editing ? (
        <>
          {/* 비제어다. 이 칸은 편집 모드에서만 존재하고 닫히면 사라지므로 열릴 때
              지금 href 로 한 번 심으면 끝이고, 값을 state 로 들면 그걸 심어 주는
              effect 가 필요해진다 — effect 안의 setState 는 렌더를 한 번 더 돈다. */}
          <input
            ref={inputRef}
            defaultValue={href}
            onChange={() => setError(null)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); apply(); }
              if (event.key === 'Escape') { event.preventDefault(); close(); }
            }}
            placeholder="https://… 또는 /경로"
            aria-label="링크 주소"
            aria-invalid={error !== null}
            className={cn(
              'w-64 rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-2',
              error ? statusColors.error.border : borderColors.default,
              textColors.primary,
              primaryColors.focusRing,
            )}
          />
          <button type="button" onClick={apply} className={cn(bubbleButton, primaryColors.textOnLight)}>
            적용
          </button>
          <button
            type="button"
            onClick={close}
            className={cn(bubbleButton, textColors.secondary)}
          >
            취소
          </button>
          {error && (
            // 패널 밖 아래로 — 안에 넣으면 오류가 뜰 때마다 입력 칸이 옆으로 밀린다.
            <span
              role="alert"
              className={cn(
                'absolute left-0 top-full mt-1 whitespace-nowrap text-[12px]',
                statusColors.error.textDark,
              )}
            >
              {error}
            </span>
          )}
        </>
      ) : (
        <>
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
          <button type="button" onClick={() => onEditingChange(true)} className={cn(bubbleButton, textColors.secondary)}>
            편집
          </button>
          <button type="button" onClick={remove} className={cn(bubbleButton, textColors.secondary)}>
            링크 해제
          </button>
        </>
      )}
    </BubbleMenu>
  );
};

const bubbleButton = cn(
  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
  bgColors.panelHover,
);
