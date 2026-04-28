# BFF API 문서

> Confluence: 5.2.3.5.5.10.0 (개요)
> 상태: Draft
> 작성일: 2026-04-27
> 마지막 수정일: 2026-04-28
> 대상: BFF API 문서를 읽거나 작성하는 개발자, 기획자, QA, 운영 담당자

이 디렉터리는 BFF API에 대한 Tag별 가이드, 카탈로그, 관련 논의를 모은 곳이다.
각 Tag 페이지에는 해당 Tag의 BFF Swagger를 직접 포함하고, Swagger만으로 알기 어려운 업무적 의미와 운영 기준을 함께 관리한다.

문서 관리 전략의 자세한 근거는 [strategy.md](./strategy.md)에, 운영 워크플로우와 자동화 정책은 [management-plan.md](./management-plan.md)에 정리되어 있다.

## 1. 디렉터리 구조

```text
docs/bff-api/
├── README.md                  # 이 문서. 진입점/인덱스
├── strategy.md                # 문서 관리 전략 (왜 이렇게 관리하는가)
├── management-plan.md         # 운영 워크플로우 (어떻게 관리하는가)
├── tag-guides/                # API Tag별 가이드
├── catalogs/                  # 공통 카탈로그 (error code, enum/state)
└── discussions/               # API 변경 논의 로그
```

Confluence 트리와의 매핑은 각 문서 본문 상단의 `> Confluence:` 라인에서 확인할 수 있다.

## 2. API Tag 가이드

| API Tag | 파일 | 상태 | 비고 |
| --- | --- | --- | --- |
| Target Sources | [target-sources.md](./tag-guides/target-sources.md) | Draft | Target source 조회·생성·설치 확인 |
| Scan Jobs | [scan-jobs.md](./tag-guides/scan-jobs.md) | Draft | Scan job 실행·상태·이력 |
| Resource Recommendations | [resource-recommendations.md](./tag-guides/resource-recommendations.md) | Draft | 추천 리소스 조회 |
| Approval Requests | [approval-requests.md](./tag-guides/approval-requests.md) | Draft | 승인 요청 흐름 |
| Installation Status | [installation-status.md](./tag-guides/installation-status.md) | Draft | 설치 상태 조회 |
| Database Credentials | [database-credentials.md](./tag-guides/database-credentials.md) | Draft | DB 자격증명 관리 |
| Cloud Permission | [cloud-permission.md](./tag-guides/cloud-permission.md) | Draft | Cloud 권한 검증 |
| Users | [users.md](./tag-guides/users.md) | Draft | 사용자 조회 |
| Services | [services.md](./tag-guides/services.md) | Draft | 서비스 메타 |
| Test Connection | [test-connection.md](./tag-guides/test-connection.md) | Draft | 연결 테스트 |
| Admin Guides | [admin-guides.md](./tag-guides/admin-guides.md) | Implemented | Admin guide CMS |

## 3. 공통 카탈로그

| 카탈로그 | 파일 | 비고 |
| --- | --- | --- |
| 에러 코드 카탈로그 | [error-codes.md](./catalogs/error-codes.md) | error code 의미·발생 조건·사용자 액션 |
| Enum / 상태 카탈로그 | TBD | enum, state 의미와 전이 규칙 (예정) |

## 4. API 관련 논의

API 변경 제안과 변경 이력은 [`discussions/`](./discussions/) 하위에 모은다.
파일명 규칙: `YYYY-MM-DD-{tag-slug}-{topic-slug}.md` (예: `2026-04-27-scan-jobs-added.md`).
인덱스와 작성 템플릿은 [discussions/README.md](./discussions/README.md)를 참고한다.

## 5. 목적별 진입 경로

| 목적 | 먼저 볼 위치 | 다음 확인 위치 |
| --- | --- | --- |
| 특정 Tag의 최신 API 확인 | 해당 Tag 가이드 | BFF Swagger 섹션 |
| Tag의 request/response schema 확인 | 해당 Tag 가이드 | BFF Swagger 섹션 (인라인 YAML) |
| response 값의 업무적 의미 확인 | 해당 Tag 가이드 | response 설명 섹션 |
| 신규 API 논의 확인 | `discussions/` | 관련 Tag 가이드의 변경/논의 이력 요약 |
| 배포된 최종 API 확인 | 해당 Tag 가이드 | 상태가 `Released`인 BFF Swagger |
| API 변경 이력 확인 | 해당 Tag 가이드 | 관련 discussion 문서 |
| error code 의미 확인 | [에러 코드 카탈로그](./catalogs/error-codes.md) | 관련 Tag 가이드 |

## 6. Tag 가이드에 포함되는 내용

각 Tag 가이드는 해당 Tag를 이해하기 위한 중심 문서다. 최소 아래 항목을 포함한다.

- Tag 이름, 상태, 담당, 마지막 수정일, Confluence path
- BFF Swagger (인라인 YAML, 상태 명시)
- 관련 PR 링크
- 주요 사용 화면 또는 사용 주체
- API 목록 (Method / Path / 설명 / 상태)
- response 설명 (Swagger schema 복사가 아니라 운영 의미)
- 관련 enum/state · error code 링크
- 변경/논의 이력 요약 표

## 7. 상태 정의

| 상태 | 의미 |
| --- | --- |
| Draft | 초안 작성 중 |
| Reviewing | 검토 중 |
| Accepted | 구현 기준으로 합의됨 |
| Implemented | 코드 또는 PR에 반영됨 |
| Released | 배포되어 사용 주체가 따라야 하는 기준 |
| Deprecated | 폐기 예정 |
| Rejected | 논의 결과 채택하지 않음 |

## 8. 운영 원칙 (요약)

- API 계약의 원본은 Swagger/OpenAPI다. 이 디렉터리의 Tag 가이드 인라인 YAML은 Tag 단위의 사람이 읽는 사본이다.
- Tag 가이드에는 변경/논의 이력 요약만 두고, 상세 논의는 `discussions/` 문서로 분리한다.
- enum, state, error code는 Tag 가이드에 중복 기입하지 않고 카탈로그로 연결한다.
- 배포 전 Swagger는 상태(Draft / Reviewing / Accepted / Implemented)를 명시하고, 배포 후에는 `Released`로 갱신한다.

자세한 비권장 패턴과 결정 근거는 [strategy.md](./strategy.md), 운영 워크플로우는 [management-plan.md](./management-plan.md)를 참고한다.
