'use client';

import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { QuestionCircleIcon } from '@/app/components/ui/icons';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import { bgColors, cn, providerColors, statusColors, textColors } from '@/lib/theme';

/** Tinted tile per provider. IDC/기타 have no brand color, so they sit on neutrals. */
const TILE_TONE: Record<ProviderChipKey, string> = {
  aws: cn(providerColors.AWS.bg, providerColors.AWS.text),
  azure: cn(providerColors.Azure.bg, providerColors.Azure.text),
  gcp: cn(providerColors.GCP.bg, providerColors.GCP.text),
  idc: cn(providerColors.IDC.bg, providerColors.IDC.text),
  other: cn(bgColors.panel, textColors.secondary),
};

interface ProviderGlyphTileProps {
  providerKey: ProviderChipKey;
  /** An SDU candidate reads as SDU over its underlying CSP — upload glyph, warn tone. */
  isSdu?: boolean;
  /** Tile box (size + radius). */
  className?: string;
  /** Glyph box inside the tile. */
  glyphClassName?: string;
}

export const ProviderGlyphTile = ({
  providerKey,
  isSdu = false,
  className,
  glyphClassName,
}: ProviderGlyphTileProps) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-flex flex-shrink-0 items-center justify-center rounded-[10px]',
      isSdu ? cn(statusColors.warning.bg, statusColors.warning.textDark) : TILE_TONE[providerKey],
      className,
    )}
  >
    {isSdu ? (
      <ProviderGlyph provider="sdu" isSdu className={glyphClassName} />
    ) : providerKey === 'other' ? (
      // 기타 has no brand mark to borrow — a question mark says exactly what the chip
      // means: we do not know what runs there.
      <QuestionCircleIcon className={glyphClassName} />
    ) : (
      <ProviderGlyph provider={providerKey} className={glyphClassName} />
    )}
  </span>
);
