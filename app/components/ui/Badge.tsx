'use client';

import { ReactNode } from 'react';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'pending' | 'info' | 'neutral' | 'aws' | 'idc';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  /** 뱃지 스타일 변형 */
  variant?: BadgeVariant;
  /** 뱃지 크기 */
  size?: BadgeSize;
  /** 상태 점 표시 여부 */
  dot?: boolean;
  /** 뱃지 내용 */
  children: ReactNode;
  /** 추가 CSS 클래스 */
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    dot: 'bg-green-500',
  },
  error: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    dot: 'bg-orange-500',
  },
  pending: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    dot: 'bg-yellow-500',
  },
  info: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    dot: 'bg-gray-500',
  },
  aws: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
  },
  idc: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-500',
  },
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

/**
 * 상태 뱃지 컴포넌트
 *
 * @example
 * // 기본 사용
 * <Badge variant="success">완료</Badge>
 *
 * // 상태 점 포함
 * <Badge variant="error" dot>오류</Badge>
 *
 * // 클라우드 프로바이더
 * <Badge variant="aws">AWS</Badge>
 * <Badge variant="idc">IDC</Badge>
 */
export const Badge = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  children,
  className = '',
}: BadgeProps) => {
  const variantStyle = VARIANT_CLASSES[variant];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${variantStyle.bg} ${variantStyle.text} ${sizeClass} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${variantStyle.dot}`} />}
      {children}
    </span>
  );
};

export default Badge;
