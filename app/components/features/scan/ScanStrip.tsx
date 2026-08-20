'use client';

import { Button } from '@/app/components/ui/Button';
import { SCAN_ERROR_LABELS } from '@/app/components/features/scan/scan-labels';
import {
  ScanPermissionResult,
  type ScanPermissionState,
} from '@/app/components/features/scan/scan-permission';
import { bgColors, borderColors, buttonStyles, cn, primaryColors, statusColors, textColors } from '@/lib/theme';
import { formatDateTimeLocal, formatRelativeTime } from '@/lib/utils/date';
import type { ApprovalFilter } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

/**
 * The band's three counts — all in ONE unit (candidate DBs), and `selected +
 * excluded === eligible`. Any number in another unit (e.g. the scan's raw
 * discovery total across every resource type) belongs to the scan job, not to
 * this row: side by side the two only invite a comparison with no answer.
 */
export interface ScanFunnelCounts {
  /** Candidate DBs the table lists. */
  eligible: number;
  selected: number;
  excluded: number;
  /** Excluded rows still missing their required reason. */
  missingReasons: number;
  filter: ApprovalFilter;
  onFilterChange: (next: ApprovalFilter) => void;
}

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
   * 후보 목록이 서 있을 때만 넘어온다 — 목록이 없으면(스캔 전·0건·실패) 셀은 전부
   * 0이라 정보가 아니라 소음이므로, 그때 밴드는 예전처럼 한 줄로만 선다.
   */
  funnel?: ScanFunnelCounts;
}

// 텍스트 버튼(이력·권한 확인) — 스트립의 보조 행동은 버튼 크롬 없이 밑줄 링크
// 문법으로 물러난다. 유일한 버튼 크롬은 스캔 시작(secondary) 하나.
// 색은 buttonStyles.ghostText 토큰이 소유한다 (CLAUDE.md ④ raw 색상 금지).
const GHOST_BUTTON = buttonStyles.ghostText;

const CELL_BASE = 'min-w-0 px-4 py-3 text-center';

/**
 * One count cell — label over number, one quiet line under, all centred on the
 * cell's axis. No change-since-last-scan delta: step 1 asks how many DBs can be
 * connected, and a `+9` beside that count answers a different question.
 * Equal-width cells put the numbers on a shared vertical line, which is the
 * point: comparison needs alignment first. Weight stays medium like the admin
 * resource tiles — size and colour already carry the hierarchy.
 *
 * A cell that filters the table is a real <button> with aria-pressed; the
 * eligible cell only reports (it IS the 'all' state), so it renders as plain
 * text and "looks interactive" and "is interactive" never disagree.
 */
const FunnelCell = ({
  label,
  value,
  sub,
  subWarn = false,
  emphasis = false,
  pressed,
  onPress,
}: {
  label: string;
  value: number;
  sub?: string;
  subWarn?: boolean;
  emphasis?: boolean;
  pressed?: boolean;
  onPress?: () => void;
}) => {
  const body = (
    <>
      <p
        className={cn(
          'whitespace-nowrap text-[12px] font-semibold',
          pressed ? primaryColors.textOnLight : textColors.tertiary,
        )}
      >
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline justify-center gap-1.5">
        <span
          className={cn(
            'text-[22px] font-medium leading-[1.15] tracking-[-0.02em] tabular-nums',
            emphasis ? primaryColors.text : textColors.primary,
          )}
        >
          {value.toLocaleString()}
        </span>
      </p>
      {/* Reserved line — the warning text appears and disappears with the data,
          and a cell that changes height on every re-select reads as a glitch. */}
      <p
        className={cn(
          'mt-0.5 min-h-[17px] truncate text-[11.5px]',
          subWarn ? cn('font-semibold', statusColors.warning.textDark) : textColors.quaternary,
        )}
      >
        {sub ?? ''}
      </p>
    </>
  );

  if (!onPress) {
    return <div className={CELL_BASE}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={pressed}
      className={cn(
        CELL_BASE,
        // 프레임이 overflow-hidden이라 바깥 링은 잘린다 — ring-inset으로 안쪽에 그린다.
        'transition-colors focus:outline-none focus:ring-2 focus:ring-inset',
        primaryColors.focusRing,
        pressed ? primaryColors.bgLight : cn(bgColors.surface, primaryColors.bgLightActive),
      )}
    >
      {body}
    </button>
  );
};

/**
 * Scan status band, between the header and the table. With `funnel` it carries
 * three cells on top (eligible = selected + excluded); the line below holds the
 * last-scan summary (relative time, because staleness is the signal) plus
 * history / permission check / rescan. There is no standing green permission
 * badge — that rule belongs to ScanPermissionResult.
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
  funnel,
}: ScanStripProps) => {
  // The counts need a scan behind them: with none on record, number cells make an
  // absent result read like a result and push the one true fact ("no scan yet")
  // below them. The band is that single line instead.
  const showFunnel = funnel != null && job != null;
  const succeeded = job?.scan_status === 'SUCCESS';
  const failedByPermission = job != null && !succeeded && job.scan_error === 'AUTH_PERMISSION_ERROR';
  const scannedAt = job?.updated_at ?? job?.created_at ?? null;

  const mainText = job == null
    ? '아직 스캔한 적이 없어요'
    : `${succeeded ? '마지막 스캔' : '마지막 스캔 실패'}${scannedAt ? ` ${formatRelativeTime(scannedAt)}` : ''}`;
  const dotClass = job == null
    // 기록 없음은 상태가 아니라 부재 — pending(대기) 도트 토큰을 그대로 쓴다.
    ? statusColors.pending.dot
    : succeeded
      ? statusColors.success.dot
      : statusColors.error.dot;

  const metaParts: string[] = [];
  if (job != null) {
    if (scannedAt) metaParts.push(formatDateTimeLocal(scannedAt));
    if (succeeded) {
      if (typeof job.duration_seconds === 'number') metaParts.push(`${Math.round(job.duration_seconds)}초 소요`);
      // Meta carries the scan's own facts only (time, duration). Counts belong to
      // the cells above, in the candidate-DB unit.
      if (!showFunnel && newCount > 0) metaParts.push(`신규 ${newCount}`);
    } else if (!failedByPermission && job.scan_error) {
      // 권한 오류는 아래 배지가 전담 — 그 외 실패 사유만 메타로 흘린다.
      metaParts.push(SCAN_ERROR_LABELS[job.scan_error] ?? job.scan_error);
    }
  }

  return (
    <div
      className={cn(
        // 항상 독립 밴드 — 스캔 영역은 리소스 테이블과 명시적으로 분리된 컴포넌트다.
        // (표의 상단 세그먼트로 붙이는 connected 변형은 사용자 결정으로 제거.)
        'overflow-hidden rounded-xl border',
        bgColors.surface,
        borderColors.default,
      )}
    >
      {showFunnel && funnel && (
        <div className={cn('grid grid-cols-3 divide-x', borderColors.light)}>
          <FunnelCell label="연동 가능 DB" value={funnel.eligible} emphasis />
          <FunnelCell
            label="선택함"
            value={funnel.selected}
            pressed={funnel.filter === 'target'}
            onPress={() => funnel.onFilterChange(funnel.filter === 'target' ? 'all' : 'target')}
          />
          <FunnelCell
            label="제외함"
            value={funnel.excluded}
            sub={funnel.missingReasons > 0 ? `사유 ${funnel.missingReasons}건 미입력` : undefined}
            subWarn={funnel.missingReasons > 0}
            pressed={funnel.filter === 'excluded'}
            onPress={() => funnel.onFilterChange(funnel.filter === 'excluded' ? 'all' : 'excluded')}
          />
        </div>
      )}

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3',
          showFunnel && cn('border-t', borderColors.light, bgColors.muted),
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
    </div>
  );
};
