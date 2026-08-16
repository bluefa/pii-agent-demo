/**
 * Class tokens for the R23 job-result surface added to the task drawer: the
 * attempt-history / Terraform Job list rows, the attempt drill-down header, and the
 * full-screen log/state viewer. Same discipline as `detailImprovedStyles` —
 * every value maps to a `--pl-*` token, no raw color classes (CLAUDE.md #4).
 * Reuses `improvedStyles.drawer` for shared kv/section grammar; only the pieces
 * unique to this surface live here.
 */
import type { JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import type { AnsiColor } from '@/app/admin/pipelines/_detail/ansiLog';

/** Per-job verdict pill tone (success/fail/running/unobserved). */
const VERDICT_TONE: Record<JobVerdict, string> = {
  success: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  failed: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  running: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
  none: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
};

const VERDICT_LABEL: Record<JobVerdict, string> = {
  success: '성공',
  failed: '실패',
  running: '진행 중',
  none: '기록 없음',
};

/** Solid 8px status dot per verdict — the Job filter's leading dot and the job
 *  row's status channel (design-benchmark 2026-08-15 시안 A·B). A dot, not a
 *  tinted pill: the row now carries the raw `last_state`, so the Korean label
 *  lives on the filter (Carbon — the label has to exist somewhere on screen). */
const VERDICT_DOT: Record<JobVerdict, string> = {
  success: 'bg-[var(--pl-ok)]',
  failed: 'bg-[var(--pl-err)]',
  running: 'bg-[var(--pl-info)]',
  none: 'bg-[var(--pl-gray-400)]',
};

/** Verdict as colored TEXT (no pill) — condition verdict (owner Figma node 121-493). */
const VERDICT_TEXT_TONE: Record<JobVerdict, string> = {
  success: 'text-[var(--pl-ok-text)]',
  failed: 'text-[var(--pl-err-text)]',
  running: 'text-[var(--pl-primary)]',
  none: 'text-[var(--pl-text-weak)]',
};

export const jobStyles = {
  verdictTone: VERDICT_TONE,
  verdictLabel: VERDICT_LABEL,
  verdictTextTone: VERDICT_TEXT_TONE,
  verdictDot: VERDICT_DOT,
  verdictText: 'text-[13px] font-medium',
  // 12px is the type set's floor — the verdict these carry is the panel's whole
  // point, so it does not get to sit below it (design-benchmark 진단 06).
  miniBadge: 'inline-flex items-center rounded-full px-[7px] py-[2.5px] text-[12px] font-medium leading-none whitespace-nowrap tracking-[-0.196px]',

  /** Job list — takes the panel's leftover height and scrolls inside itself, so
   *  the panel never has to (owner 2026-08-16: "패널 자체의 스크롤을 내리는 일은
   *  없었으면"). Needs a bounded ancestor chain: the drawer body is `min-h-0` and
   *  the page column is capped to the viewport (`layout.contentDetail`).
   *  The floor that keeps three rows on screen lives on the section (Section
   *  `grow`), not here — this box just takes whatever is left of it. */
  jobList: 'mt-4 flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain',

  /** Job status filter (design-benchmark 2026-08-15 시안 A) — the rollup line that
   *  only *read* "1 실패 · 2 성공", promoted to the control that narrows the list.
   *  Metrics are `pipelineStyles.seg` (the segmented toggle this page already
   *  uses): container p1 gap1 r8 on a card face, buttons px3 py1 r6 14px, active
   *  = gray-900 fill. The count suffix borrows `tqStyles.segLg.count` — but weak,
   *  not that component's faint, which reads 2.5:1 against this panel.
   *  The attempt picker (owner 2026-08-16) reuses the same three tokens, so the
   *  top margin belongs to the Job 현황 call site, not to the container. */
  filter: 'inline-flex items-center gap-1 flex-wrap p-1 rounded-lg bg-[var(--pl-bg-card)] border border-[var(--pl-border)]',
  filterBtn: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[14px] cursor-pointer transition-colors',
  filterIdle: 'text-[var(--pl-text-weak)] hover:text-[var(--pl-text-medium)]',
  filterActive: 'bg-[var(--pl-gray-900)] text-[var(--pl-white)] font-medium',
  /** 8px leading dot — `tqStyles.segLg.dot`'s metric, verdict tone. */
  filterDot: 'inline-block w-2 h-2 flex-none rounded-full',
  filterCount: 'tabular-nums',
  /** Count tone is picked, never layered — two `text-[…]` classes would both apply
   *  and stylesheet order, not argument order, would decide the winner. */
  filterCountTone: {
    on: 'text-[var(--pl-gray-300)]', // design-exempt: on the gray-900 active face (11:1), never on the card
    off: 'text-[var(--pl-text-weak)]',
  },

  /** Terraform Job entry — the row plus, for a failed job, its reason line. The
   *  hairline moved here so the reason sits inside the same entry as its row. */
  jobItem: 'flex flex-col border-b border-[var(--pl-border)] last:border-b-0',
  /** Terraform Job row (시안 B) — the whole 44px row opens the log viewer; it used
   *  to be a 51×17px text link at the right end, repeated 21 times. */
  jobRow: 'w-full flex items-center gap-2.5 pt-3 pb-[13px] text-left hover:bg-[var(--pl-gray-50)] transition-colors',
  /** What the job last did — `last_state · N회 폴링 · HH:mm`. Three contract fields
   *  that were parsed and then never rendered; without them 21 rows differ only
   *  by id and nothing tells the operator which one to open. */
  jobMeta: 'ml-auto min-w-0 truncate text-[12px] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)] tabular-nums',
  jobChev: 'flex-none text-[var(--pl-text-weak)]',
  /** `last_fail_reason` under a failed job — the cause the panel used to keep
   *  three hops away (attempt row → job row → log viewer). Clamped; the full
   *  text is in the log viewer. */
  jobFailReason: '-mt-1.5 pb-3 text-[14px] leading-[1.6] text-[var(--pl-err-text)] break-words line-clamp-2',
  jobId: 'text-[13px] font-bold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] tabular-nums tracking-[-0.196px]',
  /** Raw-response fold (owner Figma node 121-389) — a ▼ triangle (gray) that flips
   *  up + sky-blue when open; the raw dispatch response sits in an inset mono code
   *  box. Not parsed. The summary line itself is `drawer.foldSummary`, shared with
   *  the other two folds in the body. */
  respFold: 'group',
  respTri: 'inline-block text-[10px] leading-none text-[var(--pl-text-weak)] transition-transform group-open:rotate-180 group-open:text-[var(--pl-info)]',
  respPre: 'mt-3 ml-[18px] rounded-[6px] bg-[var(--pl-gray-50)] border border-[var(--pl-border)] px-[15px] py-[13px] text-[11px] leading-[1.4] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)] whitespace-pre-wrap break-all',

  /** Poll-history "show all" toggle. */
  moreBtn: 'w-full border-t border-[var(--pl-border)] py-2.5 text-[12px] font-medium text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-50)] transition-colors',

  // ── Viewer (rendered inside ModalShell — scrim/Esc/backdrop are the shell's) ─
  /** Overrides ModalShell's default dialog padding/width for a full-bleed viewer.
   *  Width/height come from JobViewer as an inline style (user-resizable) — the
   *  max-* here are the viewport backstop, so no `!w`/`!h` importance that would
   *  outrank the inline size. Explicit height (not just max) keeps the dark log
   *  panel filling to the bottom even when the log is short (owner Figma node 121-659). */
  viewer: 'relative !max-w-[95vw] !p-0 !max-h-[90vh] flex flex-col overflow-hidden',
  /** Default viewer size, applied inline by each consumer (owner Figma node 121-659). */
  viewerBaseSize: { width: 720, height: 572 },
  /** Bottom-right drag grip — logs are long lines, so the operator sizes the
   *  viewer to the log instead of the other way round. The tone is picked, never
   *  layered: two text-[…] classes would both apply and stylesheet order, not
   *  argument order, would decide the winner. */
  grip: 'absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize touch-none',
  gripTone: {
    light: 'text-[var(--pl-gray-500)]',
    dark: 'text-[var(--pl-gray-400)]', // design-exempt: grip glyph on the dark log panel
  },
  vHead: 'flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-[var(--pl-border)]',
  vTitle: 'flex items-center gap-2.5 text-[16px] font-bold leading-snug text-[var(--pl-text-strong)]',
  vJid: 'tabular-nums',
  vSub: 'mt-1 text-[12px] text-[var(--pl-text-weak)] truncate',
  vStamp: 'mt-0.5 text-[12px] text-[var(--pl-text-faint)] tabular-nums truncate',
  vClose: 'flex-none inline-flex items-center justify-center w-8 h-8 -mr-1 rounded-lg text-[var(--pl-text-strong)] hover:bg-[var(--pl-gray-50)] transition-colors',

  /** Log/state panel — one flex column that owns the bottom of the viewer. Its
   *  dark bg (when content is shown) therefore runs to the very bottom; the top
   *  strip (status pills + copy) and the scrolling body share it. */
  panel: 'flex-1 flex flex-col min-h-0 overflow-hidden',
  panelDark: 'bg-[var(--pl-gray-800)]',
  strip: 'flex items-center gap-2.5 px-5 py-2.5',
  warnPill: 'inline-flex items-center rounded-full bg-[var(--pl-warn-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--pl-warn-text)]',
  livePill: 'inline-flex items-center rounded-full bg-[var(--pl-info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--pl-info-text)]',
  toolbarGrow: 'ml-auto',

  /** Log body — mono, tail-anchored; bg lives on the panel so it fills the bottom.
   *  tabIndex-focusable (it is the viewer's only scroll region), so give it a
   *  visible focus ring for keyboard users. */
  logBody: 'flex-1 overflow-auto px-5 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--pl-primary)]',
  logPre: 'text-[12px] leading-[1.6] text-[var(--pl-chrome-item)] [font-family:var(--pl-font-mono)] whitespace-pre-wrap break-all',
  logCut: 'block pb-2 mb-2 text-[11px] text-[var(--pl-warn)] border-b border-[var(--pl-gray-600)]',

  /** ANSI SGR → semantic tokens, tuned to read on the dark log panel. Bold is
   *  added inline (font-semibold). No raw colors — all `--pl-*` (CLAUDE.md #4). */
  logAnsi: {
    red: 'text-[var(--pl-err)]',
    green: 'text-[var(--pl-ok)]',
    yellow: 'text-[var(--pl-warn)]',
    blue: 'text-[var(--pl-info)]',
    cyan: 'text-[var(--pl-info)]',
    magenta: 'text-[var(--pl-pv-sdu)]',
    gray: 'text-[var(--pl-gray-400)]',
  } as Record<AnsiColor, string>,

  /** Empty / error states inside the viewer body (owner Figma node 121-753:
   *  amber warning mark, bold title, muted two-line description). */
  vEmpty: 'flex-1 flex flex-col items-center justify-center gap-2 px-8 py-16 text-center',
  vEmptyIcon: 'mb-1 text-[var(--pl-warn)]',
  vEmptyTitle: 'text-[15px] font-semibold text-[var(--pl-text-strong)]',
  vEmptyDesc: 'text-[13px] leading-[1.6] text-[var(--pl-text-weak)] max-w-[380px]',
  vLoading: 'flex-1 flex items-center justify-center px-8 py-16 text-[13px] text-[var(--pl-text-faint)]',
} as const;
