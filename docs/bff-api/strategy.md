# BFF API 문서 관리 전략

> Confluence: 5.2.3.5.5.10 (전략 문서)
> 작성일: 2026-04-27
> 상태: Proposed
> 대상: `docs/bff-api/` 디렉터리 및 매핑되는 Confluence 트리
> 짝 문서: 운영 워크플로우는 [management-plan.md](./management-plan.md) 참고

## 1. 배경

BFF API 관련 정보는 여러 층에 흩어지기 쉽다.

- Swagger/OpenAPI: API 계약의 원본
- Confluence: 설명, 협업, 논의, 운영 맥락
- Git/PR: 실제 구현 변경 내역
- 코드: enum, error code, 실행 동작

Swagger는 request/response schema와 endpoint 계약을 확인하는 데 적합하다.
하지만 아래 정보는 Swagger만으로 관리하기 어렵다.

- API Tag별 사용 맥락
- response 값의 업무적 의미
- 상태 전이와 예외 처리 기준
- enum, state, error code 운영 기준
- API 변경 논의와 의사결정 과정
- Tag별 변경 이력

따라서 BFF API 문서는 Swagger를 외부 링크로만 보내는 문서가 아니라, Tag별 페이지 안에 해당 BFF Swagger를 포함하고 그 Swagger를 읽기 위한 설명과 논의 기록을 함께 관리하는 구조로 둔다.

## 2. 문제 정의

`5.2.3.5.5.10 BFF API` 하위 문서 구조를 명확히 정하지 않으면 다음 문제가 반복된다.

- Swagger 링크만 있고 API 사용 맥락이 없다.
- 신규 API의 제안 Swagger가 Tag 페이지 안에 없으면 최종안을 확인하기 어렵다.
- API Tag별 response 의미와 운영 규칙이 흩어진다.
- 변경 제안과 변경 이력을 따로 관리하다가 중복 문서가 생긴다.
- enum, state, error code가 기능 문서마다 중복된다.
- Swagger와 Confluence에 같은 schema를 복사해 낡은 문서가 생긴다.

## 3. 결정

Confluence의 BFF API 문서는 다음 원칙으로 관리한다.

1. Swagger/OpenAPI는 API 계약의 원본으로 사용한다.
2. API Tag 페이지에는 해당 Tag의 BFF Swagger를 직접 포함한다.
3. Confluence에는 Swagger schema를 수동 표로 중복 복사하지 않는다.
4. API Tag별 BFF Swagger, response 설명, 운영 규칙, 변경 요약은 `API Tag 가이드`에서 관리한다.
5. API 변경 제안과 변경 이력은 별도 문서로 분리하지 않고 `API 관련 논의`로 관리한다.
6. 각 논의 문서는 `[yy.mm.dd] {API Tag 또는 주제} 관련 논의` 제목 규칙을 따른다.
7. Tag별 가이드에는 관련 논의 링크와 변경 요약만 남긴다.
8. enum, state, error code는 공통 카탈로그로 분리한다.

## 4. 권장 페이지 구조

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

이 구조의 중심은 `API Tag 가이드`다.
`API 관련 논의`는 API 변경이 왜 필요했고 어떤 결론이 났는지 기록하는 공간이다.

별도의 `배포 API 인덱스`, `변경 제안`, `변경 이력` 페이지는 기본 생성하지 않는다.
그 역할은 각각 `API Tag 가이드`와 `API 관련 논의` 안으로 흡수한다.

## 5. 페이지별 역할

| 페이지 | 목적 | Swagger 포함 여부 | 비고 |
| --- | --- | --- | --- |
| `5.2.3.5.5.10 BFF API` | 부모 허브 | 아니오 | 하위 페이지 안내만 |
| `5.2.3.5.5.10.0 개요` | 전체 구조, 목적별 진입 경로, 공식 링크 안내 | 예 | 전체 Swagger 또는 Tag 가이드 링크 |
| `5.2.3.5.5.10.1 API Tag 가이드` | Tag별 API 문서의 상위 인덱스 | 예 | Tag별 페이지 링크 |
| `5.2.3.5.5.10.1.x {API Tag}` | Tag별 최신 Swagger, response 설명, 운영 규칙, 변경 요약 | 예 | 사람이 가장 자주 보는 API 문서 |
| `5.2.3.5.5.10.2 공통 규칙` | 인증, 버전, 공통 응답, breaking 판단 기준 | 아니오 | 공통 규칙은 문서 본문이 기준 |
| `5.2.3.5.5.10.2.1 에러 코드 카탈로그` | 에러 코드 의미와 운영 기준 | 아니오 | 값의 원본이 아니라 설명 기준 |
| `5.2.3.5.5.10.2.2 Enum / 상태 카탈로그` | enum, state 의미와 전이 규칙 | 아니오 | 값의 원본이 아니라 설명 기준 |
| `5.2.3.5.5.10.3 API 관련 논의` | API 변경, 추가, 폐기, 응답 변경 논의 모음 | 선택 | 논의 문서 인덱스 |
| `5.2.3.5.5.10.3.x [yy.mm.dd] ... 관련 논의` | 개별 API 논의 기록 | 아니오 | BFF Swagger는 Tag 페이지에서 확인 |

## 6. BFF Swagger 포함 원칙

- Swagger/OpenAPI는 API 계약의 원본이다.
- API Tag 페이지에는 해당 Tag의 BFF Swagger를 직접 포함한다.
- BFF Swagger는 링크만 두지 않고 Confluence 본문에서 바로 확인할 수 있어야 한다.
- BFF Swagger는 Swagger UI, OpenAPI viewer, Confluence 매크로, 또는 사내 표준 임베드 방식으로 포함한다.
- Confluence에는 request/response schema 전체를 별도 표로 수동 복사하지 않는다.
- response 설명은 schema 복사가 아니라 "값의 의미, 해석 기준, 화면/사용 주체 영향" 중심으로 작성한다.
- 배포 전 API도 별도 외부 문서로 보내지 않고 해당 Tag 페이지의 BFF Swagger 섹션에 포함한다.
- 배포 전 BFF Swagger는 상태를 `Draft`, `Reviewing`, `Accepted`, `Implemented` 등으로 명시한다.
- 배포된 BFF Swagger는 상태를 `Released`로 명시한다.

## 7. 각 페이지에 들어가야 할 내용

### 7.1 `5.2.3.5.5.10.0 개요`

개요는 단순한 링크 목록이 아니라, 사용자가 목적에 맞는 페이지로 바로 이동할 수 있는 입구다.

포함 내용:

- 문서 목적
- 문서 읽는 순서
- 목적별 진입 경로
- API Tag 가이드 링크
- 전체 Swagger 또는 환경별 Swagger 링크
- 공통 규칙, 카탈로그, API 관련 논의 링크
- 문서 운영 원칙

목적별 진입 경로:

| 목적 | 먼저 볼 페이지 | 다음 확인 위치 | 비고 |
| --- | --- | --- | --- |
| 특정 Tag의 최신 API 확인 | API Tag 가이드의 해당 Tag 페이지 | BFF Swagger 섹션 | 예: `ScanJob`, `Approval Process` |
| 특정 Tag의 response 의미 확인 | 해당 API Tag 페이지 | response 설명 섹션 | Swagger schema를 다시 복사하지 않음 |
| 신규 API 논의 확인 | API 관련 논의 | 해당 Tag 페이지의 변경/논의 요약 | 논의 제목은 `[yy.mm.dd] ... 관련 논의` |
| 제안된 API Tag의 Swagger 확인 | 해당 API Tag 페이지 | BFF Swagger 섹션 | 배포 전 Swagger는 상태를 `Draft`로 명시 |
| 배포된 최종 API 확인 | 해당 API Tag 페이지 | BFF Swagger 섹션 | 상태가 `Released`인 Swagger가 기준 |
| breaking/non-breaking 판단 | 공통 규칙 | API 관련 논의 | 판단 결과는 논의 문서에 기록 |
| enum/state 의미 확인 | Enum / 상태 카탈로그 | 관련 Tag 페이지 | 상태 전이는 카탈로그에 기록 |
| error code 의미 확인 | 에러 코드 카탈로그 | 관련 Tag 페이지 | 사용자 액션, 운영자 확인 포인트 포함 |
| API 변경 이력 확인 | 해당 API Tag 페이지 | 관련 API 논의 문서 | Tag 페이지에는 요약만 둠 |

### 7.2 `5.2.3.5.5.10.1 API Tag 가이드`

`API Tag 가이드`는 Tag별 API 문서의 상위 인덱스다.
Tag별 상세 설명은 하위 페이지에서 관리한다.

포함 내용:

- API Tag 목록
- 각 Tag의 담당자 또는 담당 팀
- 상태: Draft / Reviewing / Accepted / Implemented / Released / Deprecated
- BFF Swagger 포함 여부
- 최근 논의 링크
- 최근 배포 또는 변경 요약

예시:

| API Tag | 상태 | 담당 | BFF Swagger | 최근 논의 | 비고 |
| --- | --- | --- | --- | --- | --- |
| ScanJob | Draft | TBD | Tag 페이지에 포함 | `[26.04.27] ScanJob API 추가 관련 논의` | 신규 API |
| Approval Process | Released | TBD | Tag 페이지에 포함 | `[26.04.27] Approval Process 응답 구조 관련 논의` | 승인 흐름 |

### 7.3 `5.2.3.5.5.10.1.x {API Tag}`

Tag별 API 페이지는 해당 Tag를 이해하기 위한 중심 문서다.
예: `5.2.3.5.5.10.1.1 ScanJob`, `5.2.3.5.5.10.1.2 Approval Process`.

포함 내용:

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

#### BFF Swagger

Tag 페이지에는 해당 Tag의 BFF Swagger를 직접 포함한다.
이 섹션은 Tag 페이지에서 가장 먼저 확인할 수 있어야 한다.

포함 방식:

- Confluence에서 Swagger UI 또는 OpenAPI viewer로 바로 렌더링
- 사내 표준 BFF Swagger 매크로 사용
- OpenAPI YAML/JSON을 첨부하거나 붙여 넣더라도 사람이 다시 작성한 표로 관리하지 않음

포함 내용:

- API Tag
- Method / Path
- request schema
- response schema
- response status code
- error response
- enum 값
- example request/response
- 상태: Draft / Reviewing / Accepted / Implemented / Released / Deprecated
- 생성 기준: PR, commit, release 중 하나

#### API 목록

API 목록은 Tag 안에서 사람이 빠르게 훑을 수 있는 수준으로만 작성한다.
상세 request/response schema는 Swagger를 참조한다.

예시:

| Method | Path | 설명 | 상태 |
| --- | --- | --- | --- |
| POST | `/api/scan-jobs` | ScanJob 생성 | Draft |
| GET | `/api/scan-jobs/{scanJobId}` | ScanJob 조회 | Draft |
| POST | `/api/scan-jobs/{scanJobId}/cancel` | ScanJob 취소 | Draft |

#### Response 설명

response 설명은 Swagger schema를 다시 쓰는 곳이 아니다.
Swagger만으로 알기 어려운 해석 기준을 작성한다.

포함하면 좋은 내용:

- 주요 response 필드의 업무적 의미
- 상태값별 화면 표시 기준
- null, 빈 배열, 빈 문자열의 의미
- 실패/취소/진행 중 상태의 해석 기준
- 사용자가 취해야 할 액션
- 운영자가 확인해야 할 포인트
- 관련 enum/state 카탈로그 링크
- 관련 error code 카탈로그 링크

예시:

| Response 항목 | 설명 | 관련 기준 |
| --- | --- | --- |
| `status` | ScanJob의 현재 진행 상태 | Enum / 상태 카탈로그 |
| `statusReason` | 실패, 취소, 대기 상태의 사유 | 에러 코드 카탈로그 또는 운영 기준 |
| `progress` | 진행률 표시 기준. 정확한 완료율이 아닐 수 있음 | 화면 표시 정책 |

#### 변경/논의 이력 요약

Tag 페이지에는 논의 본문을 복사하지 않는다.
Tag에 어떤 변경이 있었는지만 요약하고, 상세는 API 관련 논의 문서로 연결한다.

예시:

| 날짜 | 상태 | 변경 유형 | 요약 | 관련 논의 |
| --- | --- | --- | --- | --- |
| 26.04.27 | Draft | Added | ScanJob API 신규 추가 논의 | `[26.04.27] ScanJob API 추가 관련 논의` |
| 26.05.02 | Released | Changed | 조회 response에 `statusReason` 추가 | `[26.05.02] ScanJob 응답 변경 관련 논의` |

### 7.4 `5.2.3.5.5.10.2 공통 규칙`

공통 규칙은 Tag와 무관하게 모든 BFF API에 적용되는 기준을 관리한다.

포함 내용:

- 인증/인가 규칙
- API version 정책
- deprecated 정책
- breaking/non-breaking 판단 기준
- pagination/filter/sort 규칙
- id, time, nullability 규칙
- 공통 에러 응답 형식
- 공통 response envelope 규칙

### 7.5 `5.2.3.5.5.10.2.1 에러 코드 카탈로그`

에러 코드 카탈로그는 코드나 Swagger의 값을 대체하는 원본이 아니다.
에러 코드의 운영 의미, 사용자 액션, 운영자 확인 포인트를 설명하는 기준 문서다.

각 항목은 최소 아래 필드를 가진다.

- 코드
- HTTP status
- 의미
- 발생 조건
- 재시도 가능 여부
- 사용자 액션
- 운영자 확인 포인트
- 관련 API Tag
- 관련 API
- 폐기 예정 여부
- 추가일 / 변경일

### 7.6 `5.2.3.5.5.10.2.2 Enum / 상태 카탈로그`

Enum / 상태 카탈로그는 코드나 Swagger의 enum 값을 다시 복사하는 표가 아니다.
값 목록의 원본은 코드 또는 Swagger로 두고, Confluence에는 값의 의미와 운영 기준을 둔다.

각 항목은 최소 아래 필드를 가진다.

- enum 이름
- 값
- 의미
- 사용 API Tag
- 사용 API
- 사용 화면 또는 사용 주체
- 폐기 예정 여부
- 비고

상태 전이가 중요한 값이면 아래를 추가한다.

- 허용 전이
- 전이 규칙
- 전이 실패 시 error code

### 7.7 `5.2.3.5.5.10.3 API 관련 논의`

`API 관련 논의`는 API 변경 제안과 변경 이력을 함께 관리하는 공간이다.
변경은 처음에는 논의로 시작하고, 이후 상태가 바뀌면서 확정, 구현, 배포 이력이 된다.

하위 문서 제목 규칙:

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

예시:

```text
## 대상

- API Tag: ScanJob
- 변경 유형: Added
- 관련 API:
  - POST /api/scan-jobs
  - GET /api/scan-jobs/{scanJobId}

## 논의 내용

- ScanJob 생성 API가 필요하다.
- 조회 response에는 상태, 진행률, 실패 사유가 필요하다.
- Approval Process와 연결되는 경우 승인 상태를 함께 해석해야 한다.

## 관련 BFF Swagger

- API Tag 페이지:
- BFF Swagger 섹션:
- Swagger 상태: Draft / Reviewing / Accepted / Implemented / Released / Deprecated

## 영향

- 화면:
- 사용 주체:
- enum/state 영향:
- error code 영향:

## 상태

- Draft / Reviewing / Accepted / Implemented / Released / Rejected

## 결정 사항

-

## 관련 링크

- API Tag 가이드:
- PR:
- 배포 링크:
```

## 8. API 변경 시 운영 흐름

신규 API 또는 큰 변경은 아래 흐름으로 관리한다.

1. API 관련 논의 하위에 `[yy.mm.dd] {API Tag 또는 주제} 관련 논의` 문서를 만든다.
2. 논의 문서에 대상 API Tag, 변경 유형, 관련 Method / Path, 논의 배경을 작성한다.
3. 해당 API Tag 페이지의 BFF Swagger 섹션에 변경할 Swagger를 포함한다.
4. 논의 문서에는 BFF Swagger를 중복 작성하지 않고 해당 Tag 페이지의 BFF Swagger 섹션을 참조한다.
5. API Tag 가이드의 해당 Tag 페이지에 변경/논의 이력 요약을 추가한다.
6. Tag 페이지의 BFF Swagger, response 설명, 주요 동작 규칙을 필요한 만큼 갱신한다.
7. 구현이 끝나면 논의 상태를 `Implemented`로 갱신하고 관련 PR을 연결한다.
8. 배포가 끝나면 논의 상태를 `Released`로 갱신하고 Tag 페이지의 BFF Swagger 상태를 `Released`로 갱신한다.

## 9. API 최종안의 정의

"최종안"은 하나가 아니라 단계별로 다르다.

| 구분 | 의미 | 확인 위치 |
| --- | --- | --- |
| 검토 확정안 | 논의가 끝나고 구현 기준으로 합의된 안 | API 관련 논의 상태가 `Accepted` |
| 구현 계약 | 코드와 PR에 반영된 안 | API Tag 페이지의 BFF Swagger + PR |
| 배포 계약 | 실제 사용 주체가 따라야 하는 안 | 상태가 `Released`인 BFF Swagger |

운영 원칙:

- 외부 사용 주체 기준 최종안은 `배포 계약`이다.
- 내부 개발 기준 다음 버전 최종안은 상태가 `Accepted`인 API 관련 논의다.
- Confluence에서 "최종안"이라고만 쓰지 않고, 위 단계 중 하나로 명시한다.

## 10. 비권장 패턴

- endpoint 하나마다 하위 페이지 하나 생성
- Swagger schema 전체를 사람이 작성한 표로 Confluence에 복사
- API Tag 페이지에 BFF Swagger를 포함하지 않고 외부 링크만 제공
- API Tag 가이드와 API 관련 논의에 같은 내용을 상세 중복 작성
- 변경 제안과 변경 이력을 별도 페이지에서 각각 중복 관리
- 상태가 `Draft`인 BFF Swagger를 배포 계약처럼 표현
- enum과 error code를 각 Tag 문서에 중복 기입
- 카탈로그를 코드나 Swagger보다 우선하는 값의 원본처럼 운영
- git log만으로 API 변경 이력을 대신함

## 11. 결론

이 전략의 핵심은 다음 다섯 가지다.

1. Swagger/OpenAPI는 API 계약의 원본으로 둔다.
2. API Tag 가이드는 Tag별 BFF Swagger, response 설명, 운영 규칙, 변경 요약을 담당한다.
3. API 관련 논의는 변경 제안과 변경 이력을 함께 관리한다.
4. 논의 문서 제목은 `[yy.mm.dd] {API Tag 또는 주제} 관련 논의` 형식을 따른다.
5. enum, state, error code는 운영 의미와 기준을 카탈로그로 분리한다.

이 구조를 따르면 ScanJob, Approval Process 같은 신규 API도 "BFF Swagger는 어디서 보는지", "response 의미는 어디서 보는지", "어떤 논의로 변경되었는지"를 사람이 유지 가능한 방식으로 확인할 수 있다.
