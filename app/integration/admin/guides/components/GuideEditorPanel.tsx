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
  cn,
  primaryColors,
  textColors,
} from '@/lib/theme';

import { EditLanguageTabs } from '@/app/integration/admin/guides/components/EditLanguageTabs';
import type { EditorLanguage } from '@/app/integration/admin/guides/components/EditLanguageTabs';
import { EditorToolbar } from '@/app/integration/admin/guides/components/EditorToolbar';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { GuideContents, GuideSlot } from '@/lib/types/guide';

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

const renderLockedBadge = (slot: GuideSlot): string => {
  if (slot.placement.kind !== 'process-step') return slot.guideName;
  const variant = 'variant' in slot.placement ? slot.placement.variant : undefined;
  const variantText = variant ? ` · ${variant}` : '';
  const { provider, step, stepLabel } = slot.placement;
  return `${provider}${variantText} · ${step}단계 ${stepLabel}`;
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
    extensions: [
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
        // Mirror of `LINK_HREF_SCHEME_RE` in EditorToolbar.tsx — kept
        // inline so dynamic import of the toolbar stays effective.
        validate: (href: string) => /^(https?:\/\/|mailto:|\/(?!\/))/.test(href),
      }),
    ],
    content: activeLang === 'ko' ? draftKo : draftEn,
    editable: !loading && !saving,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }: { editor: Editor }) => handleChange(nextEditor.getHTML()),
  });

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

  return (
    <section
      aria-label="가이드 편집"
      className={cn('flex flex-col h-full border-l overflow-hidden', borderColors.default)}
    >
      <header className={cn('px-5 py-3 border-b', borderColors.default)}>
        <div className={cn('text-xs font-semibold uppercase tracking-wide', textColors.tertiary)}>
          편집 중
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('text-sm font-medium', textColors.primary)}>
            {renderLockedBadge(slot)}
          </span>
          <span
            className={cn('font-mono text-[11px] px-1.5 py-0.5 rounded', bgColors.muted, textColors.tertiary)}
            aria-label={`가이드 식별자 ${slot.guideName}`}
          >
            🔒 {slot.guideName}
          </span>
        </div>
      </header>

      {showScopeNotice && (
        <div
          role="status"
          className={cn(
            'px-5 py-3 border-b text-xs space-y-1',
            borderColors.default,
            primaryColors.bgLight,
            primaryColors.text,
          )}
        >
          <div className="font-medium">
            ⓘ 이 가이드는 {sharedSlots.length}곳에 표시됩니다
          </div>
          <ul className={cn('pl-4 space-y-0.5', textColors.secondary)}>
            {sharedSlots.map((shared, idx) => (
              <li key={`${shared.guideName}-${idx}`}>· {renderLockedBadge(shared)}</li>
            ))}
          </ul>
          <div className={textColors.tertiary}>저장 시 모든 곳에 반영됩니다.</div>
        </div>
      )}

      <EditLanguageTabs
        value={activeLang}
        onChange={setActiveLang}
        koFilled={koFilled}
        enFilled={enFilled}
      />

      <EditorToolbar editor={editor} disabled={loading || saving} />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <EditorContent
          editor={editor}
          aria-label={`${activeLang === 'ko' ? '한국어' : 'English'} 가이드 본문`}
          className={cn('prose-guide min-h-[200px] focus:outline-none')}
        />
      </div>

      <footer className={cn('flex items-center justify-between px-5 py-3 border-t', borderColors.default, bgColors.muted)}>
        <span className={cn('text-xs', textColors.tertiary)} aria-live="polite">
          {saveDisabledReason ?? '⌘S 로 저장할 수 있습니다'}
        </span>
        <Button variant="primary" disabled={!canSave} onClick={() => void handleSave()}>
          {saveLabel}
        </Button>
      </footer>
    </section>
  );
};
