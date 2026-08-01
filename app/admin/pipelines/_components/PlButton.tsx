/**
 * PlButton — design-inventory §5 `.btn` (h32 pad 0 14 14/600; sm h28 pad 0 10
 * 12/600; round 28×28). Variants primary / secondary / outline / danger /
 * dangerSolid / ghost (dangerSolid = R18 destructive CTA, improvement-r18.md
 * §7-1; outline = 파란 스트로크 도구 CTA).
 */
import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export type PlButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'dangerSolid' | 'ghost';

export interface PlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PlButtonVariant;
  size?: 'md' | 'sm';
  /** Circular 28×28 icon button (pairs with size='sm'). */
  round?: boolean;
}

export function PlButton({
  variant = 'secondary',
  size = 'md',
  round,
  type = 'button',
  className,
  children,
  ...rest
}: PlButtonProps): ReactElement {
  const { button } = pipelineStyles;
  // Exactly one geometry (never combined) so padding/height/radius don't collide.
  const geometry = round ? button.round : size === 'sm' ? button.sm : button.md;
  return (
    <button type={type} className={cn(button.base, geometry, button[variant], className)} {...rest}>
      {children}
    </button>
  );
}
