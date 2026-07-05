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
| 폰트 | 본문 Geist(한글은 Apple SD Gothic Neo/Pretendard 폴백), mono Geist Mono. base·자간·타입 롤은 **[admin-pipeline-typography.md](admin-pipeline-typography.md) SSOT** (프로토타입 base 13px, 전역 -0.014em) | |

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
│●대시보드 │  대시보드(h1 24px)     🕐 기간·대시보드 전체 적용 [1h|1d|7d]│ ← 전역 기간(헤더)
│ 서비스   │  현황(20px)                                              │
│ 검색     │  최근 24시간(생성시간 기준) 실패·성공 집계 — … (section-desc)│
│          │  ┌ StatCard ──┐ ┌ StatCard ───┐ ┌ StatCard ───┐        │
│          │  │동작중·현재  │ │실패·최근24h │ │성공·최근24h  │        │ ← 회색 타일(읽기 전용)
│          │  │ 2  ✅      │ │  1  ✅     │ │  0  ✅      │        │   실패/성공 = 기간 동기화
│          │  └────────────┘ └────────────┘ └─────────────┘ (260px 상한)│
│          │  ─────────────────────────────────────────────────────│
│          │  파이프라인 목록(20px)                                   │
│          │  최근 24시간 생성 3건 · 정렬: 실패→진행 중→최신순 (section-desc)│
│          │  🔍 TargetSourceId  [상태▾][CSP▾]                   ⟳   │ ← 로컬 필터바(비시간 차원)
│          │  ┌ DataTable(카드) ─────────────────────────────────┐ │
│          │  │ TargetSourceId CSP   파이프라인 유형 상태 진행도 생성시간│ │
│          │  │ 204   Azure  INSTALL  FAILED  ▓░░1/3  06-29  상세›│ │
│          │  │ 101   AWS    INSTALL  RUNNING ▓▓░░2/4 06-30  상세›│ │
│          │  └──────────────────────────────────────────────────┘ │
│          │                                    ‹ 1 2 3 › Pagination│
└──────────┴────────────────────────────────────────────────────────┘
```

| 블록 | 컴포넌트 | 데이터 / 원천 | 표시 |
|---|---|---|---|
| 기간(전역) | 헤더 우측 `seg(1h/1d/7d)` + 시계 아이콘 + 스코프 라벨 "기간 · 대시보드 전체 적용" | **전 대시보드 동기화**(오너 확정 2026-07-05, GA4·Grafana형): 현황 실패·성공 + 목록이 같은 기간(`created_at`). 동작 중 카드만 순간값 — 라벨 "· 현재"로 자기 선언 | A2+A3 |
| 현황 | `StatsRow` = 3×`StatCard`(폭 260 상한, **회색 타일** — 읽기 전용 요약 표면) + `section-desc` 스코프 문구 | ① 동작중 파이프라인 · 현재 `count(RUNNING)` ✅ / ② **실패 · {기간}** ✅ / ③ **성공 · {기간}** ✅ — 파생 집계, 라벨이 기간 따라 동적. 실패>0이면 `.failed` 강조(페이지 유일한 강조색). 라벨 한글 단일(병기 금지 — style-guide §1) | A1+A2 |
| 필터바(로컬) | `FilterBar(search TargetSourceId + status + CSP)` — 카드 밖 독립 도구 행 | 비시간 차원 필터만 — 전역 시간과 분리. 적용 상태는 목록 `section-desc`에 텍스트로 상시 표기("… 생성 3건 · 상태 FAILED · 정렬 …") | A3 |
| 파이프라인 목록 | `PipelineListTable` = `DataTable`+`Pagination` | 열(오너 지정 2026-07-05): **TargetSourceId(숫자!)** / CSP(명칭만 — "외부" 배지 금지) / 파이프라인 유형 / 상태(P2) / 진행도 N/M(P5 ⚙️) / 생성시간 / **상세›**(rowlink 어포던스) | A3 |

- **⚠️ 근거 명시**: 목록의 CSP는 pipeline repo에 없어 `external`. §4.3 헤더의 CSP는 `getTargetSourceDetail`(=다른 repo 직접 호출)이라 🔵✅ — 상충 아님.
- **정렬**: `FAILED > RUNNING > 나머지`, 각 그룹 내 최신(id desc) —
  실패가 페이지네이션 뒤로 밀리지 않게 (근거: [admin-pipeline-info-hierarchy.md](admin-pipeline-info-hierarchy.md) §1).
- **제외 이력**: 구 실시간 카드 ②(slot 리밋 `3 / —` 미제공 분모) ③(동작중 TF task ⚙️근사),
  기간 카드 Running(순간값 RUNNING과 의미 중복) — info-hierarchy §1 판정으로 제거 (2026-07-04, 오너 승인).
- **이동**: 목록 행 `상세` → `#/pipeline/:pipelineId` (navState에 target id만 전달, service는 없음 → breadcrumb 생략)

### 4.2 서비스·대상 검색 `#/services` — `admin/pipeline/services`

```
┌ Sidebar ┬─ 서비스·대상 검색 ──────────────────────────────────────┐
│ 대시보드 │  ┌ ServiceSearchPanel ┐  ┌ TargetSourceList ────────────────────┐ │
│●서비스   │  │ 🔍 서비스 코드 검색 │  │ TargetSourceId CSP 설치상태 파이프라인 │ │
│ 검색     │  │ ● svc-alpha  ←P17  │  │ 101  AWS  CONNECTED  RUNNING #128 상세›│ │
│          │  │   svc-beta         │  │ 102  GCP  COMPLETED  PENDING #129 상세›│ │
│          │  │   svc-gamma        │  │ 103  IDC  INSTALLED  —            상세›│ │
│          │  │ (PageServiceItem)  │  │ (미선택 시 P13 EmptyState)             │ │
│          │  └────────────────────┘  └───────────────────────────────────────┘ │
└──────────┴────────────────────────────────────────────────────────┘
```

| 블록 | 컴포넌트 | 데이터 / 원천 | 표시 |
|---|---|---|---|
| 좌: 서비스 검색 | `ServiceSearchPanel` = 단순 `<input>`(P8 FilterBar 아님) + `SelectableList(P17)` | `getUserServices`→`PageServiceItem` 🔵 | ✅ |
| 우: target source 목록 | `TargetSourceList` = `DataTable`(미선택 시 `EmptyState`) | `getTargetSourcesByServiceCode` 🔵 — 컬럼: **TargetSourceId(숫자)** / CSP / **설치 상태(procChip — process_status)** / **활성 파이프라인(RUNNING·PENDING pill + #id, 없으면 —)** / 상세› | ✅ |
| ~~(참고) 권한 사용자~~ | **제거** (2026-07-05) | info-hierarchy §2 X 판정 — 지원 태스크 없음, API 호출도 폐지 | ❌ |

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
| 페이지 헤더 | app `PageHeader` 문법: **h1 = 서비스명 (회색 코드)** — 헤더는 제목만(조용) | `getTargetSourceDetail` 🔵 | ✅ |
| 파이프라인 상태 그룹 | **상태 바 + 액션 행 = 한 그룹**(4차 확정 2026-07-05: "상태와 행동은 한 사고 단위" — 버튼 활성이 상태에서 파생, 취소는 그 run 조작): 섹션 제목 "파이프라인 상태" + desc + `PipelineStatusBar` + 12px 아래 [설치 primary/삭제/취소] + 우측 잠금 사유 캡션(+tooltip) | 게이팅 = targetButtons(process_status·활성 run **내부** 판정 — **설치 상태 화면 표시는 제거**, 오너 2026-07-05) | ✅ |
| IdentityBar | app `IdentityBar` 이식: CSP 액센트 스트라이프+아이콘 박스 · CSP명/"Cloud Provider"(IDC는 sub 생략) · 필드 **TargetSourceId만**(계정은 CSP 식별자 중복이라 제거 — 오너 4차, 새로고침도 삭제) · **CSP metadata는 하단 상시 + 논리 그룹 캡션**(`mg-label`, 오너 5차 "논리적 그룹과 API Response 반영"): **CSP 연결 정보**(CloudTargetSource 식별자) / **실행 권한**(TF 플래그, 있을 때만). 필드 없는 IDC는 "이 CSP 유형은 연결 metadata가 없습니다" | 〃 | ✅ |
| 최근 1건 | `PipelineStatusBar` **재사용**(2026-07-05: 미니 카드 폐지) — pill lg·진행·현재 task·error·[↗] + meta(유형#id·**레시피 display_name**(코드는 tooltip)·생성·활동). FAILED면 tint | A8 latest (`findFirstByTarget...`) | ✅ |
| 이력 목록 | `PipelineHistoryTable` = `DataTable`+`Pagination`(빈 `EmptyState`) — 열: #·유형·**레시피 display_name**·상태·진행도·생성시간·↗, section-desc에 전체 건수·최신순 | A7 | ✅ (표시명/CSP는 ⚠️) |
| 액션 바 | `TargetActionBar` = 3×`Button` | 설치/삭제/취소 | ✅ |
| ↳ INSTALL/DELETE | `Button(primary)` → `PreviewModal` | A9 preview(recipe, `?type=`) → 확인 후 A10 `POST .../pipelines`(멱등·기존 run 반환) | ✅ |
| ↳ 취소 | `Button(danger)` → `CancelModal` | A6 cancel — **항상 동기·즉시**(원본 Q7; ADR-021의 idle/cooperative 2케이스를 이 저장소는 채택 안 함) | ✅ |

- **PENDING 잠금(2026-07-05)**: 활성 run 판정은 `RUNNING ∪ PENDING` — 시작 지연 대기 중에도
  설치·삭제는 잠기고 취소만 가능.

- **모달 상태**: 전역 `modal:{kind:preview|cancel, type?:INSTALL|DELETE, id}` 사용(§5). 여기서 `id`는 preview/설치·삭제 시 `targetId`, cancel 시 `pipelineId`.
- **타깃 페이지 취소 범위**: `TargetActionBar`의 취소는 **이 대상의 최신 RUNNING 파이프라인**(=`LatestPipelineCard`의 run id)을 A6로 취소한다. (파이프라인 상세 페이지의 취소는 그 페이지의 pipelineId 대상 — 둘 다 CancelModal/A6 경유, 스코프만 다름)
- **이동**: 이력/최근 카드 행 → `#/pipeline/:pipelineId`(navState: `{serviceCode?, targetId, provider}`) · 헤더 대상명 → (범위 밖, disabled 링크)

### 4.4 파이프라인 상세 `#/pipeline/:id`

**레이아웃 스케치** (n8n 스타일 선형 체인 — **참조 없음**: adr-021엔 flow 비주얼 부재. adr-016.html:467 ASCII
`Task: BLOCKED ─▶ READY ─▶ IN_PROGRESS ─▶ DONE|FAILED|CANCELLED` 가 유일 근거 → **Toss 토큰으로 신규 제작**)

```
┌ Breadcrumb: (컨텍스트 있으면) … › 101 › 파이프라인 #128 ─────────────┐
│ h1 파이프라인 #128                                                    │
│ ┌ 파이프라인 메타데이터 카드 (Round 14) ───────────────────────────┐ │
│ │ ⛓ AWS 인프라 설치   유형 INSTALL · 생성 · 마지막 활동   대상 101  │ │ L3
│ │   AWS_INSTALL_V1                                    · AWS  [↗]  │ │
│ │ ── 레시피 설명 문장 (RecipePreview.description) ──────────────── │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ Task 흐름  ← 섹션(상태 포함 — "상태는 Task 흐름의 일부분")            │
│ ┌ PipelineStatusBar (그룹 첫 블록) ────────────────────────────────┐ │
│ │ ● RUNNING  ▓▓▓░░ 2/4 · 현재 ③ BDC Common TF 실행        [취소]  │ │ L1+CTA
│ │ leased 예 — 워커 실행 중 · 스케줄 지연 300 ms   (비종단만)        │ │ L4
│ │ (FAILED면 error_code 요약을 1행에 추가 노출)                      │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ ┌ TaskFlowChain (전폭 캔버스: 점 격자 + 가로 스크롤, Round 15) ────┐ │
│ │ [✓ TF권한   ]──▶[✓ SVC TF  ]╌╌▶[◌ BDC Common]  [4 BDC SvcLv]    │ │
│ │  16:0x · 폴2회   시도 1회    ↑active  14:21 시작  타임아웃·한도   │ │
│ │  (커넥터: done 초록 / active 파란 대시 / toFail 빨간 대시)        │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│   노드 클릭 ──▶ TaskDetailModal (600px, 본문 스크롤, ✕/ESC/바깥 닫기) │
└──────────────────────────────────────────────────────────────────────┘

TaskDetailModal 내용 (kind 게이팅 §4.5g 동일):
  (예시 A) TERRAFORM_JOB: 설정(읽기전용 executionTimeout/maxFail resolve* ⚙️)
           + Attempts DataTable(no/status/error_code/시각/response 원시 text ✅,
             job_ids·dispatch_response_* = ❌ 제거필드 — 컬럼 없음)
  (예시 B) CONDITION_CHECK: 설정(pollingInterval/ttl→maxFailCount count-bound ⚙️)
           + Check 요약(call/not_met/api_err/timeout · last_external ·
             last_response_code null ⚠️)
```

**상태 바** — A4 `GET /pipelines/{pipelineId}` → `PipelineDetail` (LIN-20 Round 5: 카드 → 슬림 바)

| 컴포넌트 | 필드 | 표시 |
|---|---|---|
| 페이지 헤더 + **파이프라인 메타데이터 카드**(Round 14 — 오너: "파이프라인 메타데이터 강조, Target Source는 일부만") | h1 "파이프라인 #id" / 카드 hero: 아이콘 `i-flow`+**레시피 display_name**(pname)+**레시피 코드**(psub, mono) / 필드: 파이프라인 유형·생성·마지막 활동 / 우측 끝 **대상 참조 한 칸**("id · CSP명") + ↗(대상 상세) / meta 구간: 레시피 설명(RecipePreview.description) 문장만. CSP 액센트 스트라이프는 유지(약한 대상 힌트) | ✅ |
| `PipelineStatusBar` — **Task 흐름 섹션 내 첫 블록**(Round 14 — 오너: "상태는 Task 흐름의 일부분", 별도 상태 섹션 폐지) + `Button(danger)`(취소 — **여기 1곳만**) | status(P2, PENDING 포함)·취소 요청됨 배지(cancel_requested)·진행 N/M·현재 task(재시도 fail/max 병기, PENDING이면 "시작 대기 · next_due_at 시작 예정")·FAILED면 error_code·우측 "다음 실행 next_due_at"(RUNNING) / **sb-meta 줄(비종단만): leased·스케줄 지연** — "지금" 값이라 카드가 아닌 상태 바 소속 ✅ | ✅ |

**Task 흐름** — `PipelineDetail.tasks[]`

| 컴포넌트 | 필드 | 표시 |
|---|---|---|
| `TaskFlowChain`(선형, 읽기 전용) = `TaskNode(P15)`×N + 커넥터 — **v16 Athena 문법 차용**(Round 15): 점 격자 캔버스 + **가로 스크롤**(task 다수 대비), 노드 = 상태 tint 아이콘 박스 28px(✓ done/spinner running/✕ failed/⊘ cancelled/seq 숫자 대기) + 이름 + kind 칩(중립) + 상태별 한 줄 meta(`taskMetaLine` — 종단:결과·기간, 진행:시작·재시도, 대기:주기·TTL·한도), 상태별 테두리(FAILED red halo, BLOCKED dashed), 커넥터 상태색(done/active 대시/toFail). 애니메이션은 `prefers-reduced-motion` 존중 | seq/kind/operation/status/failCount/errorCode/started·finished/계약 필드 | ✅ |

**Task 상세 모달** — 노드 클릭 → A5 `GET /pipelines/{id}/tasks/{taskId}` → `TaskDetail`.
Round 15(오너 6차)에서 우측 사이드 패널(340px)을 폐지하고 **모달**로 전환 — 흐름도가 전폭을
쓰고, 상세는 요청 시에만 넓게 열린다. FAILED 자동 선택은 폐기(진입 즉시 모달을 여는 건 침습적) —
실패 노드의 red halo + 상태 바 error_code가 시선을 유도하고, 클릭으로 연다.

| 컴포넌트 | 필드 | 표시 |
|---|---|---|
| `TaskDetailModal` — **사이드 패널 → 모달**(Round 15 오너: "너무 길게 과하게 → Modal") · **3그룹 유지**(Round 13: "Task를 논리적으로 설명") | 600px 모달, max-height 86vh — 헤더(**이름만** + kind 칩·상태 pill + **X** — seq는 제목에서 빼고 정의 그룹의 "순서 (seq)" 행으로, 오너 7차)·설명은 고정, **본문(mbody)만 스크롤**. 그룹 경계 = 헤어라인(`dgroup`): ① **정의**: 순서(seq)·task_definition·operation 코드 ② **실행 계약**: 실행 방식·effective 폴링·타임아웃·재시도 예산·TF 슬롯 + **판정 방식 문단**(success_policy 요약) ③ **진행 기록**: 시각·실패 누적+error_code·attempts/폴 관찰. 닫기 = X·ESC·바깥 클릭 | ✅ |
| `AttemptList` = `DataTable` | attempt_no/status/error_code/시각 ✅, **response**(원시 text) ✅. `job_ids`/`dispatch_response_*` = ❌ 제거필드 → **컬럼 없음**(원본 명시) | ✅ |
| `CheckSummary` = `KeyValueGrid` | call/not_met/api_error/call_timeout/last_external_status/last_checked_at ✅ · last_response_code·summary ⚠️(미채움→null `FieldTag`) | ✅/⚠️ |

> **취소는 파이프라인 상세에서 상태 바(PipelineStatusBar) 1곳**으로 단일화(파이프라인 스코프). 원본 부록은 task 패널에도 "취소"를 나열하나 동일 파이프라인 취소이므로 이 페이지 내 중복 렌더하지 않는다. (§4.3 타깃 페이지의 취소는 별개 — target-scope 최신 RUNNING run 대상)
> **retry(재시도)는 원본 10-API(A1–A10)에 없음** → 이 화면 범위 밖(deferred). FAILED여도 [취소]만 노출.

- **상태**: 별도 선택 상태 없음(Round 15 — `selectedTaskId` 폐기). 모달은 전역 `modal:{kind:'task',id:seq}`, 해시 변경 시 자동 닫힘.
- **이동**: Task 노드 클릭 → `TaskDetailModal` · Breadcrumb/사이드바로 상위 복귀

## 4.5 렌더링·인터랙션 확정 규칙 (리뷰 라운드2 — 구현 결정론화)

빌더가 추측하지 않도록, 각 컴포넌트의 파생·게이팅·엣지 규칙을 못박는다.

**(a) ProgressBar (P5)** — `N = count(task.status == DONE)`, `M = task 총개수`(BLOCKED/CANCELLED 포함).
렌더는 **고정폭 트랙 + 비율 fill**(`width: N/M*100%`), 우측에 `N/M` 라벨. per-task 셀 방식 아님(5+ task 대응).
CANCELLED task는 분자 제외·분모 포함(진행이 아님).

**(b) PipelineStatusBar 파생식** —
- `현재 task` = **status가 READY/IN_PROGRESS/FAILED 중 최저 seq**(없고 전부 DONE이면 "완료", 전부 처리 후 CANCELLED면 "취소됨").
- `최종 task` = **max(seq)** (= 총 task 수).
- `실패 N/M` = `현재 task.failCount / TaskSettings.resolveMaxFailCount(현재 task)`. **CONDITION_CHECK도 count-bound**(ADR-016: ttl→유한 maxFailCount, not-met=failed poll)이므로 `∞` 아님 — 유한값 렌더(예 `0 / 6`).

**(c) Cancel 활성화** — `[취소]`는 **파이프라인 status ∈ {RUNNING, PENDING} && !cancel_requested 일 때만 enabled**(PENDING 포함은 LIN-30 2026-07-05, cancel_requested 중복 방지 포함). 종단 상태면 disabled(캡션 "진행·대기 중만 취소 가능"). 타깃 페이지 취소도 동일(최신 run 기준).

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

**(g) TaskDetailModal kind 게이팅** —
- `TERRAFORM_JOB` → **AttemptList(P6)만** 렌더(폴링 요약 없음).
- `CONDITION_CHECK` → **CheckSummary(P14)만** 렌더(attempt별 1건 폴링 카운터). attempt 개념 대신 check.
- 공통 헤더(task 설정)는 항상. (스케치의 ③ BDC Common = TERRAFORM_JOB → Attempts만; Check 요약 예시는 CONDITION_CHECK 노드에서만.)

**(h) TaskNode(P15) 상태·kind 표현 (Round 15, v16 차용으로 개정)** —
- 상태는 **테두리 + 아이콘 박스 tint + meta 한 줄**로: DONE ✓(초록 테두리) · IN_PROGRESS spinner(파란 테두리+pulse) · READY seq 숫자(호박 테두리+pulse) · BLOCKED seq 숫자(**dashed** — 대기 문법) · FAILED ✕(red halo, meta 빨강 굵게) · CANCELLED ⊘(연회색).
- kind는 **칩만**(중립 — CONDITION_CHECK는 dashed 칩). 노드 테두리 dashed는 이제 BLOCKED 뜻 — kind별 테두리 구분(구판)은 폐기(충돌).
- 노드 5+개 → 캔버스 **가로 스크롤**(데스크톱). 커넥터 = 선+화살촉, 상태색(§스케치). wrap 안 함. 애니메이션은 `prefers-reduced-motion:no-preference`에서만.

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
#/pipeline/:id ─(task 노드)──▶ TaskDetailModal (같은 페이지, 모달)
Breadcrumb / Sidebar ──▶ 임의 상위 뷰로 복귀
```

**앱 상태(전역)**: `{ route, param, navState(선택 service/target 라벨), selectedServiceCode, modal:{kind,type,id}|null, toast|null }` (`selectedTaskId`는 Round 15에서 폐기 — task 상세는 modal kind `task`).
라우터: `location.hash` 파싱 → `{route, param}` → 뷰 render + 사이드바 active + breadcrumb(navState 기반, 없으면 조각 생략).

## 6. API 매핑

**신규(전부 🆕, swagger 미정의 — mock으로 표현)**

| id | Method | Path | 소비 컴포넌트 |
|---|---|---|---|
| A1 | GET | `/install/v1/pipelines/stats/live` | LiveStatsRow |
| A2 | GET | `/install/v1/pipelines/stats?period=` | PeriodStatsRow |
| A3 | GET | `/install/v1/pipelines?status=&provider=&q=&page=&size=` | PipelineListTable (period 토글과 무관 — §4.5i) |
| A4 | GET | `/install/v1/pipelines/{id}` | PipelineStatusBar + TaskFlowChain |
| A5 | GET | `/install/v1/pipelines/{id}/tasks/{taskId}` | TaskDetailModal |
| A6 | POST | `/install/v1/pipelines/{id}/cancel` | CancelModal |
| A7 | GET | `/install/v1/target-sources/{id}/pipelines` | PipelineHistoryTable |
| A8 | GET | `/install/v1/target-sources/{id}/pipelines/latest` | LatestPipelineCard |
| A9 | GET | `/install/v1/target-sources/{id}/pipelines/preview?type=` | PreviewModal |
| A10 | POST | `/install/v1/target-sources/{id}/pipelines` | TargetActionBar |

**기존 🔵(swagger 존재)**: `getUserServices` · `getTargetSourcesByServiceCode` · `getServiceAuthorizedUsers`(page2) ·
`getTargetSourceDetail` · `getProcessStatus`(page3 헤더 설치상태).

## 7. HTML 구현 범위 (이 산출물의 경계)

- 단일 `admin-pipeline.html`, 외부 의존 없음(순수 HTML/CSS/JS), 인라인 mock 데이터.
- 4개 뷰 + 우측 사이드 패널 Task 상세 + **모달 2종(preview/cancel)** + toast + 404 fallback.
- ❌/⚠️ 필드는 placeholder·배지로 **정직하게** 노출(숨기지 않음). retry·task편집·reject는 범위 밖(주석).
- 실 API 연동·zod·라우팅 라이브러리 없음(디자인/흐름 검증용 프로토타입). — `ponytail: 프로토타입 범위, 실 연동은 별도`
