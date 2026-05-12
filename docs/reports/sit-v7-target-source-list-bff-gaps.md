# SIT v7 — 서비스별 타겟소스 목록 조회 페이지 BFF 갭 Todo

> 작성일: 2026-05-12
> 대상 시안: `design/SIT Prototype v7 - standalone.html` — `screen-3` ("03 Service List · 인프라 목록") + 인프라 등록 모달
> 현행 페이지: `/integration/admin` (`AdminDashboard.tsx`)
> 선행 문서: [sit-prototype-migration-plan.md](./sit-prototype-migration-plan.md) (v1 시안 기준, 아코디언 카드 디자인 — v7에서 flat row로 교체됨)

---

## 0. 목적과 범위

SIT Prototype v7의 screen-3 + 인프라 등록 모달을 그대로 구현하려 할 때, **현행 BFF 계약(`docs/swagger/user.yaml`, `azure-page-apis.yaml`)으로 커버되지 않는 데이터/엔드포인트**를 식별하고 후속 합의 항목으로 남긴다.

UI 작업(마크업, 토큰 적용, 라우팅)은 별도 PR로 진행하며, 이 문서는 **백엔드/도메인 결정이 필요한 항목만** 다룬다.

---

## 1. v7 screen-3 요구 데이터 정리

### 1-1. Service Header (서비스 단일 컨텍스트)

| 필드 | v7 표기 예 | 현행 가용성 |
|---|---|---|
| 서비스 코드 pill | `SERVICE-A` | ✅ `ServicePageResponse.content[].serviceCode` |
| 서비스명 (타이틀) | `서비스 A` | ✅ `serviceName` |
| 서비스 운영 상태 pill | `운영 중` | ❌ **없음** (§2-E) |
| 담당자 | `김민수 · 박지영` | ✅ `GET /services/{code}/authorized-users` 추가 호출 |
| 총 인프라 카운트 | `5` | ✅ `target-sources.length` |
| 최근 업데이트 | `2분 전` | ❌ **부분** — list 응답에 `updated_at` 누락 (§2-B) |

### 1-2. List Toolbar

| 요소 | v7 표기 | 현행 가용성 |
|---|---|---|
| 전체 카운트 | `전체 5개 인프라` | ✅ |
| 검색 (Provider, 계정, DB 이름) | `Provider, 계정, DB 이름으로 검색` | ❌ server-side 검색 미지원 (§2-F), client-side로 우회 가능 |
| 필터 버튼 | (UI만) | ✅ UI 정적 |

### 1-3. Row 표시 필드

| 컬럼 | AWS row | Azure row | GCP row | SDU row | 현행 가용성 |
|---|---|---|---|---|---|
| Provider 로고 | `AWS` | `Azure` | `GCP` | **SDU 아이콘** | ✅ `cloud_provider` (`is_sdu_type=true` 시 SDU 아이콘 우선) |
| Provider sub | `Global` / `China` | — | — | — | ❌ list 응답에 `is_china_region` 없음 (§2-A) |
| 계정 라벨 | `Payer / Linked Account` | `Tenant / Subscription` | `Project` | (provider별 식별자 동일) | — |
| 계정 값 | `12345-6789012` / `9876-5432-1098` | `9822f9a9-…` / `28674067-…` | `sea-data-platform-72` | — | ❌ list 응답에 provider 식별자 없음 (§2-A) |
| 모니터링 | `AWS Agent` / `Azure Agent` / `GCP Agent` | (좌동) | (좌동) | `SDU` | ✅ `cloud_provider` + `is_sdu_type` 에서 파생 |
| Status pill | `Healthy` / `Partial` / `Unhealthy` / `연동 대기` | (좌동) | (좌동) | (좌동) | ❌ health rollup 없음 (§2-C) |
| Kebab 메뉴 | (상세 보기 / 인프라 삭제) | (좌동) | (좌동) | (좌동) | ✅ 기존 메뉴 재사용 |

> **참고**:
> - AWS는 Payer/Linked 두 줄 표시 → 현행 도메인은 `awsAccountId`(단일)만 가지므로 §D 결정 필요. GCP는 Project ID 한 줄만 표시 (Org 도입 불필요).
> - SDU 표시: `is_sdu_type=true` 시 provider 로고 위치에 SDU 아이콘/이모티콘을 표시하며, 이는 `cloud_provider` 값보다 우선한다.

---

## 2. BFF/도메인 갭 Todo

### A. List 응답에 provider-specific 식별자 + boolean 카테고리 플래그 추가 (필수)

- **현황**: `GET /services/{serviceCode}/target-sources` 응답 (`TargetSourceSummary`)은 `target_source_id`, `project_code`, `description`, `cloud_provider`, `process_status`, `is_integrated`, `created_at`만 반환. 디테일(`TargetSourceDetail`)에는 `metadata`로 provider 식별자가 있으나 list에는 없음.
- **문제**: v7 row가 row마다 provider 식별자 + 카테고리(China 파티션 / SDU 여부 / TF 권한 부여 여부)를 표시하므로 N+1 detail fetch 회피 위해 list 응답에 포함 필요.
- **필드 네이밍 정책 (확정)**:
  - 카테고리/모드는 **boolean flag** 로 표현한다. 기존 enum (`aws_region_type: 'global'|'china'`, `aws_installation_mode: 'auto'|'manual'`) 패턴은 신규 응답에서 사용하지 않는다.
  - `is_china_region: boolean` — AWS China 파티션 여부 (그 외 provider 에서는 false)
  - `is_sdu_type: boolean` — BFF 가 SDU 모듈로 처리할 대상이라고 판단했는지. UI 는 true 일 때 SDU 아이콘 표시.
  - `is_terraform_execution_granted: boolean` — AWS 한정. Terraform 실행 권한이 BDC 에 부여되도록 결정되었는지 (구 `aws_installation_mode='auto'` 의미).
- **제안**: `TargetSourceSummary` 에 다음 필드를 추가.
  - AWS: `aws_account_id` (Payer), `aws_linked_account_id` (§D), `is_china_region`, `is_terraform_execution_granted`
  - Azure: `tenant_id`, `subscription_id`
  - GCP: `gcp_project_id`
  - 공통: `is_sdu_type`
- **작업 범위**: `docs/swagger/user.yaml`, `docs/swagger/azure-page-apis.yaml`의 `TargetSourceSummary`/`AdminTargetSourceSummary`에 필드 추가 → upstream 구현 → mock(`lib/bff/mock/target-sources.ts`) 보강.
- **선행 합의자**: BFF 팀
- **우선순위**: 🔴 High — UI 구현의 핵심 차단 항목

### B. List 응답에 `updated_at` 추가

- **현황**: `TargetSourceSummary`는 `created_at`만 포함, `updated_at` 없음. 디테일에는 있음.
- **목적**: 헤더의 "최근 업데이트 2분 전" 계산 (서비스 단위 최근 갱신 시점은 row별 `updated_at`의 max).
- **대안**:
  1. `TargetSourceSummary.updated_at` 추가 → 클라이언트에서 max 집계 (권장)
  2. 서비스 페이지 응답(`ServicePageResponse.content[]`)에 `updated_at` 추가
- **우선순위**: 🟡 Mid — 헤더 메타 표시 누락 (값 없으면 "—"로 graceful degrade)

### C. Health rollup 필드 (Healthy / Partial / Unhealthy / 연동 대기)

- **현황**: 현 도메인은 설치 워크플로우 상태(`process_status`, `ProcessStatus` enum)와 단편 정보(`hasDisconnected`, `connectionTestComplete`)만 보유. 운영 health rollup은 없음.
- **v7 의도 추정**:
  - `연동 대기` ≈ `process_status ∈ {WAITING_APPROVAL, APPLYING_APPROVED, WAITING_TARGET_CONFIRMATION}` (설치 워크플로우 진행 중)
  - `Healthy / Partial / Unhealthy` ≈ 설치 완료(`process_status = INSTALLATION_COMPLETE`) 이후 운영 health
- **결정 필요**:
  - 정의: "Partial"의 정확한 기준 (DB 일부 disconnected? 일부 unhealthy?)
  - 데이터 소스: BFF에서 산정해서 enum으로 줄지, 클라이언트에서 row별 sub-data로 계산할지
- **제안**: `TargetSourceSummary.health_status` (enum: `PENDING` | `HEALTHY` | `PARTIAL` | `UNHEALTHY` | `UPDATING`) — `process_status`와 직교
- **우선순위**: 🔴 High — v7 row의 핵심 시각 요소
- **선행 합의자**: BFF + 도메인(PII Agent 모니터링)

### D. AWS Payer / Linked Account 모델링 + TF 권한 부여 플래그

- **현황**: 도메인은 `awsAccountId`(단일 12자리)만 보유. 설치 모드는 `AwsInstallationMode = 'AUTO' | 'MANUAL'` enum.
- **v7 요구**: Payer Account / Linked Account 두 값 표시 + 인프라 등록 모달에서도 두 필드 입력. AUTO/MANUAL 의미를 의미를 더 잘 드러내는 이름으로 변경.
- **참고**: legacy 스펙(`swagger-yaml.yaml#InfrastructureInfo.provider_details`)에 `aws_payer_account` / `aws_linked_account` 필드는 정의되어 있으나 실제 사용 엔드포인트 없음 (phantom schema).
- **결정 (이 문서 기준)**:
  - Payer/Linked 도메인을 정식 도입. `aws_account_id` 를 Payer 역할로 재정의하고 `aws_linked_account_id` 신규 필드 추가.
  - 설치 모드는 boolean `is_terraform_execution_granted` 로 표현 (구 `aws_installation_mode='auto'` ≡ `is_terraform_execution_granted=true`). 의미: "Terraform 실행 권한을 BDC 에 부여하기로 결정되었다".
  - AWS region 도 boolean `is_china_region` 으로 표현 (구 `aws_region_type='china'` ≡ `is_china_region=true`).
- **적용 범위**:
  - 신규 preview API (§I): 새 네이밍 즉시 적용 ✅
  - **`CreateTargetSourceRequest`** : 본 문서 범위에 포함 ✅. `awsLinkedAccountId`, `isChinaRegion`, `isTerraformExecutionGranted`, 싱귤러 `dbType` 신규 추가. 기존 `awsRegionType` enum 은 `deprecated` 표시 후 한시 유지. (Phase 3 `다음→등록하기` 호출 경로 일관성 확보 — Codex Critical #1 대응)
  - `TargetSourceSummary` / `TargetSourceDetail`: 후속 마이그레이션 (호환성 검토 필요). 본 문서 범위 외.
- **우선순위**: 🔴 High — 등록 preview API(§I)의 입력 스키마에 직결

### E. 서비스 운영 상태 (`운영 중` pill)

- **현황**: 서비스 레벨 운영 상태 필드 없음.
- **v7 요구**: 헤더에 `운영 중` 정적 pill.
- **결정 필요**:
  - 옵션 1: 정적 표시 — pill을 hardcode (단기)
  - 옵션 2: 클라이언트 계산 — `target-sources` 중 1+개 healthy 있으면 `운영 중`, 전부 pending이면 `준비 중` 등
  - 옵션 3: `ServicePageResponse.content[]`에 `operational_status` 필드 추가
- **권장**: 단기는 옵션 1 → 정의 명확해지면 옵션 3 마이그레이션
- **우선순위**: 🟢 Low — 의미가 모호하면 UI 정적으로 시작 가능

### F. List server-side 검색

- **현황**: `GET /services/{serviceCode}/target-sources`에 `query` 파라미터 없음.
- **v7 요구**: Provider / 계정 / DB 이름으로 검색 (`Provider, 계정, DB 이름으로 검색`).
- **권장**:
  - 1단계: client-side filter (목록을 일괄 로드하는 현행 구조에서 충분히 가능)
  - 2단계: list 크기가 늘면 BFF `?query=` 파라미터 추가
- **우선순위**: 🟢 Low — client-side 1차로 충분

### G. 인프라 삭제 (`인프라 삭제` 메뉴)

- **현황**: `ManagementSplitButton`의 `인프라 삭제` 메뉴는 현재 `toast.info('삭제 미구현')`만 출력. 실제 DELETE endpoint 없음.
- **v7 요구**: kebab 메뉴에서 삭제 액션.
- **결정 필요**: 삭제 운영 정책 (소프트 삭제? 승인 워크플로우? 단순 DELETE?).
- **참고**: 이 항목은 v1 plan의 후속 재검토 사항에도 포함되어 있음.
- **우선순위**: 🟡 Mid — 메뉴 자체는 disabled 유지하고 운영 정책 결정 시 활성화

### H. 인프라 등록 — 단건 생성 vs 다건 일괄 생성

- **현황**: `POST /services/{serviceCode}/target-sources`는 1회 호출당 타겟소스 1개 생성. v7 등록 모달은 N개를 한 번에 등록한다.
- **v1 plan 결정**(C-02): `Promise.all(createTargetSource)`로 클라이언트가 N번 호출하는 누적형 유지.
- **v7 후속 검토 여지**: 등록 모달 Phase 3가 진행률 표시까지 포함하므로 bulk endpoint 도입 시 더 안정적. 다만 우선은 v1 결정 유지로 진행.
- **우선순위**: 🟢 Low — 기능적으로 현행으로 충분

### I. 인프라 등록 모달 "다음" — Registration Preview API ✅ (user.yaml 정의 완료, Tag guide 업데이트 후속, 구현은 wave-task)

- **트리거**: 등록 모달 Phase 1("입력") → Phase 2("등록 내용 확인")로 넘어가는 `다음` 버튼.
- **목적**: 사용자가 입력한 `(provider + 식별자 + DB Type 목록)`을 **N행으로 전개**하고, 각 행이 기존 타겟소스와 충돌하는지(`DUPLICATE`) 또는 신규(`ADD`)인지 표시한다.
- **엔드포인트**: `POST /services/{serviceCode}/target-sources/registration-preview`
- **Swagger 위치**: `docs/swagger/user.yaml` — `RegistrationPreviewRequest`, `RegistrationPreviewItem`, `RegistrationPreviewResponse` 스키마 + `previewServiceTargetSourceRegistration` operation.

#### I-1. 요청 (camelCase body)

```jsonc
{
  "cloudProvider": "AWS",                  // enum: AWS|Azure|GCP|IDC|SDU
  "awsAccountId": "123456789012",          // AWS Payer
  "awsLinkedAccountId": "987654321098",    // AWS Linked (미입력 시 Payer=Linked)
  "isChinaRegion": false,                  // AWS 한정. true=China, false=Global
  "isTerraformExecutionGranted": true,     // AWS 한정. true=BDC 자동 배포, false=수동 가이드
  "tenantId": "...",                       // Azure 한정
  "subscriptionId": "...",                 // Azure 한정
  "gcpProjectId": "...",                   // GCP 한정
  "description": "사업부 결제 DB",          // 선택 (IDC 는 식별자로 사용)
  "dbTypes": ["MYSQL", "POSTGRESQL"]       // 1+개. 응답 행 개수와 동일
}
```

#### I-2. 응답 (snake_case, POST raw passthrough)

> **인덱스 매칭**: `items[i]` 는 요청 `dbTypes[i]` 와 1:1 대응한다. `items.length === dbTypes.length` 가 보장되며, 응답에는 `db_type` 을 별도로 echo 하지 않는다. UI 는 요청 시점에 가진 `dbTypes` 를 인덱스로 참조한다.

```jsonc
// 요청 dbTypes 가 ["MYSQL", "POSTGRESQL"] 인 경우
{
  "items": [
    // items[0] ↔ dbTypes[0] = "MYSQL"
    {
      "type": "ADD",                              // | "DUPLICATE"
      "cloud_provider": "AWS",
      "aws_account_id": "123456789012",
      "aws_linked_account_id": "987654321098",
      "is_china_region": false,
      "is_sdu_type": false,                       // BFF 가 결정. true 면 UI 가 SDU 아이콘 사용
      "is_terraform_execution_granted": true,
      "description": "사업부 결제 DB"
    },
    // items[1] ↔ dbTypes[1] = "POSTGRESQL"
    {
      "type": "DUPLICATE",
      "cloud_provider": "AWS",
      "aws_account_id": "123456789012",
      "aws_linked_account_id": "987654321098",
      "is_china_region": false,
      "is_sdu_type": false,
      "is_terraform_execution_granted": true,
      "existing_target_source_id": 1001            // DUPLICATE 일 때만 존재
    }
  ]
}
```

#### I-3. 핵심 규칙

- **타겟소스 생성 추천 로직**: 각 응답 행 = 미래의 타겟소스 1개. 입력 `dbTypes` 길이만큼 N행 반환.
- **Phase 3 동작**: ADD 행마다 `POST /services/{serviceCode}/target-sources` 1회씩 호출 (N회). DUPLICATE 행은 사용자 결정으로 스킵 또는 안내.
- **인덱스 매칭**: `items[i]` ↔ 요청 `dbTypes[i]`. 응답에 `db_type` echo 안 함. UI 가 요청 배열 순서를 보존한 상태에서 인덱스로 참조 (정렬·필터하지 않을 책임).
- **Duplicate 판정 키** (동일 서비스 스코프):
  - AWS: `(cloud_provider, aws_account_id, is_china_region, db_type)`. `aws_linked_account_id`, `is_terraform_execution_granted` 는 identity 에 포함되지 않음.
  - Azure: `(cloud_provider, subscription_id, db_type)`. `tenant_id` 는 부가 정보.
  - GCP: `(cloud_provider, gcp_project_id, db_type)`.
  - IDC: `(cloud_provider, description_trimmed, db_type)`. trim 후 빈 문자열이면 400.
- **정규화**: `dbType` 은 대소문자 무시 비교. 식별자 (account/subscription/project id) 는 trim 후 대소문자·하이픈 보존.
- **`DUPLICATE` 행**: `existing_target_source_id` 가 반드시 함께 반환 (oneOf 로 schema-required). UI 카드에서 기존 항목으로 이동 링크 제공.
- **`is_sdu_type=true`**: UI 는 provider 로고 자리에 SDU 아이콘을 표시하고, 모니터링 라벨을 `SDU` 로 표기. 본 응답 한정 단일 권위.
- **부수효과 없음**: dry-run. 실제 생성은 후속 `POST /services/{serviceCode}/target-sources` 에서 수행.

#### I-4. 구현 작업 (wave-task)

본 문서는 Swagger 스펙 정의까지만 다룬다. 다음 구현은 별도 wave-task spec 에서 진행한다:

1. `lib/bff/types/target-sources.ts` — `RegistrationPreviewRequest` / `RegistrationPreviewItem` (oneOf ADD/DUPLICATE) / `RegistrationPreviewResponse` 타입 추가. 기존 `CreateTargetSourceResult` 도 신규 필드 (`awsLinkedAccountId` 등) echo 가능하도록 확장.
2. `lib/bff/types.ts` `BffClient.targetSources` 에 `previewRegistration` 시그니처 추가. `create` 의 body 타입에 신규 필드 반영.
3. `lib/bff/mock/target-sources.ts` — `previewRegistration` mock. 중복 검사 키는 §I-3 의 provider 별 duplicate key 정의를 따름. `create` mock 도 신규 필드 수용.
4. `lib/bff/mock-adapter.ts` / `lib/bff/http.ts` — 와이어링.
5. `app/integration/api/v1/services/[serviceCode]/target-sources/registration-preview/route.ts` — Next.js route handler (`withV1` + `bff.targetSources.previewRegistration`).
6. `app/lib/api/index.ts` — 프론트엔드 wrapper 함수 (`previewTargetSourceRegistration`, `createTargetSource` 인자 확장).
7. **Tag guide 후속**: `docs/bff-api/tag-guides/target-sources.md` 에 registration-preview path 추가 + 변경 사항 discussion 등록 (`/bff-api-docs` 워크플로우 요구사항).

- **우선순위**: 🔴 High — 등록 모달 Phase 1→2 전이의 차단 항목.

---

## 3. UI 작업 (BFF 변경 없음, 별도 PR)

이 섹션은 **즉시 적용 가능**한 UI 항목 — 본 문서 범위 밖이지만 참조용으로 정리.

1. `AdminDashboard` Service Header를 v7 디자인으로 교체: code pill + 운영중 pill(정적) + 큰 타이틀 + 메타 1줄(담당자/총 인프라/최근 업데이트). 담당자는 `getPermissions(serviceCode)` 추가 호출.
2. List Toolbar 추가 (전체 카운트 + 검색 + 필터 — 검색은 client-side).
3. `InfraCard` (아코디언) → flat row 디자인으로 교체. row의 provider 식별자 셀은 §A 적용 전까지 fallback "—" 또는 cloudProvider만 표시.
4. Status pill은 §C 적용 전까지 `process_status` 기반 매핑으로 부분 동작 (Healthy/Partial/Unhealthy 분기 불가, "연동 대기"/"운영 중"만 표시).
5. `ProjectCreateModal` Phase 1→2 전이에서 §I의 `previewRegistration` 호출 → 응답으로 Phase 2 카드 리스트 렌더. 각 카드 렌더 시:
   - `is_sdu_type=true` → provider 로고 자리에 SDU 아이콘
   - `is_china_region=true` → "China" chip, 그 외 AWS → "Global" chip
   - `is_terraform_execution_granted=true` → "자동 설치" 배지, AWS 한정으로 false → "수동 설치"
   - `type=DUPLICATE` → "이미 등록된 인프라" 배지 + `existing_target_source_id` 이동 링크
   - `type=ADD` → "신규" 배지

---

## 4. 진행 순서 제안

1. **§A, §C, §D** 합의 PR (Swagger 변경) → BFF 구현 → mock 보강
2. **§I** 본 문서와 함께 mock-level 구현 완료 (UI 진입 전 ready)
3. UI 마이그레이션 PR (header/toolbar/row 마크업 교체 + 등록 모달 §I 연동) — §A·C 미적용 상태에서도 graceful degrade 동작
4. **§B, §E, §F, §G** 순차 적용

---

## 5. 참고

- 현행 페이지 진입 경로: `/integration/admin` → `AdminDashboard.tsx` (Sidebar = `ServiceSidebar`, Main = `InfrastructureList`)
- BFF 클라이언트 mock: `lib/bff/mock/target-sources.ts` — `toBffTargetSourceDetail`이 list 응답을 생성
- 관련 ADR: ADR-006(승인→반영→설치 병합), ADR-007(2-hop BFF), ADR-011(BFF setup)
- 도메인 문서: `docs/domain/README.md`
