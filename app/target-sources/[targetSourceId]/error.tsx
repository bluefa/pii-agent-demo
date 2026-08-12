'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/app/target-sources/[targetSourceId]/_components/common';

/**
 * 마지막 그물. 조회 실패는 page.tsx 가 상태 코드까지 보고 처리하므로, 여기까지 오는 건
 * 그 밖의 렌더 오류다 — 무엇이 잘못됐는지 알 수 없으니 기본 문구만 보여준다.
 * (`ErrorState` 의 기본값이 곧 그 문구다. `load-error.ts` 는 여기서 import 하지 않는다 —
 * 그쪽은 `@/lib/bff/*` 를 끌고 오고 이 파일은 클라이언트다.)
 *
 * `error.message` 는 쓰지 않는다. 프로덕션 빌드에서 서버 에러의 message 는 Next 의
 * 영어 안내문으로 치환되고("An error occurred in the Server Components render…"),
 * 클라이언트 오류라면 스택 조각이 그대로 화면에 실린다. 어느 쪽도 사용자에게 할 말이
 * 아니다. 진단은 digest 로 서버 로그에서 찾는다.
 */
export default function ProjectDetailError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  // 렌더 본문이 아니라 effect 에서 남긴다. 렌더는 부수효과 없이 몇 번이고 다시 돌 수 있고
  // (StrictMode 는 개발에서 일부러 두 번 돌린다), 그때마다 같은 실패를 다시 찍으면 로그가
  // 실제 발생 횟수를 말해주지 못한다.
  useEffect(() => {
    console.error('[target-sources] 상세 화면 렌더 실패', error.digest ?? error);
  }, [error]);

  return <ErrorState />;
}
