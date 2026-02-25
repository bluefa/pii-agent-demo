# Admin Dashboard — 유저 스토리 & Flow 정의

> **범위**: 연동 현황 Dashboard + 시스템 상세 현황 (주간보고는 별도 정의 예정)
> **페이지**: `/admin/dashboard` (기존 Admin과 별도)
> **기준**: 2026-02-26 요구사항 정의

---

## 1. 개요

### 목적

관리자가 전체 시스템의 DB 연동 현황을 한눈에 파악하고, 서비스코드별 상세 정보를 검색/필터/추출할 수 있는 대시보드.

### 용어 정의

| 용어 | 설명 |
|------|------|
| 시스템 | 서비스코드(ServiceCode) 단위. 1 시스템 = 1 서비스코드 |
| target-source | 시스템 내 클라우드 Provider별 연동 단위 (프로젝트). 1 시스템에 AWS/Azure/GCP 등 N개 존재 가능 |
| 연동 방식 | target-source의 Provider 유형. AWS, Azure, GCP, IDC, SDU, 수동조사 중 N개 |
| 연동 대상 DB | 시스템 내 모든 target-source에서 연동 확정된 DB의 합계 |
| Healthy DB | 논리 DB 연결 상태가 정상인 DB |
| Unhealthy DB | 논리 DB 연결 상태가 비정상(끊김)인 DB |
| 연동중 DB | 설치 완료 후 모니터링 중인 DB (Healthy + Unhealthy) |

### 데이터 집계 구조

```
시스템(ServiceCode)
 ├── target-source A (AWS)  ─── logical-db-status ─── DB 1(Healthy), DB 2(Unhealthy), ...
 ├── target-source B (Azure) ─── logical-db-status ─── DB 3(Healthy), ...
 └── target-source C (IDC)  ─── logical-db-status ─── DB 4(Healthy), ...
         ↓
  시스템 단위 집계: 대상 DB 합계, Healthy 합계, Unhealthy 합계, 연동중 합계
         ↓
  전체 KPI 집계: 전 시스템 합산
```

---

## 2. 유저 스토리

### DASH-001: 연동 현황 KPI 조회

**As a** 관리자,
**I want to** 전체 시스템의 DB 연동 현황을 요약 지표로 보고 싶다,
**So that** 연동 진행 상황과 품질(끊김 여부)을 한눈에 파악할 수 있다.

**AC:**
- [AC1] 대시보드 진입 시 KPI 카드가 상단에 표시된다
  - API: `GET /api/v1/admin/dashboard/summary`
- [AC2] 2개의 복합 KPI 카드로 표시된다:
  - **서비스 현황** 카드:
    - 누적 시스템 수 (메인 수치)
    - 끊어진 서비스 수 — Unhealthy DB가 1개 이상인 시스템 수 (빨간 배지)
    - 서비스 연동률 — (전체 시스템 - 끊어진 서비스) / 전체 시스템 × 100 (%, 소수점 2번째 자리 반올림)
  - **DB 연동 현황** 카드:
    - 연동중 DB 수 (메인 수치)
    - 끊김 DB 수 — Unhealthy DB 수 (빨간 배지)
    - DB 연동률 — (연동중 DB - 끊김 DB) / 연동중 DB × 100 (%, 소수점 2번째 자리 반올림)
- [AC3] ~~각 카드에 이전 대비 증감 추이가 표시된다~~ (제거 — 불필요)
- [AC4] 데이터 로딩 중 스켈레톤 UI가 표시된다
- [AC5] 조회 실패 시 에러 메시지와 [다시 시도] 버튼이 제공된다

---

### DASH-002: 시스템 상세 현황 목록 조회

**As a** 관리자,
**I want to** 서비스코드별 시스템 정보와 DB 연동 현황을 테이블로 보고 싶다,
**So that** 각 시스템의 연동 진행 상태를 상세히 파악할 수 있다.

**AC:**
- [AC1] KPI 카드 하단에 시스템 상세 테이블이 표시된다
  - API: `GET /api/v1/admin/dashboard/systems?page=0&size=20`
- [AC2] 테이블 컬럼:

  | 컬럼 | 설명 |
  |------|------|
  | 시스템명 | 서비스코드의 serviceName + serviceCode 서브텍스트 |
  | Linked Sys | N-IRP 코드 + SW-PLM 코드 통합. 태그 형태로 N개 표시 |
  | 설치완료 | svc_installed (True/False 배지) |
  | 연동 방식 | AWS, Azure, GCP, IDC, SDU, 수동조사 — 컬러 코딩 태그 |
  | 상태 | Healthy/Unhealthy 배지 (unhealthy 시 개수 표시) |
  | 대상 DB | 해당 시스템의 연동 대상 DB 총 수 |
  | Healthy DB | 정상 연결 DB 수 (녹색) |
  | Unhealthy DB | 비정상 연결 DB 수 (빨강) |
  | 연동중 DB | 현재 모니터링 중인 DB 수 |

- [AC3] 페이지네이션으로 목록을 탐색할 수 있다 (기본 20건/페이지)
- [AC4] 테이블 헤더 클릭으로 정렬할 수 있다 (시스템명, 연동 대상 DB, Healthy DB 등)
- [AC5] 데이터 0건 시 빈 상태 안내가 표시된다
- [AC6] 행 클릭 시 해당 시스템의 기존 Admin 상세 페이지로 이동한다 (선택, MVP 이후)

---

### DASH-003: 시스템 검색 및 필터링

**As a** 관리자,
**I want to** 특정 조건으로 시스템을 검색하거나 필터링하고 싶다,
**So that** 원하는 시스템을 빠르게 찾을 수 있다.

**AC:**
- [AC1] 테이블 상단에 통합 검색 입력란이 제공된다
  - 검색 대상: 시스템명, 서비스코드
  - API: `GET /api/v1/admin/dashboard/systems?search={keyword}`
- [AC2] 필터 드롭다운이 제공된다:
  - **연동 방식** — AWS, Azure, GCP, IDC, SDU, 수동조사 (다중 선택, 체크박스)
  - **연동 상태** — 전체 / Healthy만 / Unhealthy 포함 / 미연동
  - **설치 상태** — 전체 / 설치완료 / 미설치
- [AC3] 검색과 필터는 동시 적용 가능하다 (AND 조건)
- [AC4] 검색/필터 적용 시 KPI 카드는 변경되지 않는다 (전체 현황 고정)
- [AC5] 검색/필터 결과가 0건이면 빈 상태 안내가 표시된다
- [AC6] 검색어/필터 초기화 버튼이 제공된다
- [AC7] 활성 필터 개수가 배지로 표시된다

---

### DASH-004: 시스템 현황 CSV 추출

**As a** 관리자,
**I want to** 현재 조회 중인 시스템 현황 데이터를 CSV로 다운로드하고 싶다,
**So that** 외부 보고서나 분석에 활용할 수 있다.

**AC:**
- [AC1] 테이블 우측 상단에 [CSV 추출] 버튼이 제공된다
- [AC2] 클릭 시 현재 적용된 검색/필터 조건 기준으로 전체 데이터가 CSV로 다운로드된다
  - API: `GET /api/v1/admin/dashboard/systems/export?search={keyword}&integration_method={method}&connection_status={status}&svc_installed={installed}`
  - Content-Type: `text/csv`
  - 파일명: `시스템현황_{YYYY-MM-DD}.csv`
- [AC3] CSV 컬럼은 테이블 컬럼과 동일하다
- [AC4] 태그 형태 필드(N-IRP, SW-PLM, 연동 방식)는 콤마 구분 문자열로 출력된다
- [AC5] 다운로드 중 로딩 인디케이터가 표시된다
- [AC6] 추출 실패 시 토스트 에러 메시지가 표시된다

---

### DASH-005: 주간보고 데이터 조회 (TBD)

> **Note**: 주간보고 요구사항은 별도 정의 예정. 아래는 예상 항목.

**As a** 관리자,
**I want to** 주간 단위 연동 실적을 확인하고 싶다,
**So that** 주간보고에 필요한 수치를 빠르게 파악할 수 있다.

**예상 항목:**
- 신규 연동 완료 시스템 수 (해당 주)
- 자가 검수(연결 테스트) 완료 수 (해당 주)
- 연동 끊김 발생 건수 (해당 주)
- 기간 선택 (주간 기본, 월간 등)

> **TODO**: 구체적 항목 및 기간 기준 확정 후 US 상세화

---

## 3. Flow 정의

### 페이지 레이아웃

```
┌──────────────────────────────────────────────────────────────────────┐
│ AdminHeader ("연동 현황 대시보드")                     마지막 확인: HH:MM │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  KPI Cards (2열 복합 카드)                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────┐      │
│  │ [아이콘]          연동률 52%│  │ [아이콘]          연동률 91.5%│      │
│  │ 서비스 현황                 │  │ DB 연동 현황                │      │
│  │ 25 시스템                  │  │ 258 연동중                  │      │
│  │ 🔴 끊어진 서비스 12         │  │ 🔴 끊김 22                  │      │
│  └────────────────────────────┘  └────────────────────────────┘      │
│                                                                      │
│  시스템 목록                                                          │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ [검색...]   [연동방식 ▼] [상태 ▼] [설치 ▼]  | 초기화 [CSV 추출]│    │
│  ├──────┬──────────┬──────┬───────┬────┬─────┬───┬───┬───┬────┤    │
│  │시스템 │Linked Sys│설치  │연동방식│상태 │대상DB│ H │ U │연동중│    │
│  ├──────┼──────────┼──────┼───────┼────┼─────┼───┼───┼───┼────┤    │
│  │시스템A│NI-001    │True  │AWS    │🟢  │  45 │ 38│  3│ 41│    │
│  │SVC-01│PLM-01    │      │Azure  │    │     │   │   │   │    │
│  ├──────┼──────────┼──────┼───────┼────┼─────┼───┼───┼───┼────┤    │
│  │시스템B│NI-003    │False │GCP    │🔴 3│  12 │  9│  3│ 12│    │
│  │SVC-02│          │      │IDC    │    │     │   │   │   │    │
│  └──────┴──────────┴──────┴───────┴────┴─────┴───┴───┴───┴────┘    │
│  총 25건                                     [< 1 2 3 ... 8 >]     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Flow A: Dashboard 진입 및 현황 파악

**관련 US**: DASH-001, DASH-002

```
관리자 접속
  │
  ▼
/admin/dashboard 진입
  │
  ├──→ GET /api/v1/admin/dashboard/summary     ──→ KPI 카드 렌더링
  │
  └──→ GET /api/v1/admin/dashboard/systems     ──→ 시스템 테이블 렌더링
         ?page=0&size=20
```

#### 화면 구성

| 영역 | 컴포넌트 | 데이터 소스 |
|------|---------|------------|
| 상단 KPI | DashboardKpiCards | `GET .../summary` |
| 하단 테이블 | SystemsTable | `GET .../systems` |

#### 사용자 액션

| 액션 | API | 결과 |
|------|-----|------|
| 페이지 이동 | `GET .../systems?page={n}` | 테이블 갱신 |
| 정렬 변경 | `GET .../systems?sort_by={col}&sort_order={asc|desc}` | 테이블 갱신 |

---

### Flow B: 시스템 검색 및 필터링

**관련 US**: DASH-003

```
검색어 입력 또는 필터 선택
  │
  ▼
GET /api/v1/admin/dashboard/systems
  ?search={keyword}
  &integration_method={AWS,GCP}
  &connection_status={healthy|unhealthy|none}
  &svc_installed={true|false}
  &page=0&size=20
  │
  ▼
테이블 갱신 (페이지 초기화)
```

#### 사용자 액션

| 액션 | API 파라미터 | 결과 |
|------|------------|------|
| 검색어 입력 (debounce 300ms) | `search={keyword}` | 테이블 갱신, page=0 |
| 연동 방식 필터 | `integration_method={methods}` | 테이블 갱신, page=0 |
| 연동 상태 필터 | `connection_status={status}` | 테이블 갱신, page=0 |
| 설치 상태 필터 | `svc_installed={true\|false}` | 테이블 갱신, page=0 |
| 초기화 | 파라미터 제거 | 전체 목록 |

---

### Flow C: CSV 추출

**관련 US**: DASH-004

```
[CSV 추출] 클릭
  │
  ▼
GET /api/v1/admin/dashboard/systems/export
  ?search={현재 검색어}
  &integration_method={현재 필터}
  &connection_status={현재 필터}
  &svc_installed={현재 필터}
  │
  ▼
브라우저 파일 다운로드 (시스템현황_2026-02-26.csv)
```

---

## 4. 상태 전이 다이어그램

> Dashboard 자체는 상태 전이가 없으나, 시스템 상세 테이블에서 행 클릭 시 기존 Admin 상세 페이지로 이동하는 네비게이션 흐름이 있다.

```
/admin/dashboard (대시보드)
       │
       │ 행 클릭 (MVP 이후)
       ▼
/admin?service={serviceCode} (기존 서비스 관리)
       │
       │ 프로젝트 클릭
       ▼
/projects/{id} (프로젝트 상세)
```

---

## 5. API 엔드포인트 목록

| Method | Path | 설명 | 응답 |
|--------|------|------|------|
| GET | `/api/v1/admin/dashboard/summary` | 전체 KPI 요약 | DashboardSummary |
| GET | `/api/v1/admin/dashboard/systems` | 시스템 상세 목록 (페이지네이션/검색/필터) | Paginated<SystemDetail> |
| GET | `/api/v1/admin/dashboard/systems/export` | CSV 추출 (검색/필터 동일 조건) | text/csv |

### Query Parameters (systems, systems/export 공통)

| 파라미터 | 타입 | 설명 | 기본값 |
|---------|------|------|--------|
| `search` | string | 통합 검색 (시스템명, 서비스코드) | - |
| `integration_method` | string | 연동 방식 필터 (콤마 구분, 다중) | - |
| `connection_status` | enum | 연동 상태 (all / healthy / unhealthy / none) | all |
| `svc_installed` | enum | 설치 상태 (all / true / false) | all |
| `sort_by` | string | 정렬 기준 컬럼 | service_name |
| `sort_order` | enum | 정렬 방향 (asc / desc) | asc |
| `page` | integer | 페이지 번호 (0-based) | 0 |
| `size` | integer | 페이지 크기 | 20 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-26 | 요구사항 기반 초안 작성 (Dashboard + 시스템 상세) |
| 2026-02-26 | 피드백 반영: KPI 카드 2장 복합 구조로 변경, 담당자 컬럼 제거, N-IRP+SW-PLM → Linked Sys 통합, svc_installed 필드/필터 추가, 연동률 계산식 변경 ((전체-실패)/전체 %), 트렌드 지표 제거 |
