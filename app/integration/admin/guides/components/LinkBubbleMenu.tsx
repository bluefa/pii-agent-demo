'use client';

/**
 * Guide CMS — inline link bubble menu for the editor toolbar.
 *
 * Three entry points converge on the same bubble UI:
 *  1. Drag-select text → bubble auto-shows above the selection.
 *  2. Click an existing link → Link.enableClickSelection sets the
 *     selection to the mark range → bubble auto-shows pre-filled.
 *  3. Toolbar 🔗 / ⌘K → trigger() force-shows via pluginKey meta.
 *
 * URL value, error, and IME composition state stay inside this
 * component. The parent owns the editor and a ref to call trigger().
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { PluginKey } from '@tiptap/pm/state';

import { Button } from '@/app/components/ui/Button';
import { bgColors, borderColors, cn, inputStyles, statusColors } from '@/lib/theme';

import {
  getSelectedLinkHref,
  isAllowedLinkHref,
} from '@/app/integration/admin/guides/components/editor-link';

export const linkBubblePluginKey = new PluginKey('linkBubble');

export interface LinkBubbleMenuHandle {
  /** Force-show the bubble + focus the URL input. Wired to ⌘K and toolbar 🔗. */
  trigger: () => void;
}

interface LinkBubbleMenuProps {
  editor: Editor | null;
  disabled: boolean;
}

const SCHEME_ERROR = 'https://, mailto:, 또는 /로 시작해야 합니다.';

export const LinkBubbleMenu = forwardRef<LinkBubbleMenuHandle, LinkBubbleMenuProps>(
  ({ editor, disabled }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isComposingRef = useRef(false);
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Sync the input value to the active link's href whenever selection
    // changes — required so clicking into an existing link shows its URL
    // pre-filled (scenario C in the spec).
    useEffect(() => {
      if (!editor) return;
      const sync = (): void => {
        const next = editor.isActive('link') ? getSelectedLinkHref(editor) : '';
        setValue(next);
        setError(null);
      };
      sync();
      editor.on('selectionUpdate', sync);
      return () => {
        editor.off('selectionUpdate', sync);
      };
    }, [editor]);

    const closeAndRestoreFocus = useCallback(() => {
      if (!editor) return;
      editor.view.dispatch(editor.state.tr.setMeta(linkBubblePluginKey, 'hide'));
      editor.commands.focus();
    }, [editor]);

    const trigger = useCallback(() => {
      if (!editor || disabled) return;
      editor.view.dispatch(editor.state.tr.setMeta(linkBubblePluginKey, 'show'));
      // Bubble element is appended on 'show' — defer focus to next frame
      // so the input node exists in the DOM.
      requestAnimationFrame(() => {
        editor.view.dispatch(
          editor.state.tr.setMeta(linkBubblePluginKey, 'updatePosition'),
        );
        const node = inputRef.current;
        if (!node) return;
        node.focus();
        node.select();
      });
    }, [editor, disabled]);

    useImperativeHandle(ref, () => ({ trigger }), [trigger]);

    const apply = useCallback(() => {
      if (!editor) return;
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        if (editor.isActive('link')) {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
        }
        closeAndRestoreFocus();
        return;
      }
      if (!isAllowedLinkHref(trimmed)) {
        setError(SCHEME_ERROR);
        return;
      }
      const { selection } = editor.state;
      if (selection.empty && !editor.isActive('link')) {
        // Empty caret + no link mark: insert the URL itself as visible
        // text with the link mark. Otherwise selection / mark range
        // already carries the visible text.
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'text',
            text: trimmed,
            marks: [{ type: 'link', attrs: { href: trimmed } }],
          })
          .run();
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
      }
      closeAndRestoreFocus();
    }, [editor, value, closeAndRestoreFocus]);

    const remove = useCallback(() => {
      if (!editor) return;
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      closeAndRestoreFocus();
    }, [editor, closeAndRestoreFocus]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeAndRestoreFocus();
          return;
        }
        if (event.key === 'Enter') {
          // IME composing → let the IME consume Enter (Korean composition).
          if (isComposingRef.current || event.nativeEvent.isComposing) return;
          event.preventDefault();
          apply();
        }
      },
      [apply, closeAndRestoreFocus],
    );

    if (!editor) return null;

    return (
      <BubbleMenu
        editor={editor}
        pluginKey={linkBubblePluginKey}
        shouldShow={({ editor: e, state }) => {
          if (!e.isEditable) return false;
          if (!state.selection.empty) return true;
          // Empty selection still allowed when caret sits on a link
          // (covers click-to-edit + ⌘K / 🔗 force-show on existing links).
          return e.isActive('link');
        }}
        options={{ placement: 'top' }}
      >
        <div
          role="group"
          aria-label="링크 편집"
          className={cn(
            'flex flex-col gap-1.5 rounded-lg border shadow-md p-2 w-[420px]',
            bgColors.surface,
            borderColors.default,
          )}
          // Clicks inside the bubble must not move the editor selection.
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true">🔗</span>
            <label className="sr-only" htmlFor="link-bubble-input">URL</label>
            <input
              ref={inputRef}
              id="link-bubble-input"
              type="text"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className={cn(inputStyles.base, error && inputStyles.error)}
              disabled={disabled}
            />
            <Button variant="primary" onClick={apply} disabled={disabled}>적용</Button>
            {editor.isActive('link') && (
              <Button variant="secondary" onClick={remove} disabled={disabled}>
                제거
              </Button>
            )}
          </div>
          {error && (
            <p
              role="alert"
              aria-live="polite"
              className={cn('text-xs px-1', statusColors.error.text)}
            >
              {error}
            </p>
          )}
        </div>
      </BubbleMenu>
    );
  },
);
LinkBubbleMenu.displayName = 'LinkBubbleMenu';
