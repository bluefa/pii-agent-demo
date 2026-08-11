import { BffError } from '@/lib/bff/errors';

/**
 * 연동 대상 상세를 못 열었을 때 사용자가 읽을 한 줄.
 *
 * 문구는 **상태 코드**로 고른다. `BffError.message` 는 업스트림이 쓴 진단 문자열이고
 * (ADR-008 개정 2026-04-27), 그대로 렌더하면 BFF 가 쓴 영어 문장이 그대로 UI 카피가
 * 된다. 게다가 프로덕션 빌드에서는 서버 컴포넌트가 던진 에러의 message 자체가
 * Next 에 의해 지워지므로 — error.tsx 에 도착할 땐 "An error occurred in the Server
 * Components render…" 라는 영어 안내문만 남는다 — 분류는 status 가 살아 있는
 * page.tsx 에서 끝내야 한다.
 */
export const TARGET_SOURCE_LOAD_FALLBACK =
  '연동 대상 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';

export const targetSourceLoadMessage = (error: unknown): string => {
  if (!(error instanceof BffError)) return TARGET_SOURCE_LOAD_FALLBACK;
  if (error.status === 404) {
    return '요청하신 연동 대상을 찾을 수 없어요. 삭제되었거나 주소가 잘못되었을 수 있어요.';
  }
  if (error.status === 401 || error.status === 403) {
    return '이 연동 대상을 볼 수 있는 권한이 없어요. 서비스 담당자에게 문의해 주세요.';
  }
  return TARGET_SOURCE_LOAD_FALLBACK;
};
