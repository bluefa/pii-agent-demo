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

import { GuideCardInvalidState } from '@/app/components/features/process-status/GuideCard/GuideCardInvalidState';
import { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';
import { StepProgressBar } from '@/app/components/features/process-status/StepProgressBar';
import { useDebounce } from '@/app/hooks/useDebounce';
import { ProcessStatus } from '@/lib/types';
import { GuidePlaceholder } from '@/app/integration/admin/guides/components/GuidePlaceholder';
import { PreviewEmptyLang } from '@/app/integration/admin/guides/components/PreviewEmptyLang';
import { PreviewLanguageToggle } from '@/app/integration/admin/guides/components/PreviewLanguageToggle';
import { resolveSlot } from '@/lib/constants/guide-registry';
import { borderColors, cn, textColors } from '@/lib/theme';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

import type { PreviewLanguage } from '@/app/integration/admin/guides/components/PreviewLanguageToggle';
import type { GuideSlotKey } from '@/lib/constants/guide-registry';

const PREVIEW_DEBOUNCE_MS = 250;

interface Props {
  slotKey: GuideSlotKey | null;
  draftKo: string;
  draftEn: string;
  /** Active language — shared with the editor so toggling on either side
   *  keeps the surfaces in sync. */
  activeLang: PreviewLanguage;
  onChangeLang: (next: PreviewLanguage) => void;
}

export const GuidePreviewPanel = ({
  slotKey,
  draftKo,
  draftEn,
  activeLang,
  onChangeLang,
}: Props) => {
  const debouncedKo = useDebounce(draftKo, PREVIEW_DEBOUNCE_MS);
  const debouncedEn = useDebounce(draftEn, PREVIEW_DEBOUNCE_MS);
  const previewHtml = activeLang === 'ko' ? debouncedKo : debouncedEn;

  if (!slotKey) {
    return (
      <GuidePlaceholder
        icon={
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
        subtitle="편집 중인 가이드의 실제 GuideCard 렌더링 결과가 이곳에 표시됩니다."
      >
        미리보기 영역
      </GuidePlaceholder>
    );
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
      <header
        className={cn(
          'flex items-center justify-between px-5 h-[52px] border-b shrink-0',
          borderColors.light,
        )}
      >
        <h2 className={cn('text-[13.5px] font-semibold', textColors.primary)}>미리보기</h2>
        <PreviewLanguageToggle value={activeLang} onChange={onChangeLang} />
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {slot.placement.kind === 'process-step' && (
          // Mirror the user-facing process modal — use the same
          // StepProgressBar so admins see the exact widget the end
          // user sees, with the canonical 7-step labels.
          <StepProgressBar currentStep={slot.placement.step as ProcessStatus} />
        )}
        {isEmpty ? (
          <PreviewEmptyLang lang={activeLang} />
        ) : validation && !validation.valid ? (
          <GuideCardInvalidState errors={validation.errors} variant="admin" />
        ) : (
          <GuideCardPure content={previewHtml} />
        )}
      </div>
    </section>
  );
};
