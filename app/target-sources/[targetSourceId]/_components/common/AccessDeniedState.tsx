import Link from 'next/link';
import { passRoutes } from '@/lib/routes';
import { bgColors, cn, getButtonClass, textColors } from '@/lib/theme';
import { LockIcon } from '@/app/components/ui/icons';

/**
 * 접근 권한이 없어 연동 대상을 열지 못했을 때의 전면 상태.
 *
 * `ErrorState` 와 갈라 둔 이유: 권한 없음은 **오류가 아니다**. 빨간 X 와 "오류가
 * 발생했어요" 아래 놓으면 신규 입사자에게는 시스템이 고장 난 화면으로 읽힌다. 실제로는
 * 정상적인 상태이고, 해야 할 일(권한 요청)이 분명한 상황이다.
 *
 * 그래서 탈출구가 둘이다 — 비어 있을 수도 있는 서비스 목록 하나만 주면 막다른 길끼리
 * 서로를 가리키게 된다(권한이 없으면 그 목록도 비어 있다). 권한을 요청할 수 있는 곳이
 * 주 행동이다.
 *
 * 서비스 이름을 말하지 못하는 건 계약 때문이다: 403 은 본문이 없어서 이 대상이 어느
 * 서비스 것인지 알 방법이 없다. 403 problem body 에 `service_code` 가 실리면 여기서
 * 서비스를 이름으로 부르고 그 자리에서 요청 모달을 열 수 있다.
 *
 * 훅도 bff 의존도 없다 — page.tsx(서버)와 error.tsx(클라이언트) 양쪽에서 쓴다.
 */
export const AccessDeniedState = () => (
  <div className={cn('flex min-h-screen items-center justify-center', bgColors.muted)}>
    <div className="max-w-md px-6 text-center">
      <div
        className={cn(
          'mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full',
          bgColors.panel,
          textColors.secondary,
        )}
      >
        <LockIcon className="h-8 w-8" />
      </div>
      <p className={cn('mb-2 font-medium', textColors.primary)}>
        이 연동 대상에 접근할 권한이 없어요
      </p>
      <p className={cn('mb-5 text-sm leading-relaxed', textColors.tertiary)}>
        이 대상이 속한 서비스의 접근 권한이 필요해요. 권한을 요청하면 관리자가 검토한 뒤
        승인하거나 반려해요.
      </p>
      <div className="flex items-center justify-center gap-2">
        <Link
          href={passRoutes.accessRequests}
          className={cn('inline-block', getButtonClass('primary'))}
        >
          권한 요청하기
        </Link>
        <Link
          href={passRoutes.services}
          className={cn('inline-block', getButtonClass('secondary'))}
        >
          Service 목록
        </Link>
      </div>
    </div>
  </div>
);
