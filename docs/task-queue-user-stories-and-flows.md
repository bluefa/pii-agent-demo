# PII Agent Task Queue Board — 유저 스토리 & Flow 정의

> **범위**: PII 모니터링 모듈 관련 PM/개발 개입 필요 승인 요청의 일괄 조회 및 대응 (Queue Board)
> **기준**: 2026-02-26 요구사항 기반
> **라우팅**: `/task_admin`

---

## 1. 개요

### 도메인 모델: 기존 승인 프로세스의 확장

Queue Board에서 관리하는 항목은 **별도 엔티티가 아니라**, 기존 `ApprovalRequest`에 `requestType`을 확장한 것이다.

```
Target Source (기존)
  └── ApprovalRequest (기존 엔티티 확장)
        ├── TARGET_CONFIRMATION  ← 기존: 연동 대상 확정 승인
        └── END_OF_SERVICE       ← 신규: EoS 처리

Queue Board (/task_admin)
  = 전체 Target Source를 횡단하여 승인 요청을 모아 보여주는 관리자 뷰
  = 2탭 구조: [Pending Tasks] | [완료 내역]
```

### 승인 요청 유형 (requestType)

| 유형 | 코드 | 설명 |
|------|------|------|
| 연동 대상 확정 승인 | `TARGET_CONFIRMATION` | 기존: 리소스 선택 후 연동 승인 요청 |
| EoS 처리 | `END_OF_SERVICE` | 신규: 서비스 종료에 따른 모니터링 모듈 제거 |

### 상태 (기존 ApprovalRequest 상태 재사용)

| 상태 | 탭 | 설명 |
|------|---|------|
| `PENDING` | Pending Tasks | 접수됨, 관리자 처리 대기 |
| `APPROVED` | 완료 내역 | 관리자 승인 완료 |
| `REJECTED` | 완료 내역 | 관리자 반려 (사유 포함) |

### Queue Board 테이블 컬럼

**Pending Tasks 탭:**

| 컬럼 | 설명 |
|------|------|
| 요청 유형 | 연동 대상 확정, EoS 처리 등 (requestType 표시명) |
| 서비스코드 | ServiceCode |
| Cloud Provider | AWS, Azure, GCP, IDC, SDU |
| Cloud 정보 | Provider별 식별 정보 (아래 표 참조) |
| 요청 시간 | 승인 요청 생성 시각 (`requested_at`, datetime) |
| Action | [승인] [반려] [상세] |

**완료 내역 탭:**

| 컬럼 | 설명 |
|------|------|
| 요청 유형 | (동일) |
| 서비스코드 | (동일) |
| Cloud Provider | (동일) |
| Cloud 정보 | (동일) |
| 요청 시간 | 승인 요청 생성 시각 (`requested_at`, datetime) |
| 처리 시간 | 승인/반려 처리 시각 (`processed_at`, datetime) |
| 결과 | 승인 / 반려 |
| Action | [상세] |

#### Provider별 Cloud 정보

| Provider | 표시 정보 | 예시 |
|----------|-----------|------|
| AWS | Account ID | `123456789012` |
| Azure | Tenant / Subscription | `contoso.onmicrosoft.com / prod-sub-01` |
| GCP | Project ID | `my-project-123` |
| SDU | SDU | `SDU` |
| IDC | IDC | `IDC` |

---

## 2. 유저 스토리

### ADM-Q-001: Pending Tasks 탭 조회

**As a** 관리자,
**I want to** 처리 대기 중인 전체 승인 요청을 한 화면에서 보고 싶다,
**So that** 대기 중인 요청을 빠르게 파악하고 대응할 수 있다.

**AC:**
- [AC1] Queue Board 진입 시 기본으로 [Pending Tasks] 탭이 활성화된다
- [AC2] `PENDING` 상태의 승인 요청만 테이블에 표시된다
  - API: `GET /api/v1/task-admin/approval-requests?status=PENDING&page=0&size=20`
- [AC3] 각 행에 요청 유형, 서비스코드, Cloud Provider, Cloud 정보, 요청 시간이 표시된다
- [AC4] 각 행에 [승인], [반려], [상세] 액션 버튼이 노출된다
- [AC5] 요청이 0건이면 빈 상태 안내가 표시된다
- [AC6] Pending 건수가 탭 라벨에 배지로 표시된다 (예: `Pending Tasks (5)`)

---

### ADM-Q-002: 완료 내역 탭 조회

**As a** 관리자,
**I want to** 이미 처리된 승인 요청 이력을 확인하고 싶다,
**So that** 과거 처리 내역을 추적하고 검토할 수 있다.

**AC:**
- [AC1] [완료 내역] 탭 클릭 시 `APPROVED` + `REJECTED` 상태의 요청이 표시된다
  - API: `GET /api/v1/task-admin/approval-requests?status=APPROVED,REJECTED&page=0&size=20`
- [AC2] 각 행에 요청 유형, 서비스코드, Cloud Provider, Cloud 정보, 요청 시간, 처리 시간, 결과(승인/반려)가 표시된다
- [AC3] 각 행에는 [상세] 액션만 노출된다 (승인/반려 불가)
- [AC4] 페이지네이션으로 과거 이력을 탐색할 수 있다

---

### ADM-Q-003: 승인 요청 필터링 및 검색

**As a** 관리자,
**I want to** 승인 요청을 유형/서비스코드별로 필터링하고 검색하고 싶다,
**So that** 특정 조건의 요청만 빠르게 찾을 수 있다.

**AC:**
- [AC1] 요청 유형 필터로 특정 유형만 조회할 수 있다
  - API: `GET /api/v1/task-admin/approval-requests?requestType=TARGET_CONFIRMATION`
- [AC2] 서비스코드 또는 서비스명으로 검색할 수 있다
  - API: `GET /api/v1/task-admin/approval-requests?search=SVC001`
- [AC3] 필터는 양쪽 탭에서 모두 동작한다
- [AC4] 필터 초기화 버튼으로 전체 목록으로 복귀할 수 있다

---

### ADM-Q-004: 승인 요청 상세 확인

**As a** 관리자,
**I want to** 승인 요청의 상세 정보를 확인하고 싶다,
**So that** 충분한 정보를 바탕으로 승인/반려 판단을 할 수 있다.

**AC:**
- [AC1] [상세] 클릭 시 상세 모달이 표시된다
  - API: `GET /api/v1/target-sources/{targetSourceId}/approval-history?page=0&size=1`
- [AC2] 상세 정보:
  - 요청 유형
  - 시스템 정보 (서비스코드, Provider, Cloud 정보)
  - TARGET_CONFIRMATION: 연동/제외 리소스 목록, 입력값
  - END_OF_SERVICE: EoS 대상 시스템 정보, 제거 사유
  - 요청일, 요청 담당자
  - 처리 결과 (완료된 경우: 승인/반려, 처리일, 처리 담당자, 반려 사유)
- [AC3] [해당 시스템 상세 보기] 링크로 `/detail/{id}` 이동 가능
- [AC4] 승인 이력을 시간순으로 확인할 수 있다

---

### ADM-Q-005: 승인 요청 승인

**As a** 관리자,
**I want to** Pending 상태의 승인 요청을 승인하고 싶다,
**So that** 승인된 작업이 실제로 진행될 수 있다.

**AC:**
- [AC1] Pending Tasks 탭에서 [승인] 버튼 클릭 시 확인 다이얼로그가 표시된다
- [AC2] 확인 시 기존 승인 API를 호출한다
  - API: `POST /api/v1/target-sources/{targetSourceId}/approval-requests/approve`
- [AC3] 성공 시 해당 행이 Pending 탭에서 사라지고, 완료 내역 탭으로 이동된다
- [AC4] Pending 탭 배지 카운트가 갱신된다

---

### ADM-Q-006: 승인 요청 반려

**As a** 관리자,
**I want to** 부적절한 승인 요청을 반려 사유와 함께 반려하고 싶다,
**So that** 원천 담당자가 사유를 확인하고 재요청할 수 있다.

**AC:**
- [AC1] Pending Tasks 탭에서 [반려] 버튼 클릭 시 반려 사유 입력 모달이 표시된다
- [AC2] 반려 사유는 필수, 비어있으면 [반려하기] 비활성화
- [AC3] 기존 반려 API를 호출한다
  - API: `POST /api/v1/target-sources/{targetSourceId}/approval-requests/reject`
  - Body: `{ "reason": "반려 사유" }`
- [AC4] 성공 시 해당 행이 Pending 탭에서 사라지고, 완료 내역 탭에서 조회 가능
- [AC5] 반려 사유는 원천 담당자가 상세 페이지에서 확인 가능

---

## 3. Flow 정의

### 공통 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ Queue Board Header (승인 요청 관리)                            │
├──────────────────────────────────────────────────────────────┤
│ [Pending Tasks (5)]  |  [완료 내역]                           │ ← 탭
├──────────────────────────────────────────────────────────────┤
│ Filter Bar                                                    │
│ [요청 유형 ▼] [검색: 서비스코드/서비스명]  [초기화]              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ※ Pending Tasks 탭 활성 시                                          │
│ ┌──────────┬──────┬────────┬────────────┬─────────────┬─────────────┐│
│ │요청 유형  │서비스 │Provider│Cloud 정보   │요청 시간     │ Action      ││
│ ├──────────┼──────┼────────┼────────────┼─────────────┼─────────────┤│
│ │연동 확정  │SVC01│ AWS    │1234...9012 │02-25 10:30  │[승인][반려]  ││
│ │          │      │        │            │             │[상세]       ││
│ │EoS 처리  │SVC02│ Azure  │contoso/sub │02-24 09:00  │[승인][반려]  ││
│ │          │      │        │            │             │[상세]       ││
│ └──────────┴──────┴────────┴────────────┴─────────────┴─────────────┘│
│                                                                       │
│  ※ 완료 내역 탭 활성 시                                               │
│ ┌──────────┬──────┬────────┬───────────┬────────────┬────────────┬──────┬──────┐│
│ │요청 유형  │서비스 │Provider│Cloud 정보  │요청 시간   │처리 시간    │결과  │Action││
│ ├──────────┼──────┼────────┼───────────┼────────────┼────────────┼──────┼──────┤│
│ │연동 확정  │SVC03│ GCP    │my-proj-123│02-23 14:00 │02-23 16:30 │승인  │[상세]││
│ │연동 확정  │SVC04│ IDC    │IDC        │02-22 11:00 │02-22 15:45 │반려  │[상세]││
│ └──────────┴──────┴────────┴───────────┴────────────┴────────────┴──────┴──────┘│
│                                                               │
│ [< 1 2 3 >]                                                  │
└──────────────────────────────────────────────────────────────┘
```

### API 호출 관계

```
Queue Board (신규 — 읽기 전용 집계)         기존 confirm.yaml (재사용)
┌─────────────────────────────────┐    ┌────────────────────────────────┐
│ GET /task-admin/                │    │ POST /target-sources/{id}/     │
│     approval-requests           │    │     approval-requests/approve  │
│     ?status=PENDING             │    │ POST /target-sources/{id}/     │
│     ?status=APPROVED,REJECTED   │    │     approval-requests/reject   │
└─────────────────────────────────┘    │ GET  /target-sources/{id}/     │
                                       │     approval-history           │
         탭별 목록 조회                  └────────────────────────────────┘
         (전체 Target Source 횡단)              개별 승인/반려 액션
                                              (Target Source 단위)
```

---

### 데이터 플로우: 승인 요청 생성 → Queue Board 노출

기존 Target Source 상세 페이지에서 승인 요청이 생성되면, Queue Board에 자동으로 노출된다.

```
[원천 담당자 — /detail/{id}]                    [관리자 — /task_admin]

 1. 승인 요청 생성
    POST /target-sources/{id}/approval-requests
    { requestType: "TARGET_CONFIRMATION",       ─────→  Queue Board
      input_data: { resource_inputs: [...] } }          GET /task-admin/approval-requests
                                                        ?status=PENDING
    ※ requestType 미지정 시 TARGET_CONFIRMATION              ↓
      (기존 호출과 완전 호환)                          [Pending Tasks] 탭에 신규 행 노출
                                                        ├ 요청 유형: 연동 대상 확정
                                                        ├ 서비스코드, Provider, Cloud 정보
                                                        ├ 요청 시간: requested_at
                                                        └ Action: [승인][반려][상세]

 2. 관리자 승인/반려 (Queue Board에서)
    POST /target-sources/{id}/approval-requests/approve  ← 기존 API
    POST /target-sources/{id}/approval-requests/reject   ← 기존 API

 3. 처리 완료
    Queue Board Pending 탭에서 행 제거               ─→  [완료 내역] 탭에 행 추가
                                                        ├ 처리 시간: processed_at
    원천 담당자 상세 페이지에서 결과 확인                    └ 결과: 승인/반려
    GET /target-sources/{id}/process-status
```

**핵심**: Queue Board의 신규 API(`GET /task-admin/approval-requests`)는 기존 `ApprovalRequest` 테이블을 전체 Target Source에 걸쳐 집계하는 **읽기 전용 뷰**일 뿐이다. 쓰기 동작은 모두 기존 `confirm.yaml` 엔드포인트를 재사용한다.

---

### Flow 1: Pending Tasks 탭 → 목록 조회

**관련 US**: ADM-Q-001, ADM-Q-003

```
관리자 진입 (/task_admin)
    │
    ▼
┌─────────────────────────────────────────┐
│ [Pending Tasks] 탭 활성 (기본)           │
│ PENDING 목록 로드                        │ ← GET /task-admin/approval-requests
│                                          │    ?status=PENDING&page=0&size=20
└─────────────────────────────────────────┘
    │
    ├── 필터/검색 → 목록 재조회 (?requestType=...&search=...)
    ├── 페이지 이동 → 목록 재조회 (?page=N)
    ├── [승인] 클릭 → Flow 2
    ├── [반려] 클릭 → Flow 3
    └── [상세] 클릭 → Flow 4
```

---

### Flow 2: 승인 처리

**관련 US**: ADM-Q-005

```
[승인] 클릭
    │
    ▼
┌───────────────────────────┐
│ 확인 다이얼로그              │
│ "이 요청을 승인하시겠습니까?" │
│ [취소] [확인]               │
└───────────────────────────┘
    │
    └── [확인] → POST /target-sources/{id}/approval-requests/approve
         │         (기존 API 재사용)
         │
         ├── 성공: Pending 목록 갱신 (해당 행 제거), 탭 배지 -1
         └── 실패: 에러 토스트
```

---

### Flow 3: 반려 처리

**관련 US**: ADM-Q-006

```
[반려] 클릭
    │
    ▼
┌─────────────────────────┐
│ 반려 사유 입력 모달        │
│                          │
│ [반려 사유 *]             │
│ ┌──────────────────────┐ │
│ │ (textarea)           │ │
│ └──────────────────────┘ │
│                          │
│ [취소] [반려하기]         │
│  ※ 사유 비어있으면 비활성화 │
└─────────────────────────┘
    │
    └── [반려하기] → POST /target-sources/{id}/approval-requests/reject
         │            Body: { "reason": "..." }
         │            (기존 API 재사용)
         │
         ├── 성공: Pending 목록 갱신 (해당 행 제거), 탭 배지 -1
         └── 실패: 에러 토스트
```

---

### Flow 4: 상세 확인

**관련 US**: ADM-Q-004

```
[상세] 클릭 (Pending 또는 완료 내역 탭 공통)
    │
    ▼
┌─────────────────────────────────────┐
│ 승인 요청 상세 모달                    │ ← GET /target-sources/{id}/
│ ├ 요청 유형                           │    approval-history?page=0&size=1
│ ├ 시스템 정보                         │    (기존 API)
│ │  ├ 서비스코드                       │
│ │  ├ Cloud Provider                   │
│ │  └ Cloud 정보 (Account/Tenant 등)   │
│ ├ 요청 내용                           │
│ │  ├ TARGET_CONFIRMATION: 리소스 목록  │
│ │  └ END_OF_SERVICE: 대상 시스템 정보  │
│ ├ 요청일, 요청 담당자                  │
│ ├ 처리 결과 (완료 시)                  │
│ │  ├ 승인/반려                        │
│ │  ├ 처리일, 처리 담당자               │
│ │  └ 반려 사유 (반려 시)               │
│ └ [해당 시스템 상세 보기] 링크          │ → /detail/{targetSourceId}
└─────────────────────────────────────┘
```

---

## 4. 유형별 시나리오

### 시나리오 A: 연동 대상 확정 승인 (TARGET_CONFIRMATION)

기존 프로세스와 동일. Queue Board에서는 **Pending 목록에 노출 → 승인/반려 → 완료 내역으로 이동**.

```
[원천 담당자]                              [관리자 — Queue Board]
     │                                       │
     │ 리소스 선택 후 승인 요청               │
     │ POST .../approval-requests            │
     │ { requestType: TARGET_CONFIRMATION }  │
     │ ─────────────────────────────────────→ │ [Pending Tasks] 탭에 노출
     │                                       │  서비스코드 | AWS | 1234...9012
     │                                       │
     │                    승인 ──────────────│ → [완료 내역] 탭으로 이동
     │                    반려 ──────────────│ → [완료 내역] 탭으로 이동
     │                                       │   (반려 사유 포함)
```

### 시나리오 B: EoS 처리 (END_OF_SERVICE)

```
[원천 담당자]                              [관리자 — Queue Board]
     │                                       │
     │ EoS 요청                              │
     │ POST .../approval-requests            │
     │ { requestType: END_OF_SERVICE }       │
     │ ─────────────────────────────────────→ │ [Pending Tasks] 탭에 노출
     │                                       │  서비스코드 | Azure | contoso/sub
     │                                       │
     │                    승인 ──────────────│ → 모듈 제거 프로세스 시작
     │                    반려 ──────────────│ → 사유 전달
```

---

## 5. 상태 전이 (기존 ApprovalRequest 동일)

```
                                ┌─────────────────┐
                                │                 │
[승인 요청 생성] ──────────────→ │    PENDING      │  ← [Pending Tasks] 탭
 POST .../approval-requests     │                 │
                                └────────┬────────┘
                                         │
                              ┌──────────┼──────────┐
                              │                     │
                           승인 시                반려 시
                     POST .../approve        POST .../reject
                              │                     │
                              ▼                     ▼
                     ┌──────────┐          ┌──────────┐
                     │ APPROVED │          │ REJECTED │  ← [완료 내역] 탭
                     └──────────┘          └──────────┘
```

---

## 6. API 엔드포인트 목록

### 신규 API (Queue Board — 읽기 전용 집계)

| Method | Path | 설명 | Swagger |
|--------|------|------|---------|
| GET | `/api/v1/task-admin/approval-requests` | 전체 TS 횡단 승인 요청 목록 (탭별 status 필터) | `task_dashboard.yaml` |

### 기존 API 재사용 (confirm.yaml)

| Method | Path | 설명 | 호출 시점 |
|--------|------|------|-----------|
| POST | `/api/v1/target-sources/{id}/approval-requests` | 승인 요청 생성 | 원천 담당자 요청 시 |
| POST | `/api/v1/target-sources/{id}/approval-requests/approve` | 승인 | Queue Board에서 승인 시 |
| POST | `/api/v1/target-sources/{id}/approval-requests/reject` | 반려 | Queue Board에서 반려 시 |
| GET | `/api/v1/target-sources/{id}/approval-history` | 승인 이력 | 상세 모달에서 조회 시 |

### confirm.yaml 스키마 확장

| 항목 | 변경 |
|------|------|
| `ApprovalRequest` | `requestType` 필드 추가 (`TARGET_CONFIRMATION`, `END_OF_SERVICE`) |
| `ApprovalRequestCreateRequest` | `requestType` 필드 추가 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-26 | 요구사항 기반 초안 작성 |
| 2026-02-26 | v2: 기존 승인 프로세스 확장 모델로 전면 개편 |
| 2026-02-26 | v3: 2탭 구조(Pending/완료), Cloud 정보 컬럼 추가, Task 유형 정리(TARGET_CONFIRMATION + END_OF_SERVICE) |
| 2026-02-26 | v4: 요청일자→요청시간/처리시간, API 연계 데이터 플로우 추가, 완료 내역 탭에 처리시간 컬럼 추가 |
