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

  /** Header (design-benchmark round 2, 시안 E) — the ops target-card grammar
   *  (ServiceDetailView `tsTable`) transplanted: 64px bare provider mark +
   *  3-tier identity (#target · SDU/provider → service name·code → run-context
   *  row) with the promoted Target 상세 확인 CTA at right. The subject leads;
   *  the static page label (h1) and run # are demoted into the context row;
   *  the recipe description lives in the ⓘ tooltip (owner: hover 대체).
   *  All tier metrics are copied from the ops card — no new values. */
  header: {
    root: 'bg-[var(--pl-bg-card)] border-b border-[var(--pl-border)] px-10 pt-6 pb-6 flex items-center gap-4',
    body: 'flex min-w-0 flex-1 flex-col gap-1',
    /** Tier 1 — target id (ops tsTable.id metrics) + SDU chip / provider gloss. */
    idRow: 'flex items-center gap-2 flex-wrap',
    id: 'text-[16px] font-semibold [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)] tabular-nums whitespace-nowrap',
    idHash: 'mr-0.5 font-normal text-[var(--pl-text-weak)]',
    sduChip:
      'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-semibold bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
    prov: 'text-[14px] font-medium text-[var(--pl-text-medium)]',
    /** Tier 2 — labelled service name + code; a fixed-width skeleton until #8
     *  lands so the header's anchor text never swaps mid-load (텍스트 점프 제거).
     *  Labels stay visible during load — the value slot is what skeletons. */
    nameRow: 'flex items-baseline gap-x-2 gap-y-1 min-w-0 min-h-[20px] flex-wrap',
    klabel: 'text-[12px] text-[var(--pl-text-weak)] whitespace-nowrap',
    name: 'text-[14px] font-semibold text-[var(--pl-text-strong)] truncate',
    code: 'text-[14px] font-semibold [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)] whitespace-nowrap',
    /** Tier 3 — run context: page label(h1) · run # · type tag · created · lineage. */
    subRow: 'mt-0.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px] text-[var(--pl-text-weak)]',
    pageLabel: 'text-[12px] font-semibold text-[var(--pl-text-weak)]',
    runId: 'text-[12px] [font-family:var(--pl-font-mono)] text-[var(--pl-text-weak)] tabular-nums whitespace-nowrap',
    /** Combined "AWS 설치" tag — neutral: the header's only hue is the CTA.
     *  DELETE keeps the err tone (a destructive run must not read neutral). */
    typeTag:
      'inline-flex items-center gap-1 rounded-[5px] bg-[var(--pl-gray-100)] px-2 py-0.5 text-[12px] font-semibold text-[var(--pl-text-medium)]',
    typeTagDelete: 'text-[var(--pl-err-text)]',
    /** ⓘ recipe-tooltip trigger — opens on hover AND keyboard focus. */
    tipWrap:
      'group relative inline-flex items-center outline-none cursor-help text-[var(--pl-text-weak)] hover:text-[var(--pl-text-strong)] focus-visible:text-[var(--pl-text-strong)]',
    tip: 'hidden group-hover:block group-focus-within:block absolute left-1/2 top-full z-20 mt-1.5 w-[360px] -translate-x-1/2 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-4 py-3 text-left font-normal shadow-[var(--pl-shadow-md)]',
    tipName:
      'block text-[12px] font-semibold [font-family:var(--pl-font-mono)] text-[var(--pl-text-medium)] break-all',
    tipDesc: 'block mt-1.5 text-[12px] leading-[1.6] text-[var(--pl-text-medium)] whitespace-pre-line',
    link: 'text-[12px] font-semibold text-[var(--pl-primary)] hover:underline inline-flex items-center gap-1 whitespace-nowrap',
    /** CTA — Target 상세 확인, PlButton-primary geometry on a Link. */
    cta: 'flex-none',
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
    /** Per-task segment bar (GitLab mini-graph grammar) — same 300px footprint
     *  as `track`; falls back to track/fill when the chain has >12 tasks. */
    segTrack: 'flex items-center gap-1 w-[300px] max-w-[40vw]',
    seg: 'h-2.5 flex-1 min-w-[8px] rounded-[3px] transition-colors duration-500',
    segTone: {
      DONE: 'bg-[var(--pl-ok)]',
      IN_PROGRESS: 'bg-[var(--pl-info)]',
      FAILED: 'bg-[var(--pl-err)]',
      CANCELLED: 'bg-[var(--pl-gray-400)]',
      READY: 'bg-white/30',
      BLOCKED: 'bg-white/30',
    } as Record<TaskStatus, string>,
    /** READY with fail_count>0 = waiting between retry attempts (Databricks'
     *  yellow "waiting for retry" — neither running nor failed). */
    segRetry: 'bg-[var(--pl-warn)]',
    /** Faint elapsed suffix after the count phrase. */
    elapsed: 'text-[14px] font-normal text-[var(--pl-chrome-item)] whitespace-nowrap', // design-exempt: chrome-item on the dark gray-800 exec band (8.0:1), not on white
  },

  /** Restart context strip between the exec band and the flow (§8.4) — where
   *  this run sits inside the ORIGIN chain, without faking its own progress. */
  originStrip:
    'flex items-center gap-2 border-b border-[var(--pl-border)] bg-[var(--pl-primary-bg)] px-10 py-2.5 text-[14px] text-[var(--pl-primary)]',

  /** Failure strip (시안 1 — Step Functions error-banner grammar, originStrip
   *  metrics): failed task + cause on the left, the restart-unavailable reason
   *  (superseded by a newer run) on the right. */
  failStrip:
    'flex items-center gap-2 border-b border-[var(--pl-border)] bg-[var(--pl-err-bg)] px-10 py-2.5 text-[14px] text-[var(--pl-err-text)]',
  failStripRight: 'ml-auto flex items-center gap-1.5 whitespace-nowrap',
  failStripLink: 'font-semibold underline hover:no-underline',

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
    /** Restart task → origin task link in the drawer header (§8.4). */
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
    // Idle tabs at text-weak — faint(#98A2B3) measured 2.6:1 on the panel.
    navIdle: 'text-[var(--pl-text-weak)] font-normal',
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
