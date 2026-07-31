'use client';

import { Button } from '@/app/components/ui/Button';
import { SCAN_ERROR_LABELS } from '@/app/components/features/scan/scan-labels';
import {
  ScanPermissionResult,
  type ScanPermissionState,
} from '@/app/components/features/scan/scan-permission';
import { bgColors, borderColors, cn, statusColors, textColors } from '@/lib/theme';
import { formatDate, formatRelativeTime } from '@/lib/utils/date';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

export interface ScanStripProps {
  /**
   * 마지막 종료 스캔 잡. null = 종료된 스캔이 없는데 목록은 있는 상태(목 시드,
   * 이력 유실) — 그때도 스캔 진입점은 이 스트립이 유일하므로 "기록 없음"으로
   * 정직하게 렌더한다.
   */
  job: ScanJob | null;
  /** 이번 목록에서 scanStatus === 'NEW_SCAN' 인 리소스 수 (재스캔 차분 표기). */
  newCount: number;
  permission: ScanPermissionState;
  onCheckPermission: () => void;
  onOpenHistory: () => void;
  onStartScan: () => void;
  /**
   * 스캔 실패 상태에서는 본문 ScanErrorState가 재시도 CTA를 소유하므로 스트립의
   * 스캔 버튼을 숨긴다 — 같은 행동의 버튼 두 개가 한 화면에 놓이지 않게.
   */
  showScanButton: boolean;
  scanDisabled: boolean;
  starting: boolean;
  /**
   * 테이블 위에 붙는 list 상태용 — Step 2 툴바 문법(틴트·상단 라운드·무테두리)
   * 으로 표와 한 덩어리가 된다. false(기본)는 표 없는 상태의 독립 밴드.
   */
  connected?: boolean;
}

// 텍스트 버튼(이력·권한 확인) — 스트립의 보조 행동은 버튼 크롬 없이 밑줄 링크
// 문법으로 물러난다. 유일한 버튼 크롬은 스캔 시작(secondary) 하나.
const GHOST_BUTTON = cn(
  'text-[13px] font-semibold underline underline-offset-[3px] decoration-[#D1D6DB] transition-colors',
  'hover:text-[#191F28] disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * A안 스캔 상태 스트립 — 헤더와 테이블 사이의 한 줄 밴드. 좌측은 마지막 스캔
 * 요약(시점은 상대시간이 곧 낡음 신호), 우측은 이력·권한 확인·재스캔.
 * 권한의 상시 초록 배지는 없다 — ScanPermissionResult 규칙을 따른다.
 */
export const ScanStrip = ({
  job,
  newCount,
  permission,
  onCheckPermission,
  onOpenHistory,
  onStartScan,
  showScanButton,
  scanDisabled,
  starting,
  connected = false,
}: ScanStripProps) => {
  const succeeded = job?.scan_status === 'SUCCESS';
  const failedByPermission = job != null && !succeeded && job.scan_error === 'AUTH_PERMISSION_ERROR';
  const scannedAt = job?.updated_at ?? job?.created_at ?? null;
  const foundCount = Object.values(job?.resource_count_by_resource_type ?? {}).reduce<number>(
    (sum, count) => sum + (count ?? 0),
    0,
  );

  const mainText = job == null
    ? '아직 스캔한 적이 없어요'
    : `${succeeded ? '마지막 스캔' : '마지막 스캔 실패'}${scannedAt ? ` ${formatRelativeTime(scannedAt)}` : ''}`;
  const dotClass = job == null
    ? 'bg-[#8B95A1]'
    : succeeded
      ? statusColors.success.dot
      : statusColors.error.dot;

  const metaParts: string[] = [];
  if (job != null) {
    if (scannedAt) metaParts.push(formatDate(scannedAt, 'datetime'));
    if (succeeded) {
      if (typeof job.duration_seconds === 'number') metaParts.push(`${Math.round(job.duration_seconds)}초 소요`);
      metaParts.push(`${foundCount}개 발견`);
      if (newCount > 0) metaParts.push(`신규 ${newCount}`);
    } else if (!failedByPermission && job.scan_error) {
      // 권한 오류는 아래 배지가 전담 — 그 외 실패 사유만 메타로 흘린다.
      metaParts.push(SCAN_ERROR_LABELS[job.scan_error] ?? job.scan_error);
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2',
        // connected = WaitingApprovalToolbar 문법 그대로(#F7F8FA·rounded-t-12·무테두리):
        // 표와 이어 붙어 한 덩어리로 읽힌다. 독립 밴드만 자기 테두리를 가진다.
        connected
          ? 'rounded-t-[12px] bg-[#F7F8FA] px-[16px] py-[14px]'
          : cn('rounded-xl border px-4 py-3', bgColors.surface, borderColors.default),
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', dotClass)} aria-hidden="true" />
        <span className={cn('whitespace-nowrap text-[13.5px] font-semibold', textColors.primary)}>
          {mainText}
        </span>
        {metaParts.length > 0 && (
          <span className={cn('whitespace-nowrap text-[12.5px]', textColors.tertiary)}>
            {metaParts.join(' · ')}
          </span>
        )}
        {failedByPermission && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap',
              statusColors.error.bg,
              statusColors.error.border,
              statusColors.error.textDark,
            )}
          >
            스캔 권한 오류 — 설정 확인 필요
          </span>
        )}
        <ScanPermissionResult state={permission} />
      </div>

      <div className="flex flex-shrink-0 items-center gap-4">
        <button type="button" onClick={onOpenHistory} className={cn(GHOST_BUTTON, textColors.secondary)}>
          스캔 이력
        </button>
        <button
          type="button"
          onClick={onCheckPermission}
          disabled={permission.status === 'checking'}
          className={cn(GHOST_BUTTON, textColors.secondary)}
        >
          {permission.status === 'checking' ? '확인 중...' : '권한 확인'}
        </button>
        {showScanButton && (
          <Button
            variant="secondary"
            disabled={scanDisabled}
            onClick={onStartScan}
            className="inline-flex items-center gap-1.5 py-1.5 text-sm"
          >
            {starting ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                시작 중...
              </>
            ) : job == null ? (
              '스캔 시작'
            ) : (
              '다시 스캔'
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
