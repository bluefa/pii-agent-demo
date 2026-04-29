'use client';

import type { ReactNode } from 'react';
import { bannerStyles, cn } from '@/lib/theme';

export type BannerVariant = keyof typeof bannerStyles.variants;

export interface StepBannerProps {
  variant?: BannerVariant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const StepBanner = ({
  variant = 'info',
  icon,
  children,
  className,
}: StepBannerProps) => (
  <div className={cn(bannerStyles.base, bannerStyles.variants[variant], className)}>
    {icon && <span className="flex-shrink-0">{icon}</span>}
    <div>{children}</div>
  </div>
);
