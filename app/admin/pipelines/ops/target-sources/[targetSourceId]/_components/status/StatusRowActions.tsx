'use client';

/**
 * 연동 현황 행이 쓰는 두 개의 클라이언트 조각 — 탭으로 가는 문과 「다시 시도」.
 *
 * 카드 본문은 Server Component 라 함수 prop 을 받을 수 없다. 그래서 탭 전환은
 * context 로 건넨다: `OpsTargetView` 가 자기 `selectTab` 을 얹고, 서버가 그린 행
 * 안의 이 버튼이 그것을 꺼내 쓴다. 서버 컴포넌트의 출력은 클라이언트 트리의 그
 * 자리에 꽂히므로, 그 안의 클라이언트 잎은 provider 아래에 있다.
 *
 * ⛔ 링크로 만들지 않는다. 탭은 이 화면의 클라이언트 상태이고, `?tab=` 은 그 상태를
 * 공유 가능하게 비추는 거울일 뿐이다 (`InfraStatusHead` 와 같은 판단). `<Link>` 로
 * 옮기면 라우트가 다시 돌아 열려 있던 모달·폴링·페이지가 전부 초기화된다.
 */
import { createContext, useContext, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { OpsTargetTabLabel } from '@/lib/routes';

/** `OpsTargetView.selectTab`. 기본값이 no-op 인 것은 provider 밖에서 쓰이면 안 되기
 *  때문이 아니라, 없을 때 조용히 아무 일도 안 하는 편이 던지는 것보다 낫기 때문이다. */
export const OpsTabNavContext = createContext<((tab: OpsTargetTabLabel) => void) | null>(null);

export function TabLink({ tab }: { tab: OpsTargetTabLabel }): ReactElement {
  const selectTab = useContext(OpsTabNavContext);
  return (
    <button
      type="button"
      onClick={() => selectTab?.(tab)}
      className={cn(opsStyles.detailLink, 'text-[12px] font-normal')}
      aria-label={`${tab} 탭에서 상세보기`}
    >
      상세보기
      <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
    </button>
  );
}

/**
 * 거절된 조회 하나를 다시 부른다. 새 CSR 헬퍼를 만들지 않는다 — `router.refresh()` 가
 * 라우트를 서버에서 다시 렌더해 RSC 페이로드만 새로 보내므로, 열려 있던 탭·폴링 같은
 * 클라이언트 상태는 그대로 살아 있다. 라우트 전체가 다시 도는 것이 값이지만, 이 카드가
 * 부르는 네 건이 전부라 그 값은 작다.
 */
export function StatusRetryButton(): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={cn(opsStyles.detailLink, 'text-[12px] font-normal disabled:cursor-default disabled:opacity-60')}
    >
      {pending ? '불러오는 중' : '다시 시도'}
    </button>
  );
}
