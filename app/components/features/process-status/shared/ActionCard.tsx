'use client';

import { statusColors, cn } from '@/lib/theme';

interface ActionCardProps {
  title?: string;
  variant?: 'warning' | 'error';
  children: React.ReactNode;
}

export const ActionCard = ({ title, variant = 'warning', children }: ActionCardProps) => {
  const colors = variant === 'error' ? statusColors.error : statusColors.warning;

  return (
    <div className={cn('px-4 py-3 rounded-lg border', colors.bg, colors.border)}>
      {title && (
        <div className={cn('flex items-center gap-2 mb-2 text-sm font-medium', colors.textDark)}>
          {variant === 'error' ? '\u2715' : '\u26A0'} {title}
        </div>
      )}
      {children}
    </div>
  );
};
