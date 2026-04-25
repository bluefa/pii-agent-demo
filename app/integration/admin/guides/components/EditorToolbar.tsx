'use client';

/**
 * Guide CMS — Tiptap toolbar (7 commands) + link-prompt modal.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-b-editor.md §Step 2 +
 * design/guide-cms/components.md §4. Caller scope keeps the LinkPrompt
 * inline here rather than splitting it into its own file (one file per
 * concern was rejected to keep the toolbar surface consolidated).
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

import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import {
  bgColors,
  borderColors,
  cn,
  inputStyles,
  primaryColors,
  shadows,
  textColors,
} from '@/lib/theme';

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
    glyph: <span className="font-bold">H4</span>,
    isActive: (editor) => editor.isActive('heading', { level: 4 }),
    apply: (editor) => {
      editor.chain().focus().toggleHeading({ level: 4 }).run();
    },
  },
  {
    id: 'bold',
    label: '굵게',
    shortcut: '⌘B',
    glyph: <span className="font-bold">B</span>,
    isActive: (editor) => editor.isActive('bold'),
    apply: (editor) => {
      editor.chain().focus().toggleBold().run();
    },
  },
  {
    id: 'italic',
    label: '기울임',
    shortcut: '⌘I',
    glyph: <span className="italic font-semibold">I</span>,
    isActive: (editor) => editor.isActive('italic'),
    apply: (editor) => {
      editor.chain().focus().toggleItalic().run();
    },
  },
  {
    id: 'code',
    label: '인라인 코드',
    shortcut: '⌘E',
    glyph: <span className="font-mono text-xs">{'</>'}</span>,
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
    glyph: <span aria-hidden="true">1.</span>,
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

/**
 * Allowed link href schemes — mirrors the validator in
 * `lib/utils/validate-guide-html.ts`. Kept as a local literal (not
 * imported across files) so the parent's `dynamic(() =>
 * import('./EditorToolbar'))` can keep the Tiptap-prompt surface
 * code-split.
 */
const LINK_HREF_SCHEME_RE = /^(https?:\/\/|mailto:|\/(?!\/))/;

interface LinkPromptModalProps {
  initialHref: string;
  onSubmit: (href: string) => void;
  onUnset: () => void;
  onClose: () => void;
}

/**
 * Mounted only while the prompt is open (parent gates with
 * `linkOpen ? <LinkPromptModal /> : null`). That gives us a fresh
 * component instance per open, so `useState(initialHref)` seeds
 * lazily without a "reset state inside an effect" anti-pattern.
 */
const LinkPromptModal = ({
  initialHref,
  onSubmit,
  onUnset,
  onClose,
}: LinkPromptModalProps) => {
  const [value, setValue] = useState(initialHref);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount. Modal's enter animation can steal focus
  // back to the dialog container — defer focus to the next macrotask.
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const handleSubmit = (): void => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      onUnset();
      onClose();
      return;
    }
    if (!LINK_HREF_SCHEME_RE.test(trimmed)) {
      setError('https://, mailto:, 또는 /로 시작해야 합니다.');
      return;
    }
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="링크 삽입"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleSubmit}>확인</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className={cn('block text-sm font-medium', textColors.secondary)}>
          URL
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="https://example.com"
            className={cn('mt-1', inputStyles.base, error && inputStyles.error)}
          />
        </label>
        {error && (
          <p className={cn('text-xs', textColors.tertiary)} role="alert">{error}</p>
        )}
        <p className={cn('text-xs', textColors.quaternary)}>
          빈 문자열로 저장하면 링크가 해제됩니다.
        </p>
      </div>
    </Modal>
  );
};

const getSelectedLinkHref = (editor: Editor | null): string => {
  if (!editor) return '';
  const attrs = editor.getAttributes('link') as { href?: unknown };
  return typeof attrs.href === 'string' ? attrs.href : '';
};

export const EditorToolbar = ({ editor, disabled }: EditorToolbarProps) => {
  const [focusIdx, setFocusIdx] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
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
      if (!editor) return;
      const spec = TOOLBAR_BUTTONS[idx];
      setFocusIdx(idx);
      if (spec.id === 'link') {
        setLinkOpen(true);
        return;
      }
      spec.apply?.(editor);
    },
    [editor],
  );

  // ⌘K → open link modal even when focus is inside the editor body.
  useEffect(() => {
    if (!editor) return;
    const handler = (event: KeyboardEvent): void => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setLinkOpen(true);
      }
    };
    const root = editor.view.dom;
    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
  }, [editor]);

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
        className={cn('flex items-center gap-1 px-3 py-2 border-b', borderColors.default, bgColors.muted)}
      >
        {TOOLBAR_BUTTONS.map((spec, idx) => {
          const active = editor ? spec.isActive(editor) : false;
          const isCurrent = idx === focusIdx;
          return (
            <button
              key={spec.id}
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
                'min-w-[34px] h-8 px-2 flex items-center justify-center rounded text-sm font-medium transition-colors duration-[120ms]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline',
                primaryColors.focusRing,
                'disabled:opacity-40 disabled:cursor-not-allowed',
                active
                  ? cn('bg-white', primaryColors.text, shadows.card)
                  : cn(textColors.secondary, 'hover:bg-white'),
              )}
            >
              {spec.glyph}
            </button>
          );
        })}
      </div>
      {linkOpen && (
        <LinkPromptModal
          initialHref={getSelectedLinkHref(editor)}
          onSubmit={submitLink}
          onUnset={unsetLink}
          onClose={() => setLinkOpen(false)}
        />
      )}
    </>
  );
};
