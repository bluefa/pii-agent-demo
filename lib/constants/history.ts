// History API 에러 코드
export const HISTORY_ERROR_CODES = {
  UNAUTHORIZED: { status: 401, message: '로그인이 필요합니다.' },
  FORBIDDEN: { status: 403, message: '해당 프로젝트에 대한 권한이 없습니다.' },
  NOT_FOUND: { status: 404, message: '프로젝트를 찾을 수 없습니다.' },
  INVALID_TYPE: { status: 400, message: '유효하지 않은 type 파라미터입니다. (all, approval)' },
} as const;

// History 필터 타입
export const VALID_HISTORY_TYPES = ['all', 'approval'] as const;
export type ValidHistoryType = (typeof VALID_HISTORY_TYPES)[number];

// 기본값
export const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 100;
