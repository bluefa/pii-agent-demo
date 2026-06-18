# IDC Provider 구현 계획 + API 계약 + 마이그레이션 전략

> 대상 프로토타입: `design/SIT Prototype Athena v15.html` (IDC `data-prov-view="idc"` 분기)
> 요구사항 원천: `design/idc-flow-requirements.md` (결정 #1~#58)
> API 계약 원천: `docs/swagger/idc.yaml` (v1.0.0, **provisional** — Forward Compatibility 선언)
> 작성일: 2026-06-16 · 브랜치: `feat/idc-integration`

---

## 0. 이 문서의 목적

IDC(온프레미스) Provider를 기존 7-step SIT 플로우에 추가한다. 핵심 제약 두 가지:

1. **IDC API는 미확정이다.** `docs/swagger/idc.yaml`이 v1.0.0으로 존재하나 "모든 응답 모델은 향후
   확장될 수 있다"고 명시(Forward Compatibility). path·response가 바뀔 수 있으므로, **각 Step이
   호출하는 API와 response 변경 시 마이그레이션 방법을 §4·§5에 정확히 기록**한다.
2. **HTML이 UI 진실의 원천이다.** 디자인·토큰·인터랙션·mock 데이터는 v15 HTML 그대로 구현한다.
   HTML과 idc.yaml이 충돌하는 지점(§6 계약 갭)은 **UI는 HTML을, mock 형태는 (확장된) 계약을** 따르고
   갭을 문서화한다.

구현은 본 문서를 계약으로 삼는다. 구현 중 HTML을 재해석하지 않는다(누락 발견 시 본 문서에 항목을
추가하고 진행).

---

## 1. 기존 코드베이스 매핑 (mirror 대상)

IDC API는 "기존 API를 참고해 최대한 비슷하게" 구현한다. 따라야 할 기존 패턴:

| 계층 | 기존 패턴 | 파일(예시) | IDC 적용 |
|------|----------|-----------|----------|
| Provider 분기 | `ProjectDetail` 가 `cloudProvider` 로 switch | `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx` | `default:` → `case 'IDC'` 추가 |
| Provider 페이지 | `AzureProjectPage` → identity 구성 → `CloudTargetSourceLayout` | `.../_components/azure/AzureProjectPage.tsx` | `IdcProjectPage` 신설 |
| Step 라우팅 | `CloudTargetSourceLayout` 가 `processStatus`(1~7) 로 step 렌더 | `.../_components/layout/CloudTargetSourceLayout.tsx` | `IdcTargetSourceLayout` 신설 (동일 시그니처) |
| Step chrome | `ProjectPageMeta`(identity) + `ProcessStatusCard`(pbar) + `GuideCardContainer` + `RejectionAlert` | `.../layout/WaitingTargetConfirmationStep.tsx` | IDC step 들이 동일 chrome 재사용 |
| 설치 상태 폴링 | `useInstallationStatus({getFn, checkFn})` | `app/hooks/useInstallationStatus.ts` | IDC `getFn=getIdcInstallationStatus`, `checkFn=checkIdcInstallation` |
| BFF client | `BffClient` 인터페이스에 provider namespace(`aws`/`azure`/`gcp`) | `lib/bff/types.ts` | `idc` namespace 추가 |
| BFF http | `httpBff.{provider}.{method}` → upstream `/api/infra/v1/...` | `lib/bff/http.ts` | `httpBff.idc` 추가 |
| BFF mock | `mockBff.{provider}` → `lib/bff/mock/{provider}.ts` → `unwrap(NextResponse)` | `lib/bff/mock-adapter.ts`, `lib/bff/mock/gcp.ts` | `mockBff.idc` + `lib/bff/mock/idc.ts` |
| Mock 로직 | `lib/mock-gcp.ts` (authorize → state → response) + `lib/mock-store.ts` seed | `lib/mock-gcp.ts`, `lib/mock-data.ts` | `lib/mock-idc.ts` |
| Route 핸들러 | `withV1(async (req,{requestId,params}) => bff.{provider}.{method})` | `app/integration/api/v1/azure/.../installation-status/route.ts` | `app/integration/api/v1/idc/...` |
| Client API | `app/lib/api/{provider}.ts` → fetch proxy route | `app/lib/api/gcp.ts` | `app/lib/api/idc.ts` |
| Guide slot | `resolveStepSlot(provider, step)` → `GUIDE_SLOTS['process.{provider}.{step}']` | `.../GuideCard/resolve-step-slot.ts`, `lib/constants/guide-registry.ts` | `process.idc.1..7` |

**이미 부분 스캐폴드됨** (재사용/연결만 필요):
- `CloudProvider` 타입에 `'IDC'` 포함 (`lib/types.ts:23`)
- `providerColors.IDC` = gray-700 계열 (`lib/theme.ts`)
- `SCAN_POLICY.IDC = { enabled: false }` (`lib/constants/scan.ts`) — Step 1에서 scan 대신 수동 입력
- `CloudProviderIcon` IDC glyph, `provider-mapping.ts` IDC chip
- `docs/swagger/idc.yaml` (계약 초안)
- `InstallResourceTable` 의 IDC 컬럼 라벨

---

## 2. 아키텍처 결정

### 2.1 IDC 전용 step stack (cloud step 비침습)

IDC는 7단계 중 **Step 1(scan→수동입력)·Step 4(설치 2-task)** 가 본질적으로 다르고, Step 2·3·5·6·7도
목록 컬럼이 전부 IDC 식별자로 치환된다. 기존 공용 step 컴포넌트(`WaitingTargetConfirmationStep` 등)는
scan/candidate/confirmed 테이블에 강결합되어 있어, 거기에 IDC 분기를 끼우면 AWS/Azure/GCP 회귀 위험이 크다.

**결정:** IDC는 `CloudTargetSourceLayout` 와 동일 시그니처의 `IdcTargetSourceLayout` 을 두고, 7개 IDC
step 컴포넌트를 별도로 둔다. 단, **chrome(identity bar·process bar·guide card·rejection alert)은 공용
컴포넌트를 그대로 재사용**한다. HTML이 IDC를 `data-prov-view="idc"` 로 완전 분리한 것과 일치한다.

```
ProjectDetail (cloudProvider switch)
 └ case 'IDC' → IdcProjectPage (ProjectIdentity 구성: 이름 + Agent 칩만, 결정 #49)
     └ IdcTargetSourceLayout (processStatus switch 1~7)
         ├ 1 IdcStep1TargetInput      (수동입력 + 5 모달 + 제외)
         ├ 2 IdcStep2WaitingApproval  ─┐
         ├ 3 IdcStep3Applying          │ 공용 chrome + <IdcResourceTable cols=...>
         ├ 4 IdcStep4Installing        │  (Step4는 2 install-task + 방화벽 모달 추가)
         ├ 5 IdcStep5ConnectionTest    │
         ├ 6 IdcStep6ConnectionVerified│
         └ 7 IdcStep7Complete         ─┘
```

공용 재사용: `ProjectPageMeta`, `ProcessStatusCard`, `GuideCardContainer`, `RejectionAlert`,
`Pagination`, `Badge`, `Tooltip`/`InfoTooltip`, `CopyButton`, `Modal`, `StepBanner`.

### 2.2 승인 라이프사이클은 공용 confirm 플로우 사용 (중요)

HTML Step 1 버튼은 **"연동 대상 승인 요청"** → Step 2(승인 대기) → Step 3(반영 중) → Step 4(설치)로
진행한다. 이는 cloud와 동일한 승인 라이프사이클이다.

**결정:** IDC의 승인/전이 라이프사이클(Step 1→2→3→4)은 **공용 confirm/approval 플로우**
(`confirm.createApprovalRequest`, admin approve, applying→installing)를 그대로 사용한다. IDC 전용
endpoint는 cloud의 scan/credential을 대체하는 **데이터 영역**(수동입력 리소스, source IP, 방화벽,
설치 상태)에만 쓴다.

> ⚠ idc.yaml의 `POST /confirm-targets`는 description상 "리소스 추가 후 **INSTALLING으로 전이**"라
> 승인(Step2·3)을 건너뛴다. 이는 v15 HTML(Step 1→2 승인)과 불일치한다 → §6 갭 G1. 본 구현은
> HTML을 따라 **승인 플로우를 사용**하고, `confirm-targets`는 "수동입력 리소스를 프로젝트 리소스로
> 확정 저장하는 용도"로만 (전이 부수효과 없이) mock 구현한다. 백엔드 확정 시 §5 절차로 정렬한다.

### 2.3 IDC 리소스 데이터 모델

cloud 리소스(`MockResource`)는 IDC 식별자(구분/host/ips/srcIps/sid/방화벽)를 담지 못한다.
`vmDatabaseConfig?` 선례를 따라 **`MockResource.idcConfig?: IdcResourceConfig`** 를 추가(비침습)한다.
IDC 수동입력 리소스는 `MockResource`(+`idcConfig`)로 저장되어, 승인·confirmed-integration·
test-connection 등 **공용 머신을 그대로 통과**한다. Source IP·방화벽은 IDC 설치 상태 endpoint에서 온다.

---

## 3. 7-Step ↔ ProcessStatus ↔ IDC 화면 매핑

`ProcessStatus`(1~7) = `lib/types.ts`. IDC 컬럼 세트는 v15 HTML `data-idc-cols` 와 1:1.

| Step | ProcessStatus | IDC 화면 | 목록 컬럼 (`IdcResourceTable cols`) | 행 범위 |
|------|--------------|----------|-----|--------|
| 1 | WAITING_TARGET_CONFIRMATION | 연동 대상 DB 입력 (수동) | 편집 테이블: ☑·구분·연동대상·Port·DBType·제외사유·연동완료여부·✎🗑 | 전체 |
| 2 | WAITING_APPROVAL | 승인 대기 | `src excl` | 제외 포함 |
| 3 | APPLYING_APPROVED | 반영 중 | `src excl` | 제외 포함 |
| 4 | INSTALLING | 설치 (2 task) | `src fw` + 2 install-task + 방화벽 모달 | 연동 대상만 |
| 5 | WAITING_CONNECTION_TEST | 연결 테스트 | `src conn` + Run Test | 연동 대상만 |
| 6 | CONNECTION_VERIFIED | 연결 확인 | `src conn` | 연동 대상만 |
| 7 | INSTALLATION_COMPLETE | 설치 완료 | `src health` | 연동 대상만 |

`cols` 토큰: `src`=Source IP(헤더 ⓘ tooltip), `excl`=대상여부 pill+제외사유칩, `fw`=방화벽 상태,
`conn`=Connection(Success/Pending), `health`=Health(Healthy/Unhealthy). Source IP는 **Step 2부터** 노출
(Step 1엔 없음, 결정 #9).

---

## 4. Step별 API 호출 매핑 (핵심)

> 표기: **[IDC]** = `docs/swagger/idc.yaml` 전용, **[공용]** = 기존 confirm/test-connection 등 공유.
> proxy route는 모두 2-hop: 브라우저 `/integration/api/v1/...` → Next route → upstream `/api/infra/v1/...`.
> mock 모드(`USE_MOCK_DATA=true`)에서는 route가 `bff.idc.*`/`bff.confirm.*` → `mockBff` 로 처리.

### Step 1 — 연동 대상 DB 입력 (WAITING_TARGET_CONFIRMATION)

| 사용자 액션 | API | Method · Path | 요청 | 응답 | 비고 |
|------------|-----|--------------|------|------|------|
| 진입 시 목록 로드 | **[IDC]** getIdcResources | `GET /idc/target-sources/{id}/resources` | — | `{ resources: IdcResource[] }` | 임시 저장된 수동입력 목록. **응답은 `IdcResource`(resource_id 필수)** — id 누락은 계약 위반 |
| 연동 대상 추가/수정 → 저장 | **[IDC]** updateIdcResources | `PUT /idc/target-sources/{id}/resources` | `{ resources: IdcResourceInput[] }` | `{ resources: IdcResource[] }` | 요청=`IdcResourceInput`(신규 행 id 없음), 응답=`IdcResource`. 전체 목록 덮어쓰기(임시 저장) |
| 삭제 | **[IDC]** updateIdcResources | `PUT .../resources` | 삭제 후 전체 목록 | 〃 | 클라가 splice 후 PUT |
| 제외/사유 변경 | (로컬 상태) + 위 PUT | — | — | — | `exclusion_reason` 를 IdcResourceInput에 포함(§6 G3) |
| 기존 연동 요청 불러오기 | **[IDC]** getIdcPreviousRequest | `GET /idc/target-sources/{id}/previous-request` | — | `{ resources: IdcResource[] }` | §6 G4 — 전용 endpoint 반영 완료. 확정 시 현재 입력 목록을 응답으로 **전면 교체**. mock은 고정 `IDC_PREV_REQUEST`(7건). 클라는 `useIdcPreviousRequest`(abort+stale-guard)로 로드 |
| "연동 대상 승인 요청" 제출 | **[공용]** createApprovalRequest | `POST /target-sources/{id}/approval-requests` (plural) | `{ resource_inputs:[...selected/excluded] }` | 승인요청 생성 | cloud와 동일. ⏳ Step1 submit→WAITING_APPROVAL 전이 wiring은 백엔드 확정 시 (현재 TODO, §6 G1) |

`IdcResourceInput` (idc.yaml): `name`, `input_format(IP|HOST)`, `ips[]`(≤6, §6 G2), `host`(≤100),
`port`, `database_type`(7종, §6 G5), `service_id`(Oracle), `credential_id`. `구분`은 파생:
`HOST`→Domain / `ips.length>1`→Multiple IP / else Single.

### Step 2·3 — 승인 대기 / 반영 중

| 데이터 | API | 비고 |
|--------|-----|------|
| 프로세스 상태 | **[공용]** `GET .../process-status` (or getProject) | processStatus 판정 |
| 승인 요청 스냅샷(목록) | **[공용]** getApprovalRequestLatest / getApprovedIntegration | 제외 포함 목록 + 사유 |
| Source IP(행별) | **[IDC]** installation-status 의 per-resource (§6 G6) | 승인 후 할당 |

읽기 전용. 제외 행은 비대상 pill + 사유칩(읽기). Step 1의 `confirm.createApprovalRequest` 응답 이후
admin 승인(공용 approve) → APPLYING_APPROVED → INSTALLING 전이는 mock이 진행.

### Step 4 — 설치 (INSTALLING)

| 데이터/액션 | API | Method · Path | 응답 | 비고 |
|------------|-----|--------------|------|------|
| 설치 상태(캐시) | **[IDC]** getIdcInstallationStatus | `GET /idc/target-sources/{id}/installation-status` | `IdcInstallationStatus` | task1=bdc_tf, task2=firewall_opened |
| 설치 상태(강제 갱신) | **[IDC]** checkIdcInstallation | `POST /idc/target-sources/{id}/check-installation` | `IdcInstallationStatus` | useInstallationStatus.refresh |
| 방화벽 확인 모달(행별) | **[IDC]** installation-status 의 per-resource firewall (§6 G6) | (위 GET) | per-resource `firewall_open` | mock 합성 |
| 방화벽 오픈 완료 보고 | **[IDC]** confirmIdcFirewall | `POST /idc/target-sources/{id}/confirm-firewall` | `ConfirmFirewallResponse` | 서비스 담당자 수동 확인 후 |

`IdcInstallationStatus`: `provider:'IDC'`, `bdc_tf:PENDING|IN_PROGRESS|COMPLETED|FAILED`,
`firewall_opened:boolean`, `last_checked_at?`, `error?`. 2 install-task 매핑:
task1 "BDC 측 리소스 설치 진행" ← `bdc_tf`, task2 "방화벽 확인" ← `firewall_opened`(클릭 시 방화벽 모달).

행별 Source IP·방화벽 상태의 **정본은 `installation-status.resources[{resource_id, source_ips, firewall_open}]`**
(idc.yaml 반영). `IdcStep4Installing`이 이 배열을 리소스 행에 병합(동명 필드 우선)해 표/모달에 표시하므로,
실 백엔드의 `GET /resources`가 해당 필드를 생략해도 Step 4는 정상 동작한다(**cutover-safe**). mock은
`/resources`·`installation-status` 양쪽에 동일 값을 실어 데모를 보존한다.

### Step 5·6 — 연결 테스트 / 연결 확인

> ⚠ **현재 구현 = 클라이언트 시뮬레이션 (실 API 미연결).** `IdcStep5ConnectionTest`의 "Run Test"는
> 실제 API를 호출하지 않고 로컬 `setTimeout`(~1.8s) 후 각 행 `connection`을 `SUCCESS`로 낙관적 갱신한다
> (HTML `runIdcConnTest` 재현). 아래 공용 API는 **백엔드 cutover 시 연결할 대상**이며 현재는 미연결이다.

| 액션 | API (cutover 대상) | 비고 |
|------|-----|------|
| 테스트 실행 | **[공용]** testConnection (async) | `POST /target-sources/{id}/test-connection` → 202 `{id}` |
| 결과 폴링 | **[공용]** getTestConnectionLatest | `GET .../test-connection/latest` → `{status, resource_results[]}` |
| Source IP 추천(참고) | **[IDC]** getIdcSourceIpRecommendation | `GET /idc/source-ip-recommendation?ipType=` (방화벽 안내용, 선택) |

**Cutover 절차:** `runTest`의 `setTimeout` 블록을 `testConnection` 호출 + `getTestConnectionLatest`
폴링(`useTestConnectionPolling` 재사용)으로 교체. 도메인 모델(`IdcResourceView.connection`)은 그대로라
테이블/배지 UI는 무변경.

### Step 7 — 설치 완료

| 데이터 | API | 비고 |
|--------|-----|------|
| Health | **[공용]** getProject / confirmed-integration health | Healthy/Unhealthy |
| 완료 확정(admin) | **[공용]** confirmCompletion / completeInstallation | CONNECTION_VERIFIED→COMPLETE |

### API 인벤토리 (IDC 전용)

| operationId | Method · Path | x-expected-duration | 본 구현 사용처 |
|-------------|--------------|--------------------|--------------|
| getIdcResources | GET `/idc/target-sources/{id}/resources` | 100ms | Step 1 로드 |
| getIdcPreviousRequest | GET `/idc/target-sources/{id}/previous-request` | 100ms | Step 1 "기존 연동 요청 정보 불러오기" (§6 G4) |
| updateIdcResources | PUT `/idc/target-sources/{id}/resources` | 200ms | Step 1 추가/수정/삭제(임시저장) |
| updateIdcResourcesList | PUT `/idc/target-sources/{id}/resources/list` | 300ms | (미사용, §6 G1 — 문서화만) |
| confirmIdcTargets | POST `/idc/target-sources/{id}/confirm-targets` | 500ms | (대체 경로, §6 G1) |
| getIdcInstallationStatus | GET `/idc/target-sources/{id}/installation-status` | 200ms~1s | Step 4 |
| refreshIdcInstallationStatus | POST `/idc/target-sources/{id}/check-installation` | 1s~30s | Step 4 강제 갱신 |
| confirmIdcFirewall | POST `/idc/target-sources/{id}/confirm-firewall` | 200ms | Step 4 방화벽 완료 |
| getIdcSourceIpRecommendation | GET `/idc/source-ip-recommendation?ipType=` | 50ms | Step 5 참고(선택) |

---

## 5. API 마이그레이션 전략 (핵심)

IDC API는 **path·response가 바뀔 수 있다.** 변경 충격을 한 곳에 가두기 위한 격리 규칙:

### 5.1 격리 계층 — "wire 형태는 BFF 경계에서만 안다"

```
UI/hook  ──IdcResourceView (앱 도메인 모델, §5.3)──▶  app/lib/api/idc.ts (client mapper)
                                                          │  ← 여기서만 wire snake_case ↔ 도메인 camelCase 변환
                                                          ▼
                                              route.ts (withV1, 얇음)
                                                          ▼
                                              bff.idc.* (lib/bff/http.ts | mock-adapter)
                                                          ▼  ← upstream path 는 여기 한 곳
                                              /api/infra/v1/idc/...
```

- **UI 컴포넌트는 wire 타입(snake_case)을 직접 만지지 않는다.** 항상 `app/lib/api/idc.ts`가 반환하는
  도메인 모델(`IdcResourceView` 등)만 사용. response가 바뀌면 mapper 1곳만 고친다.
- **upstream path 는 `lib/bff/http.ts` 의 idc 메서드에만 하드코딩.** path가 바뀌면 그 메서드만 수정.
- **wire DTO 는 `lib/bff/types/idc.ts` 에 격리.** idc.yaml과 1:1. 스키마 변경 시 이 파일이 진단 지점.

### 5.2 변경 시나리오별 절차

| 변경 종류 | 영향 파일 | 절차 |
|----------|----------|------|
| **path 변경** (예: `/idc/...` → `/idc/v2/...`) | `lib/bff/http.ts` (idc 메서드) | 해당 메서드 URL만 수정. 그 외 무변경 |
| **응답 필드 추가** | 없음(Forward Compat) | 무시 가능. 필요 시 `lib/bff/types/idc.ts`에 옵셔널 추가 → mapper에서 채택 |
| **응답 필드 이름 변경** (예: `bdc_tf`→`bdc_terraform_status`) | `lib/bff/types/idc.ts` + `app/lib/api/idc.ts` mapper | 타입 rename → mapper의 해당 한 줄 수정. UI 무변경 |
| **응답 구조 변경** (예: firewall 글로벌 boolean → per-resource 배열) | `lib/bff/types/idc.ts` + mapper + mock | mapper가 신/구 형태를 흡수(§6 G6 참고 구현이 이미 per-resource 도메인 모델). UI 무변경 |
| **enum 확장** (DB type 4→7) | `lib/bff/types/idc.ts` + `lib/constants/idc.ts` | enum 추가 + display 매핑 추가 |
| **요청 형태 변경** | `app/lib/api/idc.ts` + `lib/bff/types/idc.ts` | client mapper에서 도메인→wire 변환 1곳 수정 |

### 5.3 도메인 모델 (UI 계약, wire와 분리)

`app/lib/api/idc.ts` 가 반환/입력하는 안정적 도메인 타입. **UI는 이것만 의존.**

```ts
type IdcKind = 'SINGLE' | 'MULTIPLE_IP' | 'DOMAIN';
type IdcConnState = 'PENDING' | 'SUCCESS';
type IdcHealth = 'HEALTHY' | 'UNHEALTHY';

interface IdcResourceView {
  resourceId: string;
  kind: IdcKind;            // input_format + ips.length 에서 파생
  hosts: string[];          // ip 모드면 ips, domain 모드면 [domain]
  port: number;
  databaseType: string;     // 표시명 (MySQL, Oracle, ...)
  oracleSid?: string;
  sourceIps: string[];      // Step2+ 할당 (per-resource, §6 G6)
  firewallOpen: boolean;    // Step4 (per-resource, §6 G6)
  connection: IdcConnState; // Step5/6
  health: IdcHealth;        // Step7
  excluded: boolean;
  exclusionReason?: string;
}
```

wire(`IdcResourceInput`, snake) ↔ 도메인(`IdcResourceView`, camel) 변환은 `app/lib/api/idc.ts`
단일 지점. response가 흔들려도 UI/mock-seed 형태는 이 모델로 고정된다.

### 5.4 계약 검증

- `docs/swagger/idc.yaml` 은 본 구현에 맞춰 **갱신 완료** — `ips.maxItems: 6`, DB enum 7종,
  `GET /previous-request`, `IdcInstallationStatus.resources[{resource_id, source_ips, firewall_open}]`,
  `IdcResourceInput`의 `resource_id`/`exclusion_reason`/`source_ips`/`firewall_open`/`connection_status`/`health`/`done`.
  이제 swagger 가 현재 wire DTO(`lib/bff/types/idc.ts`)와 1:1 일치한다. **swagger = 정본**(Contract-First,
  route.ts 파싱 금지). 타입은 yaml에서 도출.
- mock 응답은 wire 형태(snake)로 반환 → `app/lib/api/idc.ts` mapper가 도메인으로 변환. 실 API 교체 시
  mapper·UI 무변경, `lib/bff/http.ts` 만 활성.

---

## 6. 계약 갭 (HTML/요구사항 ↔ idc.yaml) — 결정 기록

> **"idc.yaml (갱신 전)" 컬럼은 작성 시점의 원래 yaml 상태**이며, "현재 상태" 컬럼이 본 PR 반영 후를 가리킨다.

| # | 갭 | idc.yaml (갱신 전) | HTML/요구사항 (진실) | 현재 상태 (본 PR 반영 후) |
|---|-----|----------|---------------------|------|
| G1 | 승인 플로우 | `confirm-targets` → INSTALLING 직행 | Step1→2(승인)→3→4 | **HTML 채택.** 승인은 공용 confirm 플로우. `confirm-targets`는 전이 부수효과 없이 리소스 확정 저장으로만 mock. ⏳ 백엔드 의존: yaml transition 문구 분리 + Step1 submit 전이 wiring |
| G2 | IP 최대 개수 | `ips.maxItems: 3` | `IDC_MAX_IPS = 6` (결정 #52) | **6 채택.** ✅ yaml `maxItems: 6` 반영 완료 |
| G3 | 제외 사유 필드 | `IdcResourceInput`에 없음 | 제외 사유 필수(결정 #27·28) | 도메인 모델 `excluded`/`exclusionReason`. ✅ yaml `IdcResourceInput.exclusion_reason?` 반영 완료. (승인요청 본문의 확정 경로는 ⏳ 백엔드 확정 시 정렬) |
| G4 | 기존 요청 불러오기 | 전용 endpoint 없음 | "기존 연동 요청 정보 불러오기"(결정 #10·44) | ✅ 전용 `GET /previous-request` yaml 반영 완료. mock은 고정 `IDC_PREV_REQUEST`(7건) |
| G5 | DB Type enum | `ORACLE/MYSQL/POSTGRESQL/MSSQL` (4) | MySQL/PostgreSQL/Oracle/MSSQL/**MariaDB/MongoDB/Redis** (7, 결정 #54) | **7 채택.** ✅ yaml enum 7종 반영 완료. 기본 포트 매핑 동반(§7) |
| G6 | Source IP·방화벽 입자 | `firewall_opened: boolean`(글로벌), Source IP 행별 필드 없음 | 행별 Source IP(1~2개)·행별 방화벽 상태 필요(Step2+, Step4 모달) | **도메인 모델 per-resource**(`sourceIps[]`, `firewallOpen`). ✅ yaml `installation-status.resources:[{resource_id, source_ips[], firewall_open}]` 반영 완료. Step 4가 이를 행에 병합(**cutover-safe**). 글로벌 `firewall_opened`는 roll-up(전 행 open) |
| G7 | Source IP 출처 | recommendation(글로벌) 만 존재 | 행별 할당값(승인 후) | admin `nlb_index` 할당의 SIT 표현(admin-page-requirements §4.3.5). mock 고정값(172.16.0.11/.12). ⏳ 실 계약 confirmed/installation 노출은 백엔드 확정 시 |

> 위 갭은 모두 "API 미확정"의 자연스러운 결과다. **본 구현은 HTML을 따른다.**
> **idc.yaml 반영 완료:** G2(maxItems 6) · G4(`/previous-request`) · G5(DB 7종) ·
> G6(`installation-status.resources` 행별) — swagger 가 현재 wire DTO와 일치한다.
> **남은 백엔드 의존 항목(cutover 시 §5.2 절차):** G1(승인 전이 분리 + Step1 submit→WAITING_APPROVAL wiring) ·
> G3(임시저장 `exclusion_reason` 확정) · Step 5 연결 테스트 실 API 연결(§4 참조, 현재 클라이언트 시뮬레이션).
> Step 4 Source IP·방화벽은 `installation-status.resources` 병합으로 이미 cutover-safe.
>
> **액션 CTA stub (의도된 설계):** Step 5 "완료 승인 요청" · Step 6 "연결 테스트 재실행" · Step 7 "인프라 변경 / 연결
> 테스트 재실행"은 **클라우드 형제(`ConnectionVerifiedStep`/`InstallationCompleteStep`)와 동일하게** `toast.info(… 준비중)`
> stub이다. HTML 시안에 버튼이 노출되므로 가시성은 유지하고(시안 충실), 실 API(승인/테스트/인프라변경)는 백엔드
> 확정 시 연결한다. 형제 provider와 동일 동작이라 IDC만의 결함이 아니다.

---

## 7. 상수 & 매핑 (`lib/constants/idc.ts`)

```ts
export const IDC_MAX_IPS = 6;                         // 결정 #52 (yaml 3 → 6)
export const IDC_DOMAIN_MAXLEN = 100;                 // 결정 #56
export const IDC_REASON_MAXLEN = 200;                 // 결정 #28
export const IDC_EXCL_PRESETS = ['임시DB', 'StageDB', 'DevDB'] as const;
export const IDC_LOAD_PER = 5;                        // 불러오기 모달 페이지당

// DB Type 표시명 ↔ wire enum, + 기본 포트(결정 #54)
export const IDC_DB_TYPES = [
  { label: 'MySQL',      wire: 'MYSQL',      port: 3306  },
  { label: 'PostgreSQL', wire: 'POSTGRESQL', port: 5432  },
  { label: 'Oracle',     wire: 'ORACLE',     port: 1521  },  // SID 필수
  { label: 'MSSQL',      wire: 'MSSQL',      port: 1433  },
  { label: 'MariaDB',    wire: 'MARIADB',    port: 3306  },
  { label: 'MongoDB',    wire: 'MONGODB',    port: 27017 },
  { label: 'Redis',      wire: 'REDIS',      port: 6379  },
] as const;

export const IDC_SOURCE_IP_TOOLTIP =
  '방화벽 등록 필요\nBDC Agent가 DB에 접근할 때 사용하는 출발지 IP예요. 서비스 측 방화벽에서 ' +
  'Source IP → 연동 대상(IP:Port) 허용 규칙을 등록해야 연결 테스트를 통과할 수 있어요.';
```

**검증 규칙**(HTML `validateIdcTargetForm`): IPv4(옥텟≤255), 끝 공백 감지→경고+저장차단(결정 #35),
IP 중복 차단(결정 #55), Domain FQDN + maxlen 100(결정 #56), Port 1~65535, Oracle SID 필수(결정 #4),
필수 미충족 시 `추가` disabled. 인라인 에러(toast 금지).

---

## 8. 디자인 / 토큰 매핑

HTML raw 값 → `lib/theme.ts` 토큰. **raw 색상 클래스 직접 사용 금지** — 토큰/UI 컴포넌트만.

> **반영 완료 (IDC-scoped exact match).** 아래는 구현된 최종 매핑이다. IDC는 공유 `Badge`/`tagStyles`/
> `Button`/`Modal`/`tableStyles` 대신 **`idcStyles.*` + `modalStyles.toss`** (프로토타입 정확 hex)를 쓴다.
> 형제 provider(AWS/Azure/GCP)는 미변경. 신규 IDC 디자인 작업도 이 표를 따른다.

| HTML | 의미 | 토큰 (lib/theme.ts) |
|------|------|--------------|
| `.idc-kind.single/.multi/.domain` | 구분 배지 | `idcStyles.kindBadge.{single,multi,domain}` (+`.base`) |
| `.tag.blue` (DB Type) | DB Type 배지 | `idcStyles.tag.blue` (+`.base`) |
| `.tag.green` 방화벽 오픈/Success | 성공 배지 | `idcStyles.tag.green` |
| `.tag.red` 오픈되지 않음 | 실패 배지 | `idcStyles.tag.red` |
| `.tag.orange` Pending | 진행 배지 | `idcStyles.tag.orange` |
| `.status.healthy/.unhealthy` (점+텍스트, bg 없음) | Health | `idcStyles.status` (`.base`/`.dot`/`.healthy`/`.unhealthy`) |
| `.idc-ep-toggle` / `.idc-sid-k` | 멀티 IP 더보기 / SID 키 | `idcStyles.epToggle` / `idcStyles.sidKey` |
| `.idc-field-warn` / `.idc-field-err` | 인라인 경고/오류 | `idcStyles.fieldWarn` / `idcStyles.fieldError` |
| `.idc-add-ip` / `.rm-ip` | IP 추가/삭제 | `idcStyles.addIp` / `idcStyles.removeIp` |
| `.idc-row-actions button(.del)` | 행 수정/삭제 | `idcStyles.rowAction` / `idcStyles.rowActionDelete` |
| `.idc-reason-pop` | 제외 사유 팝오버 | `idcStyles.popover.*` |
| `.idc-ip-warn` / `.idc-load-note` | amber 경고 배너 | `idcStyles.warnBanner` |
| `.btn.soft`/`.warn-outline`/`.primary` (카드 CTA, h40) | 추가/불러오기/승인요청 | `idcStyles.triggerBtn.{soft,warnOutline,primary}` |
| `.modal-footer .btn.*` (52px) | 모달 푸터 버튼 | `idcStyles.modalBtn.{primary,outline}` |
| `.field input/select/textarea` (borderless #F7F8FA) | 모달 입력 | `idcStyles.input` / `idcStyles.textarea` |
| `.db-table` 헤더(13/700 #4E5968 비대문자) | IDC 테이블 | `idcStyles.table.{header,headerCell,body,row,cell}` |
| `.modal` Toss chrome (radius24/26px/흰 footer/amber icon) | IDC 모달 외관 | `<Modal chrome="toss" tone="info\|warn">` + `modalStyles.toss` |
| 스켈레톤 shimmer | 불러오기 로딩 | `idcStyles.skeletonBar` |
| `.status` pill 승인 대기/Healthy | 헤더 상태 pill | `idcStyles.statusPill` + `statusColors.{warning,success}` |
| `--color-provider-idc` #374151 | IDC accent | `providerColors.IDC` (gray-700) |
| `.reason-chip-inline` / `.th-tip` Source IP ⓘ | 사유칩 / 헤더 tooltip | 기존 `ReasonChipInline` / `InfoTooltip` 재사용 |

간격/모서리: card-padding 24, section-gap 24, form-gap 20 / rounded 6·8·12·14·24·full. 타이포: page/card 토큰 + 9-stop scale.

---

## 9. Mock 데이터 (API response 형태 일치)

mock은 wire 형태(snake)로 반환하여 실 API와 동일하게 동작. seed는 v15 HTML `idcTargets`(3건) +
`IDC_PREV_REQUEST`(7건) 그대로.

**`idcTargets` seed (Step 진행 데모용, `lib/mock-idc.ts`)** — 도메인 표현:
1. Single `10.20.30.40:3306` MySQL · srcIp 172.16.0.11 · fw=open · conn=success · healthy
2. Multiple IP `10.20.31.10(+2):1521` Oracle SID(긴 값) · srcIp .11/.12 · fw=closed · conn=pending · unhealthy
3. Domain `analytics-...svc-a...io:5432` PostgreSQL · srcIp .12 · **제외(StageDB)**

**`IDC_PREV_REQUEST` seed (불러오기 7건)**: MySQL/Oracle(2IP,SID ORCL)/PostgreSQL(제외 StageDB)/
MySQL/MongoDB/Redis(제외, custom 사유)/MSSQL. (HTML 9810~9817 그대로)

`getIdcInstallationStatus` mock: 프로젝트 단계에 따라 `bdc_tf`(INSTALLING이면 IN_PROGRESS→COMPLETED),
`firewall_opened`(roll-up), per-resource `{resource_id, source_ips, firewall_open}`(G6 도메인용).

---

## 10. 파일 구현 계획

### 신규
```
lib/bff/types/idc.ts                       # wire DTO (idc.yaml 1:1, 7 DB type)
lib/constants/idc.ts                       # 상수·DB type 매핑·검증 상수
lib/mock-idc.ts                            # mock 로직(authorize→state→wire response) + seed
lib/bff/mock/idc.ts                        # mockBff.idc 핸들러(NextResponse)
app/lib/api/idc.ts                         # client api + wire↔도메인 mapper (IdcResourceView)
app/hooks/useIdcResources.ts               # (선택) Step1 목록 상태 훅
app/integration/api/v1/idc/target-sources/[targetSourceId]/resources/route.ts          # GET/PUT
app/integration/api/v1/idc/target-sources/[targetSourceId]/installation-status/route.ts # GET
app/integration/api/v1/idc/target-sources/[targetSourceId]/check-installation/route.ts  # POST
app/integration/api/v1/idc/target-sources/[targetSourceId]/confirm-firewall/route.ts    # POST
app/integration/api/v1/idc/source-ip-recommendation/route.ts                            # GET
app/integration/target-sources/[targetSourceId]/_components/idc/
  IdcProjectPage.tsx
  IdcTargetSourceLayout.tsx
  IdcResourceTable.tsx                     # 공용 IDC 테이블(cols 가변)
  cells.tsx                                # idcKind/idcEndpoint/idcSrcIp/idcDbTag/badges
  steps/IdcStep1TargetInput.tsx
  steps/IdcStep2WaitingApproval.tsx
  steps/IdcStep3Applying.tsx
  steps/IdcStep4Installing.tsx
  steps/IdcStep5ConnectionTest.tsx
  steps/IdcStep6ConnectionVerified.tsx
  steps/IdcStep7Complete.tsx
  modals/IdcTargetFormModal.tsx            # 연동 대상 추가/수정
  modals/IdcLoadRequestModal.tsx           # 기존 요청 불러오기
  modals/IdcSubmitModal.tsx                # 승인 요청 확인
  modals/IdcExclusionReasonModal.tsx       # 제외 사유 직접 입력
  modals/IdcFirewallModal.tsx              # 방화벽 확인
  IdcExclusionPopover.tsx                  # 제외 사유 선택 popover
  index.ts
```

### 수정 (최소 침습)
```
lib/types.ts                               # IdcInputFormat/IdcDatabaseType/IdcResourceConfig + MockResource.idcConfig?
lib/bff/types.ts                           # BffClient.idc namespace
lib/bff/http.ts                            # httpBff.idc
lib/bff/mock-adapter.ts                    # mockBff.idc
lib/mock-data.ts (or mock-store)           # IDC 프로젝트 seed (processStatus별 데모 타깃소스)
app/integration/.../ProjectDetail.tsx      # case 'IDC'
lib/constants/guide-registry.ts            # process.idc.1..7 + IDC guide names
app/components/features/process-status/GuideCard/resolve-step-slot.ts  # IDC 분기
lib/bff/mock/guides.ts (seed)              # IDC 가이드 ko/en seed
docs/swagger/idc.yaml                      # §6 갭 반영(7 DB type, ips 6, firewall per-resource, exclusion_reason)
```

---

## 11. 검증 기준 (Definition of Done)

1. `USE_MOCK_DATA=true` dev 서버에서 IDC 타깃소스 진입 → Step 1~7 전 화면이 HTML과 일치.
2. Step 1: 추가/수정/삭제, 5개 모달, 제외 popover+직접입력, 승인요청 가드(연동 0건 disabled) 동작.
3. Step 4: 2 install-task + 방화벽 모달(행별 Source IP→대상→오픈여부), check-installation 갱신.
4. Step 5: Run Test → Testing… → Success 전이.
5. 디자인: raw 색상 클래스 0건(토큰만), `any` 0건, 상대경로 import 0건.
6. `npx tsc --noEmit` · `npm run lint` · `npm run build` 통과.
7. mock 응답이 wire 형태(snake) → `app/lib/api/idc.ts` mapper 통과 → UI는 도메인 모델만 사용.
8. §4 API 매핑·§5 마이그레이션·§6 갭이 문서와 코드에서 일치.
```
