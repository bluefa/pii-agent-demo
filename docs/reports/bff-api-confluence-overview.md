# 5.2.3.5.5.10.0 개요

> 상태: Draft
> 작성일: 2026-04-27
> 상위 문서: `5.2.3.5.5.10 BFF API`
> 대상: BFF API 문서를 읽거나 작성하는 개발자, 기획자, QA, 운영 담당자

## 1. 문서 목적

이 문서는 BFF API Confluence 문서의 입구다.
BFF API의 최신 Swagger, Tag별 설명, response 의미, 공통 규칙, API 변경 논의를 어디서 확인해야 하는지 안내한다.

BFF API 문서는 Swagger를 외부 링크로만 안내하지 않는다.
각 API Tag 페이지 안에 해당 Tag의 BFF Swagger를 직접 포함하고, Swagger만으로 알기 어려운 업무적 의미와 운영 기준을 함께 관리한다.

## 2. 문서 구조

```text
5.2.3.5.5.10 BFF API
5.2.3.5.5.10.0 개요
5.2.3.5.5.10.1 API Tag 가이드
5.2.3.5.5.10.1.1 ScanJob
5.2.3.5.5.10.1.2 Approval Process
5.2.3.5.5.10.1.x {API Tag}
5.2.3.5.5.10.2 공통 규칙
5.2.3.5.5.10.2.1 에러 코드 카탈로그
5.2.3.5.5.10.2.2 Enum / 상태 카탈로그
5.2.3.5.5.10.3 API 관련 논의
5.2.3.5.5.10.3.x [yy.mm.dd] {API Tag 또는 주제} 관련 논의
```

## 3. 주요 링크

| 구분 | 링크 | 비고 |
| --- | --- | --- |
| API Tag 가이드 | TODO | Tag별 BFF Swagger와 설명의 상위 인덱스 |
| ScanJob | TODO | ScanJob BFF Swagger, response 설명, 변경/논의 이력 |
| Approval Process | TODO | Approval Process BFF Swagger, response 설명, 변경/논의 이력 |
| 공통 규칙 | TODO | 인증, 버전, 공통 응답, breaking 판단 기준 |
| 에러 코드 카탈로그 | TODO | 에러 코드 의미, 사용자 액션, 운영자 확인 포인트 |
| Enum / 상태 카탈로그 | TODO | enum, state 의미와 상태 전이 규칙 |
| API 관련 논의 | TODO | API 변경, 추가, 폐기, 응답 변경 논의 모음 |
| 전체 Swagger | TODO | 전체 BFF API를 한 번에 확인해야 할 때 사용 |

## 4. 목적별 진입 경로

| 목적 | 먼저 볼 페이지 | 다음 확인 위치 | 비고 |
| --- | --- | --- | --- |
| 특정 Tag의 최신 API 확인 | API Tag 가이드의 해당 Tag 페이지 | BFF Swagger 섹션 | 예: `ScanJob`, `Approval Process` |
| 특정 Tag의 request/response schema 확인 | 해당 API Tag 페이지 | BFF Swagger 섹션 | Confluence 본문 표가 아니라 포함된 Swagger 기준 |
| response 값의 업무적 의미 확인 | 해당 API Tag 페이지 | response 설명 섹션 | 상태값, null, 실패 사유, 화면 표시 기준 |
| 신규 API 논의 확인 | API 관련 논의 | 해당 Tag 페이지의 변경/논의 이력 요약 | 논의 제목은 `[yy.mm.dd] ... 관련 논의` |
| 제안된 API Tag의 Swagger 확인 | 해당 API Tag 페이지 | BFF Swagger 섹션 | 배포 전 Swagger는 상태를 `Draft`로 명시 |
| 배포된 최종 API 확인 | 해당 API Tag 페이지 | BFF Swagger 섹션 | 상태가 `Released`인 Swagger가 기준 |
| API 변경 이력 확인 | 해당 API Tag 페이지 | 관련 API 논의 문서 | Tag 페이지에는 요약만 둠 |
| breaking/non-breaking 판단 | 공통 규칙 | API 관련 논의 | 판단 결과는 논의 문서에 기록 |
| enum/state 의미 확인 | Enum / 상태 카탈로그 | 관련 Tag 페이지 | 상태 전이는 카탈로그에 기록 |
| error code 의미 확인 | 에러 코드 카탈로그 | 관련 Tag 페이지 | 사용자 액션, 운영자 확인 포인트 포함 |

## 5. 페이지별 역할

| 페이지 | 역할 |
| --- | --- |
| API Tag 가이드 | Tag별 API 문서의 상위 인덱스 |
| API Tag 페이지 | 해당 Tag의 BFF Swagger, response 설명, 운영 규칙, 변경/논의 이력 요약 |
| 공통 규칙 | 모든 BFF API에 공통 적용되는 기준 |
| 에러 코드 카탈로그 | error code의 의미, 발생 조건, 사용자/운영자 액션 |
| Enum / 상태 카탈로그 | enum, state 의미와 상태 전이 기준 |
| API 관련 논의 | API 변경 제안과 변경 이력을 함께 관리하는 논의 공간 |

## 6. API Tag 페이지에서 확인할 내용

각 API Tag 페이지는 해당 Tag를 이해하기 위한 중심 문서다.
예: `ScanJob`, `Approval Process`.

각 Tag 페이지에는 최소 아래 내용을 포함한다.

- Tag 이름
- 상태: Draft / Reviewing / Accepted / Implemented / Released / Deprecated
- 담당자 또는 담당 팀
- 마지막 수정일
- BFF Swagger
- 관련 PR 링크
- 주요 사용 화면 또는 사용 주체
- API 목록
- response 설명
- 주요 동작 규칙
- 관련 enum/state 링크
- 관련 error code 링크
- 변경/논의 이력 요약

## 7. BFF Swagger 운영 원칙

- API Tag 페이지에는 해당 Tag의 BFF Swagger를 직접 포함한다.
- BFF Swagger는 링크만 두지 않고 Confluence 본문에서 바로 확인할 수 있어야 한다.
- BFF Swagger는 Swagger UI, OpenAPI viewer, Confluence 매크로, 또는 사내 표준 임베드 방식으로 포함한다.
- 배포 전 API도 별도 외부 문서로 보내지 않고 해당 Tag 페이지의 BFF Swagger 섹션에 포함한다.
- 배포 전 BFF Swagger는 상태를 `Draft`, `Reviewing`, `Accepted`, `Implemented` 등으로 명시한다.
- 배포된 BFF Swagger는 상태를 `Released`로 명시한다.
- request/response schema 전체를 사람이 작성한 표로 다시 관리하지 않는다.
- response 설명은 schema 복사가 아니라 값의 의미와 해석 기준을 설명한다.

## 8. API 관련 논의 작성 규칙

API 변경, 추가, 폐기, 응답 변경은 `API 관련 논의` 하위 문서로 관리한다.
논의 문서는 변경 제안과 변경 이력을 함께 담당한다.

제목 규칙:

```text
[yy.mm.dd] {API Tag 또는 주제} 관련 논의
```

예시:

```text
[26.04.27] ScanJob API 추가 관련 논의
[26.04.28] Approval Process 응답 구조 변경 관련 논의
[26.05.02] Provider API 에러 코드 정리 관련 논의
```

논의 문서에는 최소 아래 내용을 작성한다.

- 대상 API Tag
- 변경 유형: Added / Changed / Deprecated / Removed / Fixed
- 관련 API: Method / Path
- 논의 배경
- 논의 내용
- 관련 BFF Swagger 위치
- 관련 PR 링크
- 사용 주체 영향
- enum/state 영향
- error code 영향
- 상태: Draft / Reviewing / Accepted / Implemented / Released / Rejected
- 결정 사항
- 후속 작업

## 9. 상태 정의

| 상태 | 의미 |
| --- | --- |
| Draft | 초안 작성 중 |
| Reviewing | 검토 중 |
| Accepted | 구현 기준으로 합의됨 |
| Implemented | 코드 또는 PR에 반영됨 |
| Released | 배포되어 사용 주체가 따라야 하는 기준이 됨 |
| Deprecated | 폐기 예정 |
| Rejected | 논의 결과 채택하지 않음 |

## 10. 운영 원칙

- API 계약의 원본은 Swagger/OpenAPI다.
- Confluence는 Swagger를 읽기 위한 설명과 운영 맥락을 제공한다.
- Tag별 BFF Swagger는 API Tag 페이지 안에서 확인할 수 있어야 한다.
- API 관련 논의는 상세 논의와 결정 사항을 기록한다.
- API Tag 페이지에는 논의 본문을 복사하지 않고 변경/논의 요약과 링크만 남긴다.
- enum, state, error code는 Tag 문서에 중복 기입하지 않고 카탈로그로 연결한다.

## 11. 비권장 패턴

- API Tag 페이지에 BFF Swagger를 포함하지 않고 외부 링크만 제공
- endpoint 하나마다 하위 페이지 하나 생성
- Swagger schema 전체를 사람이 작성한 표로 Confluence에 복사
- API Tag 페이지와 API 관련 논의에 같은 내용을 상세 중복 작성
- 변경 제안과 변경 이력을 별도 페이지에서 각각 중복 관리
- 상태가 `Draft`인 BFF Swagger를 배포 계약처럼 표현
- enum과 error code를 각 Tag 문서에 중복 기입
