# Admin Pipeline — 컴포넌트 명세 (HTML 구현 전 계획서)

> 원본 요구사항: `Admin Pipeline Dashboard — 페이지별 기능·API 매핑`(대화 내 문서, 이하 **원본**) ·
> IA/와이어프레임: `design/admin-page-requirements.md` §4.1/§4.4 ·
> 디자인 토큰: `design/v15-extract/00-tokens.md`(Toss 토큰) ·
> 도메인 용어(enum): `design/pipeline/adr-016.html`(§Schema), 실행 모델: `adr-021.html`.
>
> 목적: **HTML을 만들기 전에** 4개 페이지가 필요로 하는 컴포넌트를 정확히 나열하고,
> 각 컴포넌트가 렌더하는 데이터 원천(✅/⚙️/⚠️/❌)과 페이지 이동을 확정한다.
> 구현 산출물: `design/pipeline/admin-pipeline.html`(단일 파일, 해시 라우팅, mock 데이터).
>
> **표기 규칙 (리뷰 반영)**: 컴포넌트 id = `C#`(셸)·`P#`(프리미티브), **API id = `A#`**(네임스페이스 분리).
> §4 표의 `A#`는 전부 신규 API를, `P#`는 프리미티브를 가리킨다.

## 0. 전제 · 렌더 가능성 범례 (원본 부록 그대로)

- ✅ **표시 가능** — 이 저장소(ADR-016) 엔티티 필드로 그대로 렌더.
- ⚙️ **파생/집계** — 계산해서 렌더(근사치는 배지 표기).
- ⚠️ **외부 조인 필요** — target-source 등 **다른 repo** 값(여기선 id만). 배지로 "외부" 표기.
- ❌ **표시 불가(현재)** — ADR-021 실행 필드/제거 필드 등 데이터 자체가 없음. 화면엔 "미제공" placeholder로 노출.
- 🔵 **기존 API** — 다른 서비스에 이미 존재(✅ 취급).

> 원칙: ❌/⚠️ 항목도 **숨기지 않고** 상태를 명시(placeholder/배지)한다. 화면이 "다 된 것처럼" 보이지 않게 한다.

### 도메인 enum 고정 (adr-016.html §Schema — 값 그대로 사용, 리뷰 확인)

- `PipelineStatus` = **RUNNING · DONE · FAILED · CANCELLED** (4종. `QUEUED`/`WAITING_SLOT` **없음** — adr-021 §명시).
- `TaskStatus` = **BLOCKED · READY · IN_PROGRESS · DONE · FAILED · CANCELLED** (6종).
  - "외부 대기"는 별도 status가 아니라 **`TaskKind = CONDITION_CHECK`** 로 표현된다(WAITING_EXTERNAL/EXPIRED 상태 없음 — admin-page-requirements §4.4.3의 명칭과 다르며, 이 저장소는 ADR-016 도메인을 따른다).
- `TaskKind` = **TERRAFORM_JOB · CONDITION_CHECK**.
- `PipelineType` = **INSTALL · DELETE**.
- 표시 라벨은 한국어 가능하나(예: DONE→"성공/완료"), **enum 값은 위 영문 그대로** 렌더·비교.

## 1. 디자인 토큰 (Toss 계열 — 두 `:root` 모두 이식)

`00-tokens.md`의 **1st `:root`(색상: primary/status/provider/gray)** + **2nd `:root`(Toss surface)** 를
모두 HTML `:root`로 이식한다(리뷰: 색·라디우스가 2nd에만 있는 게 아님). 화면이 실제 쓰는 값:

| 용도 | 토큰 | 값 |
|---|---|---|
| 페이지 배경 | `--toss-page-bg` | `#F2F4F6` (스타일시트 토큰값 채택. 렌더 override `#F4F4FB`는 미채택) |
| 카드 | `--toss-card-bg` / `--toss-radius-card` | `#FFFFFF` / `20px` |
| 내부 surface | `--toss-inner-bg` / `--toss-radius-inner` | `#F7F8FA` / `12px` |
| 구분선 | `--toss-divider` | `#EBEEF2` |
| pill 라디우스 | `--toss-radius-pill` | **`10px`** (1st `:root`의 9999px `--radius-pill` 아님) |
| 카드 라디우스(소) | `--toss-radius-card-sm` | `16px` |
| 텍스트 | strong/medium/weak/faint | `#191F28` / `#4E5968` / `#8B95A1` / `#B0B8C1` |
| Primary | `--color-primary` / hover / light | `#0064FF` / `#0050D6` / `#E8F1FF` |
| 상태색 | success/error/warning/pending/info | `#45CB85` / `#EF4444` / `#F97316` / `#9CA3AF` / `#3B82F6` |
| Provider | aws/azure/gcp/idc/sdu | `#FF9900` / `#0078D4` / `#4285F4` / `#374151` / `#9333EA` |
| 그림자 sm | `--toss-shadow-sm` | `0 1px 2px rgba(17,24,39,0.04), 0 4px 16px -8px rgba(17,24,39,0.06)` |
| 그림자 md | `--toss-shadow-md` | `0 2px 4px rgba(17,24,39,0.04), 0 12px 32px -12px rgba(17,24,39,0.10)` |
| 폰트 | 본문 Geist, mono Geist Mono, base 15px, `letter-spacing -0.018em`(전역) | |

### enum → 상태색 매핑 (고정 — HTML 결정론화, 리뷰 반영)

| enum | 색 토큰 | 용도 |
|---|---|---|
| `RUNNING` / `IN_PROGRESS` | info `#3B82F6` | 진행 |
| `READY` | info-light/primary-light 배경 + info 텍스트 | 실행 대기 |
| `DONE` | success `#45CB85` | 완료/성공 |
| `FAILED` | error `#EF4444` | 실패 |
| `CANCELLED` | pending `#9CA3AF` | 취소 |
| `BLOCKED` | faint `#B0B8C1` / gray | 선행 대기 |

Pill: 배경 = 상태색 12% tint, 텍스트 = 상태색 dark, 좌측 6px dot, radius `--toss-radius-pill`.

## 2. 공통 셸(Chrome) 컴포넌트

| # | 컴포넌트 | 역할 | 데이터 |
|---|---|---|---|
| C1 | `AppTopNav` | 상단 nav `[SIT 연동] [관리자●]` | 정적 |
| C2 | `AdminSidebar` | 좌측 메뉴. 항목: `대시보드`, `서비스·대상 검색` (대상 이력·상세는 drill-down → 사이드바 항목 아님) | 정적 + active 라우트 |
| C3 | `Breadcrumb` | 깊은 라우트 경로 표시. **소스 규칙**: 이동 시 `navState`(선택 service/target 라벨)를 함께 넘겨 렌더. 대시보드→상세처럼 service/target 컨텍스트가 없으면 **해당 조각 생략**하고 `PipelineDetail.target`(id)만 노출. `#/pipeline/:id` 라벨은 `#{id}` | `navState` + 라우트 param |
| C4 | `PageHeader` | 페이지 제목 + 우측 액션 슬롯 | 정적 |
| C5 | `Router` | 해시 라우팅으로 뷰 교체. **기본 라우트 `#/dashboard`**(빈 해시), **미매칭 시 404 fallback 뷰** | `location.hash` |

## 3. 재사용 프리미티브

| # | 컴포넌트 | props(핵심) | 쓰이는 곳 |
|---|---|---|---|
| P1 | `StatCard` | label, value, tone(normal/approx/unavailable), sub? | 대시보드 live/period |
| P2 | `PipelineStatusPill` | status: RUNNING/DONE/FAILED/CANCELLED | 목록·상세·이력 |
| P3 | `TaskStatusPill` | status: BLOCKED/READY/IN_PROGRESS/DONE/FAILED/CANCELLED | Task 흐름·상세 |
| P4 | `ProviderTag` | provider(aws/azure/gcp/idc/sdu) → 색 dot+라벨. `external` 플래그면 점선 배지(⚠️ 외부 조인) | 목록·이력·헤더 |
| P5 | `ProgressBar` | done, total → **고정폭 트랙 + 비율 fill(width=done/total)** + `N/M` 라벨(§4.5a). per-task 셀 아님 | 목록·이력 카드 |
| P6 | `DataTable` | columns[], rows[], onRowClick | 목록·이력·attempt |
| P7 | `Pagination` | page, size, total | 목록·이력 |
| P8 | `FilterBar` | periodToggle(1h/1d/7d) / status·provider select / searchInput (조합은 사용처별) | 대시보드 |
| P9 | `Button` | variant: primary/secondary/ghost/danger | 전역 |
| P10 | `Modal` | title, body, footer. **종류 2개: preview / cancel** (reject 없음 — Queue Board 전용이라 범위 밖) | §4.3·§4.4 |
| P11 | `Toast` | message, tone | 실행/취소 결과 |
| P12 | `FieldTag` | 데이터 원천 배지: `외부(⚠️)` / `근사(⚙️)` / `미제공(❌)` / `null` | 전역(정직성) |
| P13 | `EmptyState` | icon, text | 이력/검색 결과 없음(§4.2·§4.3에서 실제 사용) |
| P14 | `KeyValueGrid` | rows[{label,value,tag?}] | 상세 메타·헤더 |
| P15 | `TaskNode` | seq, kind, operation, status, failCount, times → 흐름 노드 1개 | 파이프라인 상세 |
| P16 | `Collapsible` | summary, body (네이티브 `<details>`) | 권한 사용자·미제공 메타 그룹 |
| P17 | `SelectableList` | items[], selectedId, onSelect (radio형 `● item`) | §4.2 서비스 목록 |

## 4. 페이지별 컴포넌트 구성 + API + 이동 + 레이아웃 스케치

### 4.1 대시보드 `#/dashboard` — `admin/pipeline/dashboard`

```
┌ Sidebar ┬─ 대시보드 ─────────────────────────────────────────────┐
│●대시보드 │  실시간 현황(순간값)                                     │
│ 서비스   │  ┌ StatCard ┐ ┌ StatCard ┐ ┌ StatCard ┐               │
│ 검색     │  │동작중 P   │ │사용 slot  │ │동작중 TF │               │
│          │  │  3   ✅   │ │ 3 / — ❌ │ │ 5  ⚙️근사│               │
│          │  └──────────┘ └──────────┘ └──────────┘               │
│          │  기간 통계                            [기간: 1h|1d|7d]   │
│          │  ┌ Running 8 ┐ ┌ Failed 2 ┐ ┌ 성공(DONE) 41 ┐         │
│          │  ─────────────────────────────────────────────────────│
│          │  파이프라인 목록   🔍 target  [상태▾][Provider▾]   ⟳    │
│          │  ┌ DataTable ───────────────────────────────────────┐ │
│          │  │ target        Provider   상태     진행    상세    │ │
│          │  │ ts-aws-001    AWS ⚠️외부 RUNNING ▓▓░░2/4 [상세]  │ │
│          │  │ ts-gcp-002    GCP ⚠️외부 DONE    ▓▓▓▓4/4 [상세]  │ │
│          │  └──────────────────────────────────────────────────┘ │
│          │                                    ‹ 1 2 3 › Pagination│
└──────────┴────────────────────────────────────────────────────────┘
```

| 블록 | 컴포넌트 | 데이터 / 원천 | 표시 |
|---|---|---|---|
| 실시간 현황 | `LiveStatsRow` = 3×`StatCard` | ① 동작중 파이프라인 = 사용중 slot `count(RUNNING)` ✅ / ② **총 slot 리밋**(구 Worker): 분자=RUNNING count ✅, **분모=❌**(ADR-021) → `3 / —` + `FieldTag(미제공)` / ③ 동작중 TF task `count(kind=TERRAFORM_JOB, IN_PROGRESS)` ⚙️ `근사` 배지 | A1 |
| 기간 통계 | `PeriodStatsRow` = 3×`StatCard` + `FilterBar(period)` | Running/Failed/**DONE(성공)** 집계(`created_at` 기준, 원본 Q2) ✅. **기간 토글은 이 블록에 귀속** | A2 |
| 파이프라인 목록 | `PipelineListTable` = `DataTable`+`Pagination`+`FilterBar(search target + status + provider)` | target(id ✅) / **CSP(⚠️→`ProviderTag.external`)** / status(P2) / 진행 N/M(P5 ⚙️) / 상세 | A3 |

- **⚠️ 근거 명시**: 목록의 CSP는 pipeline repo에 없어 `external`. §4.3 헤더의 CSP는 `getTargetSourceDetail`(=다른 repo 직접 호출)이라 🔵✅ — 상충 아님.
- **이동**: 목록 행 `상세` → `#/pipeline/:pipelineId` (navState에 target id만 전달, service는 없음 → breadcrumb 생략)

### 4.2 서비스·대상 검색 `#/services` — `admin/pipeline/services`

```
┌ Sidebar ┬─ 서비스·대상 검색 ──────────────────────────────────────┐
│ 대시보드 │  ┌ ServiceSearchPanel ┐  ┌ TargetSourceList ──────────┐ │
│●서비스   │  │ 🔍 서비스 코드 검색 │  │ Provider   TargetSourceId   │ │
│ 검색     │  │ ● svc-alpha  ←P17  │  │ AWS        ts-aws-001    ›  │ │
│          │  │   svc-beta         │  │ GCP        ts-gcp-002    ›  │ │
│          │  │   svc-gamma        │  │ IDC        ts-idc-003    ›  │ │
│          │  │ (PageServiceItem)  │  │ (미선택 시 P13 EmptyState)   │ │
│          │  └────────────────────┘  └─────────────────────────────┘ │
│          │  ▸ (참고) 서비스 권한 사용자  ← P16 Collapsible            │
└──────────┴────────────────────────────────────────────────────────┘
```

| 블록 | 컴포넌트 | 데이터 / 원천 | 표시 |
|---|---|---|---|
| 좌: 서비스 검색 | `ServiceSearchPanel` = 단순 `<input>`(P8 FilterBar 아님) + `SelectableList(P17)` | `getUserServices`→`PageServiceItem` 🔵 | ✅ |
| 우: target source 목록 | `TargetSourceList` = `DataTable`(미선택 시 `EmptyState`) | `getTargetSourcesByServiceCode`→`TargetSourceDetail[]` 🔵 (컬럼: Provider / TargetSourceId) | ✅ |
| (참고) 권한 사용자 | `AuthorizedUsers` = `Collapsible(P16)` | `getServiceAuthorizedUsers` 🔵 (원본 page2에 명시) | ✅ |

- **상태**: `selectedServiceCode` 보유(선택 시 우측 목록 로드 + breadcrumb navState 갱신).
- **이동**: target 행 클릭 → `#/target/:targetSourceId` (navState: `{serviceCode, provider, targetId}`)

### 4.3 대상 이력 `#/target/:id` — `admin/pipeline/target/{targetSourceId}`

```
┌ Breadcrumb: 서비스 검색 › svc-alpha › ts-aws-001 ───────────────────┐
│ ┌ TargetSourceHeader ─────────────────────────────────────────────┐ │
│ │ AWS · ts-aws-001    계정 1234-.. · svc-alpha(SVC001)             │ │
│ │ 설치상태(process_status): CONNECTED        [⟳ 새로고침]           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌ LatestPipelineCard ─────────┐   [설치 시작] [삭제 시작] [취소]      │
│ │ 최근 #128 · INSTALL · RUNNING│    └TargetActionBar (3×P9 Button)   │
│ │ ▓▓░░ 2/4 · 4분 경과   [상세] │    (RUNNING 존재→설치·삭제 disabled)  │
│ └─────────────────────────────┘                                     │
│ 이력 목록  PipelineHistoryTable (없으면 P13 EmptyState)              │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ #    유형     상태      진행     생성일        상세             │   │
│ │ 128  INSTALL RUNNING  2/4     06-30 14:02  [상세]            │   │
│ │ 127  DELETE  DONE     2/2     06-28 09:11  [상세]            │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                               ‹ 1 2 › Pagination     │
└──────────────────────────────────────────────────────────────────────┘
   [설치/삭제] → PreviewModal(recipe, type=INSTALL|DELETE)  ·  [취소] → CancelModal(즉시)
```

| 블록 | 컴포넌트 | 데이터 / 원천 | 표시 |
|---|---|---|---|
| 헤더 | `TargetSourceHeader` = `KeyValueGrid`+`ProviderTag` | CSP/계정/서비스명·코드 = `getTargetSourceDetail` 🔵 · **설치상태 = `getProcessStatus` 🔵**(원본 Q4: process_status를 "설치 상태"로 채택) | ✅🔵 |
| 최근 1건 | `LatestPipelineCard` | A8 latest (`findFirstByTarget...`) | ✅ |
| 이력 목록 | `PipelineHistoryTable` = `DataTable`+`Pagination`(빈 `EmptyState`) | A7 | ✅ (표시명/CSP는 ⚠️) |
| 액션 바 | `TargetActionBar` = 3×`Button` | 설치/삭제/취소 | ✅ |
| ↳ INSTALL/DELETE | `Button(primary)` → `PreviewModal` | A9 preview(recipe, `?type=`) → 확인 후 A10 `POST .../pipelines`(멱등·기존 run 반환) | ✅ |
| ↳ 취소 | `Button(danger)` → `CancelModal` | A6 cancel — **항상 동기·즉시**(원본 Q7; ADR-021의 idle/cooperative 2케이스를 이 저장소는 채택 안 함) | ✅ |

- **모달 상태**: 전역 `modal:{kind:preview|cancel, type?:INSTALL|DELETE, id}` 사용(§5). 여기서 `id`는 preview/설치·삭제 시 `targetId`, cancel 시 `pipelineId`.
- **타깃 페이지 취소 범위**: `TargetActionBar`의 취소는 **이 대상의 최신 RUNNING 파이프라인**(=`LatestPipelineCard`의 run id)을 A6로 취소한다. (파이프라인 상세 페이지의 취소는 그 페이지의 pipelineId 대상 — 둘 다 CancelModal/A6 경유, 스코프만 다름)
- **이동**: 이력/최근 카드 행 → `#/pipeline/:pipelineId`(navState: `{serviceCode?, targetId, provider}`) · 헤더 대상명 → (범위 밖, disabled 링크)

### 4.4 파이프라인 상세 `#/pipeline/:id`

**레이아웃 스케치** (n8n 스타일 선형 체인 — **참조 없음**: adr-021엔 flow 비주얼 부재. adr-016.html:467 ASCII
`Task: BLOCKED ─▶ READY ─▶ IN_PROGRESS ─▶ DONE|FAILED|CANCELLED` 가 유일 근거 → **Toss 토큰으로 신규 제작**)

```
┌ Breadcrumb: (컨텍스트 있으면) … › ts-aws-001 › 파이프라인 #128 ─────┐
│ ┌ PipelineMetaPanel ──────────────┐ ┌ UnavailableMetaGroup(P16) ─┐ │
│ │ #128 INSTALL · ts-aws-001        │ │ next_due_at     미제공 ❌   │ │
│ │ 상태 RUNNING                     │ │ lease(claimed)  미제공 ❌   │ │
│ │ 생성 06-30 14:02 · 활동 14:25    │ │ cancel_requested 미제공 ❌  │ │
│ │ 현재 task ③ / 최종 ④ ⚙️          │ │ lag             미제공 ❌   │ │
│ │ 실패 0 / 1 ⚙️          [취소]     │ │ (ADR-021 실행필드, 데이터無)│ │
│ └──────────────────────────────────┘ └────────────────────────────┘ │
│ Task 흐름 (읽기전용, 노드 클릭→하단 상세)                             │
│ ┌ TaskFlowChain ──────────────────────────────────────────────────┐ │
│ │ [✔①TF권한]─▶[✔②SVC TF]─▶[▶③BDC Common]─▶[○④BDC SvcLv]           │ │
│ │  DONE        DONE         IN_PROGRESS      BLOCKED                │ │
│ │  (각 노드 = P15 TaskNode: seq/kind/operation/status/failCount)    │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ 노드 클릭 시 ▼ TaskDetailPanel (인패널, 미선택 시 숨김/안내)          │
│ ┌── (예시 A) TERRAFORM_JOB 노드 클릭 → Attempts만 (§4.5g) ─────────┐ │
│ │ Task ③ BDC Common · TERRAFORM_JOB · IN_PROGRESS                   │ │
│ │ 설정(읽기전용): executionTimeout/maxFail (resolve* ⚙️)             │ │
│ │ Attempts  ┌ DataTable: no / status / error_code / 시각 / response ┐│ │
│ │           │ 1  IN_PROGRESS  -   14:21  「원시 text…」(✅)          ││ │
│ │           └ job_ids·dispatch_response_* = ❌ 제거필드(컬럼 없음)   ┘│ │
│ ├── (예시 B) CONDITION_CHECK 노드(① TF권한) 클릭 → Check만 ─────────┤ │
│ │ Task ① TF 권한 확인 · CONDITION_CHECK · DONE                      │ │
│ │ 설정(읽기전용): pollingInterval/ttl→maxFailCount (count-bound ⚙️)  │ │
│ │ Check 요약: call 2 / not_met 1 / api_err 0 / timeout 0            │ │
│ │            last_external OK · last_response_code null ⚠️          │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**메타 패널** — A4 `GET /pipelines/{pipelineId}` → `PipelineDetail`

| 컴포넌트 | 필드 | 표시 |
|---|---|---|
| `PipelineMetaPanel` = `KeyValueGrid` + `Button(danger)`(취소, 파이프라인 스코프 — **여기 1곳만**) | ID/타입/target/status(P2) ✅, created/lastActivity ✅, 현재·최종 task ⚙️, 실패횟수/한계 ⚙️ | ✅/⚙️ |
| `UnavailableMetaGroup` = `Collapsible(P16)` | next_due_at / lease(claimed_until) / cancel_requested / lag ❌ | **`FieldTag(미제공)` 4행** |

**Task 흐름** — `PipelineDetail.tasks[]`

| 컴포넌트 | 필드 | 표시 |
|---|---|---|
| `TaskFlowChain`(선형, 읽기 전용) = `TaskNode(P15)`×N + 커넥터 | seq/kind(=taskName)/operation/status(P3)/failCount/errorCode(FAILED만)/started·finished | ✅ |

**Task 상세 패널** — 노드 클릭 → A5 `GET /pipelines/{id}/tasks/{taskId}` → `TaskDetail`. **미선택이 기본**(패널 숨김·안내문).

| 컴포넌트 | 필드 | 표시 |
|---|---|---|
| `TaskDetailPanel` 헤더 = `KeyValueGrid` | task 전체 컬럼(유효설정 `TaskSettings.resolve*` **읽기전용** ⚙️. 원본 10-API에 PATCH 없음 → 편집 미제공) | ✅ |
| `AttemptList` = `DataTable` | attempt_no/status/error_code/시각 ✅, **response**(원시 text) ✅. `job_ids`/`dispatch_response_*` = ❌ 제거필드 → **컬럼 없음**(원본 명시) | ✅ |
| `CheckSummary` = `KeyValueGrid` | call/not_met/api_error/call_timeout/last_external_status/last_checked_at ✅ · last_response_code·summary ⚠️(미채움→null `FieldTag`) | ✅/⚠️ |

> **취소는 파이프라인 상세에서 메타 패널 1곳**으로 단일화(파이프라인 스코프). 원본 부록은 task 패널에도 "취소"를 나열하나 동일 파이프라인 취소이므로 이 페이지 내 중복 렌더하지 않는다. (§4.3 타깃 페이지의 취소는 별개 — target-scope 최신 RUNNING run 대상)
> **retry(재시도)는 원본 10-API(A1–A10)에 없음** → 이 화면 범위 밖(deferred). FAILED여도 [취소]만 노출.

- **상태**: `selectedTaskId`(기본 null → 패널 숨김).
- **이동**: Task 노드 클릭 → 하단 `TaskDetailPanel`(같은 페이지 인패널) · Breadcrumb/사이드바로 상위 복귀

## 4.5 렌더링·인터랙션 확정 규칙 (리뷰 라운드2 — 구현 결정론화)

빌더가 추측하지 않도록, 각 컴포넌트의 파생·게이팅·엣지 규칙을 못박는다.

**(a) ProgressBar (P5)** — `N = count(task.status == DONE)`, `M = task 총개수`(BLOCKED/CANCELLED 포함).
렌더는 **고정폭 트랙 + 비율 fill**(`width: N/M*100%`), 우측에 `N/M` 라벨. per-task 셀 방식 아님(5+ task 대응).
CANCELLED task는 분자 제외·분모 포함(진행이 아님).

**(b) PipelineMetaPanel 파생식** —
- `현재 task` = **status가 READY/IN_PROGRESS/FAILED 중 최저 seq**(없고 전부 DONE이면 "완료", 전부 처리 후 CANCELLED면 "취소됨").
- `최종 task` = **max(seq)** (= 총 task 수).
- `실패 N/M` = `현재 task.failCount / TaskSettings.resolveMaxFailCount(현재 task)`. **CONDITION_CHECK도 count-bound**(ADR-016: ttl→유한 maxFailCount, not-met=failed poll)이므로 `∞` 아님 — 유한값 렌더(예 `0 / 6`).

**(c) Cancel 활성화** — `[취소]`는 **파이프라인 status === RUNNING 일 때만 enabled**. DONE/FAILED/CANCELLED면 disabled(툴팁 "진행 중인 파이프라인만 취소 가능"). 타깃 페이지 취소도 동일(최신 run이 RUNNING일 때만).

**(d) 설치/삭제 버튼 활성화 매트릭스** (`process_status` 기준, 원본 §4.4.4 중복방지) —
- 진행 중(RUNNING) 파이프라인 존재 → **설치·삭제 모두 disabled**(중복 방지), 취소만 enabled.
- process_status가 미설치 계열 → **설치 enabled / 삭제 disabled**.
- 설치 완료 계열(CONNECTED/COMPLETED 등) → **삭제 enabled / 설치 disabled**.
- (mock에서는 대상별로 하나의 상태를 부여해 위 규칙대로 disabled 처리.)

**(e) LatestPipelineCard 빈 상태** — 대상에 파이프라인 0건(A8 empty) → 카드 자리에 `EmptyState(P13)` "실행 이력 없음, [설치 시작]으로 첫 파이프라인을 만드세요".

**(f) PreviewModal(A9) recipe 형태 + confirm 결과** —
- A9 응답 shape: `{ type: INSTALL|DELETE, targetId, steps: [{seq, taskName, kind(TERRAFORM_JOB|CONDITION_CHECK), operation}] }`.
- 모달 body = steps를 seq 순서 리스트로(각 행: `① taskName · kind chip · operation`). 하단 [실행]/[취소].
- [실행] → A10 POST → 성공 시 **`#/pipeline/{반환 run id}` 로 이동 + Toast("파이프라인 실행됨")**.
- **멱등 분기**: 반환 run이 기존 진행 run이면 Toast("이미 진행 중인 파이프라인으로 이동") 후 동일 이동.

**(g) TaskDetailPanel kind 게이팅** —
- `TERRAFORM_JOB` → **AttemptList(P6)만** 렌더(폴링 요약 없음).
- `CONDITION_CHECK` → **CheckSummary(P14)만** 렌더(attempt별 1건 폴링 카운터). attempt 개념 대신 check.
- 공통 헤더(task 설정)는 항상. (스케치의 ③ BDC Common = TERRAFORM_JOB → Attempts만; Check 요약 예시는 CONDITION_CHECK 노드에서만.)

**(h) TaskNode(P15) kind 구분 + 오버플로우** —
- `TERRAFORM_JOB` = 실선 테두리 노드. `CONDITION_CHECK` = **점선 테두리 + "외부확인" chip**(외부 대기 성격 시각화).
- status 아이콘: DONE ✔(success) · IN_PROGRESS ▶(info, 진행 애니 optional) · BLOCKED ○(faint) · READY ◔(info-light) · FAILED ✕(error) · CANCELLED ⊘(pending).
- 노드 5+개 → **가로 스크롤**(데스크톱). 커넥터는 노드 사이 `─▶`. wrap 안 함.

**(i) 데이터 정직성 세부** —
- 대시보드 "동작중 TF" 배지: count 자체는 정확하나 **worker 부하의 근사 지표**라는 의미의 `⚙️근사`(원본 권장). 툴팁으로 명시.
- 목록/이력 provider: mock 행에 표시용으로 join된 값 보유, `provider=` 필터는 그 값에 동작. 단 UI엔 `⚠️외부(다른 repo)` 배지 유지(출처 정직성).
- 기간 토글은 **PeriodStatsRow 전용** — 목록(A3)은 자체 필터만 사용, period 토글에 재조회하지 않음.

**(j) 접근성(데스크톱 전용이나 최소)** — 클릭 대상(테이블 행, TaskNode, 사이드바 항목)은 `role="button"` + `tabindex="0"` + Enter/Space 처리. 모달은 열릴 때 focus 이동, Esc 닫기.

## 5. 라우팅 · 상태 모델 (페이지 이동 전체)

```
(빈 해시) ──▶ #/dashboard (기본)   ·   (미매칭 해시) ──▶ 404 fallback 뷰
#/dashboard ──(목록 상세: pipelineId)──▶ #/pipeline/:id
#/services  ──(target 행: targetSourceId)──▶ #/target/:id
#/target/:id ─(이력/최근 행: pipelineId)──▶ #/pipeline/:id
#/pipeline/:id ─(task 노드)──▶ 인패널 TaskDetailPanel
Breadcrumb / Sidebar ──▶ 임의 상위 뷰로 복귀
```

**앱 상태(전역)**: `{ route, param, navState(선택 service/target 라벨), selectedServiceCode, selectedTaskId, modal:{kind,type,id}|null, toast|null }`.
라우터: `location.hash` 파싱 → `{route, param}` → 뷰 render + 사이드바 active + breadcrumb(navState 기반, 없으면 조각 생략).

## 6. API 매핑

**신규(전부 🆕, swagger 미정의 — mock으로 표현)**

| id | Method | Path | 소비 컴포넌트 |
|---|---|---|---|
| A1 | GET | `/install/v1/pipelines/stats/live` | LiveStatsRow |
| A2 | GET | `/install/v1/pipelines/stats?period=` | PeriodStatsRow |
| A3 | GET | `/install/v1/pipelines?status=&provider=&q=&page=&size=` | PipelineListTable (period 토글과 무관 — §4.5i) |
| A4 | GET | `/install/v1/pipelines/{id}` | PipelineMetaPanel + TaskFlowChain |
| A5 | GET | `/install/v1/pipelines/{id}/tasks/{taskId}` | TaskDetailPanel |
| A6 | POST | `/install/v1/pipelines/{id}/cancel` | CancelModal |
| A7 | GET | `/install/v1/target-sources/{id}/pipelines` | PipelineHistoryTable |
| A8 | GET | `/install/v1/target-sources/{id}/pipelines/latest` | LatestPipelineCard |
| A9 | GET | `/install/v1/target-sources/{id}/pipelines/preview?type=` | PreviewModal |
| A10 | POST | `/install/v1/target-sources/{id}/pipelines` | TargetActionBar |

**기존 🔵(swagger 존재)**: `getUserServices` · `getTargetSourcesByServiceCode` · `getServiceAuthorizedUsers`(page2) ·
`getTargetSourceDetail` · `getProcessStatus`(page3 헤더 설치상태).

## 7. HTML 구현 범위 (이 산출물의 경계)

- 단일 `admin-pipeline.html`, 외부 의존 없음(순수 HTML/CSS/JS), 인라인 mock 데이터.
- 4개 뷰 + 인패널 Task 상세 + **모달 2종(preview/cancel)** + toast + 404 fallback.
- ❌/⚠️ 필드는 placeholder·배지로 **정직하게** 노출(숨기지 않음). retry·task편집·reject는 범위 밖(주석).
- 실 API 연동·zod·라우팅 라이브러리 없음(디자인/흐름 검증용 프로토타입). — `ponytail: 프로토타입 범위, 실 연동은 별도`
