import type { IconProps } from '@/app/components/ui/icons/types';
import { scanTransition } from '@/lib/theme';

interface CheckIconProps extends IconProps {
  /**
   * true 면 체크가 300ms 드로우로 그려진다 (scanTransition.checkDraw). dasharray 만
   * 선언하고 offset 은 기본값(0)이라 motion-reduce 에서도 체크는 그려진 상태로 남는다.
   * 라이브로 지켜본 완료에만 켤 것 — 마운트 시 발견한 과거 완료에는 연출이 없다.
   */
  draw?: boolean;
}

export const CheckIcon = ({ className, draw, ...rest }: CheckIconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 13l4 4L19 7"
      {...(draw ? { strokeDasharray: 30, className: scanTransition.checkDraw } : {})}
    />
  </svg>
);
