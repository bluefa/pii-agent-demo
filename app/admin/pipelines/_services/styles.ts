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
   *  padding so the recessed ground bleeds to the content edges on all four sides.
   *
   *  The ground is painted HERE, not on `--pl-bg-page`. Tinting the global token
   *  made it byte-identical to `--pl-gray-100`, which is what tiles sitting
   *  straight on the page ground use — the ops-alerts summary tiles
   *  (`bg-[var(--pl-gray-100)]`, no border) went to 1.000 contrast and vanished.
   *  Scoping the tint to this split keeps the layered treatment on the two
   *  service screens and leaves every other admin page alone. */
  split:
    'flex items-stretch -ml-8 -mr-8 -mt-6 -mb-12 min-h-[calc(100vh_-_64px)] bg-[var(--pl-gray-100)]',
  /**
   * The rail owns no padding — each zone sets its own, so row fills run edge to edge.
   *
   * It carries no background and no seam of its own — `split` paints the ground
   * under both columns, so nav and ground are literally one surface and cannot
   * drift apart. White made the rail the brightest surface on screen while the
   * work area sat lower, which read as two pages butted together; a 1px line was
   * the only thing claiming otherwise.
   */
  rail: 'w-[296px] flex-none flex flex-col',
  railHead: 'flex shrink-0 items-center gap-2 px-3 pt-6 pb-2.5',
  railTitle: 'text-[16px] font-bold text-[var(--pl-text-strong)]',
  /** Total beside the title — round, unlike the square code tags: a quantity, not an identifier. */
  railCount:
    'inline-flex items-center rounded-full bg-[var(--pl-gray-200)] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]',
  /** Search closes the rail's chrome block; the hairline under it opens the list. */
  railSearch: 'shrink-0 px-3 pb-3 border-b border-[var(--pl-border)]',
  /** 목록 위 구역 라벨 — 지금 보고 있는 게 전체인지 검색 결과인지. ServiceSidebar 와 같은 자리. */
  railSection: 'shrink-0 px-3 pt-3 pb-1.5 text-[12px] font-medium tracking-[0.02em] text-[var(--pl-text-weak)]',
  railBody: 'flex flex-col flex-1 min-h-0',
  /** Rows divide the remaining height between them, so a page reaches the rail's bottom. */
  railList: 'flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--pl-border)]',
  railFoot: 'mt-auto',
  /**
   * Right pane — restores the escaped content padding, and is itself a column so
   * the sheet inside can fill the remaining height. The padding here is the grey
   * that frames the sheet on every side; the parent layout supplies the right.
   */
  main: 'flex-1 min-w-0 flex flex-col pl-8 pr-8 pt-6 pb-6',
  /** 1-line picker row — tile, name (wraps), then the code in its own right column.
   *  `flex-1` stretches it to fill the rail; `min-h` keeps it readable when a short
   *  viewport makes the list scroll instead. State variants own bg + name color. */
  item: 'flex w-full flex-1 min-h-[48px] items-center gap-2.5 px-3 text-left cursor-pointer transition-colors',
  /** Tint + 2px accent bar — how a desktop rail marks "you are here". The bar
   *  sits on the RIGHT edge, the side the rail hands off to the detail pane. */
  itemActive:
    'relative bg-[var(--pl-primary-bg)] before:absolute before:inset-y-0 before:right-0 before:w-0.5 before:bg-[var(--pl-primary)] before:content-[""]',
  /** White, not a deeper grey — on a recessed rail the row under the cursor lifts. */
  itemIdle: 'hover:bg-[var(--pl-bg-card)]',
  /** Service names run to ~30 characters — wrap rather than clip at the rail's edge.
   *  16px/`leading-6` mirrors `serviceSidebarStyles.rowName`: these two rails are the
   *  same control on two screens, and they have already drifted apart once (page size,
   *  10 vs 8). This is the one rail label that routinely reaches `line-clamp-3`, so the
   *  leading moves with the size — 16 on `leading-5` would be a 1.25 ratio. */
  name: 'flex-1 min-w-0 line-clamp-3 break-words text-[16px] font-medium leading-6',
  nameActive: 'text-[var(--pl-primary)]',
  nameIdle: 'text-[var(--pl-text-strong)]',
  /** 코드 태그 — codes are 3 characters, so `min-w` fixes the column and every code
   *  lands on one x down the list; packed against a wrapping name it would not.
   *  태그 면이 흰색에서 gray-200 으로 내려갔으므로 글자도 한 단 내린다 — weak(#667085)
   *  는 #E4E7EC 위에서 4.01 로 AA 미달이고, medium(#344054)이 8.44. */
  code: 'inline-flex shrink-0 min-w-[38px] items-center justify-center rounded-[6px] bg-[var(--pl-gray-200)] px-1.5 py-0.5 font-mono text-[12px] font-medium leading-5 text-[var(--pl-text-medium)]',
  codeActive:
    'inline-flex shrink-0 min-w-[38px] items-center justify-center rounded-[6px] bg-[var(--pl-white)] px-1.5 py-0.5 font-mono text-[12px] font-semibold leading-5 text-[var(--pl-primary)]',

  /**
   * Content sheet — the page's ONE raised plane, filling the pane so the grey
   * frames it on all four sides. The rail and the ground behind it are a single
   * recessed surface; the sheet is the only thing in front of it.
   *
   * One sheet, not one per section. Stacked sheets let the ground show through
   * between them, which cuts the content back into separate islands — the very
   * thing the layered treatment is meant to fix. Sections are separated inside
   * the sheet by space and a hairline, never by a gap in the sheet itself.
   */
  sheet:
    'flex-1 min-h-0 flex flex-col gap-7 rounded-[12px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-7 py-6',
  /** Section break inside the sheet — a rule, so the group never comes apart. */
  sheetRule: 'border-t border-[var(--pl-border)] -mx-7',
  /** Sticky rail geometry — top-[64px] clears the 64px TopNav; at top-0 the title slides under it. */
  railSticky: 'sticky top-[64px] self-start h-[calc(100vh_-_64px)]',
  /**
   * 시트 머리의 분류 태그 — 서비스 이름 위에서 "지금 무엇을 하는 화면인지"를 먼저 말한다.
   * primary 쌍(#2563EB on #EFF4FF)은 흰 시트 위에서 4.69:1.
   */
  pageTag:
    'inline-flex w-fit items-center rounded-[6px] bg-[var(--pl-primary-bg)] px-2 py-1 text-[12px] font-semibold text-[var(--pl-primary)]',

  /** Selected-service identity block (Figma "pipeline-services-improved"):
   *  eyebrow + service_name(hero) + service_code chip, a summary stat row, then
   *  a scope line — replaces the old "…의 Target Source" section header so the
   *  right pane leads with WHAT is selected before the target table. */
  identity: 'flex flex-col gap-4',
  eyebrow: 'text-[13px] font-medium text-[var(--pl-flow-meta-label)]',
  titleRow: 'flex items-center gap-3 flex-wrap',
  svcTitle: 'text-[26px] font-extrabold tracking-[-0.03em] leading-[1.2] text-[var(--pl-text-strong)]',
  svcCodeChip:
    'inline-flex items-center gap-1.5 rounded-full bg-[var(--pl-gray-100)] px-2.5 py-1 text-[12px] font-semibold text-[var(--pl-text-medium)]',
  /** 칩 안의 라벨 — 값이 아니라 값의 이름이라 한 단 여리게. */
  svcCodeChipLabel: 'font-medium text-[var(--pl-text-weak)]',
  statRow: 'flex items-center gap-10',
  stat: 'flex flex-col gap-1.5',
  statLabel: 'text-[12px] font-medium text-[var(--pl-flow-meta-label)]',
  statVal: 'text-[18px] font-semibold text-[var(--pl-text-strong)] tabular-nums',
  /** 실행 중 — the one actionable signal, tinted info like the RUNNING pill. */
  statValActive: 'text-[18px] font-semibold text-[var(--pl-info-text)] tabular-nums',
  identityDesc: 'text-[13px] leading-[1.55] text-[var(--pl-text-weak)]',
} as const;
