/**
 * Ops target-source page chrome (Figma pYCA7zTWcZysYOpYykuYAN 4:2, adapted to
 * the --pl-* token system — raw Figma hex values map to their semantic tokens).
 */
export const opsStyles = {
  /** 3-tier surface (admin-ops.html .ts-mast): full-bleed white masthead over the
      layout's gray page — escapes layout.content padding (-mt-6 -mx-8), no card. */
  headCard: '-mt-6 -mx-8',
  header: 'relative bg-[var(--pl-bg-card)] px-8 pt-5 pb-[18px] border-b border-[var(--pl-border)]',

  /** 현재 단계 row under the breadcrumb. */
  stageRow: 'flex items-center gap-2 mt-1',
  stageLabel: 'text-[12px] text-[var(--pl-text-weak)]',

  titleRow: 'flex items-start justify-between gap-6 mt-3',
  titleGroup: 'flex items-center gap-2 min-w-0',
  /** Neutral header tags (Target # id / service code) — Figma 49:4/34:4. */
  tag: 'inline-flex items-center rounded px-2 py-1 text-[11px] font-semibold bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)] whitespace-nowrap',

  /** Cloud info inline row — Figma 34:12. */
  cloudRow: 'flex items-center gap-1.5 mt-2 text-[14px]',
  cloudStrong: 'font-medium text-[var(--pl-text-strong)]',
  cloudSep: 'text-[var(--pl-text-faint)]',
  regionTag: 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',
  modeTag: 'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] bg-[var(--pl-gray-100)] cursor-pointer hover:bg-[var(--pl-gray-200)]',
  modeTagKey: 'text-[var(--pl-text-weak)]',
  modeTagValue: 'font-semibold text-[var(--pl-primary)] underline',

  /** Role sub-rows — Figma 16:6/16:13 (label 72px + mono ARN link). */
  roleRow: 'flex items-center gap-3 pl-3.5 mt-2',
  roleLabel: 'w-[72px] flex-none text-[12px] text-[var(--pl-text-weak)]',
  roleArn: 'text-[12px] text-[var(--pl-primary)] underline cursor-pointer [font-family:var(--pl-font-mono)] break-all text-left',
  roleEmpty: 'text-[12px] text-[var(--pl-text-faint)]',
  roleRegister: 'text-[12px] font-semibold text-[var(--pl-primary)] underline cursor-pointer',

  /** 협업 채널 — popover-style callout (Radix/shadcn grammar: white surface +
      border + soft shadow + border-matched arrow), pinned to the masthead's
      top-right. CTA hierarchy: Jira link = primary (brand color), 관리 = quiet. */
  bubbleWrap: 'absolute top-5 right-8 z-10',
  bubble:
    'relative min-w-[190px] rounded-xl bg-[var(--pl-bg-card)] border border-[var(--pl-border)] shadow-[var(--pl-shadow-lg)] px-4 py-3 flex flex-col gap-1.5',
  /* Border-matched arrow: rotated square sharing the bubble's border on its two
     visible edges, pointing down-left toward the target title. */
  bubbleTail:
    'absolute left-5 -bottom-[6.5px] h-3 w-3 rotate-45 bg-[var(--pl-bg-card)] border-b border-r border-[var(--pl-border)]',
  bubbleTop: 'flex items-center justify-between gap-4',
  bubbleTitle: 'text-[12px] font-semibold text-[var(--pl-text-weak)]',
  bubbleManage:
    'text-[11px] font-medium text-[var(--pl-text-faint)] hover:text-[var(--pl-text-medium)] hover:underline cursor-pointer',
  bubbleJiraRow:
    'self-start inline-flex items-center gap-1.5 -mx-1.5 px-1.5 py-0.5 rounded-md hover:bg-[var(--pl-primary-bg)] transition-colors',
  /* Plain inline (not inline-flex) so the underline runs unbroken across "KEY ↗". */
  bubbleLink:
    'text-[13px] font-semibold text-[var(--pl-primary)] underline underline-offset-2 cursor-pointer',

  /** Tab rail (admin-ops.html .tabbar) — tinted band; only the active tab turns
      white so it visually connects to the body below. */
  tabStrip: 'flex gap-0.5 px-8 bg-[var(--pl-gray-100)] border-b border-[var(--pl-border)]',
  tab: 'px-4 py-3 text-[14px] cursor-pointer whitespace-nowrap rounded-t-[6px] border-b-2 -mb-px',
  tabActive: 'font-semibold text-[var(--pl-primary)] border-[var(--pl-primary)] bg-[var(--pl-bg-card)]',
  tabIdle: 'font-medium text-[var(--pl-text-weak)] border-transparent hover:text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-50)]',
  tabDisabled: 'font-medium text-[var(--pl-text-faint)] cursor-not-allowed',

  /** 진행 상태 tab content — 24px below the tab rail (prototype). */
  content: 'mt-6 flex flex-col gap-4',
  /** Side-by-side cards — grid rows stretch so the pair is always equal height. */
  cardsRow: 'grid grid-cols-2 gap-4',
  /** 20px — 16은 카드 안 블록 제목들과 급이 안 벌어진다는 운영 피드백(스캔 탭). */
  cardTitle: 'text-[20px] font-semibold text-[var(--pl-text-strong)]',
  /** 13/medium + 타이틀과 12px 간격 — 12/weak·4px는 힌트처럼 흐릿하다는 운영 피드백. */
  cardDesc: 'text-[13px] text-[var(--pl-text-medium)] mt-3',

  /** A paged card in cardsRow: column layout so the pager sits at the bottom. */
  pagedCard: 'flex flex-col',
  /** Its body slot — tall enough for a full PAGE_SIZE(5) table, so a card with
      one row (or none) does not shrink below its sibling. `flex-1` then absorbs
      any extra height the taller sibling forces on this one. */
  pagedCardBody: 'mt-3 min-h-[266px] flex-1',

  /** 상세 보기 → text button (Figma 40:21). */
  detailLink: 'inline-flex items-center gap-1 text-[13px] font-medium text-[var(--pl-primary)] cursor-pointer hover:underline whitespace-nowrap',

  /** Figma 4:2 table grammar — plain headers (no fill), divider rows. */
  table: {
    base: 'w-full border-collapse text-[13px]',
    headCell:
      'py-2.5 px-3 text-left text-[12px] font-medium text-[var(--pl-text-weak)] border-b border-[var(--pl-border)] whitespace-nowrap',
    cell: 'py-3 px-3 border-b border-[var(--pl-gray-100)] align-middle text-[var(--pl-text-strong)]',
    rowHover: 'hover:bg-[var(--pl-gray-50)] transition-colors',
  },

  /** Uppercase wire-status tag (Figma APPROVED/CANCELLED chips). */
  statusTag:
    'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em] whitespace-nowrap',
} as const;
