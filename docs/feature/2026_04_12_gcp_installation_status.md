# GCP 설치 상태 조회 구현 계획

> Issue: #251 — GCP 설치 상태 조회 API
> Branch: `feat/gcp-installation-status`
> 날짜: 2026-04-12

---

## 1. 배경 및 목표

### 현재 상태
- 기존 GCP 설치 상태는 `serviceTfStatus` / `bdcTfStatus` 2개 그룹 + `pendingAction` + `regionalManagedProxy` / `pscConnection` 으로 구성
- UI는 "GCP 리소스 생성" / "에이전트 연동" 2행으로 표시

### 새 스펙 (Issue #251 Swagger)
- **3단계 고정 Step** 모델로 전환:
  1. `serviceSideSubnetCreation` — 상대측 Subnet 생성 확인
  2. `serviceSideTerraformApply` — 상대측 Terraform 적용 확인
  3. `bdcSideTerraformApply` — BDC측 Terraform 적용 확인
- 리소스 타입에 따라 불필요한 Step은 `SKIP` 상태
- `resourceSubType` 추가: `PRIVATE_IP_MODE` | `BDC_PRIVATE_HOST_MODE` | `PSC_MODE`
- 전체 `installationStatus`: `COMPLETED` | `FAIL` | `IN_PROGRESS`
- `Summary` 객체: `totalCount`, `completedCount`, `allCompleted`

### Step 활성화 매트릭스

| resourceType | resourceSubType | subnetCreation | serviceTF | bdcTF |
|---|---|---|---|---|
| CLOUD_SQL | PRIVATE_IP_MODE | **활성** | **활성** | **활성** |
| CLOUD_SQL | BDC_PRIVATE_HOST_MODE | SKIP | SKIP | SKIP |
| CLOUD_SQL | PSC_MODE | SKIP | SKIP | **활성** |
| BIGQUERY | (null) | SKIP | **활성** | **활성** |

### 목표 UI

```
┌─────────────────────────────────────────────────────────────┐
│  GCP 에이전트 설치 상태              [새로고침] [마지막 확인: 10:30] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  │ ① Subnet 생성    │ │ ② Service TF    │ │ ③ BDC TF        │
│  │   ● 완료  2/3    │ │   ● 진행중 1/3   │ │   ○ 대기  0/3    │
│  │   ■■■■□          │ │   ■□□□□          │ │   □□□□□          │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘
│                                                              │
│  전체 진행률: 2/5 완료                                        │
│  ████████░░░░░░░░░░░░  40%                                   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  리소스별 상세 상태                                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ cloud-sql-instance-1  (CLOUD_SQL / PRIVATE_IP_MODE) ───┐ │
│  │  Subnet 생성: ✅ 완료                                     │ │
│  │  Service TF:  🔄 진행중  "Terraform apply 실행 중..."     │ │
│  │  BDC TF:     ○ 대기                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ cloud-sql-instance-2  (CLOUD_SQL / PSC_MODE) ──────────┐ │
│  │  Subnet 생성: ─ SKIP                                     │ │
│  │  Service TF:  ─ SKIP                                     │ │
│  │  BDC TF:     ✅ 완료                                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ bigquery-dataset-1  (BIGQUERY) ────────────────────────┐ │
│  │  Subnet 생성: ─ SKIP                                     │ │
│  │  Service TF:  ❌ 실패  "권한 부족. 가이드를 확인하세요."   │ │
│  │  BDC TF:     ○ 대기                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**핵심 UX:**
- 상단: 3단계 Step 요약 카드 (각 Step별 집계 상태 + 미니 진행바)
- 중단: 전체 진행률 바 + Summary
- 하단: 리소스별 3-Step 상세 (SKIP은 회색 처리, guide 텍스트 표시)

---

## 2. 변경 범위

### 2-1. 타입 정의 변경

**파일: `app/api/_lib/v1-types.ts`**

```
[삭제] GcpTfStatus, GcpPendingAction, PscConnection, 기존 GcpResourceStatus, GcpInstallationStatusResponse
[추가]
- GcpStepStatusValue = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'SKIP'
- GcpInstallationStatusValue = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS'
- GcpResourceType = 'CLOUD_SQL' | 'BIGQUERY'
- GcpResourceSubType = 'PRIVATE_IP_MODE' | 'BDC_PRIVATE_HOST_MODE' | 'PSC_MODE'
- GcpStepStatus { status: GcpStepStatusValue; guide?: string | null }
- GcpResourceStatus { resourceId, resourceName?, resourceType, resourceSubType?, installationStatus, serviceSideSubnetCreation, serviceSideTerraformApply, bdcSideTerraformApply }
- GcpInstallationSummary { totalCount, completedCount, allCompleted }
- GcpInstallationStatusResponse { lastCheck: LastCheckInfo; summary?: GcpInstallationSummary; resources: GcpResourceStatus[] }
```

### 2-2. Mock 데이터 변경

**파일: `lib/mock-gcp.ts`**

- `GcpInstallResource` 내부 타입을 새 3-Step 모델로 전환
- `connectionType` → `resourceSubType` 매핑:
  - `PRIVATE_IP` → `PRIVATE_IP_MODE`
  - `PSC` → `PSC_MODE`
  - `BIGQUERY` → subType null
- `buildInstallResource()`: Step 활성화 매트릭스에 따라 각 step의 status 생성
- `checkGcpInstallation()`: step 진행 로직 수정 (IN_PROGRESS→COMPLETED 랜덤 전이)
- `pendingAction`, `regionalManagedProxy`, `pscConnection` 제거

### 2-3. API Route 변경

**파일: `app/api/v1/gcp/target-sources/[targetSourceId]/installation-status/route.ts`**

- 기존 변환 로직 제거, 새 스펙에 맞춘 응답 반환
- `LastCheckInfo.status` 매핑: `NEVER_CHECKED` | `IN_PROGRESS` | `COMPLETED` | `FAILED`
- `summary` 계산 로직 추가

**파일: `app/api/v1/gcp/target-sources/[targetSourceId]/check-installation/route.ts`**

- 동일하게 새 스펙 적용

### 2-4. 프론트엔드 API 클라이언트

**파일: `app/lib/api/gcp.ts`**

- 반환 타입을 새 `GcpInstallationStatusResponse`로 변경 (타입만 변경, fetch 로직 동일)

### 2-5. 상수/유틸 변경

**파일: `lib/constants/gcp.ts`**

```
[삭제] GcpUnifiedStatus, getGcpUnifiedStatus, GcpGroupStatus, getGcpGroupStatus, GCP_TF_STATUS_LABELS, GCP_PSC_STATUS_LABELS
[추가]
- GCP_STEP_LABELS = { serviceSideSubnetCreation: 'Subnet 생성', serviceSideTerraformApply: 'Service TF 설치', bdcSideTerraformApply: 'BDC TF 설치' }
- GCP_STEP_STATUS_LABELS = { COMPLETED: '완료', FAIL: '실패', IN_PROGRESS: '진행중', SKIP: '해당없음' }
- GCP_INSTALLATION_STATUS_LABELS = { COMPLETED: '설치 완료', FAIL: '설치 실패', IN_PROGRESS: '설치 진행 중' }
- getGcpStepAggregateStatus(resources, stepKey): 리소스 배열에서 특정 step의 집계 상태 계산
- getGcpActiveStepCount(resources, stepKey): 해당 step이 SKIP이 아닌 리소스 수
- getGcpCompletedStepCount(resources, stepKey): 해당 step이 COMPLETED인 리소스 수
```

### 2-6. UI 컴포넌트 변경

#### 삭제 대상
- `RegionalManagedProxyPanel.tsx` — 더 이상 사용하지 않음
- `PscApprovalGuide.tsx` — 더 이상 사용하지 않음

#### 신규 컴포넌트

**`GcpStepSummaryCard.tsx`** — 개별 Step 요약 카드
```
Props: { stepKey: string; label: string; activeCount: number; completedCount: number; status: 집계상태 }
UI: Step 이름 + 상태 아이콘 + "N/M" 카운트 + 미니 진행바
색상: COMPLETED=green, FAIL=red, IN_PROGRESS=amber, 전체SKIP=gray
```

**`GcpStepSummaryRow.tsx`** — 3개 StepSummaryCard를 가로 배치
```
Props: { resources: GcpResourceStatus[] }
UI: 3칸 grid로 StepSummaryCard 3개 렌더링
각 카드에 stepKey별 집계 상태/카운트 전달
```

**`GcpResourceDetailCard.tsx`** — 리소스별 3-Step 상세 카드
```
Props: { resource: GcpResourceStatus }
UI:
- 헤더: resourceName (resourceType / resourceSubType)
- 3행: 각 Step의 상태 아이콘 + 라벨 + guide 텍스트 (있으면 표시)
- SKIP step은 회색 + "─" 표시
- FAIL step은 빨간색 + guide 텍스트 강조
```

#### 수정 컴포넌트

**`GcpInstallationInline.tsx`** — 전면 개편
```
변경 전: 2그룹 상태 + pendingAction 패널
변경 후:
- 헤더: 제목 + 새로고침 버튼 + lastCheck 시각
- GcpStepSummaryRow (3-Step 요약)
- 전체 진행률 바 (summary.completedCount / summary.totalCount)
- GcpResourceDetailCard 리스트 (각 리소스)

상태 판단:
- allCompleted → onInstallComplete 콜백
- resources가 비어있으면 → NEVER_CHECKED 안내
```

---

## 3. 작업 순서

| # | 작업 | 파일 | 검증 |
|---|------|------|------|
| 1 | 새 타입 정의 | `v1-types.ts` | tsc 통과 |
| 2 | 상수/유틸 교체 | `lib/constants/gcp.ts` | tsc 통과 |
| 3 | Mock 데이터 재작성 | `lib/mock-gcp.ts` | tsc 통과 |
| 4 | API Route 변환 로직 교체 | `installation-status/route.ts`, `check-installation/route.ts` | API 응답 확인 |
| 5 | 프론트엔드 API 클라이언트 타입 수정 | `app/lib/api/gcp.ts` | tsc 통과 |
| 6 | 신규 컴포넌트 작성 | `GcpStepSummaryCard`, `GcpStepSummaryRow`, `GcpResourceDetailCard` | tsc 통과 |
| 7 | GcpInstallationInline 개편 | `GcpInstallationInline.tsx` | dev 서버 UI 확인 |
| 8 | 삭제 정리 | `RegionalManagedProxyPanel`, `PscApprovalGuide`, index 재export | tsc 통과 |
| 9 | 전체 빌드 검증 | - | `scripts/verify.sh` 통과 |

---

## 4. 주의사항

- **Swagger가 기준** — 코드를 swagger에 맞춤 (PR #179 교훈)
- `StepStatus.status`의 `FAIL` (not `FAILED`) — swagger 스펙 그대로 사용
- `installationStatus`의 `FAIL` (not `FAILED`) — 동일
- `LastCheckInfo.status`에 `NEVER_CHECKED` 추가 — 기존 공용 타입 확장 필요
- `GcpSettingsResponse`는 이번 스코프 외 (변경 없음)
- `ProcessStatusCard.tsx`에서 `GcpInstallationInline` import는 변경 불필요 (Props 동일)
