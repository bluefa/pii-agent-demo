import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * Cloud Composer (managed Airflow) — the mark beside the Airflow 확인 heading.
 *
 * Brand colours, so this one does not take `currentColor`: it identifies a
 * vendor product rather than joining the text around it. Same reasoning as the
 * provider marks in `CloudProviderIcon`.
 *
 * ⏳ Approximation drawn from the Google Cloud palette — swap the paths when the
 * official asset lands. It is inlined rather than served from `public/`: a bare
 * `<img src>` is not basePath-aware, so `/icons/*.svg` 404s under `/pass`.
 */
export const ComposerIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    {/* design-exempt: brand logotype (WCAG 1.4.11) */}
    <path
      d="M10.31 7.95 7.09 13.55M13.69 7.95l3.22 5.6M8.8 16.5h6.4"
      fill="none"
      stroke="#669DF6"
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <circle cx="12" cy="5" r="2.6" fill="#4285F4" />
    <circle cx="5.4" cy="16.5" r="2.6" fill="#669DF6" />
    <circle cx="18.6" cy="16.5" r="2.6" fill="#669DF6" />
  </svg>
);
