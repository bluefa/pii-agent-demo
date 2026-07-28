'use client';

import { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';
import { resolveSlot } from '@/lib/constants/guide-registry';
import { STEP_GUIDE_HTML } from '@/lib/constants/step-guide-content';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';

interface Props {
  slotKey: GuideSlotKey;
  /** Render prose only — the outer surface (GuidePanel) owns chrome, header, and padding. */
  bare?: boolean;
}

// Guide content is hardcoded (owner decision 2026-07-28) — no CMS fetch,
// so no skeleton/error/empty-lang states. See lib/constants/step-guide-content.ts.
export const GuideCardContainer = ({ slotKey, bare = false }: Props) => {
  const slot = resolveSlot(slotKey);
  return <GuideCardPure content={STEP_GUIDE_HTML[slot.guideName]} bare={bare} />;
};
