/**
 * Class tokens for the R23 job-result surface added to the task drawer: the
 * attempt-history / Terraform Job list rows, the attempt drill-down header, and the
 * full-screen log/state viewer. Same discipline as `detailImprovedStyles` —
 * every value maps to a `--pl-*` token, no raw color classes (CLAUDE.md #4).
 * Reuses `improvedStyles.drawer` for shared kv/section grammar; only the pieces
 * unique to this surface live here.
 */
import type { JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';

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
  verdictText: 'text-[13px] font-medium',
  miniBadge: 'inline-flex items-center rounded-full px-[7px] py-[2.5px] text-[10px] font-medium leading-none whitespace-nowrap tracking-[-0.196px]',

  /** A muted caption line rendered on its own line under a section label
   *  (e.g. the attempt-history "tap a row for detail" hint; owner Figma node 121-74). */
  labelHint: 'mt-2 text-[14px] font-normal text-[var(--pl-text-faint)]',

  /** Bare row list on the panel — rows carry their own hairline divider, no card
   *  wrap (owner Figma nodes 121-74 / 121-311). Top margin clears the heading. */
  list: 'mt-5 flex flex-col',
  listTight: 'mt-4 flex flex-col',

  /** Attempt-history row — a full-width button that drills into the attempt. */
  attemptRow: 'w-full flex items-center gap-2.5 pt-2.5 pb-[11px] text-left border-b border-[var(--pl-border)] last:border-b-0 hover:bg-[var(--pl-gray-50)] transition-colors',
  attemptNo: 'flex-none min-w-[26px] text-[14px] font-semibold text-[var(--pl-text-strong)] tabular-nums tracking-[-0.196px]',
  /** Row CTA — blue "view details" link text, right-aligned. */
  attemptDetail: 'ml-auto flex-none text-[12px] font-semibold text-[var(--pl-primary)] tracking-[-0.196px]',

  /** Terraform Job row — verdict + id + meta + log action. */
  jobRow: 'flex items-center gap-2.5 pt-3 pb-[13px] border-b border-[var(--pl-border)] last:border-b-0',
  jobId: 'text-[13px] font-bold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] tabular-nums tracking-[-0.196px]',
  /** Log action — blue text button (owner Figma node 121-326), not a bordered btn. */
  logBtn: 'ml-auto flex-none rounded-[8px] px-1 text-[12px] font-semibold text-[var(--pl-primary)] hover:underline transition-colors',

  /** Attempt drill-down header (replaces the tab bar on the sub-view). */
  subHeader: 'flex items-start gap-2.5 px-6 pt-5 pb-4 border-b border-[var(--pl-border)]',
  back: 'flex-none inline-flex items-center justify-center w-8 h-8 -ml-1 rounded-lg text-[var(--pl-text-strong)] hover:bg-[var(--pl-bg-card)] transition-colors text-[18px] leading-none',
  subTitle: 'flex items-center gap-2 text-[16px] font-bold leading-snug text-[var(--pl-text-strong)]',
  subCrumb: 'mt-1 text-[12px] text-[var(--pl-text-weak)] truncate',

  /** Raw-response fold (owner Figma node 121-389) — 16px SemiBold heading led by
   *  a ▼ triangle (gray) that flips up + sky-blue when open; the raw dispatch
   *  response sits in an inset mono code box. Not parsed. */
  respFold: 'group',
  respSummary: 'flex items-center gap-1.5 cursor-pointer list-none text-[16px] font-semibold text-[var(--pl-text-strong)] tracking-[-0.196px] [&::-webkit-details-marker]:hidden select-none',
  respTri: 'inline-block text-[10px] leading-none text-[var(--pl-text-weak)] transition-transform group-open:rotate-180 group-open:text-[var(--pl-info)]',
  respPre: 'mt-3 ml-[18px] rounded-[6px] bg-[var(--pl-gray-50)] border border-[var(--pl-border)] px-[15px] py-[13px] text-[11px] leading-[1.4] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)] whitespace-pre-wrap break-all',

  /** Poll-history "show all" toggle. */
  moreBtn: 'w-full border-t border-[var(--pl-border)] py-2.5 text-[12px] font-medium text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-50)] transition-colors',

  // ── Viewer (rendered inside ModalShell — scrim/Esc/backdrop are the shell's) ─
  /** Overrides ModalShell's default dialog padding/width for a full-bleed viewer.
   *  Fixed height (not just max) so the dark log panel fills all the way to the
   *  bottom even when the log is short (owner Figma node 121-659). */
  viewer: '!w-[720px] !max-w-[90vw] !p-0 !h-[572px] !max-h-[85vh] flex flex-col overflow-hidden',
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

  /** Empty / error states inside the viewer body (owner Figma node 121-753:
   *  amber warning mark, bold title, muted two-line description). */
  vEmpty: 'flex-1 flex flex-col items-center justify-center gap-2 px-8 py-16 text-center',
  vEmptyIcon: 'mb-1 text-[var(--pl-warn)]',
  vEmptyTitle: 'text-[15px] font-semibold text-[var(--pl-text-strong)]',
  vEmptyDesc: 'text-[13px] leading-[1.6] text-[var(--pl-text-weak)] max-w-[380px]',
  vLoading: 'flex-1 flex items-center justify-center px-8 py-16 text-[13px] text-[var(--pl-text-faint)]',
} as const;
