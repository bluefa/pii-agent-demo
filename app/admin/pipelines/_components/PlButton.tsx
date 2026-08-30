/**
 * PlButton — design-inventory §5 `.btn` (h32 pad 0 14 14/600; sm h28 pad 0 10
 * 12/600; round 28×28). Variants primary / secondary / outline / danger /
 * dangerSolid / ghost (dangerSolid = R18 destructive CTA, improvement-r18.md
 * §7-1; outline = brand-stroke tool CTA).
 */
import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export type PlButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'dangerSolid' | 'ghost';

export interface PlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PlButtonVariant;
  size?: 'md' | 'sm';
  /** Circular 28×28 icon button (pairs with size='sm'). */
  round?: boolean;
  /**
   * Closed with a stated reason: the disabled FACE, but the button keeps its place in the tab
   * order (`aria-disabled` + a dropped onClick) so a hover/focus tooltip can carry the reason.
   * Chrome dispatches no pointer events on a natively `disabled` button and drops it from the
   * tab order, which puts any explanation attached to it out of reach of mouse AND keyboard.
   * Callers with nothing to explain keep passing `disabled` and are unchanged.
   */
  blocked?: boolean;
}

export function PlButton({
  variant = 'secondary',
  size = 'md',
  round,
  blocked,
  type = 'button',
  className,
  onClick,
  children,
  ...rest
}: PlButtonProps): ReactElement {
  const { button } = pipelineStyles;
  // Exactly one geometry (never combined) so padding/height/radius don't collide.
  const geometry = round ? button.round : size === 'sm' ? button.sm : button.md;
  // The blocked face REPLACES the variant instead of layering over it: `cn` only joins, so two
  // fills on one element would be settled by stylesheet order, and the variant's
  // `enabled:hover:` still fires on a button that is merely aria-disabled.
  return (
    <button
      type={type}
      className={cn(button.base, geometry, blocked ? button.blocked : button[variant], className)}
      {...rest}
      aria-disabled={blocked || undefined}
      onClick={blocked ? undefined : onClick}
    >
      {children}
    </button>
  );
}
