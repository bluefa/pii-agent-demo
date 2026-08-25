/**
 * 목 응답의 시각은 지금 기준이다.
 *
 * 화면이 "3분 전 확인"처럼 신선도를 말하기 시작하면서, 고정된 과거 날짜
 * (2026-06-23)는 표현할 수 없는 상태가 됐다 — 진행 중인 설치의 마지막 확인이 두 달
 * 전일 수는 없고, 그렇게 두면 목에서는 상대시각 분기가 영영 그려지지 않는다.
 *
 * ⛔ `aws-wire-sample.ts` 는 실제 캡처 응답이라 여기에 해당하지 않는다.
 */
export const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();
