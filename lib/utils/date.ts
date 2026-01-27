/**
 * 날짜 포맷팅 유틸리티
 *
 * 사용 가능한 포맷:
 * - 'date': 날짜만 (예: 2024. 01. 15.)
 * - 'datetime': 날짜 + 시간 (예: 2024. 01. 15. 14:30)
 * - 'datetime-seconds': 날짜 + 시간 + 초 (예: 2024. 01. 15. 14:30:45)
 * - 'short': 짧은 형식 (예: 1월 15일 14:30)
 */

export type DateFormat = 'date' | 'datetime' | 'datetime-seconds' | 'short';

const FORMAT_OPTIONS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  date: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  },
  datetime: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  },
  'datetime-seconds': {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  },
  short: {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
};

/**
 * 날짜 문자열을 지정된 형식으로 포맷팅합니다.
 *
 * @param dateString - ISO 8601 형식의 날짜 문자열
 * @param format - 출력 형식 (기본값: 'date')
 * @returns 포맷팅된 날짜 문자열
 *
 * @example
 * formatDate('2024-01-15T14:30:45Z', 'date')           // "2024. 01. 15."
 * formatDate('2024-01-15T14:30:45Z', 'datetime')       // "2024. 01. 15. 14:30"
 * formatDate('2024-01-15T14:30:45Z', 'datetime-seconds') // "2024. 01. 15. 14:30:45"
 * formatDate('2024-01-15T14:30:45Z', 'short')          // "1월 15일 14:30"
 */
export const formatDate = (dateString: string, format: DateFormat = 'date'): string => {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', FORMAT_OPTIONS[format]);
};

/**
 * 날짜만 포맷팅하는 헬퍼 함수
 */
export const formatDateOnly = (dateString: string): string => {
  return formatDate(dateString, 'date');
};

/**
 * 날짜와 시간을 포맷팅하는 헬퍼 함수
 */
export const formatDateTime = (dateString: string): string => {
  return formatDate(dateString, 'datetime');
};

/**
 * 날짜, 시간, 초를 포맷팅하는 헬퍼 함수
 */
export const formatDateTimeSeconds = (dateString: string): string => {
  return formatDate(dateString, 'datetime-seconds');
};
