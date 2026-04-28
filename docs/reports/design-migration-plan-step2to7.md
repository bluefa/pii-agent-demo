# SIT Prototype v2 — Step 2~7 Design Migration Plan

> Source: `design/app/SIT Prototype v2.html` (스토리보드/HTML 시안), `design/design/guide-cms/*`, `design/uploads/*` (스토리보드 PDF/JPG)
> Target: `app/integration/target-sources/[targetSourceId]/_components/layout/*`
> Scope: Step 2 ~ Step 7 (Step 1 "연동 대상 DB 선택"은 본 문서 범위 외 — 별도 PR 진행 중)
> Provider scope: **Azure / GCP** (시안에 설치 분기가 작성된 두 Provider 한정. AWS/IDC/SDU는 시안에 포함되어 있지 않으므로 본 plan에 포함하지 않음)

---

## 0. 전제와 용어

| 시안 라벨 | 코드 ProcessStatus | 의미 |
|---|---|---|
| Step 1 — 연동 대상 DB 선택 | `WAITING_TARGET_CONFIRMATION` (1) | (범위 외) |
| Step 2 — 연동 대상 승인 대기 | `WAITING_APPROVAL` (2) | 사용자 승인 요청 후 관리자 검토 |
| Step 3 — 연동 대상 반영중 | `APPLYING_APPROVED` (3) | 승인 후 사전 작업 자동 진행 |
| Step 4 — Agent 설치 | `INSTALLING` (4) | Provider별 인프라 설치 진행 |
| Step 5 — 연결 테스트 | `WAITING_CONNECTION_TEST` (5) | 사용자 측 connection test |
| Step 6 — 완료 여부 관리자 승인 대기 | `CONNECTION_VERIFIED` (6) | 관리자 최종 확정 대기 |
| Step 7 — 완료 (PII 모니터링 모듈 연동 완료) | `INSTALLATION_COMPLETE` (7) | 운영 모니터링 단계 |

기존 슬롯 파일 매핑:

| Step | 현재 컴포넌트 (마이그레이션 대상) |
|---|---|
| 2 | `layout/WaitingApprovalStep.tsx` |
| 3 | `layout/ApplyingApprovedStep.tsx` |
| 4 | `layout/InstallingStep.tsx` (+ `azure/AzureInstallationStatus.tsx`, `gcp/GcpInstallationStatus.tsx`) |
| 5 | `layout/ConnectionTestStep.tsx` |
| 6 | `layout/ConnectionTestStep.tsx` (`CONNECTION_VERIFIED` 분기) |
| 7 | `layout/ConnectionTestStep.tsx` (`INSTALLATION_COMPLETE` 분기) |

> 현재 Step 5/6/7이 모두 `ConnectionTestStep` 한 파일에서 분기되고 있으나, 시안 기준으로 Step 7은 모니터링 화면이며 Step 5/6와 IA가 다릅니다. Step 별로 컴포넌트 분리가 필요합니다.

---

## Step 2 — 연동 대상 승인 대기

### 시안 요약

- 안내 banner: "관리자 승인을 기다리고 있어요. 평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다."
- DB List: `# / DB Type / Resource ID / Region / DB Name / 연동 대상 여부 / 스캔 이력`
- 우측 하단 액션: **연동 대상 승인 요청 취소** (danger-outline) → confirm modal

### BFF API 매핑

| UI 요소 | 매핑 API / 필드 |
|---|---|
| 요청된 리소스 목록 (catalog) | `GET /target-sources/{id}/resources` (= `ResourceCatalogResponse`) — 현재 `WaitingApprovalStep` 의 `CandidateResourceSection` 이 이미 이 endpoint 사용 중 |
| 행별 `연동 대상 여부` (selected) | catalog 의 per-resource state + 진행 중 approval request snapshot. 현재 mock 은 project.resources 의 `isSelected` 필드 사용 |
| 행별 `스캔 이력` 컬럼 | `ResourceConfigDto.scan_status` (`UNCHANGED` / `NEW_SCAN`) — null 이면 `—` |
| 행별 메타 (Region / DB Name / DB Type) | catalog 응답의 ResourceConfigDto 필드 |
| 요청 메타 (요청일시, 요청자, total/selected 카운트) | `GET /target-sources/{id}/approval-requests/latest` (`request/result` 요약만 — 리소스 목록은 미포함) |
| 승인 요청 취소 버튼 | `POST /target-sources/{id}/approval-requests/cancel` ✅ |
| 반려 사유 노출 | `BaseTargetSource.rejectionReason` (이미 `bff.targetSources.get` 응답에 포함) |
| 반려 후 "연동 대상 DB 다시 선택하기" 버튼 | `POST /target-sources/{id}/approval-requests/system-reset` ✅ (PR #420 신규) |

⚠️ **`approval-requests/latest` 는 리소스 배열을 반환하지 않습니다** (`request/result` 요약 + count 만 — confirm.yaml line 769–838). 따라서 Step 2 의 표 데이터 source 는 catalog (`getResources`) + project resources state 의 조합. 이는 기존 `CandidateResourceSection` 흐름을 그대로 재사용하는 방식.

### 변경/구현 포인트

1. 기존 `WaitingApprovalStep.tsx` 의 `CandidateResourceSection`(readonly) → 시안 시각 spec(좁은 컬럼/한국어 헤더)에 맞춰 **dedicated table** 로 교체.
2. **null 표시 규칙**: 모든 컬럼 값이 null/undefined 인 경우 `—` (em-dash) 로 통일 표시. (제외 사유 inline 미사용)
3. **취소 버튼 → confirm modal** 신규 추가. 시안 `confirmStepModal` 패턴 재사용.
   - 제목: `연동 대상 승인 요청을 취소할까요?`
   - 본문: `1단계 · 연동 대상 DB 선택으로 되돌아갑니다.\n취소 후에는 다시 DB 선택부터 진행해야 해요.`
   - Note(warning bg): `관리자에게 전달된 요청 내용은 보존되지 않으며, 취소 즉시 처리됩니다.`
   - 버튼: `[머무르기]` (outline) / `[요청 취소]` (danger-outline)
4. **반려 케이스 IA**: 반려 시 BFF processStatus 가 자동 회귀하지 않고 **Step 2 화면 유지** (`isRejected=true`). RejectionAlert 하단에 **`[연동 대상 DB 다시 선택하기]` Primary 버튼** 추가 → 클릭 시 `system-reset` 호출 → 응답 후 `bff.targetSources.get` refetch → processStatus=1 로 자연 라우팅.
5. Mock 모드도 system-reset 지원 필요 (`USE_MOCK_DATA=true`).

### ❓ 남은 확인 사항

- **Q2-1a.** 시안 라벨 `신규` / `변경` ↔ BFF enum `NEW_SCAN` / `UNCHANGED` 매핑.
  - `NEW_SCAN` → "신규" 는 자명.
  - `UNCHANGED` 는 의미상 "변경 없음" 인데 시안은 "변경" 으로 라벨링되어 정반대로 읽힘.
  - 옵션: (a) 시안 라벨을 `신규` / `기존` 으로 수정하여 enum 의미와 일치, (b) BFF 에 `MODIFIED` enum 추가, (c) 표기 자체 생략하고 모두 `—` 처리.
  - **임시 결정**: null/undefined 인 경우 `—`. enum 값이 들어오면 해당 라벨 그대로 표기 (변경 의미 정의는 후속 합의).
- **Q2-2a.** BFF `confirm.yaml` 의 `ResourceInputDto.exclusion_reason` 도 별도 컬럼으로 보일 필요 없는지 확인 (현재는 비대상 행에서도 사유 미표기 결정).

---

## Step 3 — 연동 대상 반영중

### 시안 요약

- 헤더 우측: `반영중` status pill
- DB List: `DB Type / Resource ID / Region / DB Name / 연동 제외 사유 / 스캔 이력 / 연동 이력`
- 우측 하단: **Next** 버튼 (→ Step 4)

### BFF API 매핑

| UI 요소 | 매핑 API / 필드 |
|---|---|
| 반영 중 리소스 목록 | `GET /target-sources/{id}/approved-integration` ✅ |
| processStatus 폴링 | `GET /target-sources/{id}/process-status` ✅ |
| 행별 `연동 제외 사유` 컬럼 | `ResourceInputDto.exclusion_reason` — null 이면 `—` |
| 행별 `스캔 이력` 컬럼 | `ResourceConfigDto.scan_status` (`UNCHANGED` / `NEW_SCAN`) — null 이면 `—` |
| 행별 `연동 이력` 컬럼 | `ResourceConfigDto.integration_status` (`INTEGRATED` / `NOT_INTEGRATED`) — null 이면 `—` |
| 자동 전이 (Step 3 → Step 4) | processStatus 가 `INSTALLING`(4)으로 바뀌면 `bff.targetSources.get`으로 refetch |

### 변경/구현 포인트

1. 기존 `ApplyingApprovedStep.tsx` 가 폴링 메시지를 보여주고 있는데(Memory: 미구현) 시안은 "반영 중 리소스 테이블"이 메인. 카드 + 테이블 형태로 재구성.
2. **시연 Next 버튼 제거** — ProcessStatus 4 자동 전이만 사용. (시안 line 1669–1673 prototype 전용)
3. **`반영중` status pill 제거** — 카드 헤더는 제목 + sub-text 만 표시. (Step 2 와 색상 구분 모호 회피)
4. **null 표시 규칙**: 모든 컬럼 값이 null/undefined 인 경우 `—` 통일.
5. **enum 라벨 매핑** (BFF 패스-스루):
   - `scan_status`: `NEW_SCAN` → `신규` / `UNCHANGED` → `—` / null → `—`
   - `integration_status`: `INTEGRATED` → `Integrated` / `NOT_INTEGRATED` → `—` / null → `—`
6. **SYSTEM_ERROR (= BFF UNAVAILABLE)** 케이스: Step 2 와 **동일한 위치 / 동일한 패턴**으로 error banner + Primary "연동 대상 DB 다시 선택하기" 버튼 노출. 버튼은 S2-W1b 가 추가한 `system-reset` endpoint 재사용 (UNAVAILABLE → IDLE 전이).
7. **선택 + 제외 리소스 동일 표 노출**: BFF `approved-integration` 응답의 `resource_infos` (선택) → `excluded_resource_infos` (제외) 순으로 단순 concat 후 렌더.

### ✅ 확정 (Q3-1 ~ Q3-6 답변 반영)

- **Q3-1**: BFF enum 패스-스루.
- **Q3-2**: Next 버튼 제거.
- **Q3-3**: SYSTEM_ERROR (= UNAVAILABLE) 시 Step 2 위치 / 패턴으로 error banner + 회귀 버튼.
- **Q3-4**: `approved-integration` 응답을 그대로 사용, 선택 + 제외 concat.
- **Q3-5**: `반영중` status pill 제거.
- **Q3-6**: SYSTEM_ERROR 외에는 사용자가 빠져나갈 수 없음 (BFF 자동 전이 대기).

---

## Step 4 — Agent 설치 (Azure / GCP)

### 시안 요약 (공통)

- 헤더 우측: `Provider: Azure` / `Provider: GCP` 라벨
- **install-tasks**: 3개의 horizontal pipeline (각 task: `완료` / `진행중` 칩)
- Task를 클릭하면 **Task Detail Modal** (탭: 전체 / 완료 / 진행중) — Resource ID / DB Type / Region / 진행 완료 여부
- 하단 공용 DB List: `DB Type / Resource ID / Region / DB Name / [Provider별 컬럼]`

### Azure 분기

| 시안 task | 의미 (시안 sub-text 기반) | BFF 매핑 후보 |
|---|---|---|
| 1. 서비스 측 리소스 설치 진행 | Subnet / NSG / Storage 등 사전 구성 | **❓ 매핑 불명** — `AzureInstallationStatus` 에는 service-side TF 상태 필드가 없음. (cf. AWS/GCP는 `service_tf_status` 별도 존재) |
| 2. BDC 측 리소스 설치 진행 | PII Agent VM, IAM Role, KeyVault 자동 배포 | `vm_installation.subnet_exists`, `vm_installation.load_balancer.installed` 조합 |
| 3. Private Link 모듈 설치 진행 | Private Link 채널 구성 | `private_endpoint.status` (NOT_REQUESTED / PENDING_APPROVAL / APPROVED / REJECTED) |

공용 DB List Azure 컬럼: **Private Link 상태** → resource별 `private_endpoint.status` 매핑 ✅

### GCP 분기

| 시안 task | 의미 | BFF 매핑 후보 |
|---|---|---|
| 1. Subnet 생성 진행 | Project 내 모니터링용 Subnet 생성 | `regional_managed_proxy.exists` + `pending_action == CREATE_PROXY_SUBNET` |
| 2. 서비스 측 리소스 설치 진행 | VPC Peering / Firewall / Service Account | `service_tf_status` (PENDING / IN_PROGRESS / COMPLETED / FAILED) ✅ |
| 3. BDC 측 리소스 설치 진행 | PII Agent GCE 인스턴스 + IAM | `bdc_tf_status` ✅ |

공용 DB List GCP 컬럼: **서비스 리소스 상태** → resource별 `service_tf_status` 매핑 ✅
(추가 신호: `psc_connection.status`, `pending_action == APPROVE_PSC_CONNECTION`)

### 변경/구현 포인트

1. 기존 `Azure/GcpInstallationStatus.tsx` 는 리소스 단위 표 위주. 시안의 **3-step horizontal pipeline (install-tasks)** 컴포넌트를 신규 도입.
2. **Task Detail Modal**: install-tasks 클릭 시 그 task에 속한 리소스 진행 상태를 표시.
3. Azure는 task→리소스 매핑 정의가 필요 (Q4-1 참조).
4. 기존 `InstallingStep.tsx` 의 polling/refresh hook 재사용 가능.

### ❓ 사용자 확인 필요

- **Q4-1. (Critical)** Azure의 task 1 "**서비스 측 리소스 설치 진행**" — 현재 `AzureInstallationStatus` 응답에는 service-side(고객 측) Terraform 상태를 직접 반환하는 필드가 없습니다. GCP/AWS와 달리 `service_tf_status`가 없는데, 시안의 Azure task 1을 어떻게 산출해야 하나요?
  - (a) 시안 정의를 따라 BFF에 `service_tf_status` 필드 추가 요청
  - (b) Azure는 task 1을 제거하고 task를 2개(BDC / Private Link)로만 운영
  - (c) PE 존재 여부 / VM 사전조건으로 추론
- **Q4-2.** Azure task 2 ("BDC 측 리소스 설치") 완료 조건을 `vm_installation.subnet_exists && load_balancer.installed` 로 잡으면 되나요? VM 외 리소스(MSSQL/PostgreSQL/Cosmos 등)는 PE 단일 신호밖에 없는데, "BDC 측 설치"가 PE 까지 포함하는 개념인지 명확히 해주세요.
- **Q4-3.** GCP task 1 "Subnet 생성 진행"의 완료 기준은 `regional_managed_proxy.exists === true` 인가요? 사용자가 직접 생성해야 하는 경우(`pending_action == CREATE_PROXY_SUBNET`)에는 시안 어디에 액션 버튼이 노출되어야 하나요? 시안에는 액션 버튼이 보이지 않습니다.
- **Q4-4.** GCP `pending_action == APPROVE_PSC_CONNECTION`은 시안 어디에 매핑되나요? (사용자/관리자 액션 위치 확인 필요)
- **Q4-5.** Task Detail Modal의 "진행 완료 여부" 컬럼 — 이 값이 리소스 단위로 partial 가능한가요? 아니면 task 전체 단위인가요?

---

## Step 5 — 연결 테스트

### 시안 요약

- 헤더 우측: **Run Test** 버튼
- DB List: `DB Type / Resource ID / Region / DB Name / DB Credential / Connection Status / 논리 DB 확인 [설정]`
- DB Credential 컬럼은 link (예: `Key1`, `Key2`)
- 논리 DB 확인 `[설정]` 클릭 → **Logical DB Modal** (전체/제외 탭, Database/Schema 행, 연동 대상/연동 제외 select, 제외 사유 select)
- 하단 좌측 안내: "모든 DB의 Connection Status가 Success이고 논리 DB 확인 설정이 완료되어야 다음 단계로 진행할 수 있어요."
- 하단 우측: **완료 승인 요청** 버튼 (→ Step 6)

### BFF API 매핑

| UI 요소 | 매핑 API |
|---|---|
| Run Test | `POST /target-sources/{id}/test-connection` ✅ |
| Connection Status (Success/Pending/Failed) per resource | `GET /target-sources/{id}/test-connection/results` ✅ (또는 `latest`) |
| DB Credential 컬럼 (Key1, Key2 …) | `GET /target-sources/{id}/secrets` ✅ |
| 논리 DB 확인 모달 — 행 데이터 (Database/Schema 목록) | **❓ 매핑 없음** (아래 Q5-1 참조) |
| 논리 DB 확인 모달 — 저장 (선택/제외 사유 변경) | **❓ 매핑 없음** (아래 Q5-2 참조) |
| 완료 승인 요청 버튼 | **❓ 매핑 없음** (아래 Q5-3 참조) |

### 변경/구현 포인트

1. 기존 `ConnectionTestStep.tsx` 에 시안의 **DB Credential 링크 컬럼** + **논리 DB 확인 [설정]** 컬럼 추가.
2. **Logical DB Modal** 신규 컴포넌트(시안의 `logical-modal` style — sidebar 탭 + table + summary).
3. "Save" 시 변경 내역을 어떤 API로 persist 할지 BFF 합의 필요.

### ❓ 사용자 확인 필요 (가장 큰 gap)

- **Q5-1. (Critical)** 논리 DB 확인 모달의 **Database/Schema 목록(전체 7건, 제외 3건 등)** 은 어디에서 가져오나요? `logical-db-status` 는 카운트 합계(`total_database_count`, `success_database_count`, `fail_count`, `pending_count`)만 반환하고, 개별 Database/Schema 이름과 상태는 노출하지 않습니다. 별도 API가 필요해 보입니다.
- **Q5-2. (Critical)** 모달의 "연동 대상 ↔ 연동 제외" 토글과 "제외 사유" 변경을 저장하는 PUT/POST 가 BFF에 없습니다. (a) 기존 `approval-requests` 흐름을 다시 타게 할지(인프라 변경 처럼), (b) 새 endpoint(`PUT /target-sources/{id}/logical-db-config` 같은) 추가가 필요할지 결정 필요.
- **Q5-3. (Critical)** 시안의 **"완료 승인 요청"** 버튼 — Step 5 → Step 6 전이 (processStatus 5 → 6)는 사용자 액션으로 트리거되는 것으로 보입니다. 그러나 BFF 명세(`confirm.yaml`)에서 사용자가 호출 가능한 "완료 승인 요청 생성" endpoint는 보이지 않고, Step 6→7 확정 endpoint만 있음(`pii-agent-installation/confirm`, 관리자용). 사용자측에서 호출 가능한 endpoint가 추가로 필요한가요? 아니면 모든 connection test 가 Success가 되면 자동 전이인가요?
- **Q5-4.** "DB Credential" 칼럼이 link 인데(클릭 시 동작 미상) — credential 상세 모달을 여는 것이 맞나요, credential 선택 변경 모달인가요? 현재 BFF 는 `PUT /target-sources/{id}/resources/credential` 가 있어 변경 가능.
- **Q5-5.** "Run Test" 후 결과를 어떻게 폴링할지 — `test-connection/latest` polling 인지 SSE 인지 명세가 필요합니다.

---

## Step 6 — 완료 여부 관리자 승인 대기

### 시안 요약

- 헤더 우측: `승인 대기` status pill
- 안내 banner: "최종 관리자 승인을 기다리고 있어요. 승인이 완료되면 모니터링이 즉시 시작됩니다."
- DB List: `DB Type / Resource ID / Region / DB Name / DB Credential / Connection Status` (모두 Success로 표시)
- 우측 하단: **연결 테스트 재실행** (warn-outline) — 클릭 시 Confirm rewind modal → Step 5로 회귀

### BFF API 매핑

| UI 요소 | 매핑 API |
|---|---|
| 리소스 + connection status 목록 | `GET /target-sources/{id}/test-connection/results` 또는 `last-success` ✅ |
| 관리자 측 최종 확정 (Step 6→7) | `POST /target-sources/{id}/pii-agent-installation/confirm` (관리자) ✅ |
| 연결 테스트 재실행 | `POST /target-sources/{id}/test-connection` ✅ + processStatus를 5로 되돌리는 처리 |

### 변경/구현 포인트

1. 기존 `ConnectionTestStep.tsx` 의 `CONNECTION_VERIFIED` 분기를 **별도 컴포넌트** (`WaitingFinalApprovalStep.tsx` 등)로 분리.
2. **Confirm Rewind Modal** 추가 (시안의 `confirmStepModal` 패턴).
3. 관리자 화면(`/integration/admin/...`)에서 최종 승인을 내릴 수 있도록 admin route와 연동(이미 일부 존재).

### ❓ 사용자 확인 필요

- **Q6-1.** "연결 테스트 재실행" 버튼은 사용자(서비스 매니저) 권한으로 처리 가능한가요? processStatus 를 6 → 5 로 되돌리는 것은 BFF 가 자동으로 해주나요(test-connection 호출 부수효과), 아니면 별도 endpoint 가 필요한가요?
- **Q6-2.** Step 6에서 사용자가 직접 "취소" 또는 "수정"이 가능한지 시안에서 명확하지 않습니다. 재실행 외 액션이 필요한지 확인 필요.

---

## Step 7 — 완료 (PII 모니터링 모듈 연동 완료)

### 시안 요약

- 헤더 우측: `Healthy` status pill + 헤더 sub-text "PII가 사용되어 있을 가능성이 있어요. 사용 단어 빈도가 표시되며, 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다."
- 우상단 액션: **인프라 변경** (warn-outline) / **연결 테스트 재실행** (warn-outline)
- DB List: `[checkbox] / DB Type / Resource ID / Region / DB Name / DB Credential / 연동 대상 논리 DB / 연동 제외 논리 DB / Status (Healthy/Unhealthy + tooltip)`
- "연동 대상 논리 DB" / "연동 제외 논리 DB" 컬럼은 정수 (예: `12 / 3`)
- Status는 Healthy(녹색) / Unhealthy(붉은색) 두 종류

### BFF API 매핑

| UI 요소 | 매핑 API |
|---|---|
| 리소스 행 베이스 데이터 | `GET /target-sources/{id}/confirmed-integration` ✅ |
| Status 행 (Healthy/Unhealthy) | `GET /target-sources/{id}/logical-db-status` 의 per-resource fail/pending count + `agent_running` |
| 연동 대상 논리 DB 카운트 | `logical-db-status.resources[*].success_database_count` (혹은 total - excluded) ✅ |
| 연동 제외 논리 DB 카운트 | **❓ 매핑 불명** (아래 Q7-1 참조) |
| DB Credential 컬럼 (Key1) | `GET /target-sources/{id}/secrets` ✅ |
| 인프라 변경 → Step 1 회귀 | Confirm rewind modal → 인프라 변경은 **신규 approval-request 생성 흐름** 으로 진입 (`POST /approval-requests`) ✅ |
| 연결 테스트 재실행 → Step 5 회귀 | Q6-1과 동일 |

### 변경/구현 포인트

1. 기존 `ConnectionTestStep.tsx` 의 `INSTALLATION_COMPLETE` 분기를 **`MonitoringStep.tsx`** 별도 컴포넌트로 분리.
2. Status 컬럼 + tooltip(Healthy/Unhealthy 설명) 컴포넌트 신규.
3. "사용 단어 빈도" 라는 시안 sub-text는 후속 기능 — 본 plan 범위 외(Q7-2).

### ❓ 사용자 확인 필요

- **Q7-1.** "**연동 제외 논리 DB**" 카운트(시안 예: `3`, `2`, `1`)는 어디서 오나요? `logical-db-status` 응답에는 `total_database_count` 가 있어 (total - success - fail - pending) 으로 추정 가능하지만 명확한 의미가 다릅니다. Step 5 logical DB 모달에서 사용자가 "연동 제외"로 지정한 항목 수와 동일한지 확인 필요.
- **Q7-2.** 헤더 sub-text의 "**사용 단어 빈도**"는 본 마이그레이션 범위에 포함되나요? 포함된다면 별도 API가 필요합니다(현재 swagger에는 매핑되는 것이 없음). 후속 phase로 분리 권장.
- **Q7-3.** 행별 checkbox 의 용도는 무엇인가요? 시안에서는 액션이 묶여 있지 않아 보입니다 — bulk action이 있다면 명세 필요.
- **Q7-4.** "인프라 변경" 클릭 시 Step 1로 되돌아가지만, 그 동안 Step 7 모니터링은 유지되나요(이중 상태)? 아니면 processStatus 가 1로 리셋되어 모니터링이 중단되나요?

---

## 마이그레이션 우선순위 (제안)

| Wave | 대상 | 사전조건 | 비고 |
|---|---|---|---|
| W1 | Step 2, 3 (시각 정리 + 반려/취소 modal + system-reset 통합) | Q2-1a, Q3-1a 답변 + system-reset mock 구현 + **SYSTEM_ERROR detection BFF 결정** (옵션 A/B/C — 본 plan 의 [sit-step3/S3-W1b-error-state.md](./sit-step3/S3-W1b-error-state.md) Step 2 참조) | BFF 신규 endpoint(system-reset, PR #420) 통합 포함. 임시 결정: 옵션 (C) approval-history polling — long-term 은 (A) 권장 |
| W2 | Step 4 GCP | Q4-3, Q4-4 답변 | GCP는 BFF 필드(`service_tf_status`/`bdc_tf_status`/`pending_action`) 가 잘 정렬되어 있어 우선 진행 가능 |
| W3 | Step 4 Azure | **Q4-1 답변 필수** (BFF 변경 가능성 있음) | Azure는 service_tf_status 부재로 BFF 협의 선행 |
| W4 | Step 5 (논리 DB 모달 제외) | Q5-3, Q5-4, Q5-5 | API gap 없는 부분만 |
| W5 | Step 5 논리 DB 모달 + Step 7 카운트 | **Q5-1, Q5-2, Q7-1 답변 필수** | BFF 신규 endpoint 가능성 — 가장 큰 gap |
| W6 | Step 6, Step 7 (모니터링 코어) | Q6-1, Q7-2 ~ Q7-4 답변 | Step 7 컴포넌트 분리 포함 |

---

## ⛳ 본 plan에서 명시적으로 제외한 것

- **AWS / IDC / SDU Step 4 분기** — 시안에 없음. 시안 작성자(또는 디자이너)에게 추가 storyboard 요청 필요.
- "사용 단어 빈도" 등 PII 분석 결과 표시 — 시안 sub-text 외의 화면이 없음.
- Guide CMS 영역 (`design/design/guide-cms/*`) — 본 plan은 Step 화면에 한정. Guide 컨텐츠는 별도 진행 중인 issue 참조.
- `design/preview/*` 디자인 시스템 카드 — design-md adoption 작업과 통합 예정.

---

## ❓ 정리: 즉시 답변이 필요한 핵심 질문 (Critical)

1. **Q4-1** — Azure "서비스 측 리소스 설치" task의 데이터 source (BFF 추가 필요?)
2. **Q5-1** — 논리 DB 모달의 Database/Schema 개별 행 데이터 source (현재 BFF는 카운트만)
3. **Q5-2** — 논리 DB 모달 저장 endpoint (신규 endpoint 필요?)
4. **Q5-3** — Step 5 → Step 6 사용자 트리거 endpoint 존재 여부
5. **Q7-1** — "연동 제외 논리 DB" 카운트의 정의/source

위 5개가 BFF 명세 변경(또는 추가) 가능성이 있는 항목이며, W3/W5/W6 진입 전 반드시 협의되어야 합니다.

---

## 📌 공통 표기 규칙

- **null/undefined 값은 모두 `—` (em-dash) 로 표시.** 별도 placeholder 텍스트("없음", "정보 없음") 사용 금지.
- BFF enum 라벨은 시안 한국어 라벨로 매핑 (예: `INTEGRATED` → "Integrated" / `NEW_SCAN` → "신규"). 매핑이 미정인 enum 값(`UNCHANGED`, `NOT_INTEGRATED` 등)은 후속 합의 전까지 `—` 로 표기.

---

## 📎 참조

- BFF 신규 명세: `docs/bff-api/tag-guides/approval-requests.md` (PR #420)
  - `POST /target-sources/{id}/approval-requests/system-reset` — 반려/UNAVAILABLE 상태에서 IDLE 로 명시적 reset
  - `ApprovalActionResponseDto.status` enum 에 `UNAVAILABLE` 포함
  - `ResourceConfigDto.scan_status` (`UNCHANGED` / `NEW_SCAN`)
  - `ResourceConfigDto.integration_status` (`INTEGRATED` / `NOT_INTEGRATED`)
  - `ExcludedResourceInfo` 에 `resource_name` / `database_type` / `database_region` / `scan_status` / `integration_status` 포함 (Step 3 제외 행에서 사용)
- 기존 swagger: `docs/swagger/confirm.yaml`, `azure.yaml`, `gcp.yaml`, `test-connection.yaml`, `logical-db-status.yaml`
- BFF client 계층: ADR-011 (`docs/adr/011-typed-bff-client-consolidation.md`) — `lib/bff/types.ts` (interface) / `lib/bff/http.ts` (HTTP impl) / `lib/bff/mock-adapter.ts` (mock dispatch) / `lib/bff/mock/confirm.ts` (mock business logic)
- ⛔ ADR-007 은 ADR-011 로 대체되어 파일이 삭제됨 — 본 plan 의 어떤 wave 도 ADR-007 을 reference 하면 안 됨
