# PII Agent Task Queue Board — 유저 스토리 & Flow 정의

> **범위**: PII 모니터링 모듈 관련 PM/개발 개입 필요 승인 요청의 일괄 조회 및 대응 (Queue Board)
> **기준**: 2026-02-26 요구사항 기반 초안
> **라우팅**: `/task_admin`

---

## 1. 개요

### 도메인 모델: 기존 승인 프로세스의 확장

Queue Board에서 관리하는 항목은 **별도의 "Task" 엔티티가 아니라**, 기존 `ApprovalRequest`에 `requestType`을 확장한 것이다.

```
Target Source (기존)
  └── ApprovalRequest (기존 엔티티 확장)
        ├── TARGET_CONFIRMATION    ← 기존: 연동 대상 확정 승인
        ├── DB_EXCLUSION_REVIEW    ← 신규: DB 제외 사유 확인
        ├── PRD_EXCLUSION_REVIEW   ← 신규: PRD DB 제외 확인
        ├── MODULE_REMOVAL_FULL    ← 신규: 전체 모듈 제거
        └── MODULE_REMOVAL_PARTIAL ← 신규: 일부 모듈 제거

Queue Board (/task_admin)
  = 전체 Target Source를 횡단하여 PENDING 상태의 승인 요청을 모아 보여주는 관리자 뷰
```

**기존 승인 프로세스와의 관계:**
- 승인/반려 액션은 기존 `confirm.yaml`의 `approve`/`reject` 엔드포인트를 **그대로 재사용**
- Queue Board는 **읽기 전용 집계 뷰** + 기존 승인/반려 API 호출을 위한 진입점
- 원천 담당자 측의 요청 생성도 기존 `POST /approval-requests` 엔드포인트를 확장

### 신규 승인 요청 유형 (requestType)

| 유형 | 코드 | 트리거 시점 | 설명 |
|------|------|-------------|------|
| 연동 대상 확정 | `TARGET_CONFIRMATION` | 리소스 선택 후 승인 요청 시 | 기존 프로세스 (변경 없음) |
| DB 연동 제외 확인 | `DB_EXCLUSION_REVIEW` | 연동 대상 확정 시 일부 DB 제외 시 | dev, stg 등 비운영 DB 제외 사유 검증 |
| PRD DB 제외 확인 | `PRD_EXCLUSION_REVIEW` | 운영 DB가 제외된 경우 자동 생성 | PRD DB 제외가 의도적인지 확인 |
| 전체 모듈 제거 | `MODULE_REMOVAL_FULL` | 원천 담당자가 전체 인프라 제거 요청 시 | EoS, IRP 폐기, 타 인프라 migration |
| 일부 모듈 제거 | `MODULE_REMOVAL_PARTIAL` | 원천 담당자가 일부 DB 제거 요청 시 | DB 변경 케이스 |

### 상태 (기존 ApprovalRequest 상태 재사용)

| 상태 | 설명 |
|------|------|
| `PENDING` | 접수됨, 관리자 처리 대기 |
| `APPROVED` | 관리자 승인 완료 |
| `REJECTED` | 관리자 반려 (사유 포함) |

### 역할

| 역할 | 설명 |
|------|------|
| **관리자** | Queue Board에서 전체 Target Source의 대기 요청 일괄 조회, 상세 확인, 승인/반려 |
| **원천 담당자** | 승인 요청 생성, 반려 사유 확인, 재요청 (기존 Target Source 상세 페이지에서) |

---

## 2. 유저 스토리

### ADM-Q-001: Queue Board 조회 (횡단 집계)

**As a** 관리자,
**I want to** 전체 Target Source에 걸쳐 관리자 개입이 필요한 승인 요청을 한 화면에서 보고 싶다,
**So that** 대기 중인 요청을 빠르게 파악하고 우선순위를 정할 수 있다.

**AC:**
- [AC1] Queue Board 진입 시 요약 통계(유형별/상태별 카운트)가 상단에 표시된다
  - API: `GET /api/v1/task-admin/approval-requests/summary`
- [AC2] 전체 Target Source의 승인 요청이 테이블 형태로 표시되며, 기본 정렬은 요청일 최신순이다
  - API: `GET /api/v1/task-admin/approval-requests?page=0&size=20&sort=requestedAt,desc`
- [AC3] 각 행에 다음이 표시된다:
  - 요청 유형명 (연동 대상 확정, DB 제외 확인, EoS 제거 등)
  - 시스템 정보 (서비스코드, 서비스명, 인프라 타입)
  - 요청일, 요청 담당자, 상태
- [AC4] `PENDING` 상태 행에는 [승인]/[반려] 액션 버튼이 노출된다
- [AC5] `APPROVED`/`REJECTED` 상태 행에는 [상세 보기] 링크가 노출된다
- [AC6] 요청이 0건이면 빈 상태 안내가 표시된다
- [AC7] 페이지네이션으로 대량 요청을 탐색할 수 있다

---

### ADM-Q-002: 승인 요청 필터링 및 검색

**As a** 관리자,
**I want to** 승인 요청을 유형/상태/서비스코드별로 필터링하고 검색하고 싶다,
**So that** 특정 조건의 요청만 빠르게 찾을 수 있다.

**AC:**
- [AC1] 요청 유형 필터로 특정 유형만 조회할 수 있다
  - API: `GET /api/v1/task-admin/approval-requests?requestType=DB_EXCLUSION_REVIEW`
- [AC2] 상태 필터로 `PENDING`/`APPROVED`/`REJECTED` 상태별 조회가 가능하다
  - API: `GET /api/v1/task-admin/approval-requests?status=PENDING`
- [AC3] 서비스코드 또는 서비스명으로 검색할 수 있다
  - API: `GET /api/v1/task-admin/approval-requests?search=SVC001`
- [AC4] 필터를 조합하여 사용할 수 있다
- [AC5] 필터 초기화 버튼으로 전체 목록으로 복귀할 수 있다

---

### ADM-Q-003: 승인 요청 상세 확인

**As a** 관리자,
**I want to** 승인 요청의 상세 정보를 확인하고 싶다,
**So that** 충분한 정보를 바탕으로 승인/반려 판단을 할 수 있다.

**AC:**
- [AC1] 행 클릭 시 상세 모달이 표시된다. 상세 데이터는 기존 승인 이력 API를 활용한다
  - API: `GET /api/v1/target-sources/{targetSourceId}/approval-history?page=0&size=1`
- [AC2] 상세 정보에 다음이 포함된다:
  - 요청 유형 (TARGET_CONFIRMATION, DB_EXCLUSION_REVIEW 등)
  - 시스템 정보 (서비스코드, 서비스명, Provider)
  - 요청 내용:
    - TARGET_CONFIRMATION: 연동/제외 리소스 목록, 입력값
    - DB_EXCLUSION_REVIEW: 제외 대상 DB 목록, 각 DB별 제외 사유
    - MODULE_REMOVAL: 제거 대상 DB 목록, 제거 사유
  - 요청일, 요청 담당자
  - 완료일, 처리 담당자 (처리된 경우)
  - 상태 (PENDING / APPROVED / REJECTED)
- [AC3] [해당 시스템 상세 보기] 링크로 Target Source 상세 페이지(`/detail/{id}`)로 이동할 수 있다
- [AC4] 승인 이력을 시간순으로 확인할 수 있다
  - API: `GET /api/v1/target-sources/{targetSourceId}/approval-history`

---

### ADM-Q-004: 승인 요청 승인

**As a** 관리자,
**I want to** 확인이 완료된 승인 요청을 승인하고 싶다,
**So that** 승인된 작업이 실제로 진행될 수 있다.

**AC:**
- [AC1] `PENDING` 상태의 요청에서 [승인] 버튼이 노출된다
- [AC2] [승인] 클릭 시 확인 다이얼로그가 표시된다
- [AC3] 확인 시 **기존 승인 API**를 호출하여 승인이 처리된다
  - API: `POST /api/v1/target-sources/{targetSourceId}/approval-requests/approve`
- [AC4] 승인 성공 시 상태가 `APPROVED`로 변경되고, Queue Board 목록이 갱신된다
- [AC5] 이미 처리된 요청에 대한 승인 시도 시 에러 메시지가 표시된다

---

### ADM-Q-005: 승인 요청 반려

**As a** 관리자,
**I want to** 부적절한 승인 요청을 반려 사유와 함께 반려하고 싶다,
**So that** 원천 담당자가 사유를 확인하고 수정하여 재요청할 수 있다.

**AC:**
- [AC1] `PENDING` 상태의 요청에서 [반려] 버튼이 노출된다
- [AC2] [반려] 클릭 시 반려 사유 입력 모달이 표시된다
- [AC3] 반려 사유는 필수 입력이며, 비어있으면 [반려하기] 버튼이 비활성화된다
- [AC4] 반려 사유 입력 후 [반려하기] 클릭 시 **기존 반려 API**를 호출하여 처리된다
  - API: `POST /api/v1/target-sources/{targetSourceId}/approval-requests/reject`
  - Body: `{ "reason": "반려 사유 텍스트" }`
- [AC5] 반려 성공 시 상태가 `REJECTED`로 변경되고, 반려 사유가 저장된다
- [AC6] 반려 사유는 원천 담당자가 기존 상세 페이지에서 조회할 수 있다

---

### SRC-Q-001: 반려 사유 확인 (원천 담당자)

**As a** 원천 담당자,
**I want to** 반려된 승인 요청의 반려 사유를 확인하고 싶다,
**So that** 어떤 부분을 수정해야 하는지 파악할 수 있다.

**AC:**
- [AC1] Target Source 상세 페이지(Step 2: 승인대기)에서 반려 시 RejectionAlert가 표시된다 (기존 구현)
- [AC2] RejectionAlert에 반려 사유, 반려일시, 반려 담당자가 포함된다
  - API: `GET /api/v1/target-sources/{targetSourceId}/process-status` (last_rejection_reason 필드)
  - API: `GET /api/v1/target-sources/{targetSourceId}/approval-history?page=0&size=1` (상세)
- [AC3] 신규 요청 유형(DB 제외 확인, 모듈 제거)의 반려 사유도 동일한 방식으로 표시된다

---

### SRC-Q-002: 승인 재요청 (원천 담당자)

**As a** 원천 담당자,
**I want to** 반려된 요청을 수정하여 재요청하고 싶다,
**So that** 올바른 정보로 다시 관리자 검토를 받을 수 있다.

**AC:**
- [AC1] 반려 상태에서 기존 [리소스 다시 선택하기] 또는 [재요청] 버튼이 노출된다
- [AC2] 재요청 시 기존 승인 요청 API를 호출한다
  - TARGET_CONFIRMATION: `POST /api/v1/target-sources/{id}/approval-requests` (기존)
  - DB_EXCLUSION_REVIEW / MODULE_REMOVAL: `POST /api/v1/target-sources/{id}/approval-requests` (requestType 포함)
- [AC3] 새 요청은 `PENDING` 상태로 생성되고, 승인 이력에서 이전 반려 이력과 함께 추적 가능하다

---

## 3. Flow 정의

### 공통 레이아웃 (Queue Board: /task_admin)

```
┌──────────────────────────────────────────────────────────┐
│ Queue Board Header (승인 요청 관리)                        │
├──────────────────────────────────────────────────────────┤
│ Summary Cards                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ 전체  12 │ │ 대기   5 │ │ 승인   4 │ │ 반려   3 │     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
├──────────────────────────────────────────────────────────┤
│ Filter Bar                                                │
│ [요청 유형 ▼] [상태 ▼] [검색: 서비스코드/서비스명] [초기화] │
├──────────────────────────────────────────────────────────┤
│ Approval Requests Table                                   │
│ ┌────┬──────────────┬──────┬──────┬──────┬──────┬──────┐│
│ │ #  │ 요청 유형     │서비스│인프라│요청일│상태  │Action││
│ ├────┼──────────────┼──────┼──────┼──────┼──────┼──────┤│
│ │  1 │ DB 제외 확인  │SVC01│ AWS  │02-25│대기  │[승인]││
│ │    │              │      │      │      │      │[반려]││
│ │  2 │ EoS 전체제거  │SVC02│Azure │02-24│승인  │[상세]││
│ │  3 │ 연동대상 확정  │SVC03│ GCP  │02-23│반려  │[상세]││
│ └────┴──────────────┴──────┴──────┴──────┴──────┴──────┘│
│ [< 1 2 3 >]                                              │
└──────────────────────────────────────────────────────────┘
```

### API 호출 관계

```
Queue Board (신규 — 읽기 전용 집계)         기존 confirm.yaml (재사용)
┌─────────────────────────────────┐    ┌────────────────────────────────┐
│ GET /task-admin/                │    │ POST /target-sources/{id}/     │
│     approval-requests           │    │     approval-requests/approve  │
│ GET /task-admin/                │    │ POST /target-sources/{id}/     │
│     approval-requests/summary   │    │     approval-requests/reject   │
└─────────────────────────────────┘    │ GET  /target-sources/{id}/     │
                                       │     approval-history           │
         목록/통계 조회                  └────────────────────────────────┘
         (전체 Target Source 횡단)              개별 승인/반려 액션
                                              (Target Source 단위)
```

---

### Flow 1: Queue Board 진입 → 승인 요청 목록 조회

**관련 US**: ADM-Q-001, ADM-Q-002

```
관리자 진입 (/task_admin)
    │
    ▼
┌─────────────────────────────────────┐
│ Summary 통계 로드                     │ ← GET /task-admin/approval-requests/summary
│ 승인 요청 목록 로드 (page=0)          │ ← GET /task-admin/approval-requests?page=0&size=20
└─────────────────────────────────────┘
    │
    ├── 필터 변경 → 목록 재조회 (?requestType=...&status=...)
    ├── 검색 입력 → 목록 재조회 (?search=...)
    ├── 페이지 이동 → 목록 재조회 (?page=N)
    └── 행 클릭 → Flow 2 또는 Flow 3 진입
```

#### 사용자 액션

| 액션 | API | 비고 |
|------|-----|------|
| 페이지 진입 | `GET .../approval-requests/summary` + `GET .../approval-requests` | 신규 집계 API |
| 필터/검색 | `GET .../approval-requests?requestType=...&status=...&search=...` | 신규 집계 API |
| 행 클릭 | → Flow 2 or 3 | |

---

### Flow 2: 승인 요청 상세 확인 → 승인 처리

**관련 US**: ADM-Q-003, ADM-Q-004

```
행 클릭 (PENDING 상태)
    │
    ▼
┌─────────────────────────────────────┐
│ 승인 요청 상세 모달                    │ ← GET /target-sources/{id}/approval-history?page=0&size=1
│ ├ 요청 유형 (DB 제외 확인, EoS 등)    │    (기존 API 재사용)
│ ├ 시스템 정보                         │
│ ├ 요청 내용 (DB 목록/사유)            │
│ ├ [시스템 상세 보기] 링크             │
│ └ 승인 이력                          │ ← GET /target-sources/{id}/approval-history
└─────────────────────────────────────┘
    │
    ├── [시스템 상세 보기] → /detail/{targetSourceId} 이동
    │
    └── [승인] 클릭
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
              ├── 성공: 상태 → APPROVED, Queue Board 목록 갱신
              └── 실패: 에러 메시지 표시
```

---

### Flow 3: 승인 요청 상세 확인 → 반려 처리

**관련 US**: ADM-Q-003, ADM-Q-005

```
행 클릭 (PENDING 상태)
    │
    ▼
┌─────────────────────────────────────┐
│ 승인 요청 상세 모달                    │
└─────────────────────────────────────┘
    │
    └── [반려] 클릭
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
              ├── 성공: 상태 → REJECTED, Queue Board 목록 갱신
              └── 실패: 에러 메시지 표시
```

---

### Flow 4: 원천 담당자 → 반려 확인 → 재요청

**관련 US**: SRC-Q-001, SRC-Q-002

> 이 Flow는 기존 Target Source 상세 페이지에서 발생한다. Queue Board와 별도의 화면.

```
원천 담당자 — Target Source 상세 페이지 (/detail/{id})
    │
    ▼
┌─────────────────────────────────────┐
│ ProcessStatusCard — 반려 상태 표시    │
│ ├ RejectionAlert (반려 사유, 반려일시)│ ← GET /target-sources/{id}/process-status
│ └ [리소스 다시 선택하기] / [재요청]   │
└─────────────────────────────────────┘
    │
    └── [재요청] 클릭
         │
         ▼
    ┌───────────────────────────────────────┐
    │ 요청 유형에 따른 편집 폼                │
    │ ├ TARGET_CONFIRMATION: 리소스 재선택    │
    │ ├ DB_EXCLUSION: 제외 사유 수정          │
    │ └ MODULE_REMOVAL: 제거 대상 수정        │
    └───────────────────────────────────────┘
         │
         └── [요청] → POST /target-sources/{id}/approval-requests
              │         (기존 API, requestType 포함)
              │
              └── 새 PENDING 요청 생성 → Queue Board에 노출
```

---

## 4. 유형별 상세 시나리오

### 시나리오 A: DB 연동 제외 사유 확인

```
[원천 담당자]                              [관리자 — Queue Board]
     │                                       │
     │ 연동 대상 확정 시 일부 DB 제외          │
     │ POST /target-sources/{id}/             │
     │   approval-requests                    │
     │   { requestType: DB_EXCLUSION_REVIEW } │
     │ ─────────────────────────────────────→ │ Queue Board에 PENDING 노출
     │                                       │ ├ 제외 대상 DB 목록
     │                                       │ ├ 각 DB별 제외 사유
     │                                       │ └ PRD DB 제외 여부 표시
     │                                       │
     │                    승인 ──────────────│ POST .../approve (기존 API)
     │                    또는                │
     │ ← 반려 사유 전달 ── 반려 ──────────────│ POST .../reject (기존 API)
     │                                       │
     │ 상세페이지 RejectionAlert에서 확인      │
     │ 수정 후 재요청 ────────────────────→   │ 새 PENDING 요청 생성
```

### 시나리오 B: 모니터링 모듈 전체 제거 (EoS, IRP 폐기, Migration)

```
[원천 담당자]                              [관리자 — Queue Board]
     │                                       │
     │ POST /target-sources/{id}/             │
     │   approval-requests                    │
     │   { requestType: MODULE_REMOVAL_FULL,  │
     │     removalReason: END_OF_SERVICE }    │
     │ ─────────────────────────────────────→ │ Queue Board에 PENDING 노출
     │                                       │ ├ 대상 시스템 전체 DB 목록
     │                                       │ ├ 제거 사유 (EoS)
     │                                       │ └ [시스템 상세 보기] 링크
     │                                       │
     │                    승인 → Agent/SDU 제거 프로세스 시작
     │                    반려 → 사유 전달
```

### 시나리오 C: 모니터링 모듈 일부 제거 (DB 변경)

```
[원천 담당자]                              [관리자 — Queue Board]
     │                                       │
     │ POST /target-sources/{id}/             │
     │   approval-requests                    │
     │   { requestType: MODULE_REMOVAL_PARTIAL,│
     │     removalReason: DB_CHANGE }         │
     │ ─────────────────────────────────────→ │ Queue Board에 PENDING 노출
     │                                       │ ├ 제거 대상 DB (변경 대상)
     │                                       │ ├ 유지 대상 DB
     │                                       │ └ 변경 사유
     │                                       │
     │                    승인 → 해당 DB Agent/SDU만 제거
     │                    반려 → 사유 전달
```

---

## 5. 상태 전이 다이어그램

> 기존 ApprovalRequest 상태 전이와 동일. 신규 requestType도 같은 생명주기를 따른다.

```
                                ┌─────────────────┐
                                │                 │
[승인 요청 생성] ──────────────→ │    PENDING      │
 POST .../approval-requests     │  (접수, 대기)    │
                                └────────┬────────┘
                                         │
                              ┌──────────┼──────────┐
                              │          │          │
                           승인 시     반려 시       │
                     POST .../approve POST .../reject│
                              │          │          │
                              ▼          ▼          │
                     ┌──────────┐  ┌──────────┐    │
                     │ APPROVED │  │ REJECTED │    │
                     │          │  │          │    │
                     └──────────┘  └─────┬────┘    │
                                         │          │
                                    재요청 시        │
                              POST .../approval-requests
                                   (새 요청 생성)    │
                                         │          │
                                         └──────────┘
```

---

## 6. API 엔드포인트 목록

### 신규 API (Queue Board — 읽기 전용 집계)

| Method | Path | 설명 | Swagger |
|--------|------|------|---------|
| GET | `/api/v1/task-admin/approval-requests` | 전체 TS 횡단 승인 요청 목록 (필터/정렬/페이지네이션) | `task_dashboard.yaml` |
| GET | `/api/v1/task-admin/approval-requests/summary` | 요약 통계 (유형별/상태별 카운트) | `task_dashboard.yaml` |

### 기존 API 재사용 (confirm.yaml — 변경 없음)

| Method | Path | 설명 | 호출 시점 |
|--------|------|------|-----------|
| POST | `/api/v1/target-sources/{id}/approval-requests` | 승인 요청 생성 | 원천 담당자 요청 시 |
| POST | `/api/v1/target-sources/{id}/approval-requests/approve` | 승인 | Queue Board에서 승인 시 |
| POST | `/api/v1/target-sources/{id}/approval-requests/reject` | 반려 | Queue Board에서 반려 시 |
| GET | `/api/v1/target-sources/{id}/approval-history` | 승인 이력 | 상세 모달에서 이력 조회 시 |

### confirm.yaml 스키마 확장 (기존 스키마에 추가)

| 항목 | 변경 내용 |
|------|-----------|
| `ApprovalRequestCreateRequest` | `requestType` 필드 추가 (enum 확장) |
| `ApprovalRequest` | `requestType` 필드 추가 |
| `ApprovalRequestInputData` | 유형별 data (exclusion/removal) 지원 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-26 | 요구사항 기반 초안 작성 |
| 2026-02-26 | v2: "기존 승인 프로세스 확장" 모델로 전면 개편 — 별도 Task 엔티티 제거, Queue Board는 읽기 전용 집계 뷰로 변경 |
