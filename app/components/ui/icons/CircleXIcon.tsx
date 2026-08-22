import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * x-circle — 실패 판정(Step 5 연결 테스트 카드).
 *
 * 기하는 Lucide `circle-x` 그대로다(Figma H2kRxFxOqqeTrPceFU4zMM 의 `card/fail` 이 쓰는
 * 바로 그 프레임 이름도 `x-circle`). 앱에 이미 있는 `StatusErrorIcon` 은 Heroicons 계열
 * 이라 원 반지름이 9(박스의 83%)여서, 같은 슬롯에 서는 Lucide 글리프들(시계·모래시계,
 * 둘 다 r=10 = 92%)보다 18px 에서 1.5px 작게 그려진다 — 그래서 따로 들였다.
 *
 * ⚠️ Toast·ErrorState 의 에러 글리프는 여전히 `StatusErrorIcon` 이다. 이 아이콘은 Figma 가
 * 기하를 지정한 자리에만 쓴다.
 */
export const CircleXIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);
