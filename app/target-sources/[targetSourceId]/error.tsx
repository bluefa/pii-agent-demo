'use client';

import { ErrorState } from '@/app/target-sources/[targetSourceId]/_components/common';
import { TARGET_SOURCE_LOAD_FALLBACK } from '@/app/target-sources/[targetSourceId]/load-error';

/**
 * 마지막 그물. 조회 실패는 page.tsx 가 상태 코드까지 보고 처리하므로, 여기까지 오는 건
 * 그 밖의 렌더 오류다 — 무엇이 잘못됐는지 알 수 없으니 기본 문구만 보여준다.
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
  console.error('[target-sources] 상세 화면 렌더 실패', error.digest ?? error);
  return <ErrorState message={TARGET_SOURCE_LOAD_FALLBACK} />;
}
