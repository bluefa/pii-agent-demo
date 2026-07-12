/**
 * Class tokens for the R23 job-result surface added to the task drawer: the
 * 시도 이력 / Terraform Job list rows, the attempt drill-down header, and the
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

export const jobStyles = {
  verdictTone: VERDICT_TONE,
  verdictLabel: VERDICT_LABEL,
  miniBadge: 'inline-flex items-center rounded-[10px] px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap',

  /** A subdued suffix on a section label (e.g. "— 행을 누르면 job·로그 상세"). */
  labelHint: 'font-normal text-[var(--pl-text-faint)]',

  /** Bordered white card wrapping a stack of rows (시도 이력 / job 목록). */
  cardList: 'mt-3 rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] overflow-hidden',
  cardFoot: 'px-4 py-2.5 text-[11px] leading-[1.5] text-[var(--pl-text-faint)] bg-[var(--pl-gray-50)] border-t border-[var(--pl-border)]',

  /** 시도 이력 row — a full-width button that drills into the attempt. */
  attemptRow: 'w-full flex items-center gap-2.5 px-4 py-3 text-left border-b border-[var(--pl-gray-100)] last:border-b-0 hover:bg-[var(--pl-gray-50)] transition-colors',
  attemptNo: 'text-[13px] font-semibold text-[var(--pl-text-medium)] tabular-nums flex-none w-6',
  attemptCode: 'text-[11px] font-medium text-[var(--pl-err-text)] [font-family:var(--pl-font-mono)] truncate',
  attemptTime: 'ml-auto text-[12px] text-[var(--pl-text-faint)] tabular-nums whitespace-nowrap',
  attemptCur: 'flex-none rounded-full bg-[var(--pl-info-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pl-info-text)]',
  attemptChev: 'flex-none text-[var(--pl-text-faint)] text-[14px] leading-none',

  /** Terraform Job row — verdict + id + meta + 로그 action. */
  jobRow: 'flex items-center gap-2.5 px-4 py-3 border-b border-[var(--pl-gray-100)] last:border-b-0',
  jobId: 'text-[13px] font-semibold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] tabular-nums',
  jobMeta: 'ml-auto text-[12px] text-[var(--pl-text-faint)] tabular-nums whitespace-nowrap',

  /** Attempt drill-down header (replaces the tab bar on the sub-view). */
  subHeader: 'flex items-start gap-2.5 px-6 pt-5 pb-4 border-b border-[var(--pl-border)]',
  back: 'flex-none inline-flex items-center justify-center w-8 h-8 -ml-1 rounded-lg text-[var(--pl-text-strong)] hover:bg-[var(--pl-bg-card)] transition-colors text-[18px] leading-none',
  subTitle: 'flex items-center gap-2 text-[16px] font-bold leading-snug text-[var(--pl-text-strong)]',
  subCode: 'text-[11px] font-medium text-[var(--pl-err-text)] [font-family:var(--pl-font-mono)]',
  subCrumb: 'mt-1 text-[12px] text-[var(--pl-text-weak)] truncate',

  /** response fold (dispatch raw — not parsed). */
  respFold: 'group',
  respSummary: 'cursor-pointer list-none text-[12px] text-[var(--pl-text-faint)] [&::-webkit-details-marker]:hidden select-none',
  respPre: 'mt-2 rounded-[6px] bg-[var(--pl-gray-50)] border border-[var(--pl-border)] px-3 py-2 text-[11px] leading-[1.5] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)] whitespace-pre-wrap break-all',

  /** 폴 이력 "전체 보기" toggle. */
  moreBtn: 'w-full border-t border-[var(--pl-border)] py-2.5 text-[12px] font-medium text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-50)] transition-colors',

  // ── Viewer (rendered inside ModalShell — scrim/Esc/backdrop are the shell's) ─
  /** Overrides ModalShell's default dialog padding/width for a full-bleed viewer. */
  viewer: '!w-[720px] !max-w-[90vw] !p-0 !max-h-[80vh] flex flex-col overflow-hidden',
  vHead: 'flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-[var(--pl-border)]',
  vTitle: 'flex items-center gap-2.5 text-[16px] font-bold leading-snug text-[var(--pl-text-strong)]',
  vJid: '[font-family:var(--pl-font-mono)] tabular-nums',
  vSub: 'mt-1 text-[12px] text-[var(--pl-text-weak)] truncate',
  vClose: 'flex-none inline-flex items-center justify-center w-8 h-8 -mr-1 rounded-lg text-[var(--pl-text-strong)] hover:bg-[var(--pl-gray-50)] transition-colors',

  /** Toolbar — segmented [로그 | 상태 응답 원문] + status pills + 복사. */
  toolbar: 'flex items-center gap-2.5 px-6 py-3 border-b border-[var(--pl-border)] flex-wrap',
  seg: 'inline-flex rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-gray-50)] p-0.5',
  segBtn: 'rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors',
  segOn: 'bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] shadow-sm',
  segOff: 'text-[var(--pl-text-faint)] hover:text-[var(--pl-text-medium)]',
  warnPill: 'inline-flex items-center rounded-full bg-[var(--pl-warn-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--pl-warn-text)]',
  livePill: 'inline-flex items-center rounded-full bg-[var(--pl-info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--pl-info-text)]',
  toolbarGrow: 'ml-auto',

  /** Log body — dark, mono, tail-anchored. */
  logBody: 'flex-1 overflow-auto bg-[var(--pl-gray-800)] px-5 py-4',
  logPre: 'text-[12px] leading-[1.6] text-[var(--pl-chrome-item)] [font-family:var(--pl-font-mono)] whitespace-pre-wrap break-all',
  logCut: 'block pb-2 mb-2 text-[11px] text-[var(--pl-warn)] border-b border-white/15',

  /** Empty / error states inside the viewer body. */
  vEmpty: 'flex-1 flex flex-col items-center justify-center gap-2 px-8 py-16 text-center',
  vEmptyTitle: 'text-[15px] font-semibold text-[var(--pl-text-strong)]',
  vEmptyDesc: 'text-[13px] leading-[1.6] text-[var(--pl-text-weak)] max-w-[380px]',
  vEmptyDetail: 'mt-1 rounded-[6px] bg-[var(--pl-gray-50)] border border-[var(--pl-border)] px-3 py-2 text-[11px] leading-[1.5] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)] break-all max-w-[380px]',
  vLoading: 'flex-1 flex items-center justify-center px-8 py-16 text-[13px] text-[var(--pl-text-faint)]',

  vFoot: 'px-6 py-3 text-[11px] leading-[1.5] text-[var(--pl-text-faint)] border-t border-[var(--pl-border)] bg-[var(--pl-gray-50)]',
} as const;
