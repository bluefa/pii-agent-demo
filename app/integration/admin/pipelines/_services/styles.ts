/**
 * Local style tokens for the services page composites (LIN-25 Phase C1-b).
 *
 * `pipelineStyles` (lib/theme.ts — shared, read-only for C1) has no slot for
 * the prototype's `#svclist .sb-item` service-picker rows, so their classes
 * live here instead of inline in JSX. Same conventions as pipelineStyles:
 * colors only via `--pl-*` custom properties, state variants own the
 * color/weight so base+variant never collide in a plain `cn` join.
 *
 * Geometry: prototype `#svclist .sb-item` — flex row, gap 8, padding 8 10,
 * radius 6(≈rounded-md), 14px; active = primary tint + 600; idle hover =
 * gray-100.
 */
export const serviceListStyles = {
  /** Structural base — no color/weight (the state variants own those). */
  item: 'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[14px] cursor-pointer',
  itemActive: 'bg-[var(--pl-primary-bg)] font-semibold text-[var(--pl-primary)]',
  itemIdle: 'text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-100)]',
} as const;
