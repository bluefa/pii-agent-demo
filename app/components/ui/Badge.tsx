'use client';

import { ReactNode } from 'react';
import { statusColors, badgeStyles, cn } from '@/lib/theme';
import type { StatusType } from '@/lib/theme';

export type BadgeVariant = StatusType | 'neutral' | 'aws' | 'idc';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const fromStatus = (s: StatusType) => ({
  bg: statusColors[s].bg,
  text: statusColors[s].textDark,
  dot: statusColors[s].dot,
});

const COLORS: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: fromStatus('success'),
  error: fromStatus('error'),
  warning: fromStatus('warning'),
  pending: fromStatus('pending'),
  info: fromStatus('info'),
  neutral: { ...fromStatus('pending'), text: 'text-gray-800' },
  aws: fromStatus('warning'),
  idc: { ...fromStatus('pending'), text: 'text-gray-700' },
};

export const Badge = ({ variant = 'neutral', size = 'sm', dot = false, children, className }: BadgeProps) => {
  const c = COLORS[variant];

  return (
    <span className={cn(badgeStyles.base, badgeStyles.sizes[size], c.bg, c.text, className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />}
      {children}
    </span>
  );
};

export default Badge;
