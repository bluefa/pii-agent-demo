/**
 * 수행 담당자 태그 — 이 실행을 건 주체를 한 덩어리로 감싼다.
 *
 * 시스템 실행과 사람 실행은 성격이 다른 값이라 같은 텍스트 자리에 나란히 두면
 * 구분이 안 된다(오너 2026-09-03). 태그 틀은 하나로 통일하고, 시스템만 톱니
 * 아이콘을 달아 "사람이 아니라 자동으로 걸린 실행"이 글자를 읽기 전에 보이게 한다.
 *
 * `requested_by`를 기록하지 않은 실행(#53 이전 행)은 아무것도 그리지 않는다 —
 * 빈 태그나 대시는 "담당자가 없다"는 사실을 말해주지 못한다.
 */
import type { ReactElement } from 'react';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { cn } from '@/lib/theme';
import { requesterLabel } from '@/lib/pipeline/format';
import { SYSTEM_REQUESTER } from '@/lib/pipeline/types';

const TAG_BASE =
  'inline-flex items-center gap-1 rounded-[5px] bg-[var(--pl-gray-100)] px-2 py-0.5 text-[12px] font-semibold text-[var(--pl-text-medium)] whitespace-nowrap';

export interface RequesterTagProps {
  requestedBy: string | null | undefined;
  className?: string;
}

export function RequesterTag({ requestedBy, className }: RequesterTagProps): ReactElement | null {
  const label = requesterLabel(requestedBy);
  if (!label) return null;
  const isSystem = requestedBy === SYSTEM_REQUESTER;
  return (
    <span
      className={cn(TAG_BASE, className)}
      title={isSystem ? '시스템이 자동으로 시작한 실행입니다.' : `${label} 계정이 시작한 실행입니다.`}
    >
      {isSystem && <Icon name="cog" size="sm" />}
      {label}
    </span>
  );
}
