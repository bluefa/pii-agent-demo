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
  /**
   * The rail owns no padding — each zone sets its own, so row fills run edge to edge.
   *
   * It sits on the page ground rather than on its own white plane, and carries no
   * seam: nav and ground are one continuous back surface, and the content's white
   * sheets are the only thing in front. White made the rail the brightest surface
   * on screen while the work area sat lower, which read as two pages butted
   * together — a 1px line was the only thing claiming otherwise.
   */
  rail: 'w-[296px] flex-none flex flex-col bg-[var(--pl-bg-page)]',
  railHead: 'flex shrink-0 items-center gap-2 px-3 pt-6 pb-2.5',
  railTitle: 'text-[16px] font-bold text-[var(--pl-text-strong)]',
  /** Total beside the title — round, unlike the square code tags: a quantity, not an identifier. */
  railCount:
    'inline-flex items-center rounded-full bg-[var(--pl-gray-200)] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-text-weak)]',
  /** Search closes the rail's chrome block; the hairline under it opens the list. */
  railSearch: 'shrink-0 px-3 pb-3 border-b border-[var(--pl-border)]',
  /** 목록 위 구역 라벨 — 지금 보고 있는 게 전체인지 검색 결과인지. ServiceSidebar 와 같은 자리. */
  railSection: 'shrink-0 px-3 pt-3 pb-1.5 text-[12px] font-medium tracking-[0.02em] text-[var(--pl-text-weak)]',
  railBody: 'flex flex-col flex-1 min-h-0',
  /** Rows divide the remaining height between them, so a page reaches the rail's bottom. */
  railList: 'flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--pl-border)]',
  railFoot: 'mt-auto',
  /** Right pane — restores the escaped content padding. */
  main: 'flex-1 min-w-0 pl-8 pt-6 pb-12',
  /** 1-line picker row — tile, name (wraps), then the code in its own right column.
   *  `flex-1` stretches it to fill the rail; `min-h` keeps it readable when a short
   *  viewport makes the list scroll instead. State variants own bg + name color. */
  item: 'flex w-full flex-1 min-h-[48px] items-center gap-2.5 px-3 text-left cursor-pointer transition-colors',
  /** Tint + 2px accent bar — how a desktop rail marks "you are here". */
  itemActive:
    'relative bg-[var(--pl-primary-bg)] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[var(--pl-primary)] before:content-[""]',
  /** White, not a deeper grey — on a recessed rail the row under the cursor lifts. */
  itemIdle: 'hover:bg-[var(--pl-bg-card)]',
  /** Service names run to ~30 characters — wrap rather than clip at the rail's edge. */
  name: 'flex-1 min-w-0 line-clamp-3 break-words text-[14px] font-medium leading-5',
  nameActive: 'text-[var(--pl-primary)]',
  nameIdle: 'text-[var(--pl-text-strong)]',
  /** 코드 태그 — codes are 3 characters, so `min-w` fixes the column and every code
   *  lands on one x down the list; packed against a wrapping name it would not.
   *  faint(#98A2B3)는 흰 배경에서 2.58 로 AA 미달이라 weak(4.97). */
  code: 'inline-flex shrink-0 min-w-[38px] items-center justify-center rounded-[6px] bg-[var(--pl-gray-200)] px-1.5 py-0.5 font-mono text-[12px] font-medium leading-5 text-[var(--pl-text-weak)]',
  codeActive:
    'inline-flex shrink-0 min-w-[38px] items-center justify-center rounded-[6px] bg-[var(--pl-white)] px-1.5 py-0.5 font-mono text-[12px] font-semibold leading-5 text-[var(--pl-primary)]',

  /**
   * Content sheet — the page's one raised plane. The rail and the ground behind
   * it are a single recessed surface, so a section only reads as content once it
   * is on a sheet; anything sitting bare on the ground reads as chrome.
   */
  sheet: 'rounded-[12px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-6 py-5',
  /** Sheets stack with a gap — the ground between them is the section break. */
  sheetStack: 'flex flex-col gap-4',
  /** A block nested inside a sheet steps DOWN, not up — white on white is not a boundary. */
  sheetInner: 'rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-bg-inner)]',

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
