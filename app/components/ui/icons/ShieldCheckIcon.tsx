import type { IconProps } from '@/app/components/ui/icons/types';

/** Intent: monitoring-method / protection badge (shield with a check). */
export const ShieldCheckIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M12 3 4 6v5c0 4.5 3.2 8.4 8 9.7 4.8-1.3 8-5.2 8-9.7V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
