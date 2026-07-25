/**
 * Class tokens for the redesigned pipeline detail page (Figma
 * "pipeline-detail-improved"): a full-bleed header area, a dark top tab bar
 * (Task 흐름 / 상세 정보), a RUNNING-only progress band, and a 420px task drawer
 * with three sub-tabs (실행 정보 / 시도 기록 / 정의·계약).
 *
 * The Figma mock uses a slightly richer palette than the shared `--pl-*` scale;
 * every value here is mapped to the NEAREST existing `--pl-*` token so the page
 * stays consistent with the rest of the pipeline feature and carries no raw
 * color classes (CLAUDE.md rule #4). The flow canvas/node grammar is untouched
 * (TaskFlow owns it, shared with the custom builder).
 */
import type { PipelineStatus, TaskStatus } from '@/lib/pipeline/types';

/** Text-only status badge tones — reuse the pill semantic tokens (no icon).
 *  Covers both pipeline and task statuses (drawer header + attempts table). */
const STATUS_BADGE_TONE: Record<PipelineStatus | TaskStatus, string> = {
  PENDING: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  RUNNING: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
  IN_PROGRESS: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
  READY: 'bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
  DONE: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  FAILED: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  CANCELLED: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
  BLOCKED: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
};

export const improvedStyles = {
  /** Cancels the layout content padding (content = px-8 pt-6) so the header /
   *  tab bar / band go edge-to-edge like the Figma "main" frame. A full-height
   *  flex column (flex-1 inside layout.contentDetail) so the Task 흐름 canvas
   *  can grow to the bottom. */
  bleed: '-mx-8 -mt-6 -mb-12 flex flex-col flex-1 min-h-0',

  /** Header area (node 70:35) — white, hairline below: title + #id (+ status /
   *  중단 only when NOT running), a recipe description line, then two
   *  column-aligned meta rows led by an accent group label. */
  header: {
    root: 'bg-[var(--pl-bg-card)] border-b border-[var(--pl-border)] px-10 pt-7 pb-6 flex flex-col gap-5',
    topRow: 'flex items-start justify-between gap-6',
    titleWrap: 'flex flex-col gap-3 min-w-0',
    titleRow: 'flex items-center gap-3 flex-wrap',
    title: 'text-[28px] font-bold leading-none text-[var(--pl-text-strong)]',
    id: 'text-[18px] font-medium text-[var(--pl-text-faint)] tabular-nums',
    desc: 'text-[14px] leading-[1.55] text-[var(--pl-text-weak)] max-w-[880px] whitespace-pre-line',
    /** Two rows × [group label | pair | pair | pair], columns auto-aligned. */
    metaGrid: 'grid grid-cols-[auto_auto_auto_auto] items-center gap-x-10 gap-y-3 w-fit',
    groupLabel: 'text-[14px] font-medium text-[var(--pl-flow-meta-label)] whitespace-nowrap',
    pair: 'flex items-baseline gap-2 whitespace-nowrap',
    k: 'text-[13px] text-[var(--pl-text-weak)]',
    /** Secondary values — regular weight so the strip isn't a wall of bold. */
    v: 'text-[15px] font-normal text-[var(--pl-text-strong)]',
    /** Primary value (서비스 이름) — kept semibold as the row's anchor. */
    vStrong: 'text-[15px] font-semibold text-[var(--pl-text-strong)]',
    vMono: 'text-[13px] font-semibold text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
    link: 'text-[14px] font-semibold text-[var(--pl-primary)] hover:underline inline-flex items-center gap-1 whitespace-nowrap',
  },

  /** Text-only status badge (header + progress band). */
  badge: {
    base: 'inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium leading-none',
    tone: STATUS_BADGE_TONE,
  },

  /** RUNNING progress band (node 70:35) — dark navy, shown only while the run
   *  is live: two rows (현재 실행 중 · task · RUNNING pill / 진행 단계 · bar ·
   *  n/total) with the 중단 button vertically centered on the right. */
  band: {
    root: 'flex items-center justify-between gap-6 bg-[var(--pl-gray-800)] px-10 py-4',
    /** [label | content] grid so the task name (row 1) and the progress bar
     *  (row 2) share the same left x-coordinate (owner). */
    main: 'grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 min-w-0',
    label: 'text-[13px] text-[var(--pl-chrome-item)] whitespace-nowrap',
    cell: 'flex items-center gap-3 min-w-0',
    curName: 'text-[16px] font-bold text-[var(--pl-white)] truncate',
    pill: 'inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold text-[var(--pl-white)] leading-none',
    pillTone: {
      PENDING: 'bg-[var(--pl-warn)]',
      RUNNING: 'bg-[var(--pl-info)]',
      DONE: 'bg-[var(--pl-ok)]',
      FAILED: 'bg-[var(--pl-err)]',
      CANCELLED: 'bg-[var(--pl-gray-400)]',
    } as Record<PipelineStatus, string>,
    track: 'w-[300px] max-w-[40vw] h-2.5 rounded-full bg-white/30 overflow-hidden',
    fill: 'block h-full rounded-full bg-[var(--pl-info)] transition-[width] duration-500',
    count: 'text-[14px] font-semibold text-[var(--pl-white)] tabular-nums whitespace-nowrap',
  },

  /** Restart context strip between the exec band and the flow (§8.4) — where
   *  this run sits inside the ORIGIN chain, without faking its own progress. */
  originStrip:
    'flex items-center gap-2 border-b border-[var(--pl-border)] bg-[var(--pl-primary-bg)] px-10 py-2.5 text-[13px] text-[var(--pl-primary)]',

  /** Content region below the band: flow canvas (flex-1) + docked drawer. */
  contentRow: 'flex items-stretch',
  flowPad: 'p-5 flex-1 min-w-0',

  /** Task drawer (node 70:35) — 420px, light gray, docked flush at the canvas edge. */
  drawer: {
    root: 'w-[500px] flex-none flex flex-col bg-[var(--pl-flow-panel)] border-l border-[var(--pl-border)] overflow-hidden',
    header: 'flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-[var(--pl-border)]',
    /** Title (h3); the status badge is rendered inline after the name so it
     *  always sits to the right of the title text (node 70:35). */
    title: 'text-[18px] font-bold leading-snug text-[var(--pl-text-strong)]',
    titleBadge: 'ml-2.5 align-middle',
    /** Task description — moved into the header (node 70:35), above the tabs. */
    headerDesc: 'mt-3 text-[14px] leading-[1.6] text-[var(--pl-text-weak)] whitespace-pre-line',
    typeRow: 'flex items-center gap-2 mt-3.5 flex-wrap',
    /** "이전 실행 이력 보기 ↗" — restart task → origin task (§8.4). */
    originLink:
      'inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--pl-primary)] hover:underline',
    typeLabel: 'text-[13px] text-[var(--pl-text-weak)]',
    tag: 'inline-flex items-center rounded-full bg-[var(--pl-bg-card)] border border-[var(--pl-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
    close: 'flex-none inline-flex items-center justify-center w-8 h-8 -mr-1 rounded-lg text-[var(--pl-text-strong)] hover:bg-[var(--pl-bg-card)] transition-colors',
    /** Sub-tab nav. */
    nav: 'flex items-stretch border-b border-[var(--pl-border)]',
    navTab: 'flex-1 flex flex-col items-center justify-center gap-1.5 h-11 text-[14px]',
    // Active tab: blue text + blue underline (owner Figma node 121-406).
    navActive: 'text-[var(--pl-primary)] font-semibold',
    navIdle: 'text-[var(--pl-text-faint)] font-normal',
    navUnderline: 'h-0.5 w-14 rounded-full bg-[var(--pl-primary)]',
    navUnderlineHidden: 'h-0.5 w-14',
    body: 'flex-1 overflow-y-auto overscroll-contain px-6 py-7 flex flex-col gap-7',

    /** Section label (progress log / attempt history / attempt info / …) — dark bold
     *  16px heading, the primary hierarchy anchor inside the body (owner Figma node 121-5). */
    sectionLabel: 'text-[16px] font-semibold text-[var(--pl-text-strong)] tracking-[-0.196px]',
    descText: 'mt-2.5 text-[14px] leading-[1.6] text-[var(--pl-text-strong)] whitespace-pre-line',
    /** Terminal-failure cause block — error-toned descText; shown when a failed attempt has no job rows. */
    failReason: 'mt-2.5 text-[14px] leading-[1.6] text-[var(--pl-err-text)] whitespace-pre-line break-words',
    /** Clamped 2-line preview of a long failure cause — the full text opens in FailureReasonModal. */
    failReasonClamp: 'mt-2.5 text-[14px] leading-[1.6] text-[var(--pl-err-text)] break-words line-clamp-2',
    /** "자세히" link under a clamped failure cause — opens the full-message modal. */
    failReasonMore: 'mt-1.5 text-[12px] font-semibold text-[var(--pl-primary)] hover:underline transition-colors',
    /** key/value progress rows — value is regular weight, 14px (node 70:35). */
    kvRow: 'flex items-center justify-between gap-3',
    kvKey: 'text-[14px] text-[var(--pl-text-weak)]',
    kvVal: 'text-[14px] font-normal text-[var(--pl-text-strong)] tabular-nums',
    kvValErr: 'text-[14px] font-normal text-[var(--pl-err-text)] tabular-nums',
    /** Attempt count / retry budget — bold label + value on one row, same 14px
     *  as the label so the value doesn't outrank it (owner Figma node 121-5). */
    attemptRow: 'flex items-center justify-between gap-3',
    bigVal: 'text-[14px] font-bold text-[var(--pl-text-strong)] tabular-nums',
    bigValErr: 'text-[14px] font-bold text-[var(--pl-err-text)] tabular-nums',
    rowsGap: 'mt-4 flex flex-col gap-2.5',

    /** attempts table. */
    tableWrap: 'rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] overflow-x-auto',
    table: 'w-full border-collapse text-[12px]',
    th: 'text-left px-2 py-2 text-[11px] font-medium text-[var(--pl-text-faint)] bg-[var(--pl-gray-50)] border-b border-[var(--pl-border)] whitespace-nowrap',
    td: 'px-2 py-2.5 align-middle text-[var(--pl-text-strong)] border-b border-[var(--pl-gray-100)] tabular-nums [&:last-child]:whitespace-nowrap',
    tbody: '[&>tr:last-child>td]:border-b-0',
    miniBadge: 'inline-flex items-center rounded-[10px] px-1.5 py-0.5 text-[10px] font-medium leading-none',
    empty: 'text-[13px] text-[var(--pl-text-faint)] py-6 text-center',

    /** definition·contract rows — borderless on the panel, hairline dividers,
     *  mono gray keys + right-aligned dark values (owner Figma node 121-406). */
    defCard: 'flex flex-col',
    defRow: 'flex items-center justify-between gap-3 py-3 border-b border-[var(--pl-border)] [&:last-child]:border-b-0',
    defKey: 'flex-none text-[13px] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]',
    defVal: 'text-[13px] font-semibold text-[var(--pl-text-strong)] text-right break-all',
    defValMono: 'text-[13px] font-semibold text-[var(--pl-text-strong)] text-right break-all [font-family:var(--pl-font-mono)]',
    /** Judgment policy — dark bold 16px heading + prose paragraph (KIND_POLICY). */
    policyLabel: 'text-[16px] font-semibold text-[var(--pl-text-strong)] tracking-[-0.196px]',
    policyText: 'mt-1.5 text-[13px] leading-[1.6] text-[var(--pl-text-medium)]',
  },
} as const;
