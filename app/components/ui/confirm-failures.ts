import type { AppErrorCode } from '@/lib/errors';

/**
 * 실패 한 건당 사유 한 줄과, **다시 눌러서 풀리는 실패인지**.
 *
 * 사유는 에러 **코드**로 고른다. 서버 detail 과 AppError.message 는 진단용이고
 * (ADR-008 개정 2026-04-27 / ADR-013 §D2), 그대로 렌더하면 BFF 가 쓴 문구가 그대로 UI
 * 카피가 된다. 코드는 fetchJson 이 좁은 allowlist 로 정규화한 값이라 — 서버의
 * CONFLICT_REQUEST_PENDING 같은 도메인 코드는 status 로 접혀 CONFLICT 로 온다 — 여기
 * 나열된 것이 승인 요청 화면에 실제로 도달할 수 있는 전부다.
 *
 * `retry` 는 AppError.retriable 이 아니다. 그쪽은 전송 계층의 재시도 가능성이라 409 를
 * false 로 준다. 하지만 이 확인 모달의 다시 요청하기는 재요청 전에 진행 상태를 다시 읽으므로
 * (useConfirmSubmit), 409 야말로 가장 잘 풀리는 경우다 — 이미 접수된 요청을 찾아 그대로
 * 다음 단계로 넘긴다. 반대로 권한·입력 문제는 같은 손으로 다시 눌러도 같은 실패다.
 *
 * 1단계 승인 요청과 5단계 완료 승인 요청이 같은 표를 쓴다. 두 화면 모두 "이 연동 대상에
 * 승인을 요청한다"는 같은 행위이고 같은 코드 집합에 부딪히므로, 문구를 각자 들면
 * 같은 실패가 화면마다 다른 말을 하게 된다.
 */
export interface FailureCopy {
  reason: string;
  retry: boolean;
}

const FAILURES: Partial<Record<AppErrorCode, FailureCopy>> = {
  CONFLICT: { reason: '이미 진행 중인 승인 요청이 있어요.', retry: true },
  INTERNAL_ERROR: { reason: '서버에서 오류가 발생했어요.', retry: true },
  RATE_LIMITED: { reason: '요청이 잠시 몰렸어요. 잠시 후 다시 요청해 주세요.', retry: true },
  NETWORK: { reason: '네트워크 연결을 확인해 주세요.', retry: true },
  TIMEOUT: { reason: '응답이 늦어지고 있어요. 잠시 후 다시 요청해 주세요.', retry: true },
  BAD_REQUEST: { reason: '요청 내용을 다시 확인해 주세요.', retry: false },
  UNAUTHORIZED: { reason: '로그인이 만료됐어요. 새로고침한 뒤 다시 요청해 주세요.', retry: false },
  FORBIDDEN: { reason: '이 연동 대상에 승인을 요청할 권한이 없어요.', retry: false },
  NOT_FOUND: { reason: '연동 대상을 찾을 수 없어요. 새로고침한 뒤 다시 요청해 주세요.', retry: false },
};

/** 분류할 수 없는 실패는 다시 눌러볼 값어치가 있다 — 일시적일 수 있다는 게 유일한 정보다. */
const UNKNOWN_FAILURE: FailureCopy = { reason: '알 수 없는 오류가 발생했어요.', retry: true };

export const approvalFailureCopy = (code: AppErrorCode | undefined): FailureCopy =>
  (code && FAILURES[code]) ?? UNKNOWN_FAILURE;
