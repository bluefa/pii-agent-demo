'use client';

/**
 * Guide CMS — admin preview panel.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-c-preview.md +
 * design/guide-cms/components.md §2 GuidePreviewPanel +
 * interactions.md §3 (250ms debounce) and §4.7 (ko empty placeholder).
 *
 * Renders the user-facing `GuideCardPure` (W4-a) directly so the admin
 * sees the exact same surface that ships in `target-sources/<id>`. The
 * panel runs `validateGuideHtml` itself before delegating: on failure
 * it shows `GuideCardInvalidState` with the admin variant (mono-font
 * error list) so the editor can pinpoint what is wrong, instead of the
 * generic enduser fallback that `GuideCardPure` would otherwise pick.
 *
 * The preview language toggle is independent of the editor's tab —
 * editing en while previewing ko is a normal workflow.
 */

import { useState } from 'react';

import { GuideCardInvalidState } from '@/app/components/features/process-status/GuideCard/GuideCardInvalidState';
import { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';
import { ProcessTimelineCompact } from '@/app/components/features/process-status/ProcessTimelineCompact';
import { useDebounce } from '@/app/hooks/useDebounce';
import { GuidePlaceholder } from '@/app/integration/admin/guides/components/GuidePlaceholder';
import { PreviewEmptyLang } from '@/app/integration/admin/guides/components/PreviewEmptyLang';
import { PreviewLanguageToggle } from '@/app/integration/admin/guides/components/PreviewLanguageToggle';
import { resolveSlot } from '@/lib/constants/guide-registry';
import { borderColors, cn } from '@/lib/theme';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

import type { PreviewLanguage } from '@/app/integration/admin/guides/components/PreviewLanguageToggle';
import type { GuideSlotKey } from '@/lib/constants/guide-registry';

const PREVIEW_DEBOUNCE_MS = 250;
const PROCESS_TOTAL_STEPS = 7;

interface Props {
  slotKey: GuideSlotKey | null;
  draftKo: string;
  draftEn: string;
}

export const GuidePreviewPanel = ({ slotKey, draftKo, draftEn }: Props) => {
  const [previewLang, setPreviewLang] = useState<PreviewLanguage>('ko');

  const debouncedKo = useDebounce(draftKo, PREVIEW_DEBOUNCE_MS);
  const debouncedEn = useDebounce(draftEn, PREVIEW_DEBOUNCE_MS);
  const previewHtml = previewLang === 'ko' ? debouncedKo : debouncedEn;

  if (!slotKey) {
    return <GuidePlaceholder>미리보기 영역</GuidePlaceholder>;
  }

  const slot = resolveSlot(slotKey);
  const isEmpty = previewHtml.trim() === '';
  const validation = isEmpty ? null : validateGuideHtml(previewHtml);

  return (
    <section
      aria-label="가이드 미리보기"
      aria-live="polite"
      className={cn('flex flex-col h-full border-l overflow-hidden', borderColors.default)}
    >
      <PreviewLanguageToggle value={previewLang} onChange={setPreviewLang} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {slot.placement.kind === 'process-step' && (
          <ProcessTimelineCompact
            currentStep={slot.placement.step}
            totalSteps={PROCESS_TOTAL_STEPS}
          />
        )}
        {isEmpty ? (
          <PreviewEmptyLang lang={previewLang} />
        ) : validation && !validation.valid ? (
          <GuideCardInvalidState errors={validation.errors} variant="admin" />
        ) : (
          <GuideCardPure content={previewHtml} />
        )}
      </div>
    </section>
  );
};
