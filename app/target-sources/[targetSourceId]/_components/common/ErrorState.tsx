import Link from 'next/link';
import { passRoutes } from '@/lib/routes';
import { bgColors, cn, getButtonClass, statusColors, textColors } from '@/lib/theme';
import { StatusErrorIcon } from '@/app/components/ui/icons';

interface ErrorStateProps {
  /**
   * 사용자가 읽을 한 줄 — **카피지 진단 문자열이 아니다**. `Error.message` 를 그대로
   * 넘기지 말 것(ADR-008): 문구는 호출자가 상태 코드로 고른다(load-error.ts).
   */
  message?: string | null;
}

/**
 * 연동 대상 상세를 열지 못했을 때의 전면 상태. page.tsx(서버)와 error.tsx(클라이언트
 * 경계) 양쪽에서 쓰므로 훅 없이 둔다 — 'use client' 가 없어야 서버 렌더에서 클라이언트
 * 번들을 끌고 오지 않는다.
 *
 * 유일한 행동은 서비스 목록이다. 이전 `router.back()` 은 갈 곳을 알 수 없었다 — 이
 * 주소로 바로 들어왔거나 새로고침한 경우 앱 밖으로 나가거나 방금 실패한 URL 로 다시
 * 들어온다. 실패한 화면의 탈출구는 확정된 목적지여야 한다.
 */
export const ErrorState = ({ message }: ErrorStateProps) => (
  <div
    role="alert"
    className={cn('flex min-h-screen items-center justify-center', bgColors.muted)}
  >
    <div className="text-center">
      <div
        className={cn(
          'mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full',
          statusColors.error.bg,
          statusColors.error.text,
        )}
      >
        <StatusErrorIcon className="h-8 w-8" />
      </div>
      <p className={cn('mb-2 font-medium', textColors.primary)}>오류가 발생했어요</p>
      <p className={cn('mb-4 text-sm', textColors.tertiary)}>
        {message || '연동 대상 정보를 불러오지 못했어요.'}
      </p>
      <Link href={passRoutes.services} className={cn('inline-block', getButtonClass('secondary'))}>
        Service 목록으로 돌아가기
      </Link>
    </div>
  </div>
);
