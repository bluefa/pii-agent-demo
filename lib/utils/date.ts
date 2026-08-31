/**
 * 날짜 포맷팅 유틸리티
 *
 * 사용 가능한 포맷:
 * - 'date': 날짜만 (예: 2024. 01. 15.)
 * - 'datetime': 날짜 + 시간 (예: 2024. 01. 15. 14:30)
 * - 'datetime-seconds': 날짜 + 시간 + 초 (예: 2024. 01. 15. 14:30:45)
 * - 'short': 짧은 형식 (예: 1월 15일 14:30)
 */

import { DEFAULT_LOCALE, type Locale } from '@/lib/locale';

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
 * UI locale → the BCP-47 tag `Intl` wants. A stamp has to follow the reader's language
 * the same way a sentence does: `ko-KR` writes its own 오전/오후 marker and orders the
 * parts `2026. 08. 20.`, which is Korean text sitting on an English screen. Same
 * mapping `RejectionAlert` makes inline.
 */
const intlLocale = (locale: Locale): string => (locale === 'en' ? 'en-US' : 'ko-KR');

/**
 * 날짜 문자열을 지정된 형식으로 포맷팅합니다.
 *
 * @param dateString - ISO 8601 형식의 날짜 문자열
 * @param format - 출력 형식 (기본값: 'date')
 * @param locale - 읽는 사람의 언어 (기본값: 한국어)
 * @returns 포맷팅된 날짜 문자열
 *
 * @example
 * formatDate('2024-01-15T14:30:45Z', 'date')           // "2024. 01. 15."
 * formatDate('2024-01-15T14:30:45Z', 'datetime')       // "2024. 01. 15. 14:30"
 * formatDate('2024-01-15T14:30:45Z', 'datetime-seconds') // "2024. 01. 15. 14:30:45"
 * formatDate('2024-01-15T14:30:45Z', 'short')          // "1월 15일 14:30"
 * formatDate('2024-01-15T14:30:45Z', 'short', 'en')    // "Jan 15, 02:30 PM"
 *
 * `locale` is last and defaults to Korean, the same shape `formatRelativeTime` below
 * uses: every existing caller — the tests among them — keeps the stamp it had, and only
 * a caller that knows the reader's language asks for the other one. Every `DateFormat`
 * member follows, because the options table holds no locale-specific literal — `short`
 * is the one that changes most (`1월 15일` → `Jan 15`).
 */
export const formatDate = (
  dateString: string,
  format: DateFormat = 'date',
  locale: Locale = DEFAULT_LOCALE,
): string => {
  const date = new Date(dateString);
  return date.toLocaleString(intlLocale(locale), FORMAT_OPTIONS[format]);
};

/**
 * 날짜만 포맷팅하는 헬퍼 함수
 */
export const formatDateOnly = (dateString: string): string => {
  return formatDate(dateString, 'date');
};

/**
 * 날짜와 시간을 포맷팅하는 헬퍼 함수
 *
 * Forwards `locale` to `formatDate`, and defaults the same way, so a caller that
 * never knew about language keeps the stamp it had.
 */
export const formatDateTime = (
  dateString: string,
  locale: Locale = DEFAULT_LOCALE,
): string => {
  return formatDate(dateString, 'datetime', locale);
};

/**
 * 날짜, 시간, 초를 포맷팅하는 헬퍼 함수
 */
export const formatDateTimeSeconds = (dateString: string): string => {
  return formatDate(dateString, 'datetime-seconds');
};

/**
 * `formatDateTime` pinned to Asia/Seoul. `formatDate` renders in the browser's
 * local timezone; use this whenever the UI labels the value as KST, so the
 * label stays true on non-KST machines.
 */
export const formatDateTimeKst = (dateString: string): string => {
  return new Date(dateString).toLocaleString('ko-KR', {
    ...FORMAT_OPTIONS.datetime,
    timeZone: 'Asia/Seoul',
  });
};

/**
 * `YY. MM. DD. HH:mm`, Asia/Seoul 고정 (오너 지정 표기: "26. 07. 30. 14:46").
 *
 * 두 층으로 쌓인 시각 표기의 아래층용이다 — 위층이 경과("25일 8시간 전")를 말하고
 * 이 줄은 근거만 받치므로, 4자리 연도와 오전/오후는 폭만 차지한다. 존은 `formatDateTimeKst`
 * 와 같이 Asia/Seoul 로 못박는다: (KST) 꼬리표를 뗀 것은 라벨이지 값이 아니다.
 *
 * @example
 * formatDateTimeKstCompact('2026-07-30T05:46:38Z') // "26. 07. 30. 14:46"
 */
export const formatDateTimeKstCompact = (dateString: string): string => {
  return new Date(dateString).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // h23 — hour12:false 는 자정을 '24:00' 으로 적는다(fmtTimeMs 가 손으로 고치던 그 값).
    hourCycle: 'h23',
  });
};

/**
 * 뷰어의 로컬 타임존으로 렌더하고 존 오프셋을 덧붙입니다 — 스캔 시각처럼
 * "내 시간으로 언제였나"가 답이어야 하는 자리용. wire 는 UTC instant(`...Z`)라
 * 변환은 `Date` 파싱이 맡고, 라벨은 그 숫자가 어느 존의 것인지 못 박습니다.
 *
 * 라벨이 `shortOffset` 인 이유: Intl 은 Asia/Seoul 에 'KST' 를 내주지 않고
 * ('GMT+9'), `short` 는 존마다 약어와 오프셋이 섞여 나옵니다(UTC / EDT / GMT+2).
 * 오프셋으로 통일해야 어느 존에서 읽어도 문법이 같습니다.
 *
 * @example
 * formatDateTimeLocal('2026-08-20T09:31:31Z') // "2026. 08. 20. 오후 06:31 GMT+9" (Asia/Seoul)
 * formatDateTimeLocal('2026-08-20T09:31:31Z', 'en') // "08/20/2026, 06:31 PM GMT+9"
 *
 * `locale` picks the language of the stamp only. The zone is the viewer's either way —
 * that is this function's whole point, and it is not a language question.
 */
export const formatDateTimeLocal = (
  dateString: string,
  locale: Locale = DEFAULT_LOCALE,
): string => {
  return new Date(dateString).toLocaleString(intlLocale(locale), {
    ...FORMAT_OPTIONS.datetime,
    timeZoneName: 'shortOffset',
  });
};

const LOCAL_DASHED = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'shortOffset',
});

/**
 * `formatDateTimeLocal` 의 대시 표기 — 'YYYY-MM-DD HH:mm[:ss] GMT±H'. 관리자 표는
 * 정렬해서 읽는 자리라 24시간 고정폭 표기를 씁니다. `lib/pipeline/format` 의
 * `fmtDateTime`/`fmtDateTimeSec` 과 모양은 같고 기준만 Asia/Seoul → 뷰어 로컬입니다.
 *
 * `formatToParts` 로 조립하는 이유는 엔진마다 'YYYY-MM-DD, HH:mm' 처럼 구분자가
 * 다르기 때문이고, 자정의 '24' 시는 '00' 으로 정규화합니다. null·invalid → '-'.
 */
export const formatDateTimeLocalDashed = (
  dateString: string | null | undefined,
  withSeconds = false,
): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  const parts = LOCAL_DASHED.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  const base = `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute')}`;
  const time = withSeconds ? `${base}:${pick('second')}` : base;
  return `${time} ${pick('timeZoneName')}`;
};

const LOCAL_COMPACT = new Intl.DateTimeFormat('en-CA', {
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * `YY.MM.DD HH:mm`, 뷰어 로컬 (오너 지정 표기: "26.07.21 04:02").
 *
 * 존 꼬리표가 없는 것은 12px 메타 줄용이기 때문이다 — 바로 옆에 선 상대 시각이
 * 의미("1개월 전")를 말하므로 이 값은 근거만 받치면 되고, 4자리 연도·오전/오후·
 * 'GMT+9' 는 폭만 차지한다. 기준은 `formatDateTimeLocal` 과 같은 뷰어 로컬이다.
 *
 * `formatDateTimeLocalDashed` 와 같은 이유로 `formatToParts` 로 조립하고(엔진마다
 * 구분자가 다르다), 자정의 '24' 시는 '00' 으로 정규화한다.
 *
 * @example
 * formatDateTimeLocalCompact('2026-07-20T19:02:00Z') // "26.07.21 04:02" (Asia/Seoul)
 */
export const formatDateTimeLocalCompact = (dateString: string): string => {
  const parts = LOCAL_COMPACT.formatToParts(new Date(dateString));
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('year')}.${pick('month')}.${pick('day')} ${hour}:${pick('minute')}`;
};

/**
 * 밀리초를 사람이 읽을 수 있는 한국어 소요시간으로 변환합니다.
 *
 * @example
 * formatDuration(45000)   // "45초"
 * formatDuration(125000)  // "2분 5초"
 */
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분 ${seconds % 60}초`;
};

/**
 * 과거 시각을 상대 표기로 변환합니다 — 스캔 신선도처럼 "얼마나 낡았는가"가
 * 핵심인 자리용. 임계값 경고 대신 상대시간 자체가 낡음 신호를 전달합니다.
 *
 * @example
 * formatRelativeTime('2026-07-31T14:20:00Z')  // "3분 전" (14:23 기준)
 * formatRelativeTime('2026-07-31T14:20:00Z', 'en')  // "3m ago"
 *
 * `locale` is last and defaults to Korean, the same shape `fmtRelativeTime` and
 * `fmtElapsedAgo` in `lib/pipeline/format.ts` use: this is a plain module with no
 * provider to read, so every existing caller — the tests among them — keeps the
 * words it had, and only a caller that knows the reader's language asks for the
 * other set. The English units are that file's, not new ones; `mo` rather than a
 * second `m` because minutes already own that letter.
 */
export const formatRelativeTime = (
  dateString: string,
  locale: Locale = DEFAULT_LOCALE,
): string => {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return '';
  const en = locale === 'en';
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return en ? 'just now' : '방금 전';
  if (minutes < 60) return en ? `${minutes}m ago` : `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return en ? `${hours}h ago` : `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return en ? `${days}d ago` : `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return en ? `${months}mo ago` : `${months}개월 전`;
  const years = Math.floor(months / 12);
  return en ? `${years}y ago` : `${years}년 전`;
};
