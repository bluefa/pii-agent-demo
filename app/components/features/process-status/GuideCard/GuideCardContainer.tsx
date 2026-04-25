'use client';

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
  // useGuide initialises loading=false but data=null on first render
  // before the effect kicks off — show the skeleton instead of a blank.
  if (!data) return <GuideCardSkeleton />;

  const html = data.contents[lang];
  if (!html.trim()) return <GuideCardEmptyLang lang={lang} />;

  return <GuideCardPure content={html} />;
};
