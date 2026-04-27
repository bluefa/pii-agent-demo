'use client';

/**
 * Guide CMS — admin editor panel.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-b-editor.md §Step 3-4 +
 * design/guide-cms/components.md §2 GuideEditorPanel.
 *
 * Layout (top → bottom):
 *  - Header  : provider · variant · step · guideName badge
 *  - Scope   : "이 가이드는 N곳에 표시됩니다" (only when N ≥ 2)
 *  - Tabs    : ko / en switcher with filled/empty dot
 *  - Editor  : Tiptap surface (lazy via dynamic) + toolbar
 *  - Action  : 저장 button with state machine
 *
 * Draft state is lifted to the parent (GuidesPage) so the dirty guard
 * hook can compare drafts against the loaded guide and gate
 * navigation. The panel itself is stateless apart from the active
 * language tab (a UI concern only).
 *
 * The route mounts this panel via `dynamic({ ssr: false })` from
 * `page.tsx`, so the Tiptap bundle (StarterKit + Link extension) loads
 * only once a step is selected. Within this file the toolbar is a
 * regular import — both modules already share the same lazy chunk.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import type { Editor } from '@tiptap/core';

import { Button } from '@/app/components/ui/Button';
import { useGuide } from '@/app/hooks/useGuide';
import { useToast } from '@/app/components/ui/toast/useToast';
import { findSlotsForGuide, resolveSlot } from '@/lib/constants/guide-registry';
import { hasGuideContent } from '@/lib/utils/has-guide-content';
import {
  bgColors,
  borderColors,
  cardStyles,
  chipStyles,
  cn,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

import { EditLanguageTabs } from '@/app/integration/admin/guides/components/EditLanguageTabs';
import type { EditorLanguage } from '@/app/integration/admin/guides/components/EditLanguageTabs';
import { EditorToolbar } from '@/app/integration/admin/guides/components/EditorToolbar';
import { LinkBubbleMenu } from '@/app/integration/admin/guides/components/LinkBubbleMenu';
import type { LinkBubbleMenuHandle } from '@/app/integration/admin/guides/components/LinkBubbleMenu';
import { isAllowedLinkHref } from '@/app/integration/admin/guides/components/editor-link';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { GuideContents, GuidePlacement, GuideSlot } from '@/lib/types/guide';

// Tiptap extension configs are stable across renders. Hoisting to
// module scope avoids passing fresh non-primitive option objects into
// `useEditor` every render, which would otherwise trigger Tiptap's
// option-comparison path on every keystroke.
const TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [4] },
    strike: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
  }),
  Link.configure({
    openOnClick: false,
    // Click on a link → selection is set to the mark range so the
    // BubbleMenu (which requires a non-empty selection by default)
    // appears pre-filled with the existing href.
    enableClickSelection: true,
    // Plain URLs typed/pasted into the body must NOT auto-link without
    // running through `isAllowedLinkHref`. Tiptap v3 defaults both to
    // true, so disable explicitly.
    autolink: false,
    linkOnPaste: false,
    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    isAllowedUri: (url) => isAllowedLinkHref(url),
  }),
];

interface GuideEditorPanelProps {
  slotKey: GuideSlotKey;
  draftKo: string;
  draftEn: string;
  /** Active language — controlled by the parent so preview can stay in sync. */
  activeLang: EditorLanguage;
  onChangeLang: (next: EditorLanguage) => void;
  onChangeKo: (next: string) => void;
  onChangeEn: (next: string) => void;
  /** Pushes "is the draft different from the persisted guide?" upwards. */
  onDirtyChange: (dirty: boolean) => void;
  /** Pushes the latest server-side contents so the parent can reset drafts. */
  onLoad: (contents: GuideContents) => void;
}

interface HeaderMeta {
  /** Human-readable single line (used in scope-notice list). */
  fullLabel: string;
  provider: string | null;
  step: number | null;
  /** Step label — rendered as the h2 title in the editor header. */
  stepLabel: string;
  variant: 'AUTO' | 'MANUAL' | null;
}

const buildHeaderMeta = (slot: GuideSlot): HeaderMeta => {
  if (slot.placement.kind !== 'process-step') {
    return {
      fullLabel: slot.guideName,
      provider: null,
      step: null,
      stepLabel: slot.guideName,
      variant: null,
    };
  }
  const variant = 'variant' in slot.placement ? slot.placement.variant ?? null : null;
  const { provider, step, stepLabel } = slot.placement;
  return {
    fullLabel: `${provider}${variant ? ` · ${variant}` : ''} · Step ${step} ${stepLabel}`,
    provider,
    step,
    stepLabel,
    variant,
  };
};

/**
 * Stable React key per slot — the placement discriminator + provider
 * variant + step is unique within a `findSlotsForGuide(...)` result so
 * an array index is not needed (avoids AP-E1).
 */
const slotReactKey = (slot: GuideSlot): string => {
  const placement: GuidePlacement = slot.placement;
  switch (placement.kind) {
    case 'process-step':
      return `process-step:${placement.provider}:${placement.variant ?? 'NA'}:${placement.step}`;
    case 'side-panel':
      return `side-panel:${placement.surface}`;
    case 'tooltip':
      return `tooltip:${placement.surface}:${placement.field}`;
    case 'faq':
      return `faq:${placement.section}:${placement.order}`;
  }
};

type SaveStateMessage =
  | { kind: 'disabled'; text: string }
  | { kind: 'warning'; text: string }
  | { kind: 'error'; text: string };

type SaveStateMessageKind = SaveStateMessage['kind'];

interface SaveStateInputs {
  seeded: boolean;
  koHasContent: boolean;
  enHasContent: boolean;
  dirty: boolean;
  editedKo: boolean;
  editedEn: boolean;
}

const getEmptyContentText = (
  koHasContent: boolean,
  enHasContent: boolean,
): string | null => {
  if (!koHasContent && !enHasContent) return '한국어 / 영어 본문이 필요합니다';
  if (!koHasContent) return '한국어 본문이 필요합니다';
  if (!enHasContent) return '영어 본문이 필요합니다';
  return null;
};

/**
 * Priority chain (top wins):
 *  1. Pre-seed   → null         (suppress until parent draft is reseeded)
 *  2. Empty body → error        (red, language-specific)
 *  3. No edits   → disabled     (neutral hint)
 *  4. Half edit  → warning      (amber, untouched-side notice)
 *  5. Both edit  → null         (no message; just enable save)
 */
const computeSaveStateMessage = (
  inputs: SaveStateInputs,
): SaveStateMessage | null => {
  if (!inputs.seeded) return null;

  const emptyText = getEmptyContentText(inputs.koHasContent, inputs.enHasContent);
  if (emptyText) return { kind: 'error', text: emptyText };

  if (!inputs.dirty) {
    return { kind: 'disabled', text: '한국어 / 영어 수정이 발생하지 않았습니다' };
  }
  if (inputs.editedKo && !inputs.editedEn) {
    return {
      kind: 'warning',
      text: '영어는 수정되지 않았습니다 — 기존 내용이 그대로 저장됩니다',
    };
  }
  if (!inputs.editedKo && inputs.editedEn) {
    return {
      kind: 'warning',
      text: '한국어는 수정되지 않았습니다 — 기존 내용이 그대로 저장됩니다',
    };
  }
  return null;
};

const SAVE_STATE_TEXT_COLOR = {
  disabled: textColors.tertiary,
  warning: statusColors.warning.textDark,
  error: statusColors.error.text,
} satisfies Record<SaveStateMessageKind, string>;

const saveStateTextColor = (message: SaveStateMessage | null): string =>
  message ? SAVE_STATE_TEXT_COLOR[message.kind] : textColors.tertiary;

export const GuideEditorPanel = ({
  slotKey,
  draftKo,
  draftEn,
  activeLang,
  onChangeLang,
  onChangeKo,
  onChangeEn,
  onDirtyChange,
  onLoad,
}: GuideEditorPanelProps) => {
  const slot = useMemo(() => resolveSlot(slotKey), [slotKey]);
  const sharedSlots = useMemo(() => findSlotsForGuide(slot.guideName), [slot.guideName]);

  const { data, loading, save, saving } = useGuide(slot.guideName);
  const toast = useToast();
  const linkBubbleRef = useRef<LinkBubbleMenuHandle>(null);

  // Per-language "user has actually typed" flags. We cannot rely on
  // `draft !== data.contents` alone because:
  //   1. Tiptap may emit subtle HTML normalization between mount and
  //      the first sync (attribute reordering, whitespace), giving a
  //      false-positive "dirty" before any keystroke happens.
  //   2. The user sees the modal pop up on a step they never edited.
  // The flag flips inside `handleChange`, which only runs from
  // Tiptap's `onUpdate`. setContent() with `emitUpdate: false` does
  // not trigger it, so the initial sync stays silent.
  const [touchedKo, setTouchedKo] = useState(false);
  const [touchedEn, setTouchedEn] = useState(false);

  // Once the GET resolves, hand the canonical contents up so the parent
  // can seed (or reset) `draftKo / draftEn`. The parent owns the draft
  // because the dirty guard hook lives there. Touch flags reset
  // naturally — `key={selected}` on the panel remounts on slot change,
  // and `handleSave` clears them after a successful PUT.
  useEffect(() => {
    if (data) {
      onLoad(data.contents);
    }
  }, [data, onLoad]);

  const koFilled = draftKo.trim().length > 0;
  const enFilled = draftEn.trim().length > 0;
  // Strict visible-text check used by the save gate. `koFilled` /
  // `enFilled` above stay as the cheap predicate for the language tab
  // dot indicator (which only needs "has the user started typing?").
  const koHasContent = useMemo(() => hasGuideContent(draftKo), [draftKo]);
  const enHasContent = useMemo(() => hasGuideContent(draftEn), [draftEn]);

  // Derived "drafts are populated from the loaded server payload (or by
  // the user)" — gates the required-field message so the empty parent
  // draft (`''`) does not flash a false error in the render window
  // between `data` arriving and the parent's reseed running. Becomes
  // true the moment touched flags flip OR the draft matches the server
  // value, both of which only hold once the panel is in a steady state.
  const seeded =
    data !== null &&
    (touchedKo || draftKo === data.contents.ko) &&
    (touchedEn || draftEn === data.contents.en);

  // Real edit detection: the user must have produced an `onUpdate` AND
  // the resulting draft must differ from the persisted server value.
  // Reverting via undo collapses `editedKo` back to false.
  const editedKo = touchedKo && data ? draftKo !== data.contents.ko : false;
  const editedEn = touchedEn && data ? draftEn !== data.contents.en : false;
  const dirty = editedKo || editedEn;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const handleChange = useCallback(
    (html: string) => {
      if (activeLang === 'ko') {
        // Skip the no-op echoes that Tiptap occasionally emits during
        // normalization — they would otherwise flip touchedKo on
        // mount, making `dirty` true before the user touches anything.
        if (html === draftKo) return;
        onChangeKo(html);
        setTouchedKo(true);
      } else {
        if (html === draftEn) return;
        onChangeEn(html);
        setTouchedEn(true);
      }
    },
    [activeLang, draftKo, draftEn, onChangeKo, onChangeEn],
  );

  const canSave =
    dirty && !saving && !loading && koHasContent && enHasContent;

  const handleSave = useCallback(async (): Promise<void> => {
    if (!canSave) return;
    const result = await save({ contents: { ko: draftKo, en: draftEn } });
    if (result) {
      toast.success('저장되었습니다');
      // After a successful save the freshly-saved drafts are the new
      // baseline — drop the touch flags so the next nav is clean.
      setTouchedKo(false);
      setTouchedEn(false);
    }
  }, [canSave, save, draftKo, draftEn, toast]);

  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: activeLang === 'ko' ? draftKo : draftEn,
    editable: !loading && !saving,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }: { editor: Editor }) => handleChange(nextEditor.getHTML()),
  });

  // Tiptap only consumes `editable` at construction time. Mirror the
  // disabled prop into the live editor so toggling loading / saving
  // actually freezes the surface.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!loading && !saving);
  }, [editor, loading, saving]);

  // When the parent flips to a different slot or resets drafts after
  // discard, the controlled HTML may diverge from Tiptap's internal
  // doc. Sync only when the diff is real to avoid clobbering the
  // user's selection on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const target = activeLang === 'ko' ? draftKo : draftEn;
    if (editor.getHTML() !== target) {
      editor.commands.setContent(target, { emitUpdate: false });
    }
  }, [activeLang, draftKo, draftEn, editor]);

  // ⌘S / Ctrl+S → save when the form is in a savable state. Wired here
  // so the shortcut works whether focus is in the editor body, the
  // toolbar, or the surrounding panel.
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      void handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // ⌘K / Ctrl+K → force-show the link bubble + focus its input when
  // focus is in the editor body. Suppressed while loading / saving so
  // a write cannot be staged on a frozen surface.
  useEffect(() => {
    if (!editor || loading || saving) return;
    const root = editor.view.dom;
    const handler = (event: KeyboardEvent): void => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      if (event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      linkBubbleRef.current?.trigger();
    };
    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
  }, [editor, loading, saving]);

  // Block middle-click new-tab navigation only (auxclick). Left-click is
  // handled by Tiptap's Link extension: with `enableClickSelection: true`
  // its ProseMirror plugin returns true from handleClick, which makes
  // ProseMirror prevent the anchor's default. If we called preventDefault
  // ourselves on the capture phase, ProseMirror would skip the plugin
  // (it bails on `event.defaultPrevented`) and the selection-on-click
  // behaviour the BubbleMenu depends on would never run.
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;
    const blockMiddleClickNavigation = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest('a')) return;
      event.preventDefault();
    };
    root.addEventListener('auxclick', blockMiddleClickNavigation, { capture: true });
    return () => {
      root.removeEventListener('auxclick', blockMiddleClickNavigation, { capture: true });
    };
  }, [editor]);

  const triggerLinkBubble = useCallback(() => {
    linkBubbleRef.current?.trigger();
  }, []);

  const showScopeNotice = sharedSlots.length >= 2;
  const saveLabel = saving ? '저장 중…' : '저장';

  const saveStateMessage = computeSaveStateMessage({
    seeded,
    koHasContent,
    enHasContent,
    dirty,
    editedKo,
    editedEn,
  });

  const headerMeta = buildHeaderMeta(slot);

  return (
    <section
      aria-label="가이드 편집"
      className={cn('flex flex-col h-full border-l overflow-hidden', borderColors.default)}
    >
      <div className="flex flex-col gap-3.5 px-5 pt-4">
        <div
          className={cn(
            'flex items-start justify-between gap-2.5 px-3.5 py-3 rounded-lg border',
            bgColors.muted,
            borderColors.light,
          )}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div
              className={cn(
                'flex items-center gap-1.5 text-[11px] font-medium tracking-[0.02em]',
                textColors.tertiary,
              )}
            >
              {headerMeta.provider && <span>{headerMeta.provider}</span>}
              {headerMeta.variant && (
                <span
                  className={cn(
                    chipStyles.base,
                    headerMeta.variant === 'AUTO'
                      ? chipStyles.variant.auto
                      : chipStyles.variant.manual,
                  )}
                >
                  {headerMeta.variant}
                </span>
              )}
              {headerMeta.step !== null && (
                <>
                  <span aria-hidden="true" className={textColors.quaternary}>·</span>
                  <span>Step {headerMeta.step}</span>
                </>
              )}
            </div>
            <h2 className={cn('text-[14px] font-semibold leading-snug', textColors.primary)}>
              {headerMeta.stepLabel}
            </h2>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md border font-mono text-[10.5px] font-semibold shrink-0',
              bgColors.surface,
              borderColors.default,
              textColors.secondary,
            )}
            aria-label={`가이드 식별자 ${slot.guideName}`}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={textColors.tertiary}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {slot.guideName}
          </span>
        </div>

        {showScopeNotice && (
          <div
            role="status"
            className={cn(
              'flex flex-col gap-1.5 px-3.5 py-3 rounded-lg border text-[12.5px]',
              primaryColors.bg50,
              primaryColors.border100,
              primaryColors.textDark,
            )}
          >
            <div className="font-semibold">
              ⓘ 이 가이드는 {sharedSlots.length}곳에서 사용됩니다
            </div>
            <ul className={cn('pl-4 space-y-0.5 text-[12px] font-mono', primaryColors.text700)}>
              {sharedSlots.map((shared) => (
                <li key={slotReactKey(shared)}>· {buildHeaderMeta(shared).fullLabel}</li>
              ))}
            </ul>
            <div className={cn('text-[12px]', primaryColors.text700)}>
              저장 시 모든 곳에 반영됩니다.
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <EditLanguageTabs
            value={activeLang}
            onChange={onChangeLang}
            koFilled={koFilled}
            enFilled={enFilled}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-3.5 pb-4">
        <div className={cardStyles.editorFrame}>
          <EditorToolbar
            editor={editor}
            disabled={loading || saving}
            onTriggerLink={triggerLinkBubble}
          />
          <div
            className="guide-editor-surface px-4 py-3.5"
            // Clicking the padding region around the contenteditable would
            // otherwise miss the editor entirely. Focus on direct hits so
            // users get a caret no matter where they click in the surface.
            onClick={(e) => {
              if (e.target === e.currentTarget) editor?.chain().focus().run();
            }}
          >
            <EditorContent
              editor={editor}
              aria-label={`${activeLang === 'ko' ? '한국어' : 'English'} 가이드 본문`}
              className={cn('prose-guide text-[13px]')}
            />
          </div>
        </div>
      </div>

      <footer
        className={cn(
          'flex items-center justify-between gap-3 px-5 py-3 border-t',
          borderColors.default,
          bgColors.muted,
        )}
      >
        <span
          className={cn('text-[11.5px] leading-snug', saveStateTextColor(saveStateMessage))}
          aria-live="polite"
        >
          {saveStateMessage?.text ?? ''}
        </span>
        <Button variant="primary" disabled={!canSave} onClick={() => void handleSave()}>
          {saveLabel}
        </Button>
      </footer>
      <LinkBubbleMenu
        ref={linkBubbleRef}
        editor={editor}
        disabled={loading || saving}
      />
    </section>
  );
};
