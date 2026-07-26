/**
 * Ops target-source page chrome (Figma pYCA7zTWcZysYOpYykuYAN 4:2, adapted to
 * the --pl-* token system — raw Figma hex values map to their semantic tokens).
 */
export const opsStyles = {
  /** 3-tier surface (admin-ops.html .ts-mast): full-bleed white masthead over the
      layout's gray page — escapes layout.content padding (-mt-6 -mx-8), no card. */
  headCard: '-mt-6 -mx-8',
  header: 'bg-[var(--pl-bg-card)] px-8 pt-5 pb-[18px] border-b border-[var(--pl-border)]',

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

  /** 협업 채널 speech bubble — Figma 61:6 (tail below-left). */
  bubbleWrap: 'relative flex-none',
  bubble: 'rounded-[10px] bg-[var(--pl-gray-100)] px-4 py-3.5 flex flex-col gap-2',
  bubbleTail: 'absolute left-4 -bottom-[6px] h-3 w-3 rotate-45 bg-[var(--pl-gray-100)]',
  bubbleTop: 'flex items-center gap-2',
  bubbleTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  bubbleManage: 'text-[11px] text-[var(--pl-primary)] underline cursor-pointer',
  bubbleJiraRow: 'flex items-center gap-1.5',
  /* Plain inline (not inline-flex) so the underline runs unbroken across "KEY ↗". */
  bubbleLink: 'text-[13px] font-medium text-[var(--pl-text-strong)] underline cursor-pointer',

  /** Tab rail (admin-ops.html .tabbar) — tinted band; only the active tab turns
      white so it visually connects to the body below. */
  tabStrip: 'flex gap-0.5 px-8 bg-[var(--pl-gray-100)] border-b border-[var(--pl-border)]',
  tab: 'px-4 py-3 text-[14px] cursor-pointer whitespace-nowrap rounded-t-[6px] border-b-2 -mb-px',
  tabActive: 'font-semibold text-[var(--pl-primary)] border-[var(--pl-primary)] bg-[var(--pl-bg-card)]',
  tabIdle: 'font-medium text-[var(--pl-text-weak)] border-transparent hover:text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-50)]',
  tabDisabled: 'font-medium text-[var(--pl-text-faint)] cursor-not-allowed',

  /** 진행 상태 tab content — 24px below the tab rail (prototype). */
  content: 'mt-6 flex flex-col gap-4',
  cardsRow: 'grid grid-cols-2 gap-4 items-start',
  cardTitle: 'text-[16px] font-semibold text-[var(--pl-text-strong)]',
  cardDesc: 'text-[12px] text-[var(--pl-text-weak)] mt-1',

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
    'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em]',
} as const;
