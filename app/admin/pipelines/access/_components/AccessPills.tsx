/**
 * 접근 권한 화면의 상태 배지들. 모르는 enum 값은 회색 위에 원문 그대로 (정직한 폴백:
 * 라벨을 지어내면 계약이 바뀐 걸 화면이 숨긴다).
 *
 * 색 채널은 **하나**다 — 잉크. 예전에는 셋이었다: 꽉 찬 점(#12B76A/#F04438), 그 색의
 * 옅은 틴트 면, 그리고 같은 색의 글자. 세 겹이 한 줄에 겹치니 이력 한 장이 상태색으로
 * 얼룩졌다(오너 지시 2026-08-14). 점을 지우고 면을 중립 회색으로 내리면 남는 건
 * 12px 글자 하나이고, 승인·반려는 그 글자가 이미 말한다.
 *
 * 면은 tone 마다 다시 선언하지 않고 `PILL` 이 한 번 준다. 대비 검사 훅은 같은 줄의 bg
 * 를 못 찾으면 페이지 면(흰색)으로 재는데, 이 잉크들은 흰 면에서도 전부 AA 를 넘는다.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import type { AccessHistoryType, AccessRequestStatus } from '@/app/lib/api/access';

type Tone = 'off' | 'warn' | 'ok' | 'err' | 'info';

const TONE_INK: Record<Tone, string> = {
  off: 'text-[var(--pl-off-text)]',
  warn: 'text-[var(--pl-warn-text)]',
  ok: 'text-[var(--pl-ok-text)]',
  err: 'text-[var(--pl-err-text)]',
  info: 'text-[var(--pl-primary)]',
};

const PILL =
  'inline-flex items-center h-5 px-2 rounded-full bg-[var(--pl-off-bg)] text-[12px] font-semibold tracking-[0.02em]';

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
    <span title={title} className={cn(PILL, TONE_INK[tone], className)}>
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
