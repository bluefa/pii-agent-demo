import type { CSSProperties } from 'react';

export type ScanPillState = 'new' | 'changed' | 'kept' | 'integrated' | 'none';

interface ScanPillProps {
  state: ScanPillState;
}

interface ScanPillPalette {
  bg: string;
  text: string;
  label: string;
}

// Literal hex per design/v15-extract/03-status-tag-pill.md §7 (.scan-pill).
// No dot — v15 renders the label text only (icon, when present, is an svg).
const PALETTE: Record<Exclude<ScanPillState, 'none'>, ScanPillPalette> = {
  new: { bg: '#DBEAFE', text: '#1E40AF', label: 'New' },
  changed: { bg: '#FEF3C7', text: '#92400E', label: 'Changed' },
  kept: { bg: '#F3F4F6', text: '#374151', label: 'Kept' },
  integrated: { bg: '#D1FAE5', text: '#065F46', label: 'Integrated' },
};

// Base .scan-pill geometry (lines 2918–2924). letter-spacing is declared
// locally (0.01em) — the global inherited -0.018em does NOT apply here.
const BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.01em',
};

export const ScanPill = ({ state }: ScanPillProps) => {
  if (state === 'none') {
    // .scan-pill.none — transparent bg, #9CA3AF (--fg-4), padding 0.
    return (
      <span
        style={{
          ...BASE_STYLE,
          padding: 0,
          background: 'transparent',
          color: '#9CA3AF',
        }}
      >
        —
      </span>
    );
  }
  const palette = PALETTE[state];
  return (
    <span style={{ ...BASE_STYLE, background: palette.bg, color: palette.text }}>
      {palette.label}
    </span>
  );
};
