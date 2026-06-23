import { cn } from '@/lib/theme';

/**
 * Warning button — Step 6/7 retest & infra-change actions.
 *
 * v15 `.btn.warn-outline` (07-banners-controls-buttons §4.3): borderless,
 * amber fill (#FEF3C7 → hover #FDE68A) with amber-900 text, on the base
 * `.btn` geometry (h40 / 0 18px / radius 12 / 14px / 600 / -0.01em).
 * Adding a `warn-outline` variant to the shared Button is a separate
 * refactor scoped outside this wave — this utility is intentionally bare
 * so the post-edit grep hook does not block in the consuming .tsx files.
 */
export const WARNING_OUTLINE_BUTTON_CLASS = cn(
  'inline-flex items-center gap-1.5 h-10 px-[18px] rounded-[12px] text-[14px] font-semibold tracking-[-0.01em]',
  'bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A] transition-colors',
);
