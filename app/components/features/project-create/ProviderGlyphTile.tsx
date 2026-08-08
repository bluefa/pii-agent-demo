'use client';

import type { FC } from 'react';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import { bgColors, cn, providerColors, statusColors, textColors } from '@/lib/theme';

/**
 * 기타 환경 — a question mark, because the whole point of the chip is that we do not
 * know what runs there. No brand mark exists to borrow.
 */
export const OtherGlyph: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

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
      <OtherGlyph className={glyphClassName} />
    ) : (
      <ProviderGlyph provider={providerKey} className={glyphClassName} />
    )}
  </span>
);
