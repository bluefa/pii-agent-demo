/**
 * 제외 사유 길이. 클라우드 Step 1 의 사유 입력(`CandidateResourceSection`)과 승인 요청
 * 서버 스키마(`lib/approval-selection.ts`)가 이 상수 하나를 읽는다 — 폼이 받아 준 글자를
 * 서버가 되돌려 보내면 그 자리가 곧 false positive 다.
 *
 * 상수가 스키마 파일이 아니라 여기 사는 이유: 숫자 하나 때문에 클라이언트 컴포넌트가
 * 요청 스키마 모듈(zod 객체를 모듈 로드 시점에 만든다)을 끌어오지 않게 하려는 것이다.
 */
export const EXCLUSION_REASON_MAXLEN = 1000;
