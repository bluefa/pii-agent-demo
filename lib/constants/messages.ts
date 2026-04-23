/**
 * 중복되는 한국어 에러 메시지.
 *
 * 2+ 파일에서 동일 문자열이 사용될 때만 등록.
 */
export const ERROR_MESSAGES = {
  /** 상태 조회 공통 실패 메시지. AWS/Azure/GCP InstallationInline (3 uses). */
  STATUS_FETCH_FAILED: '상태 조회에 실패했습니다.',
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
