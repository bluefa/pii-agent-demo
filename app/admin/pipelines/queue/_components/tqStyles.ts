/**
 * Task Queue class tokens (admin-taskqueue.html — pixel SSOT). Scoped here rather
 * than in `pipelineStyles` for the same reason as `_detail/detailStyles.ts` /
 * `_services/styles.ts`: this is a self-contained feature surface, and folding
 * its ~15 net-new groups into the already-1300-line theme.ts would bury the
 * shared primitives. Every color still resolves to a `--pl-*` custom property
 * (the delay-tier + tag-blue roles are declared in app/globals.css); sizes /
 * paddings / gaps are copied VERBATIM from the prototype CSS (do NOT snap to the
 * spacing ladder). Reuses `pipelineStyles.text` roles where one already matches.
 */
import { cn, pipelineStyles } from '@/lib/theme';

const { text } = pipelineStyles;

// Cell bases, split from their color so  can take the caller's tone.
const APP_TD_BASE = 'px-4 py-[13px] align-middle tabular-nums border-t border-[var(--pl-gray-100)]';
const APP_TD_MONO_BASE = 'text-[12px] [font-family:var(--pl-font-mono)]';
const RES_ID_TEXT_BASE =
  'max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] [font-family:var(--pl-font-mono)]';

export const tqStyles = {
  /**
   * seg.lg — the large tab/filter control (`.seg.lg`): gray-100 track, p-3px,
   * r10; buttons h40 px-20 r8 14/600; active = white card + shadow. Distinct
   * grammar from `pipelineStyles.seg` (white-bordered container, dark-fill
   * active) — this is the prototype's gray-track/white-card seg, so it lives
   * here as its own group rather than an overloaded size on SegControl.
   */
  segLg: {
    container: 'inline-flex items-center rounded-[10px] bg-[var(--pl-gray-100)] p-[3px]',
    button:
      'inline-flex items-center h-10 px-5 rounded-lg border-0 bg-transparent text-[14px] font-semibold cursor-pointer',
    buttonIdle: 'text-[var(--pl-text-weak)]',
    buttonActive: 'bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] shadow-[var(--pl-shadow-xs)]',
    count: 'ml-1.5 font-normal text-[var(--pl-text-faint)] tabular-nums',
    countActive: 'text-[var(--pl-text-weak)]',
    /** 8px leading color dot (지연 seg). */
    dot: 'inline-block w-2 h-2 mr-1.5 flex-none rounded-full',
    dotTone: {
      d1: 'bg-[var(--pl-delay1-dot)]',
      d2: 'bg-[var(--pl-delay2-dot)]',
      d3: 'bg-[var(--pl-delay3-dot)]',
    },
  },

  /** sel.lg — h46 r10 14/600 select (`select.sel.lg`); aligns on-row with segLg
   *  (46px container). Own group because `PlSelect` `lg` already means h36. */
  selectLg:
    'h-[46px] rounded-[10px] border border-[var(--pl-border-strong)] px-2.5 text-[14px] font-semibold text-[var(--pl-text-strong)] bg-[var(--pl-bg-card)] cursor-pointer focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]',

  /** 지연 4-tier text tone (`.delay` / .d1/.d2/.d3). Weight lives in the tone
   *  (never the base) so the two never collide in the join. */
  delay: {
    base: 'tabular-nums',
    tone: {
      d0: 'font-medium text-[var(--pl-text-weak)]',
      d1: 'font-semibold text-[var(--pl-delay1-text)]',
      d2: 'font-semibold text-[var(--pl-delay2-text)]',
      d3: 'font-bold text-[var(--pl-delay3-text)]',
    },
  },

  /** stx — 2-line step stack (`.stx`): mono "Step n" caption over a single gray
   *  tag with the Korean step label. */
  stepStack: {
    wrap: 'inline-flex flex-col items-start gap-[3px]',
    step: 'text-[12px] font-semibold text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]',
    label:
      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)]',
  },

  /** detail-link — "상세보기" + ↗ (`.detail-link`), reused in P2/P4/P3. */
  detailLink:
    'inline-flex items-center gap-1 whitespace-nowrap text-[14px] font-semibold text-[var(--pl-primary)]',

  /** App db-list-table tag palette (`.tag.*`) — 12/600 r6 pad 2/8. No existing
   *  `pipelineStyles` group covers this grammar (idcStyles.tag is IDC-scoped raw
   *  hex, r8/px2.5). */
  tag: {
    base: 'inline-flex items-center gap-1 align-middle rounded-md px-2 py-0.5 text-[12px] font-semibold',
    blue: 'bg-[var(--pl-tag-blue-bg)] text-[var(--pl-tag-blue-text)]',
    gray: 'bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)]',
    /** Excluded-row DB-type chip (`.row-excluded .tag.blue` → gray-200) — one
     *  shade darker than the gray-100 row fill so the chip stays visible. */
    grayStrong: 'bg-[var(--pl-gray-200)] text-[var(--pl-text-medium)]',
    green: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
    red: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
    orange: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  },

  /** App resource table (`.res-wrap` + `.res-tbl`) — thead gray-50, td 13/16,
   *  row hover bg-inner, excluded rows gray. Distinct from `pipelineStyles.table`
   *  (admin th34/td44 rhythm). Row bg sits on the <tr> (cells stay bg-less) so
   *  the excluded/hover tints resolve without per-cell overrides. */
  appTable: {
    wrap: 'border border-[var(--pl-border)] rounded-t-[10px] overflow-hidden',
    root: 'w-full border-collapse text-[14px]',
    thead: 'bg-[var(--pl-gray-50)]',
    th: 'text-left px-4 py-3 text-[12px] font-semibold text-[var(--pl-text-weak)] border-b border-[var(--pl-border)]',
    /** tbody — drops the first row's top border (seam under thead). */
    body: '[&>tr:first-child>td]:border-t-0',
    td: `${APP_TD_BASE} text-[var(--pl-text-medium)]`,
    tdMono: `${APP_TD_MONO_BASE} text-[var(--pl-text-strong)]`,
    row: 'transition-colors hover:bg-[var(--pl-bg-inner)]',
    /** Resource-id cell w/ copy (`.res-id-cell`) — non-IDC tables (P3/P5). */
    resId: {
      cell: 'inline-flex items-center gap-1.5 max-w-full',
      text: `${RES_ID_TEXT_BASE} text-[var(--pl-text-strong)]`,
      /** Colorless — the caller supplies the tone and the row's hover lift. */
      textBare: RES_ID_TEXT_BASE,
      copy: 'inline-grid place-items-center w-[22px] h-[22px] flex-none rounded-[5px] border-0 bg-transparent text-[var(--pl-text-faint)] cursor-pointer hover:bg-[var(--pl-gray-100)] hover:text-[var(--pl-text-medium)]',
    },
    /** 논리 DB drill-down link (`.ldb-link`) — P5. */
    ldbLink: 'font-semibold text-[var(--pl-primary)] cursor-pointer hover:underline',
  },

  /** App-modal anatomy (`.modal.app` header/body/footer) — layered on ModalShell
   *  variant='app' (r20/p0/scroll shell). Width is passed by TqModal. */
  modal: {
    width: 'w-[720px]',
    widthWide: 'w-[840px]',
    header: 'pt-9 px-10 pb-1',
    eyebrow:
      'inline-flex items-center gap-2 mb-3 text-[12px] font-semibold uppercase tracking-[0.09em] [font-family:var(--pl-font-mono)]',
    eyebrowDot: 'w-1.5 h-1.5 flex-none rounded-full bg-[var(--pl-primary)]',
    eyebrowCtx: 'text-[var(--pl-text-weak)]',
    eyebrowSep: 'text-[var(--pl-text-faint)]',
    eyebrowId: 'font-bold text-[var(--pl-primary)]',
    title:
      'mb-2 text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
    meta: 'flex items-center gap-2 mb-2',
    sub: 'text-[16px] font-normal leading-[1.5] text-[var(--pl-text-weak)]',
    body: 'pt-6 px-10 pb-0',
    footer:
      'flex justify-end gap-2 mt-6 pt-4 px-10 pb-5 border-t border-[var(--pl-border)]',
    /** am-label — 12/700 uppercase weak. */
    label: 'mb-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--pl-text-weak)]',
    /** am-body textarea — min-h 120, r8 border-strong, focus ring. */
    textarea:
      'w-full min-h-[120px] rounded-lg border border-[var(--pl-border-strong)] px-2.5 py-2 text-[14px] leading-[1.4] resize-y focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]',
    /** am-count — n/limit, 12 faint right tabular (shared by CharCount). */
    count: 'mt-1.5 text-right text-[12px] text-[var(--pl-text-faint)] tabular-nums',
    /** am-note — warn box (unsaved-NLB warning). */
    note: 'flex items-start gap-2 mb-4 rounded-lg border border-[var(--pl-warn-border)] bg-[var(--pl-warn-bg)] px-3 py-2.5 text-[14px] leading-[1.4] text-[var(--pl-text-medium)]',
    noteIcon: 'flex-none mt-px text-[var(--pl-warn-text)]',
    /** am-stats — 3-col tile grid (연동 승인 tc modal). */
    stats: {
      grid: 'grid grid-cols-3 gap-3 mb-4',
      tile: 'flex flex-col items-center gap-2 text-center rounded-lg border border-[var(--pl-border)] bg-[var(--pl-bg-inner)] px-3 py-4',
      label: 'text-[12px] font-semibold text-[var(--pl-text-weak)]',
      value: 'text-[24px] font-bold leading-[1.2] text-[var(--pl-text-strong)] tabular-nums',
      unit: 'ml-0.5 text-[14px] font-semibold text-[var(--pl-text-medium)]',
    },
  },

  /** NLB 점유 막대 (`.occbar`) — 96×6 track + tone fill. */
  occ: {
    bar: 'relative inline-block align-middle w-24 h-1.5 overflow-hidden rounded-full bg-[var(--pl-gray-200)]',
    fill: 'absolute left-0 top-0 bottom-0 rounded-full',
    fillTone: {
      ok: 'bg-[var(--pl-gray-400)]',
      warn: 'bg-[var(--pl-warn)]',
      err: 'bg-[var(--pl-err)]',
    },
    num: 'font-semibold text-[var(--pl-text-strong)] tabular-nums',
    den: 'font-medium text-[var(--pl-text-faint)]',
  },

  /** NLB free-capacity tag (`.ftag`) — 여유 / 주의 / Hard Limit. */
  ftag: {
    base: 'inline-flex items-center gap-[3px] align-middle rounded-[4px] px-1.5 py-px text-[12px] font-semibold whitespace-nowrap',
    na: 'bg-[var(--pl-off-bg)] text-[var(--pl-text-weak)]',
    warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
    err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
    ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  },

  /** 반려 사유 hover 툴팁 (`.rr`) — truncated text + gray-900 tooltip above.
   *  Named group so only the cell (not the row) triggers the tip. */
  rr: {
    wrap: 'group/rr relative inline-flex items-center gap-1.5 max-w-full',
    text: 'max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap text-[var(--pl-text-medium)]',
    tip: 'hidden group-hover/rr:block absolute bottom-[calc(100%+8px)] left-0 z-30 w-[320px] whitespace-normal rounded-lg bg-[var(--pl-gray-900)] px-3 py-2.5 text-[12px] font-normal leading-[1.4] text-[var(--pl-white)] shadow-[var(--pl-shadow-lg)]',
  },

  /** Large empty state (`.empty-state`) — 44px inbox circle + 16/600 title +
   *  14 caption. Distinct metrics from PlEmptyState (40 circle / 22 icon). */
  empty: {
    wrap: 'flex flex-col items-center gap-1 text-center pt-14 pb-[60px]',
    icon: 'inline-flex items-center justify-center w-11 h-11 mb-2 rounded-full bg-[var(--pl-gray-100)] text-[var(--pl-text-faint)]',
    title: 'text-[16px] font-semibold text-[var(--pl-text-strong)]',
    caption: 'text-[14px] text-[var(--pl-text-weak)]',
  },

  /** Reject-box (`.reject-box`) — P5 always-on rejection reason (err tint). */
  rejectBox: {
    wrap: 'flex gap-2.5 mb-4 rounded-lg border border-[var(--pl-err-border)] bg-[var(--pl-err-bg)] px-3.5 py-3',
    icon: 'flex-none mt-px text-[var(--pl-err-text)]',
    title: 'text-[14px] font-semibold text-[var(--pl-err-text)]',
    body: cn(text.body, 'mt-1'),
    meta: cn(text.meta, 'mt-1.5'),
  },

  /** List table (`.tbl`) — flat prototype header: 12/600 weak, NO uppercase,
   *  NO gray-50 fill; tbody without the Figma-dashboard zebra tint. */
  listTable: {
    th: 'text-left h-[34px] px-3 text-[12px] font-semibold tracking-[0.03em] text-[var(--pl-text-weak)] border-b border-[var(--pl-border)]',
    body: '[&>tr:last-child>td]:border-b-0',
  },

  /** Stat tile (`.stat`) — gray-100 centered read-only summary; label over value.
   *  Value tone: warn (대기), err (반려>0), strong (default). */
  stat: {
    tile: 'rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-gray-100)] px-6 pt-5 pb-6 text-center',
    grid: 'grid grid-cols-[repeat(4,minmax(0,260px))] gap-3',
    label: 'text-[14px] font-semibold text-[var(--pl-text-medium)]',
    value: 'mt-3 text-[32px] font-semibold leading-[1.2] tracking-[-0.02em] tabular-nums',
    valueTone: {
      strong: 'text-[var(--pl-text-strong)]',
      warn: 'text-[var(--pl-warn-text)]',
      err: 'text-[var(--pl-err-text)]',
    },
  },
} as const;
