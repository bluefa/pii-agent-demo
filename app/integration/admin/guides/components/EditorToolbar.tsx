'use client';

/**
 * Guide CMS — Tiptap toolbar (7 commands).
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-b-editor.md §Step 2 +
 * design/guide-cms/components.md §4.
 *
 * Roving tabindex: Tab enters the active button (or button 0 when
 * nothing has been triggered); ←/→ move focus and update the active
 * index. Each button calls Tiptap commands directly through the chain
 * API and re-syncs by reading `editor.isActive(...)` for the visual
 * "pressed" state.
 *
 * Accessibility: `role="toolbar"` with Korean aria-labels.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';

import { useModal } from '@/app/hooks/useModal';
import { bgColors, cardStyles, cn, primaryColors } from '@/lib/theme';

import { LinkPromptModal } from '@/app/integration/admin/guides/components/LinkPromptModal';
import { getSelectedLinkHref } from '@/app/integration/admin/guides/components/editor-link';

interface EditorToolbarProps {
  editor: Editor | null;
  /** Disabled when GET is loading or PUT is in flight. */
  disabled: boolean;
}

interface ToolbarButtonSpec {
  id: 'h4' | 'bold' | 'italic' | 'code' | 'bulletList' | 'orderedList' | 'link';
  label: string;
  shortcut: string;
  /** Visual glyph rendered inside the button. */
  glyph: React.ReactNode;
  isActive: (editor: Editor) => boolean;
  /** Returned undefined for `link` — that one opens the modal instead. */
  apply?: (editor: Editor) => void;
}

const TOOLBAR_BUTTONS: readonly ToolbarButtonSpec[] = [
  {
    id: 'h4',
    label: '제목 4',
    shortcut: '⌘⇧4',
    glyph: <span className="font-bold text-[12px]">H4</span>,
    isActive: (editor) => editor.isActive('heading', { level: 4 }),
    apply: (editor) => {
      editor.chain().focus().toggleHeading({ level: 4 }).run();
    },
  },
  {
    id: 'bold',
    label: '굵게',
    shortcut: '⌘B',
    glyph: <span className="font-bold text-[13px]">B</span>,
    isActive: (editor) => editor.isActive('bold'),
    apply: (editor) => {
      editor.chain().focus().toggleBold().run();
    },
  },
  {
    id: 'italic',
    label: '기울임',
    shortcut: '⌘I',
    glyph: <span className="italic font-semibold text-[13px]">I</span>,
    isActive: (editor) => editor.isActive('italic'),
    apply: (editor) => {
      editor.chain().focus().toggleItalic().run();
    },
  },
  {
    id: 'code',
    label: '인라인 코드',
    shortcut: '⌘E',
    glyph: <span className="font-mono text-[11px]">{'</>'}</span>,
    isActive: (editor) => editor.isActive('code'),
    apply: (editor) => {
      editor.chain().focus().toggleCode().run();
    },
  },
  {
    id: 'bulletList',
    label: '글머리 기호 목록',
    shortcut: '⌘⇧8',
    glyph: <span aria-hidden="true">•</span>,
    isActive: (editor) => editor.isActive('bulletList'),
    apply: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    id: 'orderedList',
    label: '번호 매김 목록',
    shortcut: '⌘⇧7',
    glyph: <span aria-hidden="true" className="text-[12px]">1.</span>,
    isActive: (editor) => editor.isActive('orderedList'),
    apply: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    id: 'link',
    label: '링크',
    shortcut: '⌘K',
    glyph: <span aria-hidden="true">🔗</span>,
    isActive: (editor) => editor.isActive('link'),
    // apply omitted — link click opens the modal so this button does not
    // fire a direct chain command.
  },
];

// Group dividers — render a vertical separator before the button at
// each index in this set (matches the design's grouping:
// [H4] | [B I </>] | [• 1.] | [🔗]).
const DIVIDER_BEFORE = new Set<number>([1, 4, 6]);

export const EditorToolbar = ({ editor, disabled }: EditorToolbarProps) => {
  const [focusIdx, setFocusIdx] = useState(0);
  const linkModal = useModal();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Re-render on selection / transaction so `isActive(...)` stays fresh.
  // Tiptap exposes update events through the editor — subscribing is
  // cheaper than calling `useEditorState` because the toolbar only
  // depends on isActive booleans.
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const trigger = (): void => forceUpdate((tick) => tick + 1);
    editor.on('selectionUpdate', trigger);
    editor.on('transaction', trigger);
    return () => {
      editor.off('selectionUpdate', trigger);
      editor.off('transaction', trigger);
    };
  }, [editor]);

  const focusButton = useCallback((idx: number) => {
    buttonRefs.current[idx]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = (idx + direction + TOOLBAR_BUTTONS.length) % TOOLBAR_BUTTONS.length;
      setFocusIdx(next);
      focusButton(next);
    },
    [focusButton],
  );

  const handleClick = useCallback(
    (idx: number) => {
      if (!editor || disabled) return;
      const spec = TOOLBAR_BUTTONS[idx];
      setFocusIdx(idx);
      if (spec.id === 'link') {
        linkModal.open();
        return;
      }
      spec.apply?.(editor);
    },
    [editor, disabled, linkModal],
  );

  // ⌘K → open link modal even when focus is inside the editor body.
  // Suppressed when disabled so loading / saving cannot stage a write.
  useEffect(() => {
    if (!editor || disabled) return;
    const handler = (event: KeyboardEvent): void => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        linkModal.open();
      }
    };
    const root = editor.view.dom;
    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
  }, [editor, disabled, linkModal]);

  const submitLink = useCallback(
    (href: string) => {
      if (!editor) return;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    },
    [editor],
  );

  const unsetLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  }, [editor]);

  return (
    <>
      <div
        role="toolbar"
        aria-label="가이드 편집 툴바"
        aria-disabled={disabled || !editor ? 'true' : undefined}
        className={cardStyles.toolbarSurface}
      >
        {TOOLBAR_BUTTONS.map((spec, idx) => {
          const active = editor ? spec.isActive(editor) : false;
          const isCurrent = idx === focusIdx;
          return (
            <span key={spec.id} className="inline-flex items-center">
              {DIVIDER_BEFORE.has(idx) && (
                <span
                  aria-hidden="true"
                  className={cn('w-px h-[18px] mx-1', bgColors.divider)}
                />
              )}
              <button
                ref={(el) => {
                  buttonRefs.current[idx] = el;
                }}
                type="button"
                tabIndex={isCurrent ? 0 : -1}
                aria-label={`${spec.label} (${spec.shortcut})`}
                aria-pressed={active}
                disabled={disabled || !editor}
                onClick={() => handleClick(idx)}
                onKeyDown={(event) => handleKeyDown(event, idx)}
                className={cn(
                  cardStyles.toolbarBtn,
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline',
                  primaryColors.focusRing,
                  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
                  active && cardStyles.toolbarBtnActive,
                )}
              >
                {spec.glyph}
              </button>
            </span>
          );
        })}
      </div>
      {linkModal.isOpen && (
        <LinkPromptModal
          initialHref={getSelectedLinkHref(editor)}
          onSubmit={submitLink}
          onUnset={unsetLink}
          onClose={linkModal.close}
        />
      )}
    </>
  );
};
