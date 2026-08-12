import type { IconProps } from '@/app/components/ui/icons/types';

/** 비어 있음 — 뚜껑이 열린 빈 상자. 목록에 아무것도 없을 때의 글리프. */
export const EmptyBoxIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M3 9.5 5.2 4.8A1.5 1.5 0 0 1 6.55 4h10.9a1.5 1.5 0 0 1 1.35.8L21 9.5" />
    <path d="M3 9.5h5l1 3h6l1-3h5v8.2a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.7V9.5Z" />
  </svg>
);
