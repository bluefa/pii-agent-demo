# SIT v7 screen-3 — BFF API 사용 명세

> 작성일: 2026-05-13
> 대상 화면: `/integration/admin` (`AdminDashboard.tsx`) + 인프라 등록 모달 (`ProjectCreateModal.tsx`)
> 관련 PR: #465 (feat/sit-v7-registration-preview)
> 선행 문서: [sit-v7-target-source-list-bff-gaps.md](../reports/sit-v7-target-source-list-bff-gaps.md), [api/boundaries.md](../api/boundaries.md), [ADR-011](../adr/011-bff-data-access-consolidation.md)

이 문서는 SIT v7 screen-3(서비스별 타겟소스 목록 + 인프라 등록 모달)이 호출하는 모든 BFF endpoint, 요청/응답 필드, race protection 메커니즘을 정리한다. BFF spec이 변경될 때 영향 범위를 파악하기 위한 참조 자료다.

---

## 1. 호출 경로 요약

```
React (CSR)
   └─▶ @/app/lib/api/*           ← FE wrapper (fetch + 도메인 normalization)
          └─▶ Next.js Route       ← @/app/integration/api/v1/.../route.ts
                 └─▶ @/lib/bff/client.bff   ← 분기: mockBff | httpBff
                        └─▶ Upstream BFF (/install/v1/...)
```

상세는 [docs/api/boundaries.md](../api/boundaries.md) 참고. **본 화면 코드(`app/components/...`)는 절대 `@/lib/bff/*`를 직접 import하지 않는다.**

---

## 2. Endpoint 사용 매트릭스

| # | UI 시점 | FE wrapper | Internal Next route | Upstream BFF path (httpBff) | 응답 casing |
|---|---|---|---|---|---|
| 1 | Service Sidebar 첫 로드 + 검색 + 페이지 변경 | `getServicesPage(page, size, query, { signal })` | `GET /integration/api/v1/user/services/page` | `GET /install/v1/.../user/services/page?page&size&query` | camelCase |
| 2 | 서비스 선택 → 인프라 목록 | `getProjects(serviceCode)` | `GET /integration/api/v1/services/{serviceCode}/target-sources` | `GET /install/v1/target-sources/services/{serviceCode}` | camelCase |
| 3 | Service Header → 담당자 메타 | `getPermissions(serviceCode)` | `GET /integration/api/v1/services/{serviceCode}/authorized-users` | `GET /install/v1/.../services/{serviceCode}/authorized-users` | camelCase |
| 4 | 등록 모달 Phase 1→2 "다음" | `previewTargetSourceRegistration(serviceCode, body)` | `POST /integration/api/v1/services/{serviceCode}/target-sources/registration-preview` | `POST /install/v1/target-sources/services/{serviceCode}/target-sources/registration-preview` | snake_case (POST raw passthrough) |
| 5 | 등록 모달 Phase 2→3 "등록하기" — ADD 행마다 1회 (N개 → N회 병렬) | `createProject(payload)` | `POST /integration/api/v1/services/{serviceCode}/target-sources` | `POST /install/v1/target-sources/services/{serviceCode}/target-sources` | snake_case |
| 6 | 행 메뉴 "승인 요청 확인" | `getApprovalHistory(targetSourceId, page=0, size=1)` | `GET /integration/api/v1/target-sources/{id}/approval-history?page&size` | `GET /install/v1/target-sources/{id}/approval-history?page&size` | snake_case (payload) → FE에서 normalize |
| 7 | 승인 모달 → 승인 | `approveApprovalRequestV1(targetSourceId, comment?)` | `POST /integration/api/v1/target-sources/{id}/approval-requests/approve` | 동일 path | snake_case |
| 8 | 승인 모달 → 반려 | `rejectApprovalRequestV1(targetSourceId, reason)` | `POST /integration/api/v1/target-sources/{id}/approval-requests/reject` | 동일 path | snake_case |
| 9 | 행 액션 "설치 완료 확정" | `confirmInstallation(targetSourceId)` | `POST /integration/api/v1/target-sources/{id}/pii-agent-installation/confirm` | 동일 path | camelCase (envelope) |

> Note: ADR-011 §"Observable Behavior Invariants" I-3 — GET 응답은 camelCase, POST/PUT/DELETE 응답은 snake_case raw passthrough.

---

## 3. 핵심 endpoint 상세

### 3-1. `GET /services/{serviceCode}/target-sources` (인프라 목록)

**현행 응답 필드** (`TargetSourceSummary`):
```jsonc
{
  "target_source_id": 1001,
  "project_code": "TS-1001",
  "description": "사업부 결제 DB",
  "cloud_provider": "AWS",                // AWS | Azure | GCP | IDC | SDU (swagger CloudProvider enum)
  "process_status": "PENDING",            // BFF 워크플로우 상태 — 자세한 매핑은 lib/process.ts
  "created_at": "2026-05-12T10:00:00Z"
}
```

**UI 사용 필드**:
- `target_source_id` → 행 식별자 (`TS-${id}` 표시)
- `cloud_provider` → ProviderLogo + MonitoringLabel + Status pill tone 결정
- `process_status` → `deriveHealthFromProcessStatus`에서 "운영 중" / "연동 대기"로 매핑
- `description` → 행 2번째 컬럼

**미반영 spec 갭** (모두 § references → `sit-v7-target-source-list-bff-gaps.md`):
- §A — provider-specific 식별자 (AWS payer/linked, Azure tenant/subscription, GCP project) — 미반영. 행에 "—" fallback.
- §B — `updated_at` — 미반영. Service Header "최근 업데이트"가 "—"로 표시됨.
- §C — `health_status` (HEALTHY / PARTIAL / UNHEALTHY / UPDATING) — 미반영. Status pill이 process_status 기반 거친 분기만 가능 (Healthy/Partial/Unhealthy 분기 불가).
- §A 보조 — `is_china_region`, `is_sdu_type`, `is_terraform_execution_granted` — 미반영. 행에서 China/Global/SDU/자동·수동 chip 미표시.

### 3-2. `POST /services/{serviceCode}/target-sources/registration-preview` (Phase 1→2 트리거)

**요청 (camelCase)**:
```jsonc
{
  "cloudProvider": "AWS",                  // AWS | Azure | GCP | IDC (SDU 직접 입력 불가)
  "awsAccountId": "123456789012",          // AWS Payer (조건부 필수)
  "awsLinkedAccountId": "987654321098",    // 옵셔널. 미입력 시 BFF가 Payer=Linked로 echo
  "isChinaRegion": false,                  // AWS 시 필수 (true=China, false=Global)
  "isTerraformExecutionGranted": true,     // AWS 한정. true=자동(BDC 배포), false=수동
  "tenantId": "...",                       // Azure 시 필수
  "subscriptionId": "...",                 // Azure 시 필수
  "gcpProjectId": "...",                   // GCP 시 필수
  "description": "사업부 결제 DB",          // IDC 시 필수(식별자), 그 외는 선택
  "dbTypes": ["MYSQL", "POSTGRESQL"]       // 1+ 개. 응답 행 개수와 동일
}
```

**조건부 필수 검증 (mock + spec)**:
| provider | 필수 |
|---|---|
| AWS | `awsAccountId` (12자리), `isChinaRegion` (boolean) |
| Azure | `tenantId`, `subscriptionId` |
| GCP | `gcpProjectId` |
| IDC | `description` (trim 후 비어있지 않음) |
| SDU | 거부 (400) |

**응답 (snake_case)**:
```jsonc
{
  "items": [
    // items[i] ↔ 요청 dbTypes[i] (1:1 인덱스 매칭, response에 db_type echo 없음)
    {
      "type": "ADD",
      "cloud_provider": "AWS",
      "aws_account_id": "123456789012",
      "aws_linked_account_id": "987654321098",
      "is_china_region": false,
      "is_sdu_type": false,
      "is_terraform_execution_granted": true,
      "description": "..."
    },
    {
      "type": "DUPLICATE",
      "cloud_provider": "AWS",
      // ... (common 필드 동일)
      "existing_target_source_id": 1001              // DUPLICATE 한정 필수
    }
  ]
}
```

**Duplicate 판정 키** (동일 서비스 스코프 내):
- AWS: `(cloud_provider, aws_account_id, is_china_region, db_type)` (linked_account 및 install mode는 identity 외)
- Azure: `(cloud_provider, subscription_id, db_type)`
- GCP: `(cloud_provider, gcp_project_id, db_type)`
- IDC: `(cloud_provider, description_trimmed, db_type)`

**UI 사용**:
- `previewRows = response.items.map((item, i) => ({ item, dbType: request.dbTypes[i] }))` — 요청한 dbTypes 배열을 그대로 보존해 인덱스 참조 (BFF가 db_type을 echo하지 않으므로 클라이언트가 순서를 유지할 책임).
- `is_china_region` → "China" / "Global" chip (AWS 한정)
- `is_terraform_execution_granted` → "자동 설치" / "수동 설치" badge (AWS 한정)
- `is_sdu_type=true` → provider 로고 자리에 SDU 아이콘
- `type=DUPLICATE` → "이미 등록된 인프라" badge + `existing_target_source_id` 링크 ("기존 항목 열기 →")
- `type=ADD` → "신규" badge

### 3-3. `POST /services/{serviceCode}/target-sources` (Phase 2→3 트리거)

**요청 (camelCase, swagger `CreateTargetSourceRequest`)**:
```jsonc
{
  "description": "사업부 결제 DB",
  "cloudProvider": "AWS",
  "awsAccountId": "123456789012",
  "awsLinkedAccountId": "987654321098",
  "isChinaRegion": false,
  "isTerraformExecutionGranted": true,
  "awsRegionType": "global",                // deprecated. isChinaRegion에서 파생 (한시 호환)
  "tenantId": "...",                        // Azure
  "subscriptionId": "...",                  // Azure
  "gcpProjectId": "...",                    // GCP
  "dbType": "MYSQL"                         // 싱귤러. preview의 dbTypes[i] 1건과 대응
}
```

**호출 패턴**: ADD 행 N개 → `Promise.all(createProject(dto))` N회 병렬 (v1 plan C-02 결정 유지).

**필드 매핑** (FE → BFF):
| FE state | BFF 필드 | 비고 |
|---|---|---|
| `chipKey === 'aws'` + `awsRegion === 'china'` | `isChinaRegion: true` + `awsRegionType: 'china'` | 신구 필드 동시 전송 (한시 호환) |
| `installMode === 'auto'` | `isTerraformExecutionGranted: true` | AWS 한정 |
| `fields.payerAccount` | `awsAccountId` | |
| `fields.linkedAccount` (옵셔널) | `awsLinkedAccountId` | 미입력 시 생략 — BFF가 Payer=Linked 처리 |
| `chipKey === 'idc'` 또는 `'other'` | `cloudProvider: 'IDC'` + `description` | `'other'` chip은 IDC alias (스펙 enum에 Other 없음) |
| 요청 시점의 `dbType` (preview row의 dbType과 동일) | `dbType` | 싱귤러 |

**deprecated 필드 처리**: `awsRegionType` 은 boolean `isChinaRegion`이 도입되기 전의 enum (`'global'|'china'`). 신규 클라이언트가 boolean을 사용하더라도 BFF가 한시적으로 둘 다 받음 (swagger `deprecated: true`). 본 PR은 두 필드를 동시 전송한다 — BFF가 권위 필드를 결정한 뒤 enum 필드를 제거할 때까지 호환성 보장.

### 3-4. `GET /services/{serviceCode}/authorized-users` (담당자 메타)

**응답** (camelCase):
```jsonc
{
  "users": [
    { "id": "user_01H...", "name": "김민수", "email": "..." },
    ...
  ]
}
```

**UI 사용**: Service Header "담당자 김민수 · 박지영" 메타 한 줄. 최대 3명까지 이름 표시, 초과 시 "외 N명".

---

## 4. Race protection 메커니즘

화면이 빠르게 서비스를 전환할 때 이전 fetch가 새 화면 데이터를 덮어쓰지 않도록 다음 방어를 적용한다.

| 경로 | 방어 방식 | 위치 |
|---|---|---|
| `getServicesPage` (사이드바) | `AbortController` (이전 요청 abort) | `AdminDashboard.tsx` `abortRef` |
| `getProjects` (인프라 목록) | `cancelled` 플래그 + cleanup. 진입 직후 `setProjects([])`로 패널을 비워 stale row 미노출 | `AdminDashboard.tsx` `selectedService` useEffect |
| `getPermissions` (담당자) | `cancelled` 플래그 + cleanup. 진입 직후 `setManagers([])` | `ServiceHeaderV7.tsx` |
| `previewTargetSourceRegistration` (모달) | `busy` state로 재진입 차단 | `ProjectCreateModal.tsx` |
| `createProject` × N (모달 Phase 3) | `busy` state + functional `setProgressRows` updater (parallel callback간 race-free) | `ProjectCreateModal.tsx` |
| `refreshProjects` (액션 이후) | 액션 기반 호출(사용자 트리거)이라 rapid race 없음 — soft 가드 | `AdminDashboard.tsx` |

### 4-1. getProjects는 왜 AbortController가 아닌 cancelled 플래그인가

FE wrapper `getProjects(serviceCode)`가 현재 `AbortSignal`을 받지 않는다. 시그널 추가는 별도 작업(`@/app/lib/api/index.ts` + `@/lib/fetch-json.ts` 시그너처 확장)이라 본 PR에서는 cleanup 플래그로 setState만 차단한다. 네트워크 요청 자체는 abort되지 않지만, state pollution은 방지된다. AbortSignal 지원은 후속 PR.

---

## 5. BFF 변경 시 영향 범위

### 5-1. `TargetSourceSummary`에 §A·B·C 필드를 추가하면

- `lib/bff/types/target-sources.ts`의 `ServicesTargetSourcesItem` 확장
- `app/lib/api/index.ts` `toProjectSummary`가 신규 필드를 `ProjectSummary`로 매핑
- `lib/types.ts` `ProjectSummary` 인터페이스 확장
- `app/components/features/admin/v7/InfraRow.tsx`:
  - identifier 셀 — `aws_account_id` / `tenant_id` / `gcp_project_id`로 fallback "—" 제거
  - `is_china_region`/`is_sdu_type` 기반 chip / SDU 아이콘 렌더
- `app/components/features/admin/v7/StatusPillV2.tsx`의 `deriveHealthFromProcessStatus`를 health_status 기반 매핑으로 교체
- `ServiceHeaderV7` "최근 업데이트"가 list 응답의 `updated_at` max로 결정

### 5-2. `RegistrationPreviewItem` 필드 추가/제거 시

- `lib/bff/types/target-sources.ts`의 `RegistrationPreviewItemCommon` 갱신
- `app/lib/api/index.ts`의 `RegistrationPreviewItemCommon` (FE-side mirror) 동기화
- `app/components/features/admin/v7/RegistrationPreviewCardList.tsx`:
  - 새 chip / 라벨 추가는 이 한 파일만 수정
  - 식별자 라벨 함수(`formatIdentifierLabel`) 분기에 신규 provider 추가

### 5-3. `CreateTargetSourceRequest`에 신규 필드 추가 시

- `lib/bff/types/target-sources.ts`의 `CreateTargetSourceBody` 확장
- `app/lib/api/index.ts`의 `createProject` 입력 payload 확장
- `app/components/features/ProjectCreateModal.tsx`의 `buildCreateDto`에 새 필드 매핑 추가

### 5-4. `awsRegionType` enum 제거 시 (deprecation 해제)

- `lib/bff/types/target-sources.ts`의 `CreateTargetSourceBody.awsRegionType` 삭제
- `app/components/features/ProjectCreateModal.tsx`의 `buildCreateDto`에서 `awsRegionType` 키 제거
- `lib/bff/mock/target-sources.ts`의 create mock 검증 분기 정리
- `lib/types.ts`의 `Project.awsRegionType` 삭제

### 5-5. `CloudProvider` enum 확장 시 (예: `Other`)

현재 FE는 `Other` chip을 IDC alias로 보낸다 (`apiProvider: 'IDC'`). BFF가 별도 enum 값을 도입하면:
- `lib/types.ts` `CloudProvider` 유니온에 추가
- `lib/constants/provider-mapping.ts` `ApiProvider` 추가, `'other' chip의 apiProvider`를 새 값으로 변경
- `Record<CloudProvider, ...>` 사용처에 신규 엔트리 (labels / scan / icons / monitoring 라벨 등) — 본 PR cascade 참고

---

## 6. 알려진 contract 갭

| 갭 | 영향 | 처리 |
|---|---|---|
| swagger `CreateTargetSourceRequest`가 `projectCode` 를 required로 명시 | FE는 path의 serviceCode만 보내고 projectCode는 BFF가 생성 (`TS-{id}`). swagger 정의와 실제 동작이 다름 | 별도 spec 정리 필요 |
| swagger `CloudProvider` enum에 `Other` 없음 | FE의 `'other'` chip이 `IDC`로 alias 전송 — UI 라벨과 실제 분류 분리 | BFF가 Other 카테고리 도입 시 일대일 매핑으로 교체 |
| Preview 응답 `db_type` echo 없음 | UI는 요청 시점 `dbTypes[i]` 배열을 보존하여 인덱스 참조. 정렬/필터 시 매핑이 깨질 위험 | 카드 리스트는 원본 순서를 절대 변경하지 않음 (정렬 미지원) |

---

## 7. 참고

- swagger: `docs/swagger/user.yaml` (RegistrationPreview*, CreateTargetSourceRequest)
- tag guide: `docs/bff-api/tag-guides/target-sources.md`
- discussion: `docs/bff-api/discussions/2026-05-12-target-sources-registration-preview-added.md`
- spec: `docs/reports/sit-v7-target-source-list-bff-gaps.md` (§A·B·C·D·I)
- boundaries: `docs/api/boundaries.md`
- ADR-011: BFF 단일 진입점 (`@/lib/bff/client`)
