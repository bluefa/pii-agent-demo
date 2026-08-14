import { BffError } from '@/lib/bff/errors';
import { TARGET_SOURCE_LOAD_FALLBACK } from '@/app/target-sources/[targetSourceId]/_components/common/ErrorState';

/**
 * 이 모듈은 **서버 전용**이다 — `@/lib/bff/*` 를 끌어오므로 `'use client'` 파일에서
 * import 하면 안 된다(`docs/api/boundaries.md`). 기본 문구가 필요할 뿐인 클라이언트
 * 쪽은 `ErrorState` 에서 직접 가져다 쓴다.
 *
 * 문구는 **상태 코드**로 고른다. `BffError.message` 는 업스트림이 쓴 진단 문자열이고
 * (ADR-008 개정 2026-04-27), 그대로 렌더하면 BFF 가 쓴 영어 문장이 그대로 UI 카피가
 * 된다. 게다가 프로덕션 빌드에서는 서버 컴포넌트가 던진 에러의 message 자체가
 * Next 에 의해 지워지므로 — error.tsx 에 도착할 땐 "An error occurred in the Server
 * Components render…" 라는 영어 안내문만 남는다 — 분류는 status 가 살아 있는
 * page.tsx 에서 끝내야 한다.
 */
export { TARGET_SOURCE_LOAD_FALLBACK };

/**
 * 분류된 실패인지 — 이 화면이 처리하도록 설계된 결과인지.
 *
 * 로그 레벨이 여기 붙어 있는 건, 어느 상태 코드에 문구가 있는지와 어느 것이 "예상된
 * 실패"인지가 **같은 판단**이기 때문이다. 둘을 각각의 함수로 두면 한쪽에만 상태 코드를
 * 추가하는 순간 조용히 어긋난다.
 */
export interface TargetSourceLoadFailure {
  /**
   * 어떤 실패인지. 권한 없음은 **오류가 아니라 상태**라 화면 자체가 다르다
   * (AccessDeniedState) — 문구만 갈아 끼우면 빨간 X 아래 "권한이 없어요" 가 놓여
   * 시스템이 고장 난 것처럼 읽힌다.
   */
  kind: 'forbidden' | 'other';
  /** 사용자가 읽을 한 줄. `kind === 'forbidden'` 이면 쓰이지 않는다. */
  message: string;
  /**
   * `false` 면 이 화면이 아는 실패다. 서버 콘솔에 `console.error` 로 남기지 않는다 —
   * Next dev 오버레이가 `console.error` 를 빨간 에러 카드로 띄우기 때문에, 정상 처리된
   * 404 가 개발자에게는 터진 화면으로 보인다. 진짜로 예상 못 한 실패만 그 자리를 쓴다.
   */
  unexpected: boolean;
}

export const classifyTargetSourceLoad = (error: unknown): TargetSourceLoadFailure => {
  if (error instanceof BffError) {
    if (error.status === 404) {
      return {
        kind: 'other',
        message: '요청하신 연동 대상을 찾을 수 없어요. 삭제되었거나 주소가 잘못되었을 수 있어요.',
        unexpected: false,
      };
    }
    if (error.status === 401 || error.status === 403) {
      // 문구를 들려 보내지 않는다 — 이 경우의 화면은 한 줄이 아니라 행동(권한 요청)이다.
      return { kind: 'forbidden', message: '', unexpected: false };
    }
  }
  return { kind: 'other', message: TARGET_SOURCE_LOAD_FALLBACK, unexpected: true };
};
