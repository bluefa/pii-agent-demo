import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * 제외 — 원 안의 사선. 연동 불가(StatusWarningIcon, 삼각)와 도형으로 갈리므로
 * 색을 빼도 두 판정이 구분된다(WCAG 1.4.1).
 */
export const ExcludedIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <circle cx="12" cy="12" r="9" strokeWidth={2} />
    <path strokeLinecap="round" strokeWidth={2} d="M5.6 18.4 18.4 5.6" />
  </svg>
);
