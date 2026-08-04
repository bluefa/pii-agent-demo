/**
 * Local style tokens for the services page composites (LIN-25 Phase C1-b).
 *
 * R20.5 — the service picker is a full-height RAIL flush at the content area's
 * left edge (reference: /pass/services "Service List" panel), NOT a
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
  /** 2-line picker item — service_name(14/semibold) over service_code(12/faint);
   *  the state variants own bg + name color/weight. */
  item: 'flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left cursor-pointer',
  itemActive: 'bg-[var(--pl-primary-bg)]',
  itemIdle: 'hover:bg-[var(--pl-gray-100)]',
  name: 'text-[14px] font-semibold',
  nameActive: 'text-[var(--pl-primary)]',
  nameIdle: 'text-[var(--pl-text-strong)]',
  /** 코드 — faint(#98A2B3)는 흰 배경에서 2.58 로 AA 미달이라 weak(4.97). */
  code: 'text-[12px] text-[var(--pl-text-weak)]',

  /** Selected-service identity block (Figma "pipeline-services-improved"):
   *  eyebrow + service_name(hero) + service_code chip, a summary stat row, then
   *  a scope line — replaces the old "…의 Target Source" section header so the
   *  right pane leads with WHAT is selected before the target table. */
  identity: 'flex flex-col gap-4 mb-6',
  eyebrow: 'text-[13px] font-medium text-[var(--pl-flow-meta-label)]',
  titleRow: 'flex items-center gap-3 flex-wrap',
  svcTitle: 'text-[26px] font-extrabold tracking-[-0.03em] leading-[1.2] text-[var(--pl-text-strong)]',
  svcCodeChip:
    'inline-flex items-center rounded-full bg-[var(--pl-gray-100)] px-2.5 py-1 text-[13px] font-medium text-[var(--pl-text-medium)]',
  statRow: 'flex items-center gap-10',
  stat: 'flex flex-col gap-1.5',
  statLabel: 'text-[12px] font-medium text-[var(--pl-flow-meta-label)]',
  statVal: 'text-[18px] font-semibold text-[var(--pl-text-strong)] tabular-nums',
  /** 실행 중 — the one actionable signal, tinted info like the RUNNING pill. */
  statValActive: 'text-[18px] font-semibold text-[var(--pl-info-text)] tabular-nums',
  identityDesc: 'text-[13px] leading-[1.55] text-[var(--pl-text-weak)]',
} as const;
