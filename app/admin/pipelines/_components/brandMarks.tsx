/**
 * Brand logomark SVG artwork (Terraform + CSP), shared by the flow canvas
 * (TaskFlow nodes) and the preview modal's mini flow (R21 §B1). These export
 * the raw <svg> only — each caller wraps it in its own mark tile (`.nd-mark`
 * inside the scoped flow CSS, Tailwind classes in the modal). Unknown
 * providers resolve to null so callers render their text-chip fallback
 * (IDC/SDU — owner: 글자만).
 */
import type { ReactElement } from 'react';
import type { CloudProvider } from '@/lib/pipeline/types';

/** Terraform logomark — three isometric blocks, brand purple (artwork, not UI text). */
export function TerraformLogo({ size = 16 }: { size?: number } = {}): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--pl-brand-tf)" aria-hidden="true" focusable="false">
      <path d="M8.7 4.3 15 7.9v7.2L8.7 11.5Z" />
      <path d="M15.8 8.4 22 4.8v7.2l-6.2 3.6Z" opacity=".75" />
      <path d="M2 8.2l6 3.4v7L2 15.2Z" opacity=".55" />
      <path d="M8.7 12.6 15 16.2v7.2l-6.3-3.6Z" />
    </svg>
  );
}

/**
 * Jira logomark — the diamond of chevrons, Atlassian blue. Simplified from the
 * brand asset: the gradient "wings" are flattened to one lighter tone, which is
 * all that survives at 18px anyway. Artwork, not UI text — hence the raw hex.
 */
export function JiraLogo({ size = 18 }: { size?: number } = {}): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {/* evenodd — the centre diamond is a hole, not a second solid. */}
      <path
        fill="#2684FF"
        fillRule="evenodd"
        d="M30.7 15.2 16.8 1.3 15.4 0 4.9 10.5.1 15.2a1.1 1.1 0 0 0 0 1.6l9.6 9.6L15.4 32l10.5-10.5 3.2-3.2 1.6-1.5a1.1 1.1 0 0 0 0-1.6zM15.4 21.2l-4.9-4.8 4.9-4.9 4.9 4.9z"
      />
      {/* Brand asset's gradient "wings" dropped: at 18px they close over the centre
          notch, and the notch is the only thing that separates the mark from a plain
          blue diamond. */}
    </svg>
  );
}

/** Simplified provider logomark + its tile tooltip; null → text-chip fallback. */
export function providerLogo(provider: CloudProvider): { title: string; svg: ReactElement } | null {
  switch (provider) {
    case 'AWS':
      return {
        title: 'AWS',
        svg: (
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <text
              x="12"
              y="12.5"
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="700"
              fill="var(--pl-brand-aws-ink)"
              fontFamily="var(--pl-font-sans)"
            >
              aws
            </text>
            <path
              d="M5.5 15.5c4 2.6 9.2 2.6 13-.2"
              stroke="var(--pl-brand-aws-smile)"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
            <path d="m18.5 13.6.3 2-2 .3" stroke="var(--pl-brand-aws-smile)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        ),
      };
    case 'AZURE':
      return {
        title: 'Azure',
        svg: (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M13.2 4 6.3 18.6a.8.8 0 0 0 .7 1.1h4l6.9-15.7Z" fill="var(--pl-pv-azure)" opacity=".65" />
            <path d="m14.6 8.6-4 9.3 3.3 1.8h4.9a.8.8 0 0 0 .7-1.1Z" fill="var(--pl-pv-azure)" />
          </svg>
        ),
      };
    case 'GCP':
      return {
        title: 'Google Cloud',
        svg: (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M7 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.62-1.46A4.5 4.5 0 0 1 17.5 18H7Z"
              fill="var(--pl-pv-gcp)"
            />
          </svg>
        ),
      };
    default:
      return null;
  }
}
