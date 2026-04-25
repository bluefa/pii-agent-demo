'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { borderColors, textColors } from '@/lib/theme';

interface GuidePlaceholderProps {
  children: ReactNode;
}

export const GuidePlaceholder = ({ children }: GuidePlaceholderProps) => (
  <div
    className={cn(
      'flex items-center justify-center h-full border-l',
      borderColors.default,
    )}
  >
    <p className={cn('text-sm', textColors.tertiary)}>{children}</p>
  </div>
);
