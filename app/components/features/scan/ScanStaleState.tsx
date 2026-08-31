'use client';

import { Button } from '@/app/components/ui/Button';
import { ReloadIcon } from '@/app/components/ui/icons';
import {
  ScanPermissionResult,
  type ScanPermissionState,
} from '@/app/components/features/scan/scan-permission';
import { useLocale } from '@/app/components/LocaleProvider';
import { SCAN_COPY } from '@/app/components/features/scan/copy';
import { buttonStyles, cn, statusColors, textColors } from '@/lib/theme';
import { formatDateTimeLocalCompact, formatRelativeTime } from '@/lib/utils/date';

// The threshold lives on the server: the response carries only `old_scan`, never
// the number of days. Printing 7 here is the owner's copy decision, so it sits in
// exactly one place — if BE moves the threshold, this line is the only lie to fix.
const SCAN_STALE_DAYS = 7;

// Both values are transcribed from `ScanHeroState`, not chosen here: the two heroes are
// the same frame of the same card, and a half-pixel difference between them would read as
// a mistake. They live on their own lines so the exemption names exactly what it covers.
const POLICY_LINE = 'mt-2 text-[13.5px] leading-[1.6]'; // design-exempt: ScanHeroState subtitle size
const CTA_BUTTON = 'inline-flex h-11 items-center gap-2 px-6 text-[15px]'; // design-exempt: ScanHeroState CTA size

export interface ScanStaleStateProps {
  /** Latest scan's timestamp (`updated_at ?? created_at`). Absent → the meta line is dropped. */
  scannedAt: string | null;
  permission: ScanPermissionState;
  onCheckPermission: () => void;
  onOpenHistory: () => void;
  onStartScan: () => void;
  canStart: boolean;
  starting: boolean;
}

/**
 * 기한이 지난 스캔 결과의 본문 전체 — 목록을 세우지 않는다. 이 화면의 표는
 * 승인 요청이라는 쓰기의 입력인데, 정책 기한을 넘긴 결과는 그 입력이 될 수
 * 없으므로 본문에서 치운다(비활성이 아니라 소멸: 제출할 목록이 없다). 그래서
 * 이 순간 화면의 유일한 행동은 재스캔이고, primary CTA를 재스캔이 가진다.
 * 목록과 함께 사라지는 스트립의 두 진입점(이력·권한 확인)은 히어로가 물려받는다 —
 * 이력은 표를 치운 뒤에도 과거 스캔 결과에 닿는 유일한 경로다.
 */
export const ScanStaleState = ({
  scannedAt,
  permission,
  onCheckPermission,
  onOpenHistory,
  onStartScan,
  canStart,
  starting,
}: ScanStaleStateProps) => {
  const { locale } = useLocale();
  const t = SCAN_COPY[locale];

  return (
    <div className="px-5 py-12 text-center">
      <div
        className={cn(
          'mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl',
          statusColors.warning.bg,
          // Not the error tone: the scan itself did not break, its result simply aged out.
          // textDark is the foreground `bg` pairs with — orange-800 holds 5.5:1 on orange-100.
          statusColors.warning.textDark,
        )}
      >
        <svg
          className="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <polyline points="3 3 3 8 8 8" />
          <polyline points="12 7.5 12 12 15 13.8" />
        </svg>
      </div>
      <h3 className={cn('text-lg font-bold', textColors.primary)}>{t.staleTitle}</h3>
      {/* 규칙 한 줄, 사실 한 줄 — 정책은 왜 막혔는지를, 메타는 언제의 결과였는지를
          각자 자기 행에서 말한다. */}
      <p className={cn(POLICY_LINE, textColors.tertiary)}>
        {t.stalePolicy(SCAN_STALE_DAYS)}
      </p>
      {scannedAt ? (
        <p className={cn('mt-1 text-[12px] tabular-nums', textColors.quaternary)}>
          {t.staleLastScan(formatDateTimeLocalCompact(scannedAt), formatRelativeTime(scannedAt, locale))}
        </p>
      ) : null}

      <div className="mt-7">
        <Button
          variant="primary"
          disabled={!canStart}
          onClick={onStartScan}
          className={CTA_BUTTON}
        >
          {starting ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t.starting}
            </>
          ) : (
            <>
              <ReloadIcon className="h-4 w-4" />
              {t.rescan}
            </>
          )}
        </Button>
      </div>

      {/* 스트립이 서지 않는 화면이라 그 보조 행동 둘을 여기서 잇는다. 스트립과 같은
          고스트 문법 — 이 블록의 버튼 크롬은 재스캔 하나만 갖는다. */}
      <div className="mt-4 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={onOpenHistory}
          className={cn(buttonStyles.ghostText, textColors.secondary)}
        >
          {t.scanHistory}
        </button>
        <button
          type="button"
          onClick={onCheckPermission}
          disabled={permission.status === 'checking'}
          className={cn(buttonStyles.ghostText, textColors.secondary)}
        >
          {permission.status === 'checking' ? t.checking : t.checkPermission}
        </button>
      </div>
      {/* 확인 결과가 앉을 자리 — 스트립에서는 링크 옆 배지가 받던 것이다. idle 이면
          아무것도 그리지 않으므로(ScanPermissionResult) 평소엔 3행 규격 그대로다. */}
      <div className="mt-3 flex justify-center empty:mt-0">
        <ScanPermissionResult state={permission} />
      </div>
    </div>
  );
};
