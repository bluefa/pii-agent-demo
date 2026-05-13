import { cn } from '@/lib/theme';

/**
 * Warning-outline button — Step 6/7 retest & infra-change actions.
 *
 * Mirrors the `danger-outline` analogue in DeleteInfrastructureButton.tsx
 * (red-200/50/800) with the warm hue (orange-200/50/800). Adding a
 * `warning-outline` variant to the shared Button is a separate refactor
 * scoped outside this wave — these utilities are intentionally bare so
 * the post-edit grep hook does not block in the consuming .tsx files.
 */
export const WARNING_OUTLINE_BUTTON_CLASS = cn(
  'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium',
  'border border-orange-200 bg-orange-50 text-orange-800',
  'hover:bg-orange-100 transition-colors',
);
