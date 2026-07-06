/**
 * Local style tokens for the services page composites (LIN-25 Phase C1-b).
 *
 * R20.5 — the service picker is a full-height RAIL flush at the content area's
 * left edge (reference: /integration/services "Service List" panel), NOT a
 * floating card. The split wrapper escapes the section content padding
 * (`layout.content` = px-8 pt-6 pb-12) with matching negative margins; the
 * right pane restores its own padding. Same conventions as pipelineStyles:
 * colors only via `--pl-*` custom properties, state variants own the
 * color/weight so base+variant never collide in a plain `cn` join.
 */
export const serviceListStyles = {
  /** Split layout — rail | content. Negative margins undo layout.content's
   *  left/top/bottom padding so the rail bleeds to the content edges. */
  split: 'flex items-stretch -ml-8 -mt-6 -mb-12 min-h-[calc(100vh_-_56px)]',
  rail: 'w-[280px] flex-none flex flex-col bg-[var(--pl-bg-card)] border-r border-[var(--pl-border)] px-4 pt-6 pb-4',
  railTitle: 'text-[16px] font-bold text-[var(--pl-text-strong)] mb-4 px-1',
  railList: 'flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto',
  railFoot: 'pt-3',
  /** Right pane — restores the escaped content padding. */
  main: 'flex-1 min-w-0 pl-8 pt-6 pb-12',
  /** 2-line picker item — service_code(14) over service_name(12/weak);
   *  the state variants own bg + code color/weight. */
  item: 'flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left cursor-pointer',
  itemActive: 'bg-[var(--pl-primary-bg)]',
  itemIdle: 'hover:bg-[var(--pl-gray-100)]',
  code: 'text-[14px] font-semibold',
  codeActive: 'text-[var(--pl-primary)]',
  codeIdle: 'text-[var(--pl-text-strong)]',
  name: 'text-[12px] text-[var(--pl-text-weak)]',
} as const;
