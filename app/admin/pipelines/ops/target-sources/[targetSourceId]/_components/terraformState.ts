/**
 * Terraform state vocabulary — shared by the 인프라 작업 head strip (one overall
 * pill) and the 설치 현황 modal (one pill per task). It lives outside both so the
 * head can import the modal without the modal importing back into the head.
 */
import type { IconName } from '@/app/admin/pipelines/_components/icons';

/* Monochrome status ladder — the same rule as theme.ts PILL_* : all states share
   one neutral family and separate by weight, with red kept only for failure.
   Classes are written out in full because Tailwind only sees literal strings, so
   a `bg-[var(--pl-${tone}-bg)]` template would never be generated. */
export const TONE = {
  off: {
    dot: 'bg-[var(--pl-gray-400)]',
    text: 'text-[var(--pl-text-weak)]',
    pill: 'bg-[var(--pl-gray-50)] text-[var(--pl-text-weak)] border border-[var(--pl-border)]',
  },
  info: {
    dot: 'bg-[var(--pl-text-strong)]',
    text: 'text-[var(--pl-text-strong)]',
    pill: 'bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] border border-[var(--pl-text-strong)]',
  },
  ok: {
    dot: 'bg-[var(--pl-text-medium)]',
    text: 'text-[var(--pl-text-strong)]',
    pill: 'bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)] border border-[var(--pl-border-strong)]',
  },
  err: {
    dot: 'bg-[var(--pl-err)]',
    text: 'text-[var(--pl-err-text)]',
    pill: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)] border border-[var(--pl-err-border)]',
  },
} as const;

/** Wire state → tone + icon + 한국어 label. UNKNOWN covers unseen values. */
export const STATE_META: Record<string, { tone: keyof typeof TONE; icon: IconName; label: string }> =
  {
    NEVER_APPLIED: { tone: 'off', icon: 'clock', label: '미적용' },
    APPLYING: { tone: 'info', icon: 'loader', label: '적용 중' },
    APPLIED: { tone: 'ok', icon: 'check', label: '적용 완료' },
    APPLY_FAILED: { tone: 'err', icon: 'x-circle', label: '적용 실패' },
    DESTROYING: { tone: 'info', icon: 'loader', label: '삭제 중' },
    DESTROYED: { tone: 'off', icon: 'ban', label: '삭제됨' },
    DESTROY_FAILED: { tone: 'err', icon: 'x-circle', label: '삭제 실패' },
    UNKNOWN: { tone: 'off', icon: 'ban', label: '알 수 없음' },
  };

export const metaOf = (
  state: string | null | undefined,
): { tone: keyof typeof TONE; icon: IconName; label: string } =>
  STATE_META[state ?? ''] ?? STATE_META.UNKNOWN;

/** BDC/SERVICE 실행 주체 — neutral tag, never competing with the state. */
export const SIDE_LABEL: Record<string, string> = { SERVICE: '서비스', BDC: 'BDC' };
