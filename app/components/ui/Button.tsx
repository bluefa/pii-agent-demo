'use client';

import { buttonStyles, cn } from '@/lib/theme';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}

const variantStyles = {
  primary: buttonStyles.variants.primary,
  secondary: buttonStyles.variants.secondary,
  danger: buttonStyles.variants.danger,
};

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
}: ButtonProps) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn('px-4 py-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed', variantStyles[variant], className)}
    >
      {children}
    </button>
  );
};
