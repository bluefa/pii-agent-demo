/**
 * 제외 사유 길이 — 클라우드 Step 1 의 사유 입력(`CandidateResourceSection`) textarea 의
 * `maxLength` 에만 쓴다. 승인 요청 서버 스키마(`lib/approval-selection.ts`)는 이 필드에
 * 길이 상한을 두지 않는다: 이전 요청이 폼을 거치지 않은 사유를 되싣고, 계약도 상한이 없다.
 *
 * 상수가 스키마 파일이 아니라 여기 사는 이유: 클라이언트 컴포넌트가 숫자 하나 때문에
 * 요청 스키마 모듈(zod 객체를 모듈 로드 시점에 만든다)을 끌어오지 않게 하려는 것이다.
 */
export const EXCLUSION_REASON_MAXLEN = 1000;
