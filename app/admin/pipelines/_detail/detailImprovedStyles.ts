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

  /** Header (design-benchmark round 2, proposal E) — the ops target-card grammar
   *  (ServiceDetailView `tsTable`) transplanted: 64px bare provider mark +
   *  3-tier identity (#target · SDU/provider → service name·code → run-context
   *  row); the target link lives in tier 1 since the owner cut the header-wide
   *  CTA (2026-08-16). The subject leads;
   *  the static page label (h1, 20px) and run # are demoted into the context row;
   *  the recipe description lives in the ⓘ tooltip (owner: replace with hover).
   *  All tier metrics are copied from the ops card — no new values. */
  header: {
    root: 'bg-[var(--pl-bg-card)] border-b border-[var(--pl-border)] px-10 pt-6 pb-6 flex flex-col gap-3',
    /** Page title row — "Infra 작업 현황"(h1). The CTA that used to sit at its
     *  right is gone (owner 2026-08-16); the target link moved into tier 1. */
    titleRow: 'flex items-center justify-between gap-6',
    /** 20px (owner 2026-08-16) — a step under the shared 24px `pageTitle`, since
     *  the static page label is not what leads this screen; the target is. */
    pageTitle: 'text-[20px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
    main: 'flex items-center gap-4',
    body: 'flex min-w-0 flex-1 flex-col gap-1',
    /** Tier 1 (owner 2026-08-16) — the provider glyph, the id, and 상세정보 보기
     *  as a text button. It absorbed the promoted CTA that used to sit at the far
     *  right of the title row: the errand now stands next to the id it acts on. */
    idRow: 'flex items-center gap-2 flex-wrap',
    id: 'text-[12px] font-medium [font-family:var(--pl-font-mono)] text-[var(--pl-primary)] tabular-nums whitespace-nowrap',
    idHash: 'mr-0.5 font-normal',
    sduChip:
      'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-semibold bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
    prov: 'text-[14px] font-medium text-[var(--pl-text-medium)]',
    /** Tier 2 — labelled service name + code; a fixed-width skeleton until #8
     *  lands so the header's anchor text never swaps mid-load (no text jump).
     *  Labels stay visible during load — the value slot is what skeletons. */
    nameRow: 'flex items-baseline gap-x-2 gap-y-1 min-w-0 min-h-[20px] flex-wrap',
    klabel: 'text-[12px] text-[var(--pl-text-weak)] whitespace-nowrap',
    name: 'text-[14px] font-medium text-[var(--pl-text-strong)] truncate',
    /** Service code — a classifier, not a value, so it takes the SDU chip's
     *  grammar (primary-tinted tag) rather than plain text. */
    code: 'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-medium [font-family:var(--pl-font-mono)] bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
    /** Tier 3 — run context: lineage badge · type tag(ⓘ) · created. The run #
     *  line was cut on owner feedback — document.title/URL carry it. */
    subRow: 'mt-0.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px] text-[var(--pl-text-weak)]',
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
    /** PENDING only — the scheduled start is context, not a task name, so it
     *  drops one tier and takes the `elapsed` tone. */
    curSched: 'text-[14px] font-normal text-[var(--pl-chrome-item)] tabular-nums whitespace-nowrap', // design-exempt: chrome-item on the dark gray-800 exec band (8.0:1), not on white
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
   *  (superseded by a newer run) on the right.
   *  `sticky` (design-benchmark 2026-08-16 시안 C의 선행 조건): the page column is
   *  capped to the viewport, but `.pl-flow`'s 440px floor pushes past that cap on
   *  a short window and then the DOCUMENT scrolls — measured: the strip left the
   *  viewport at top -579. The drawer's hero no longer prints the error code, so
   *  the strip has to survive that scroll.
   *  Bounded, not absolute: sticky cannot leave its containing block, and `bleed`
   *  is itself capped at 100vh-64px (the canvas overflows it visibly rather than
   *  growing it). The same measurement now reads -72 instead of -579 — the strip
   *  holds for the whole capped column and then goes with it. Full pinning needs
   *  that column to scroll internally, which is a layout change of its own; the
   *  flow card beside the drawer states the cause in prose either way. */
  failStrip:
    'sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--pl-border)] bg-[var(--pl-err-bg)] px-10 py-2.5 text-[14px] text-[var(--pl-err-text)]',
  failStripRight: 'ml-auto flex items-center gap-1.5 whitespace-nowrap',
  failStripLink: 'font-semibold underline hover:no-underline',

  /** Content region below the band: flow canvas (flex-1) + docked drawer. */
  contentRow: 'flex items-stretch',
  flowPad: 'p-5 flex-1 min-w-0',

  /** Task drawer (node 70:35) — 420px, light gray, docked flush at the canvas edge. */
  drawer: {
    /** `relative` anchors the close control, which sits on the verdict's own line
     *  now rather than on a strip of its own (owner 2026-08-16). The 243px that
     *  the title + description + 타입 row + sub-tabs + that strip used to hold is
     *  the job list's: the flow card beside the panel carries the name and the
     *  status stroke, the verdict carries the judgment, and 정의·계약 (kind
     *  included) opens as a modal from the body's last row.
     *
     *  400px (design-benchmark 2026-08-16 시안 B) — a width sweep on the live panel
     *  found 440 / 400 / 380 all give zero horizontal overflow and an identical
     *  1,075px body: 500px was never a width the content asked for. 400px is the
     *  value `detailStyles.flow.panel` already carries for the same role. */
    root: 'relative w-[400px] flex-none flex flex-col bg-[var(--pl-flow-panel)] border-l border-[var(--pl-border)] overflow-hidden',
    /** Supporting link at the foot of the body — the restart task's origin link
     *  (§8.4) and 정의·계약 보기. Both are errands away from this panel, so they
     *  take one grammar and sit below the content they support. */
    bodyLink:
      'inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--pl-primary)] hover:underline',
    /** Centered on the verdict head's line (body pt-2 + `verdictHead`'s min-h-8
     *  ⇒ centre 24; this button's 32px box at top-2 ⇒ centre 24). */
    close:
      'absolute top-2 right-4 z-10 inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--pl-text-strong)] hover:bg-[var(--pl-bg-card)] transition-colors',
    /** Sub-tab nav — the drawer's own 실행 정보 / 정의·계약 pair is gone, but the
     *  job viewer's 로그 / 상태 tabs still take this grammar. */
    nav: 'flex items-stretch border-b border-[var(--pl-border)]',
    navTab: 'flex-1 flex flex-col items-center justify-center gap-1.5 h-11 text-[14px]',
    // Active tab: blue text + blue underline (owner Figma node 121-406).
    navActive: 'text-[var(--pl-primary)] font-semibold',
    // Idle tabs at text-weak — faint(#98A2B3) measured 2.6:1 on the panel.
    navIdle: 'text-[var(--pl-text-weak)] font-normal',
    navUnderline: 'h-0.5 w-14 rounded-full bg-[var(--pl-primary)]',
    navUnderlineHidden: 'h-0.5 w-14',
    /** The panel's own scroller is now a fallback — the job list inside it takes
     *  the leftover height and scrolls itself (owner: "패널 자체의 스크롤을
     *  내리는 일은 없었으면"), which only works if this column can shrink. */
    body: 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-2 pb-6 flex flex-col gap-6',
    /** Supporting fold summary — 확인 요약, and Response 원문 on a jobless attempt.
     *  Takes the raw-response fold's grammar (jobStyles.respTri) at the section
     *  label's own size: everything folded here supports the Job 현황 above it. */
    foldSummary:
      'flex items-center gap-1.5 cursor-pointer list-none text-[14px] font-semibold text-[var(--pl-text-medium)] tracking-[-0.196px] [&::-webkit-details-marker]:hidden select-none',
    /** Rule above the body's closing links (정의·계약 보기 / 이전 실행 이력 보기) —
     *  what the panel points at, separated from what the panel states. */
    bodyLinks: 'flex flex-col items-start gap-2.5 border-t border-[var(--pl-border)] pt-4',

    /** Section label (Job 현황 / 확인 이력 / 실패 원인 / …) — 14px (owner
     *  2026-08-17), down from 16. The verdict head came down to 16 when the picker
     *  joined its line, and a 16px section label beside it left the body with two
     *  headings at one size. The ramp is now 16 verdict → 14 section → 12 caption.
     *  (The `sub` tier this used to have a twin for is gone with it — its last
     *  consumer, 시도 이력, was deleted in the 4차 round.) */
    sectionLabel: 'text-[14px] font-semibold text-[var(--pl-text-strong)] tracking-[-0.196px]',
    /** Run-window caption under a section label — 시작/완료/소요, one labelled row
     *  each (owner 2026-08-17: "개별 행으로 표현하자. 3줄로"). The grammar is the
     *  flow card's own run block (`.nd-run*`) copied value for value: 12px,
     *  4px row gap, `text-weak` label on a `flex-none` column, `text-medium` value.
     *  The card and this caption say the same three things about the same run, so
     *  they say them the same way. */
    runWindow: 'mt-2 flex flex-col gap-1 text-[12px] leading-[1.4] tabular-nums',
    runWindowRow: 'flex items-baseline gap-2',
    runWindowKey: 'flex-none w-8 text-[var(--pl-text-weak)]',
    runWindowVal: 'text-[var(--pl-text-medium)]',
    descText: 'mt-2.5 text-[14px] leading-[1.6] text-[var(--pl-text-strong)] whitespace-pre-line',
    /** Terminal-failure cause block — error-toned descText; shown when a failed attempt has no job rows. */
    failReason: 'mt-2.5 text-[14px] leading-[1.6] text-[var(--pl-err-text)] whitespace-pre-line break-words',
    /** Clamped 2-line preview of a long failure cause — the full text opens in FailureReasonModal. */
    failReasonClamp: 'mt-2.5 text-[14px] leading-[1.6] text-[var(--pl-err-text)] break-words line-clamp-2',
    /** "자세히" link under a clamped failure cause — opens the full-message modal. */
    failReasonMore: 'mt-1.5 text-[12px] font-semibold text-[var(--pl-primary)] hover:underline transition-colors',
    /** Verdict hero (design-benchmark 2026-08-14 시안 A) — the first thing the
     *  exec tab says, now that the card carries the progress log. The judgment is
     *  type size + a dot, never a tinted plate, and the supporting facts drop a
     *  tier under it. Tone comes from `jobStyles.verdictTextTone`. */
    verdict: 'flex flex-col gap-1.5',
    /** The hero's one line — judgment, code, and the attempt picker beside it
     *  (owner 2026-08-17). 16px, down from 20: the picker's 32px control now sets
     *  this row's height, and a 20px verdict beside it outranked the 16px section
     *  labels below for a word the flow card's stroke already carries.
     *  `min-h-8` pins the row to the picker's height whether or not one renders,
     *  so `close` centres on one number. `pr-9` keeps a long status + code clear
     *  of the absolutely-placed close control that shares this line. */
    verdictHead:
      'flex items-center flex-wrap gap-2.5 min-h-8 pr-9 text-[16px] font-bold tracking-[-0.196px]',
    /** Attempt picker (owner 2026-08-17) — the repo's dropdown grammar, not a
     *  native `<select>`: `appearance: auto` let the browser draw both the control
     *  and its option list, which read as a raw form field in a panel that has no
     *  other form control. Trigger metrics are the shared select's (h8 / r8 / 14px,
     *  `pipelineInputBase`); the panel is the menu card `JiraTicketMenu` and the
     *  request list's `FilterMenu` already wear. */
    pickTrigger:
      'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[14px] font-medium text-[var(--pl-text-strong)] cursor-pointer transition-colors hover:bg-[var(--pl-gray-50)]',
    pickChev: 'text-[var(--pl-text-weak)] transition-transform',
    pickPanel:
      'absolute left-0 top-[36px] z-20 min-w-full whitespace-nowrap overflow-hidden rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] py-1 shadow-[var(--pl-shadow-lg)]',
    pickItem:
      'flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-[var(--pl-text-strong)] transition-colors hover:bg-[var(--pl-gray-50)]',
    pickItemOn: 'font-semibold',
    /** Muted suffix in the list — the attempt's verdict word, say. A tier down,
     *  since the dot beside the label already carries it. */
    pickItemMeta: 'text-[12px] font-normal text-[var(--pl-text-weak)]',
    pickCheck: 'ml-auto flex-none text-[var(--pl-primary)]',
    /** Error/verdict code chip — white face + stroke, so it reads against both the
     *  panel and the toned head text it sits beside. */
    verdictCode:
      'inline-flex items-center rounded-full border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-2 py-0.5 text-[12px] font-semibold tracking-normal text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
    /** Supporting facts under the verdict — attempts used, next poll, external state. */
    verdictFacts: 'text-[14px] leading-[1.6] text-[var(--pl-text-weak)] tabular-nums',

    /** key/value progress rows — value is regular weight, 14px (node 70:35). */
    kvRow: 'flex items-center justify-between gap-3',
    kvKey: 'text-[14px] text-[var(--pl-text-weak)]',
    kvVal: 'text-[14px] font-normal text-[var(--pl-text-strong)] tabular-nums',
    rowsGap: 'mt-4 flex flex-col gap-2.5',

    /** attempts table. */
    tableWrap: 'rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] overflow-x-auto',
    table: 'w-full border-collapse text-[12px]',
    th: 'text-left px-2 py-2 text-[11px] font-medium text-[var(--pl-text-faint)] bg-[var(--pl-gray-50)] border-b border-[var(--pl-border)] whitespace-nowrap',
    td: 'px-2 py-2.5 align-middle text-[var(--pl-text-strong)] border-b border-[var(--pl-gray-100)] tabular-nums [&:last-child]:whitespace-nowrap',
    tbody: '[&>tr:last-child>td]:border-b-0',
    // 12px — the type set's floor; the attempt row's verdict does not sit below it
    // (design-benchmark 진단 06).
    miniBadge: 'inline-flex items-center rounded-[10px] px-1.5 py-0.5 text-[12px] font-medium leading-none',
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
