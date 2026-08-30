import type { AppErrorCode } from '@/lib/errors';
import type { FailureCopy } from '@/app/components/ui/confirm-failures';

/**
 * 제외 정책 저장이 실패했을 때의 사유 한 줄과, **다시 눌러서 풀리는 실패인지**.
 *
 * 규칙은 `confirm-failures.ts` 와 같다 — 사유는 에러 **코드**로 고르고, 서버 detail 이나
 * AppError.message 는 화면에 옮기지 않는다(ADR-008 개정 2026-04-27 / ADR-013 §D2).
 * 표를 따로 드는 이유는 문구다: 저쪽은 "승인을 요청한다"는 행위의 실패를 말하고, 여기는
 * "이 리소스의 제외 목록을 바꾼다"는 행위의 실패를 말한다. 같은 코드라도 사용자가 다음에
 * 할 일이 다르므로 같은 문장을 쓸 수 없다.
 *
 * `retry` 는 AppError.retriable 이 아니다. 이 프레임의 다시 저장하기는 방금 보낸 그 목록을
 * 그대로 다시 PUT 하므로, 권한·입력·대상 문제는 같은 손으로 다시 눌러도 같은 실패다.
 * CONFLICT 는 진행 중인 연결 테스트가 끝나면 풀리므로 다시 눌러볼 값어치가 있다.
 */
const FAILURES: Partial<Record<AppErrorCode, FailureCopy>> = {
  CONFLICT: { reason: '이미 진행 중인 연결 테스트가 있어요.', retry: true },
  FORBIDDEN: { reason: '이 연동 대상의 제외 설정을 바꿀 권한이 없어요.', retry: false },
  UNAUTHORIZED: { reason: '로그인이 만료됐어요. 새로고침한 뒤 다시 시도해 주세요.', retry: false },
  NOT_FOUND: { reason: '이 리소스를 더 이상 찾을 수 없어요.', retry: false },
  BAD_REQUEST: { reason: '보낸 제외 목록을 서버가 받지 못했어요.', retry: false },
  NETWORK: { reason: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.', retry: true },
  TIMEOUT: { reason: '응답이 너무 오래 걸렸어요. 잠시 후 다시 시도해 주세요.', retry: true },
  RATE_LIMITED: { reason: '요청이 많아요. 잠시 후 다시 시도해 주세요.', retry: true },
  INTERNAL_ERROR: { reason: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', retry: true },
};

/** 분류할 수 없는 실패는 다시 눌러볼 값어치가 있다 — 일시적일 수 있다는 게 유일한 정보다. */
const UNKNOWN_FAILURE: FailureCopy = { reason: '알 수 없는 오류가 발생했어요.', retry: true };

export const logicalDbFailureCopy = (code: AppErrorCode | undefined): FailureCopy =>
  (code && FAILURES[code]) ?? UNKNOWN_FAILURE;
