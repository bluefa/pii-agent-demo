'use client';

/**
 * Guide CMS — data-aware card wrapper.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md §Step 4.
 *
 * Resolves a `GuideSlotKey` to its `GuideName` via the registry,
 * fetches the stored guide through `useGuide`, and routes to the
 * appropriate presentational component: skeleton while loading, error
 * shell with retry on failure, empty-lang shell when the requested
 * translation is missing, or `GuideCardPure` once content arrives.
 * `null` is rendered when the hook yields no data (e.g. the provider
 * page passed a slot that never populated); this mirrors the legacy
 * facade's behaviour so provider pages never see an unexpected card.
 */

import { useGuide } from '@/app/hooks/useGuide';
import { GuideCardEmptyLang } from '@/app/components/features/process-status/GuideCard/GuideCardEmptyLang';
import { GuideCardError } from '@/app/components/features/process-status/GuideCard/GuideCardError';
import { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';
import { GuideCardSkeleton } from '@/app/components/features/process-status/GuideCard/GuideCardSkeleton';
import { resolveSlot } from '@/lib/constants/guide-registry';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';

interface Props {
  slotKey: GuideSlotKey;
  lang?: 'ko' | 'en';
}

export const GuideCardContainer = ({ slotKey, lang = 'ko' }: Props) => {
  const slot = resolveSlot(slotKey);
  const { data, loading, error, refresh } = useGuide(slot.guideName);

  if (loading) return <GuideCardSkeleton />;
  if (error) return <GuideCardError onRetry={() => void refresh()} />;
  if (!data) return null;

  const html = data.contents[lang];
  if (!html.trim()) return <GuideCardEmptyLang lang={lang} />;

  return <GuideCardPure content={html} />;
};
