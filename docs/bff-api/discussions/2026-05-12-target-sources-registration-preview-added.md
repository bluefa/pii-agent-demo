# Target Sources Registration Preview API 추가

> Confluence: 5.2.3.5.5.10.3.x
> Confluence Title: [26.05.12] Target Sources Registration Preview API 추가 관련 논의
> 상태: Draft
> 작성일: 2026-05-12
> 마지막 수정일: 2026-05-12
> 대상 Tag: target-sources
> 변경 유형: Added
> 변경 방향: BE-first
> 담당: TBD
> 관련 PR: TBD

## 1. 논의 배경

SIT Prototype v7 의 인프라 등록 모달은 Phase 1(입력) → Phase 2(등록 내용 확인) 전이 시점에 사용자가 입력한 `(provider + 식별자 + dbTypes[])` 을 **N개의 미래 타겟소스 후보** 로 전개해 보여줘야 한다. 또한 각 후보가 동일 서비스 스코프에서 기존 타겟소스와 중복(`DUPLICATE`)인지 신규(`ADD`)인지 표시해야 한다.

기존 `POST /services/{serviceCode}/target-sources` 는 1건만 생성하며, 중복 판정 사전 조회용 엔드포인트가 없어 클라이언트가 직접 list 응답을 순회 비교해야 했다.

원 문서: `docs/reports/sit-v7-target-source-list-bff-gaps.md` §I.

## 2. 논의 내용

- 별도 preview 엔드포인트(`/registration-preview`) vs `create` 의 `dryRun=true` 플래그: dry-run 플래그는 의미 모호 + 응답 shape 분기 필요 → 별도 path 채택.
- 응답 shape: 평면 배열 vs `{ items: [...] }` envelope: envelope 채택 (향후 pagination/metadata 확장 여지).
- `ADD`/`DUPLICATE` 표현: discriminated `oneOf` (`type` 디스크리미네이터) 채택 — 추가 필드(`existing_target_source_id`) 가 DUPLICATE 분기에만 등장하기 때문.
- 카테고리/모드: 기존 `awsRegionType: 'global'|'china'`, `awsInstallationMode: 'AUTO'|'MANUAL'` enum 대신 boolean (`isChinaRegion`, `isTerraformExecutionGranted`) 채택. SIT v7 신규 API 부터 적용, 기존 enum 은 `CreateTargetSourceRequest` 에서 `deprecated` 표시 후 한시 유지.

## 3. 관련 BFF Swagger 위치

- Tag 가이드: `../tag-guides/target-sources.md`
- 인라인 BFF Swagger 섹션 상태: Draft

## 4. 영향

- 화면 / 사용 주체: `/integration/admin` 인프라 등록 모달 Phase 2 (`ProjectCreateModal`)
- enum / state 영향:
  - 신규 enum: `RegistrationPreviewItemType` (ADD | DUPLICATE)
  - `CreateTargetSourceRequest` 에 boolean 필드 (`isChinaRegion`, `isTerraformExecutionGranted`), 식별자 필드 (`awsLinkedAccountId`), 싱귤러 `dbType` 추가
  - `awsRegionType` deprecated
- error code 영향: 없음 (`400 BadRequest` 카탈로그 재사용)
- 다른 Tag 영향: 없음 (Target Sources 단독)

## 5. 결정 사항

- 신규 path: `POST /install/v1/target-sources/services/{serviceCode}/target-sources/registration-preview`
- 신규 스키마: `RegistrationPreviewRequest`, `RegistrationPreviewItemCommon`, `RegistrationPreviewItemAdd`, `RegistrationPreviewItemDuplicate`, `RegistrationPreviewItem` (oneOf), `RegistrationPreviewResponse`
- Duplicate 판정 키 (동일 서비스 스코프):
  - AWS: `(cloud_provider, aws_account_id, is_china_region, db_type)`
  - Azure: `(cloud_provider, subscription_id, db_type)`
  - GCP: `(cloud_provider, gcp_project_id, db_type)`
  - IDC: `(cloud_provider, description_trimmed, db_type)`
  - SDU: 직접 입력 미지원
- 인덱스 매칭: `items[i]` ↔ 요청 `dbTypes[i]`, 응답에 `db_type` echo 안 함.

## 6. 후속 작업

- 인프라 등록 모달 Phase 2 카드 리스트 UI 작업 (별도 PR — UI 마이그레이션 스코프)
- `TargetSourceSummary` 신규 필드 (§A) BE 합의 후 후속 BFF PR
- 실제 BFF (`USE_MOCK_DATA=false`) 측 구현 (현재는 mock 만 보유)

## 7. 관련 링크

- 관련 Tag 가이드 변경 이력 행: target-sources.md §3 API 목록 신규 행
- 백엔드 PR / 릴리스 노트: TBD
- 운영 Slack thread / 인시던트 ID: 없음
