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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import type { Editor } from '@tiptap/core';

import { Button } from '@/app/components/ui/Button';
import { useGuide } from '@/app/hooks/useGuide';
import { useToast } from '@/app/components/ui/toast/useToast';
import { findSlotsForGuide, resolveSlot } from '@/lib/constants/guide-registry';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';
import {
  bgColors,
  borderColors,
  cardStyles,
  cn,
  primaryColors,
  textColors,
} from '@/lib/theme';

import { EditLanguageTabs } from '@/app/integration/admin/guides/components/EditLanguageTabs';
import type { EditorLanguage } from '@/app/integration/admin/guides/components/EditLanguageTabs';
import { EditorToolbar } from '@/app/integration/admin/guides/components/EditorToolbar';
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
    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    validate: isAllowedLinkHref,
  }),
];

interface GuideEditorPanelProps {
  slotKey: GuideSlotKey;
  draftKo: string;
  draftEn: string;
  onChangeKo: (next: string) => void;
  onChangeEn: (next: string) => void;
  /** Pushes "is the draft different from the persisted guide?" upwards. */
  onDirtyChange: (dirty: boolean) => void;
  /** Pushes the latest server-side contents so the parent can reset drafts. */
  onLoad: (contents: GuideContents) => void;
}

const renderHeaderMeta = (slot: GuideSlot): { label: string; variant: 'AUTO' | 'MANUAL' | null } => {
  if (slot.placement.kind !== 'process-step') {
    return { label: slot.guideName, variant: null };
  }
  const variant = 'variant' in slot.placement ? slot.placement.variant ?? null : null;
  const { provider, step, stepLabel } = slot.placement;
  return { label: `${provider} · Step ${step} · ${stepLabel}`, variant };
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

export const GuideEditorPanel = ({
  slotKey,
  draftKo,
  draftEn,
  onChangeKo,
  onChangeEn,
  onDirtyChange,
  onLoad,
}: GuideEditorPanelProps) => {
  const slot = useMemo(() => resolveSlot(slotKey), [slotKey]);
  const sharedSlots = useMemo(() => findSlotsForGuide(slot.guideName), [slot.guideName]);

  const { data, loading, save, saving } = useGuide(slot.guideName);
  const toast = useToast();

  const [activeLang, setActiveLang] = useState<EditorLanguage>('ko');

  // Once the GET resolves, hand the canonical contents up so the parent
  // can seed (or reset) `draftKo / draftEn`. The parent owns the draft
  // because the dirty guard hook lives there.
  useEffect(() => {
    if (data) {
      onLoad(data.contents);
    }
  }, [data, onLoad]);

  const koValid = useMemo(() => validateGuideHtml(draftKo).valid, [draftKo]);
  const enValid = useMemo(() => validateGuideHtml(draftEn).valid, [draftEn]);
  const koFilled = draftKo.trim().length > 0;
  const enFilled = draftEn.trim().length > 0;

  const dirty = data
    ? draftKo !== data.contents.ko || draftEn !== data.contents.en
    : false;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const canSave = koValid && enValid && dirty && !saving && !loading;

  const handleChange = useCallback(
    (html: string) => {
      if (activeLang === 'ko') onChangeKo(html);
      else onChangeEn(html);
    },
    [activeLang, onChangeKo, onChangeEn],
  );

  const handleSave = useCallback(async (): Promise<void> => {
    if (!canSave) return;
    const result = await save({ contents: { ko: draftKo, en: draftEn } });
    if (result) {
      toast.success('저장되었습니다');
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

  // ⌘S → save when the form is in a savable state. Wired here so the
  // shortcut works whether focus is in the editor body, the toolbar,
  // or the surrounding panel.
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

  const showScopeNotice = sharedSlots.length >= 2;
  const saveLabel = saving ? '저장 중…' : '저장';
  const saveDisabledReason = !dirty
    ? '변경사항이 없습니다'
    : !koValid || !enValid
      ? '한국어와 영어 모두 작성해야 저장할 수 있습니다'
      : null;

  const headerMeta = renderHeaderMeta(slot);

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
              <span>{headerMeta.label}</span>
            </div>
            <h2 className={cn('text-[14px] font-semibold leading-snug', textColors.primary)}>
              {slot.guideName}
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
                <li key={slotReactKey(shared)}>· {renderHeaderMeta(shared).label}</li>
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
            onChange={setActiveLang}
            koFilled={koFilled}
            enFilled={enFilled}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-3.5 pb-4">
        <div className={cardStyles.editorFrame}>
          <EditorToolbar editor={editor} disabled={loading || saving} />
          <EditorContent
            editor={editor}
            aria-label={`${activeLang === 'ko' ? '한국어' : 'English'} 가이드 본문`}
            className={cn('prose-guide min-h-[260px] focus:outline-none px-4 py-3.5 text-[13px]')}
          />
          <div
            className={cn(
              'flex items-center justify-between px-3.5 py-1.5 border-t text-[11.5px]',
              borderColors.light,
              textColors.tertiary,
              bgColors.muted,
            )}
          >
            <span>Markdown 단축키: ⌘B / ⌘I / ⌘E / ⌘K</span>
          </div>
        </div>
      </div>

      <footer
        className={cn(
          'flex items-center justify-between px-5 py-3 border-t',
          borderColors.default,
          bgColors.muted,
        )}
      >
        <span className={cn('text-[11.5px]', textColors.tertiary)} aria-live="polite">
          {saveDisabledReason ?? '⌘S 로 저장할 수 있습니다'}
        </span>
        <Button variant="primary" disabled={!canSave} onClick={() => void handleSave()}>
          {saveLabel}
        </Button>
      </footer>
    </section>
  );
};
