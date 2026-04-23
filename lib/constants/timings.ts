/**
 * 타이밍 값 (setTimeout/setInterval).
 *
 * 2+ 사이트에서 같은 의미로 사용되는 값만 등록. 단일 사용 값은 local에 둔다.
 */
export const TIMINGS = {
  /** 프로세스 상태 폴링 간격. ProcessStatusCard, SduProjectPage. */
  PROCESS_STATUS_POLL_MS: 10_000,
} as const;

export type TimingKey = keyof typeof TIMINGS;
