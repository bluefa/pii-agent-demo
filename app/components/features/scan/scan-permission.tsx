'use client';

import { useCallback, useState } from 'react';
import { getAwsRoleVerification } from '@/app/lib/api/aws';
import { getAzureScanApp } from '@/app/lib/api/azure';
import { getGcpScanServiceAccount } from '@/app/lib/api/gcp';
import { cn, statusColors, textColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils/date';

/**
 * 권한 확인은 1회성 체크가 아니라 시점 있는 관측 — 몇 달 뒤 재스캔 시점에는
 * 자격이 회수·변경되어 있을 수 있다. 그래서 결과는 세션 로컬로만 유지하고
 * (다음 방문에 이월하지 않음), 표시할 때는 반드시 확인 시점을 함께 붙인다.
 */
export type ScanPermissionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; checkedAt: string }
  | { status: 'pending' }
  | { status: 'fail'; message: string };

const FALLBACK_FAIL_MESSAGE = '권한을 확인하지 못했어요. 가이드 문서를 참고해 설정을 점검해주세요.';

// 세 프로바이더의 검증 응답이 같은 형태를 공유한다: { status, fail_reason,
// fail_message, last_verified_at }. VALID = 통과, IN_PROGRESS = 새 자격이 아직
// 검증 중(AWS), 그 외(UNVERIFIED 등)는 실패로 취급한다.
const verifyByProvider = (provider: CloudProvider, targetSourceId: number) => {
  switch (provider) {
    case 'AWS':
      return getAwsRoleVerification(targetSourceId, 'scan');
    case 'GCP':
      return getGcpScanServiceAccount(targetSourceId);
    case 'Azure':
      return getAzureScanApp(targetSourceId);
    case 'IDC':
      // IDC는 클라우드 스캔이 없음 — 이 훅을 렌더하는 카드는 클라우드 전용이다.
      return Promise.resolve(null);
  }
};

export const useScanPermission = (provider: CloudProvider, targetSourceId: number) => {
  const [state, setState] = useState<ScanPermissionState>({ status: 'idle' });

  const check = useCallback(async () => {
    setState({ status: 'checking' });
    try {
      const res = await verifyByProvider(provider, targetSourceId);
      if (!res?.status) {
        setState({ status: 'fail', message: FALLBACK_FAIL_MESSAGE });
      } else if (res.status === 'VALID') {
        setState({ status: 'ok', checkedAt: new Date().toISOString() });
      } else if (res.status === 'IN_PROGRESS') {
        setState({ status: 'pending' });
      } else {
        setState({ status: 'fail', message: res.fail_message ?? res.fail_reason ?? FALLBACK_FAIL_MESSAGE });
      }
    } catch {
      setState({ status: 'fail', message: FALLBACK_FAIL_MESSAGE });
    }
  }, [provider, targetSourceId]);

  return { state, check };
};

/**
 * 확인 결과 한 조각 — 스트립과 히어로가 같은 문법을 쓴다. idle에는 아무것도
 * 그리지 않는다: 오래된 확인을 보증처럼 상시 표시하는 것이 이 UI가 피하려는 것.
 */
export const ScanPermissionResult = ({ state }: { state: ScanPermissionState }) => {
  if (state.status === 'ok') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap',
          statusColors.success.bg,
          statusColors.success.border,
          statusColors.success.textDark,
        )}
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        권한 확인됨 · {formatRelativeTime(state.checkedAt)}
      </span>
    );
  }
  if (state.status === 'pending') {
    return <span className={cn('text-[12px] font-medium whitespace-nowrap', textColors.tertiary)}>자격 검증이 진행 중이에요</span>;
  }
  if (state.status === 'fail') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold',
          statusColors.error.bg,
          statusColors.error.border,
          statusColors.error.textDark,
        )}
      >
        <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        {state.message}
      </span>
    );
  }
  return null;
};
