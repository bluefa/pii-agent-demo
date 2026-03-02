# PR Context Review (20-Point) + Retro

- Date: 2026-03-02
- PR: #209 (`feat/athena-memory-summary`)
- Reviewed head baseline: `db7f021d89b60702b9a9fd04e2c8c370c4fdfdc0`
- Review method: `pr-context-review` 절차 + 20개 체크포인트 점검

## 1) 20-Point Checklist

| # | Checkpoint | Result | Notes |
|---|---|---|---|
| 1 | PR description vs 실제 범위 일치 | FAIL | PR 본문이 초기 docs-only 설명으로 남아 최신 구현 범위를 반영하지 못함 |
| 2 | 최신 head 동기화 확인 | PASS | `refs/remotes/origin/pr-209` 확인 |
| 3 | Swagger에 Athena 하위 endpoint 정의 | PASS | `docs/swagger/confirm.yaml` 확인 |
| 4 | include_all_tables가 POST body 전용인지 | PASS | GET 응답 schema에서는 제거됨 |
| 5 | resources 응답에 ATHENA_REGION 포함 | PASS | `mockConfirm.getResources`에서 포함 |
| 6 | resources metadata에 athena_region 포함 | PASS | `metadata.athena_region` 포함 |
| 7 | scan mock이 Athena table 단위 생성 | PASS | `lib/mock-scan.ts` 확인 |
| 8 | approval-request drill-down pagination | PASS | DB/TABLE endpoint + page/size 확인 |
| 9 | approval-history drill-down pagination | PASS | DB/TABLE endpoint 확인 |
| 10 | confirmed-integration drill-down pagination | PASS | DB/TABLE endpoint 확인 |
| 11 | approved-integration drill-down pagination | PASS | DB/TABLE endpoint 확인 |
| 12 | 요청 시점 resolved snapshot 사용 | PASS | snapshot store + endpoint 분기 확인 |
| 13 | include_all_tables 유도(대량 table 대응) | PASS | 룰 기반 resolved + rule limit 존재 |
| 14 | approval-request submit 시 Athena exclude 규칙 보존 | PASS | selected=false 규칙 필터 유지 |
| 15 | 연동대상확정 화면 Athena UI 위치 | FAIL | 기존엔 분리된 섹션이었고 row click 동작과 불일치 |
| 16 | Athena Region row 클릭 시 DB/Table 선택 진입 | FAIL | 기존은 readonly tree 중심이어서 선택 플로우 단절 |
| 17 | Athena Region을 table로 잘못 확장하는지 | FAIL | Region resource가 가짜 `default/<id>` table로 변환되는 결함 발견 |
| 18 | mock resource_id 형식 검증 테스트 | PASS | `athena-mock-resource-id-format.test.ts` |
| 19 | Athena 관련 타입 정합성 | PASS | `AthenaSelectionRule`, region summary 타입 검증 |
| 20 | 변경 후 빌드/타입/테스트 검증 | PASS | `tsc`, 관련 vitest, `build` 통과 (lint는 베이스 이슈 1건 존재) |

## 2) 실제 수정한 결함

1. Athena 선택 UI 위치 오류 (요구사항 불일치)
- 문제: `연동 대상 확정 - Athena Database/Table 선택`이 테이블 하단 분리 영역에 표시됨.
- 수정: Athena Region resource row를 클릭했을 때 해당 row 확장 영역에서 `AthenaRuleBuilder`가 열리도록 변경.
- 파일:
  - `app/projects/[projectId]/aws/AwsProjectPage.tsx`
  - `app/components/features/ResourceTable.tsx`
  - `app/components/features/resource-table/*`
  - `app/components/features/resource-table/ResourceRow.tsx`

2. Athena Region이 가짜 table로 확장되는 결함
- 문제: `extractAthenaTables()`가 region-level resource를 table로 fallback 변환해서 가짜 database/table을 생성.
- 영향: DB 목록에 실제 없는 `default/<resource-id>`가 나타날 수 있음.
- 수정:
  - region/database level resource는 table 목록에서 제외
  - region summary는 project의 Athena region 집합 + 실제 table count로 재구성
- 파일:
  - `lib/api-client/mock/athena.ts`
  - `lib/api-client/mock/confirm.ts`
  - `lib/__tests__/mock-confirm-athena.test.ts` (회귀 테스트 추가)

## 3) 왜 잘못 구현되었는가 (원인)

1. UI 진입점 기준이 늦게 고정됨
- 초기 구현이 "분리된 Athena 패널" 방향으로 진행되었고, 이후 "region row click inline"으로 요구가 확정됨.

2. 데이터 모델 경계가 코드에서 느슨했음
- region-level resource와 table-level resource를 같은 추출 함수에서 fallback 처리하면서 경계가 무너짐.

3. 승인/확정/히스토리/리소스 조회 요구가 동시에 확장됨
- API/Mock/UI/문서를 동시에 바꾸면서 검증 포인트가 많아졌고, 중간 합의가 누락된 상태에서 구현 반복이 발생.

## 4) 구현 시간이 길어진 이유

1. 요구사항이 단계별로 진화했고, 각 단계의 "완료 정의(DoD)"가 명시적으로 잠기지 않음.
2. UI 합의(위치/트리 동작/체크 규칙)가 문서-코드 동기화 전에 여러 번 변경됨.
3. mock 데이터 구조와 UI 요구가 분리되어 검증되면서, 실제 화면에서 역행 이슈가 늦게 발견됨.

## 5) 다음부터 사용자(요청자)가 확인하면 좋은 체크포인트

1. 단계별 승인 게이트 명시
- 예: `Swagger 확정 -> UX 확정 -> Mock 확정 -> UI 구현` 순으로 각 단계 승인 후 다음 단계 진행.

2. UI 완료 정의를 문장 3개로 고정
- 예: "어디를 클릭하면", "무엇이 열리고", "무엇을 선택할 수 있는지"를 반드시 고정.

3. 데이터 경계 고정
- region/database/table 중 어떤 레벨이 API 응답, 어떤 레벨이 내부 계산인지 먼저 고정.

4. 검증 시나리오 고정
- 최소 3개: (a) region only, (b) region+table mix, (c) 대량 table(include_all_tables) 시나리오.

5. PR 본문 갱신 강제
- PR description이 최신 범위와 다르면 리뷰 오해가 커지므로, 주요 방향 변경 시 즉시 업데이트.
