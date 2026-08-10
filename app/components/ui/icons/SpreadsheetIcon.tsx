import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * 시트(표) 글리프 — 「Excel 다운로드」 버튼이 무엇을 주는지 말한다.
 *
 * Excel 로고 자체는 쓰지 않는다: 남의 상표를 UI 안에 복제하게 되고, 이 앱의 아이콘은
 * 전부 currentColor 스트로크라 로고의 색·형태와도 맞지 않는다. 초록은 버튼이 입는다.
 */
export const SpreadsheetIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2" />
    <path d="M2.25 6.25h11.5" />
    <path d="M6.25 6.25v7.5" />
  </svg>
);
