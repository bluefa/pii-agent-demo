/**
 * 접근 권한 화면의 상태 배지들 — HistoryStatusPill 과 같은 `.pill` 문법(점 + 라벨)을
 * 쓰되 어휘가 다르므로 별도로 둔다. 모르는 enum 값은 회색 위에 원문 그대로 (정직한
 * 폴백: 라벨을 지어내면 계약이 바뀐 걸 화면이 숨긴다).
 *
 * pill 면과 dot 색은 줄을 나눠 선언한다 — 한 줄에 같이 두면 대비 검사기가 글자색을
 * 점의 배경과 짝지어 읽는다(점 위에는 글자가 없다).
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import type { AccessHistoryType, AccessRequestStatus } from '@/app/lib/api/access';

type Tone = 'off' | 'warn' | 'ok' | 'err' | 'info';

const TONE_PILL: Record<Tone, string> = {
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  info: 'bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
};

const TONE_DOT: Record<Tone, string> = {
  off: 'bg-[var(--pl-gray-400)]',
  warn: 'bg-[var(--pl-warn)]',
  ok: 'bg-[var(--pl-ok)]',
  err: 'bg-[var(--pl-err)]',
  info: 'bg-[var(--pl-primary)]',
};

const PILL =
  'inline-flex items-center gap-1.5 h-5 pr-[9px] pl-2 rounded-full text-[12px] font-semibold tracking-[0.02em]';

function Pill({
  label,
  tone,
  title,
  className,
}: {
  label: string;
  tone: Tone;
  title?: string;
  className?: string;
}): ReactElement {
  return (
    <span title={title} className={cn(PILL, TONE_PILL[tone], className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', TONE_DOT[tone])} />
      {label}
    </span>
  );
}

const REQUEST_TONE: Record<AccessRequestStatus, { label: string; tone: Tone }> = {
  PENDING: { label: '승인 대기', tone: 'warn' },
  APPROVED: { label: '승인', tone: 'ok' },
  REJECTED: { label: '반려', tone: 'err' },
};

export function RequestStatusPill({
  status,
  className,
}: {
  status: AccessRequestStatus | string | null;
  className?: string;
}): ReactElement {
  const spec = (status && REQUEST_TONE[status as AccessRequestStatus]) || {
    label: status ?? '—',
    tone: 'off' as const,
  };
  return <Pill label={spec.label} tone={spec.tone} className={className} />;
}

/**
 * 부여 경로 배지는 없다. 담당자 목록이 `granted_at`/`granted_by`/부여 경로를 싣지 않기로
 * 정해져서(owner decision 2026-08-13), "요청 승인이었나 직접 부여였나"는 목록의 열이
 * 아니라 아래 이력의 이벤트(`OWNER_GRANTED` vs `REQUEST_APPROVED`)로만 답한다.
 */
const HISTORY_TONE: Record<AccessHistoryType, { label: string; tone: Tone }> = {
  REQUEST_APPROVED: { label: '요청 승인', tone: 'ok' },
  REQUEST_REJECTED: { label: '요청 반려', tone: 'err' },
  OWNER_GRANTED: { label: '직접 부여', tone: 'info' },
  OWNER_REVOKED: { label: '권한 해제', tone: 'off' },
  ADMIN_GRANTED: { label: '관리자 부여', tone: 'info' },
  ADMIN_REVOKED: { label: '관리자 회수', tone: 'off' },
};

export function HistoryTypePill({
  type,
  className,
}: {
  type: AccessHistoryType | string | null;
  className?: string;
}): ReactElement {
  const spec = (type && HISTORY_TONE[type as AccessHistoryType]) || {
    label: type ?? '—',
    tone: 'off' as const,
  };
  return <Pill label={spec.label} tone={spec.tone} className={className} />;
}
