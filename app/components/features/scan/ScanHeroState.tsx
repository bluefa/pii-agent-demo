'use client';

import { Button } from '@/app/components/ui/Button';
import { PlayIcon } from '@/app/components/ui/icons';
import { SCAN_CREDENTIAL_LABELS } from '@/app/components/features/scan/scan-labels';
import {
  ScanPermissionResult,
  type ScanPermissionState,
} from '@/app/components/features/scan/scan-permission';
import { borderColors, cn, primaryColors, textColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';

export interface ScanHeroStateProps {
  provider: CloudProvider;
  permission: ScanPermissionState;
  onCheckPermission: () => void;
  onStartScan: () => void;
  canStart: boolean;
  starting: boolean;
  /** TargetSource.scanPrincipal — 이 대상을 스캔하는 주체. 계약이 안 주면 종류 줄까지만. */
  scanPrincipal?: string;
}

/**
 * B안 스캔 온보딩 히어로 — 한 번도 스캔한 적 없는 카드의 본문 전체. 이 순간
 * 화면의 유일한 행동이 스캔이므로 primary CTA를 스캔이 가진다(승인 요청 CTA는
 * 목록이 생긴 뒤에야 존재). 안내문이 가리키는 버튼이 바로 그 자리에 있다.
 */
export const ScanHeroState = ({
  provider,
  permission,
  onCheckPermission,
  onStartScan,
  canStart,
  starting,
  scanPrincipal,
}: ScanHeroStateProps) => (
  <div className="px-5 py-12 text-center">
    <div
      className={cn(
        'mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl',
        primaryColors.bgLight,
        // textOnLight is the foreground `bgLight` pairs with: primary holds 4.33:1 on the
        // tint, which clears 1.4.11 for this glyph but nothing else that might join it.
        primaryColors.textOnLight,
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
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
    </div>
    {/* 카드 헤더가 바로 위에서 "인프라 스캔으로 {provider} 계정의 리소스를 조회하고…"를
        이미 말한다. 히어로는 그걸 되풀이하는 대신 이 화면만 가진 사실 하나 — 기록이
        없다 — 를 말한다. 문장은 같은 상태의 ScanStrip 것과 같은 것으로 둔다: 한 상태를
        두 문장으로 부르면 같은 화면이 두 번 설명된다. */}
    <h3 className={cn('text-lg font-bold', textColors.primary)}>
      아직 스캔한 적이 없어요
    </h3>
    <p className={cn('mt-2 text-[13.5px] leading-[1.6]', textColors.tertiary)}>
      스캔하면 연결된 {provider} 계정의 DB 리소스를 조회해요. 평균 5분 이내 완료돼요.
    </p>

    {/* 권한 프리플라이트 한 줄 — 확인은 시점 있는 관측이라 결과는 세션 안에서만
        유지된다. 실패해도 스캔은 막지 않는다: 검증 API와 실제 스캔 권한이 어긋날
        수 있으므로 화면은 "확인 실패"까지만 말한다. */}
    <div
      className={cn(
        'mx-auto mt-6 flex max-w-[430px] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left',
        borderColors.default,
      )}
    >
      <div className="min-w-0">
        <div className={cn('text-[13.5px] font-semibold', textColors.primary)}>스캔 권한</div>
        <div className={cn('mt-0.5 text-[12px]', textColors.tertiary)}>
          {SCAN_CREDENTIAL_LABELS[provider]}
        </div>
        {/* 종류 아래 줄에 그 종류의 값. 확인 버튼이 무엇을 확인하는지가 이름으로 서고,
            실패했을 때 어디를 고쳐야 하는지도 이 한 줄이 답한다. */}
        {scanPrincipal ? (
          <div
            className={cn('mt-1 truncate font-mono text-[12px]', textColors.secondary)}
            title={scanPrincipal}
          >
            {scanPrincipal}
          </div>
        ) : null}
      </div>
      {permission.status === 'idle' || permission.status === 'checking' ? (
        <button
          type="button"
          onClick={onCheckPermission}
          disabled={permission.status === 'checking'}
          className={cn(
            'flex-shrink-0 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            primaryColors.text,
          )}
        >
          {permission.status === 'checking' ? '확인 중...' : '지금 확인하기'}
        </button>
      ) : (
        <div className="flex min-w-0 flex-shrink items-center gap-2">
          <ScanPermissionResult state={permission} />
          <button
            type="button"
            onClick={onCheckPermission}
            className={cn('flex-shrink-0 text-[12px] font-medium underline underline-offset-[3px]', textColors.tertiary)}
          >
            다시 확인
          </button>
        </div>
      )}
    </div>

    <div className="mt-7">
      <Button
        variant="primary"
        disabled={!canStart}
        onClick={onStartScan}
        className="inline-flex h-11 items-center gap-2 px-6 text-[15px]"
      >
        {starting ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            시작 중...
          </>
        ) : (
          <>
            <PlayIcon className="h-4 w-4" />
            스캔 시작
          </>
        )}
      </Button>
    </div>
  </div>
);
