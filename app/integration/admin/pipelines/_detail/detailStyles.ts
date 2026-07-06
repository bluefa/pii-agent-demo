/**
 * Bespoke class tokens for the C2 detail composites (IdentityBar, flow card,
 * TaskDetailPanel, Preview/Cancel modals). Phase B `pipelineStyles` covers the
 * primitives but NOT these composites and is READ-ONLY, so the composite chrome
 * lives here — every color still resolves to a `--pl-*` custom property (the same
 * design tokens the primitives use; no raw Tailwind palette classes). Sizes /
 * paddings / gaps are copied VERBATIM from design/pipeline/admin-pipeline.html
 * (§5 box metrics). Text roles are reused from `pipelineStyles.text` where one
 * already matches. The TaskFlow node/connector grammar (pseudo-elements +
 * keyframes) is scoped CSS inside TaskFlow.tsx, not here.
 */
import { cn, pipelineStyles } from '@/lib/theme';

const { text } = pipelineStyles;

export const detailStyles = {
  /** IdentityBar — pad 16/24/16/28, r10, border, shadow-xs, 4px left accent stripe. */
  idbar: {
    bar: 'relative overflow-hidden bg-[var(--pl-bg-card)] border border-[var(--pl-border)] rounded-[10px] shadow-[var(--pl-shadow-xs)] pt-4 pr-6 pb-4 pl-7',
    /** Accent stripe — width 4px, full height; color via inline --ib-accent. */
    stripe: 'absolute inset-y-0 left-0 w-1 bg-[var(--ib-accent)]',
    row: 'flex items-center gap-6 flex-wrap',
    rowTop: 'flex items-start gap-6 flex-wrap',
    prov: 'flex items-center gap-3 flex-none',
    /** picon — 38×38 r10, accent-tinted fill + accent icon. */
    picon: 'grid place-items-center w-[38px] h-[38px] rounded-[10px] flex-none bg-[color-mix(in_srgb,var(--ib-accent)_12%,transparent)] text-[var(--ib-accent)]',
    pname: text.identityName,
    psub: text.fieldKey,
    psubMono: cn(text.fieldKey, '[font-family:var(--pl-font-mono)]'),
    /** Vertical hairline divider between row groups. */
    div: 'self-stretch w-px my-0.5 flex-none bg-[var(--pl-gray-100)]',
    fld: 'flex flex-col gap-1 min-w-0',
    fldKey: text.fieldKey,
    fldValue: text.fieldValue,
    spacer: 'flex-1',
    /** idbar-meta — mt/pt 16 + top hairline. */
    meta: 'mt-4 pt-4 border-t border-[var(--pl-gray-100)]',
    metaRow: 'flex items-start gap-6 flex-wrap',
    mgroup: 'min-w-0',
    mgLabel: cn(text.metaGroupLabel, 'mb-2'),
    mgEmpty: text.meta,
    note: text.note,
  },

  /** kv grid — row/col gap 10/16; wide cols 150px, task-modal cols 170px. */
  kv: {
    wide: 'grid grid-cols-[150px_1fr] gap-x-4 gap-y-2.5',
    task: 'grid grid-cols-[170px_1fr] gap-x-4 gap-y-2.5',
    k: text.kvKey,
    v: text.kvValue,
    vMono: text.kvValueMono,
    /** value-row that carries an inline chip (e.g. effective tag). */
    vRow: cn(text.kvValue, 'flex items-center gap-2'),
    /** inline error-code mono in the 실패 누적 row. */
    errCode: 'text-[12px] text-[var(--pl-err-text)] [font-family:var(--pl-font-mono)]',
  },

  /** ftag — inline flag chip (12/600, pad 1/6 r4). `ext` = warn bg/text. */
  ftag: {
    ext: 'inline-flex items-center gap-[3px] text-[12px] font-semibold px-1.5 py-px rounded-[4px] align-middle bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  },

  /** Preview-modal empty/error note (R21: the step list became the mini flow). */
  recipe: {
    empty: text.muted,
  },

  /** dgroup — top hairline, pt/mt 16; subsection title (14/600) mb via role. */
  dgroup: {
    group: 'border-t border-[var(--pl-gray-100)] pt-4 mt-4',
    /** First dgroup drops the top margin (hairline still present). */
    groupFirst: 'border-t border-[var(--pl-gray-100)] pt-4 mt-0',
    title: cn(text.subsectionTitle, 'mb-2.5'),
    /** caption above a record tail (폴 관찰 / attempts). */
    caption: cn(text.meta, 'mb-1.5 mt-3'),
    captionAlone: cn(text.meta, 'mt-3'),
    formula: cn(text.formula, 'mt-2.5'),
    /** effective tag — small mono faint with a tooltip. */
    effTag: text.formula,
  },

  /** TaskDetailModal header. */
  taskModal: {
    head: 'flex items-start gap-2',
    headMeta: 'flex items-center gap-2 mt-2',
    note: cn(text.note, 'mt-3'),
    /** attempts response cell — mono, ellipsis, capped width. */
    respCell: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap',
    /** degraded-load notice + retry. */
    degraded: cn(text.meta, 'mt-3'),
  },

  /**
   * TaskDetailModal attempts table — same `.tbl` grammar as `pipelineStyles.table`
   * BUT with the modal-scoped padding override (design `.modal.task .tbl th/td`):
   * no fixed row height (th h34 / td h44 must NOT apply inside the 600px dialog),
   * just th pad 4/8/6 and td pad 8 all round. Built locally (not via PlTable/PlTh/
   * PlTd) because those primitives hard-code the page-table row heights and carry
   * no density prop — this is the one place the modal geometry diverges.
   */
  attemptsTable: {
    root: pipelineStyles.table.root,
    body: pipelineStyles.table.body,
    th: 'text-left pt-1 px-2 pb-1.5 text-[12px] font-semibold tracking-[0.03em] text-[var(--pl-text-weak)] border-b border-[var(--pl-border)]',
    td: 'p-2 align-middle tabular-nums border-b border-[var(--pl-gray-100)]',
    tdColor: pipelineStyles.table.tdColor,
    muted: pipelineStyles.table.muted,
  },

  /**
   * R18 §7 — merged flow card (status header zones + canvas + inline panel).
   * The header bleeds to the card edge (negative margins) so the FAILED tint
   * covers the full header band; border-b color lives ONLY in headIdle /
   * headFailed (plain cn join — same-property classes must never co-occur).
   */
  flowCard: {
    head: '-mx-6 -mt-5 px-6 pt-5 pb-4 mb-4 rounded-t-[10px] border-b flex flex-col gap-2',
    headIdle: 'border-[var(--pl-gray-100)]',
    headFailed:
      'border-[var(--pl-err-statusbar-border)] [background:linear-gradient(135deg,var(--pl-err-statusbar-grad-from),var(--pl-bg-card)_55%)]',
    /** Halo ring on the lg pill when the header is FAILED. */
    pillFailedRing: 'shadow-[0_0_0_1px_var(--pl-err-border)]',
    /** err chip — mono 12, err bg/text, pad 2/8 r6. */
    err: 'text-[12px] text-[var(--pl-err-text)] bg-[var(--pl-err-bg)] px-2 py-0.5 rounded-md [font-family:var(--pl-font-mono)]',
    /** R20 — one fact per line: {label → value} rows sharing a 72px label
     *  column ({현재 태스크·상태·진행 상태}); the task name (16/700) stays the
     *  hero of row 1. No seq wording. */
    row: 'flex items-center gap-3 min-w-0 flex-wrap',
    rowLabel: 'w-[72px] flex-none text-[12px] font-semibold text-[var(--pl-text-faint)] whitespace-nowrap',
    rowMeta: 'ml-auto flex items-center gap-2 text-[12px] text-[var(--pl-text-weak)]',
    taskName: 'text-[16px] font-bold leading-[1.2] text-[var(--pl-text-strong)]',
    taskRetry: 'text-[12px] text-[var(--pl-text-weak)]',
    /** §7-3, R19.5 — right-DOCKED panel flush at the canvas edge (owner: 딱
     *  붙게). It sits OUTSIDE the horizontal scroll region (TaskFlow renders it
     *  as a flex sibling of .pl-scroll), so it can never cover the scrollbar or
     *  block left/right movement; long content scrolls vertically inside. */
    body: 'min-w-0',
    canvas: 'w-full',
    panel:
      'w-[400px] flex-none min-w-0 max-h-[440px] bg-[var(--pl-bg-card)] border-l border-[var(--pl-border)] overflow-y-auto overscroll-contain px-5 pt-4 pb-5 motion-safe:[animation:pl-panel-in_.2s_ease-out]',
  },

  /**
   * R21 §A1 — pipeline-type tiles (modal step 1). Base is structural only;
   * tone variants own the icon tile's bg/color (TypeTag vocabulary extended).
   */
  typeTile: {
    row: 'flex gap-2.5 flex-wrap',
    tile: 'flex-1 min-w-[130px] flex flex-col items-start gap-1 rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] p-3.5 text-left cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-[var(--pl-gray-300)] hover:shadow-[var(--pl-shadow-sm)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-[var(--pl-border)] disabled:hover:shadow-none',
    ico: 'grid place-items-center w-[30px] h-[30px] rounded-[8px] mb-0.5',
    icoTone: {
      INSTALL: 'bg-[color-mix(in_srgb,var(--pl-type-install)_10%,transparent)] text-[var(--pl-type-install)]',
      DELETE: 'bg-[color-mix(in_srgb,var(--pl-type-delete)_10%,transparent)] text-[var(--pl-type-delete)]',
      CUSTOM: 'bg-[color-mix(in_srgb,var(--pl-type-custom)_10%,transparent)] text-[var(--pl-type-custom)]',
    },
    title: 'text-[14px] font-bold text-[var(--pl-text-strong)]',
    desc: 'text-[12px] text-[var(--pl-text-weak)] leading-[1.4]',
  },

  /**
   * R21 §B1 — preview modal mini flow: same node vocabulary as the detail
   * canvas (TF/CSP marks, clock for CONDITION_CHECK, line-grid background) so
   * the preview reads as "the Task 흐름, seen small".
   */
  preview: {
    ident: 'text-[13px] text-[var(--pl-text-medium)]',
    identNum: 'font-semibold tabular-nums',
    flow: 'mt-3.5 flex items-center overflow-x-auto rounded-[10px] border border-[var(--pl-border)] px-3 py-3.5 [background-image:linear-gradient(var(--pl-flow-grid)_1px,transparent_1px),linear-gradient(90deg,var(--pl-flow-grid)_1px,transparent_1px)] [background-size:20px_20px]',
    node: 'flex-none flex flex-col gap-1.5 rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-3 py-2.5 min-w-[118px]',
    nodeIcons: 'flex items-center gap-1.5',
    mark: 'grid place-items-center w-[26px] h-[26px] rounded-[7px] flex-none bg-[var(--pl-bg-card)] border border-[var(--pl-border)]',
    markCond: 'grid place-items-center w-[26px] h-[26px] rounded-[7px] flex-none bg-[var(--pl-gray-100)] border border-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',
    markTxt: 'grid place-items-center h-[26px] min-w-[26px] px-1.5 rounded-[7px] flex-none bg-[var(--pl-gray-100)] border border-[var(--pl-gray-100)] text-[12px] font-bold tracking-[.02em] text-[var(--pl-gray-600)]',
    nodeName: 'text-[12px] font-semibold leading-[1.3] text-[var(--pl-text-strong)]',
    conn: 'flex-none w-7 h-0.5 bg-[var(--pl-gray-300)]',
  },

  /**
   * R21 §C1 — target-page front-matter strip: the CSP metadata demoted to one
   * 12px reference line under the h1 (head-nav feel), hairline below.
   */
  frontMeta: {
    strip: 'mt-2.5 mb-4 flex items-center gap-2.5 flex-wrap border-b border-[var(--pl-gray-100)] pb-3 text-[12px] text-[var(--pl-text-medium)]',
    item: 'inline-flex items-center gap-1.5',
    k: 'font-semibold text-[var(--pl-text-faint)]',
    strong: 'font-semibold text-[var(--pl-text-strong)]',
    sep: 'w-px h-3 bg-[var(--pl-gray-100)]',
  },

  /** Loading / layout-stable skeleton block. */
  skeleton: 'animate-pulse rounded-[10px] bg-[var(--pl-gray-100)]',
} as const;
