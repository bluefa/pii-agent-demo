# PII Agent Task Queue Board — 유저 스토리 & Flow 정의

> **범위**: PII 모니터링 모듈 관련 PM/개발 개입 필요 Task의 일괄 조회 및 대응 (Queue Board)
> **기준**: 2026-02-26 요구사항 기반 초안
> **라우팅**: `/task_admin`

---

## 1. 개요

PII 모니터링 모듈 운영 과정에서 **관리자(PM/개발) 개입이 필요한 Task**를 Queue로 관리하는 대시보드.
원천 담당자가 생성한 요청을 관리자가 일괄 조회하고, 상세 확인 후 승인/반려를 수행한다.

### 대상 Task 유형

| Task 유형 | 코드 | 설명 |
|-----------|------|------|
| DB 연동 제외 사유 확인 | `DB_EXCLUSION_REVIEW` | 연동 대상 확정 중 일부 DB(dev, stg 등)를 제외할 때 제외 사유 검증 |
| PRD DB 연동 제외 확인 | `PRD_EXCLUSION_REVIEW` | 운영(PRD) DB가 연동 대상에서 제외된 경우 의도 확인 |
| 모니터링 모듈 전체 제거 | `MODULE_REMOVAL_FULL` | EoS, IRP 폐기, 타 인프라 migration 등으로 전체 인프라 제거 |
| 모니터링 모듈 일부 제거 | `MODULE_REMOVAL_PARTIAL` | DB 변경에 따른 일부 DB의 Agent/SDU 제거 |

### Task 상태

| 상태 | 설명 |
|------|------|
| `PENDING` | 접수됨, 관리자 처리 대기 |
| `APPROVED` | 관리자 승인 완료 |
| `REJECTED` | 관리자 반려 (사유 포함) |

### 역할

| 역할 | 설명 |
|------|------|
| **관리자** | Queue Board에서 Task 조회, 상세 확인, 승인/반려 수행 |
| **원천 담당자** | Task 생성(시스템 자동/수동), 반려 사유 확인, 재요청 |

---

## 2. 유저 스토리

### ADM-Q-001: Task Queue Board 조회

**As a** 관리자,
**I want to** PM/개발 개입이 필요한 전체 Task를 한눈에 보고 싶다,
**So that** 대기 중인 요청을 빠르게 파악하고 우선순위를 정할 수 있다.

**AC:**
- [AC1] Queue Board 진입 시 Task 요약 통계(유형별/상태별 카운트)가 상단에 표시된다
  - API: `GET /api/v1/task-admin/tasks/summary`
- [AC2] Task 목록이 테이블 형태로 표시되며, 기본 정렬은 요청일 최신순이다
  - API: `GET /api/v1/task-admin/tasks?page=0&size=20&sort=requestedAt,desc`
- [AC3] 각 Task 행에 Task명, 시스템 정보(서비스코드, 서비스명, 인프라 타입), 요청일, 요청 담당자, 상태가 표시된다
- [AC4] `PENDING` 상태 Task 행에는 [승인]/[반려] 액션 버튼이 노출된다
- [AC5] `APPROVED`/`REJECTED` 상태 Task 행에는 [상세 보기] 링크가 노출된다
- [AC6] Task가 0건이면 빈 상태 안내가 표시된다
- [AC7] 페이지네이션으로 대량 Task를 탐색할 수 있다

---

### ADM-Q-002: Task 필터링 및 검색

**As a** 관리자,
**I want to** Task를 유형/상태/서비스코드별로 필터링하고 검색하고 싶다,
**So that** 특정 조건의 Task만 빠르게 찾을 수 있다.

**AC:**
- [AC1] Task 유형 필터로 특정 유형의 Task만 조회할 수 있다
  - API: `GET /api/v1/task-admin/tasks?taskType=DB_EXCLUSION_REVIEW`
- [AC2] 상태 필터로 `PENDING`/`APPROVED`/`REJECTED` 상태별 조회가 가능하다
  - API: `GET /api/v1/task-admin/tasks?status=PENDING`
- [AC3] 서비스코드 또는 서비스명으로 검색할 수 있다
  - API: `GET /api/v1/task-admin/tasks?search=SVC001`
- [AC4] 필터를 조합하여 사용할 수 있다 (예: PENDING + DB_EXCLUSION_REVIEW)
- [AC5] 필터 초기화 버튼으로 전체 목록으로 복귀할 수 있다

---

### ADM-Q-003: Task 상세 확인

**As a** 관리자,
**I want to** Task의 상세 정보를 확인하고 싶다,
**So that** 충분한 정보를 바탕으로 승인/반려 판단을 할 수 있다.

**AC:**
- [AC1] Task 행 클릭 또는 [상세 보기] 클릭 시 Task 상세 모달 또는 상세 페이지가 표시된다
  - API: `GET /api/v1/task-admin/tasks/{taskId}`
- [AC2] 상세 정보에 다음이 포함된다:
  - Task명 (연동 대상 확정, EoS 등)
  - 시스템 정보 (서비스코드, 서비스명, 인프라 타입, Provider)
  - 요청 내용 (제외 대상 DB 목록, 제외 사유 / 제거 대상 DB 목록, 제거 사유)
  - 요청일, 요청 담당자
  - 완료일, 승인 담당자 (처리된 경우)
  - 상태 (PENDING / APPROVED / REJECTED)
- [AC3] DB_EXCLUSION_REVIEW 유형의 경우, 제외 대상 DB 목록과 각 DB별 제외 사유가 표시된다
- [AC4] MODULE_REMOVAL 유형의 경우, 제거 대상 DB 목록과 제거 사유(EoS, IRP 폐기 등)가 표시된다
- [AC5] [해당 시스템 상세 페이지 진입] 링크로 해당 Target Source 상세 페이지(`/detail/{id}`)로 이동할 수 있다
- [AC6] Task 이력(생성, 승인, 반려 등)을 시간순으로 확인할 수 있다
  - API: `GET /api/v1/task-admin/tasks/{taskId}/history`

---

### ADM-Q-004: Task 승인

**As a** 관리자,
**I want to** 확인이 완료된 Task를 승인하고 싶다,
**So that** 승인된 작업이 실제로 진행될 수 있다.

**AC:**
- [AC1] `PENDING` 상태의 Task에서 [승인] 버튼이 노출된다
- [AC2] [승인] 클릭 시 확인 다이얼로그가 표시된다 ("이 Task를 승인하시겠습니까?")
- [AC3] 확인 시 승인이 처리된다
  - API: `POST /api/v1/task-admin/tasks/{taskId}/approve`
- [AC4] 승인 성공 시 Task 상태가 `APPROVED`로 변경되고, 목록이 갱신된다
- [AC5] 이미 처리된 Task에 대한 승인 시도 시 에러 메시지가 표시된다

---

### ADM-Q-005: Task 반려

**As a** 관리자,
**I want to** 부적절한 Task를 반려 사유와 함께 반려하고 싶다,
**So that** 원천 담당자가 사유를 확인하고 수정하여 재요청할 수 있다.

**AC:**
- [AC1] `PENDING` 상태의 Task에서 [반려] 버튼이 노출된다
- [AC2] [반려] 클릭 시 반려 사유 입력 모달이 표시된다
- [AC3] 반려 사유는 필수 입력이며, 비어있으면 [반려하기] 버튼이 비활성화된다
- [AC4] 반려 사유 입력 후 [반려하기] 클릭 시 반려가 처리된다
  - API: `POST /api/v1/task-admin/tasks/{taskId}/reject`
  - Body: `{ "reason": "반려 사유 텍스트" }`
- [AC5] 반려 성공 시 Task 상태가 `REJECTED`로 변경되고, 반려 사유가 저장된다
- [AC6] 반려 사유는 원천 담당자가 조회할 수 있다

---

### SRC-Q-001: 반려 사유 확인

**As a** 원천 담당자,
**I want to** 반려된 Task의 반려 사유를 확인하고 싶다,
**So that** 어떤 부분을 수정해야 하는지 파악하고 재요청할 수 있다.

**AC:**
- [AC1] 원천 담당자 시스템에서 본인이 요청한 Task 목록을 조회할 수 있다
  - API: `GET /api/v1/target-sources/{targetSourceId}/tasks`
- [AC2] `REJECTED` 상태의 Task에서 반려 사유가 표시된다
- [AC3] 반려 사유에 반려일시, 반려 담당자 정보가 포함된다

---

### SRC-Q-002: Task 재요청

**As a** 원천 담당자,
**I want to** 반려된 Task를 수정하여 재요청하고 싶다,
**So that** 올바른 정보로 다시 관리자 검토를 받을 수 있다.

**AC:**
- [AC1] `REJECTED` 상태의 Task에서 [재요청] 버튼이 노출된다
- [AC2] 재요청 시 기존 Task 정보가 사전 입력된 상태로 편집 폼이 표시된다
- [AC3] 수정 완료 후 제출 시 새로운 Task가 `PENDING` 상태로 생성된다
  - API: `POST /api/v1/target-sources/{targetSourceId}/tasks`
- [AC4] 새 Task는 이전 Task와 연결되어 이력 추적이 가능하다

---

## 3. Flow 정의

### 공통 레이아웃 (Queue Board)

```
┌──────────────────────────────────────────────────────────┐
│ Queue Board Header (Task Queue Board)                     │
├──────────────────────────────────────────────────────────┤
│ Summary Cards                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ 전체  12 │ │ 대기   5 │ │ 승인   4 │ │ 반려   3 │     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
├──────────────────────────────────────────────────────────┤
│ Filter Bar                                                │
│ [유형 ▼] [상태 ▼] [검색: 서비스코드/서비스명]  [초기화]    │
├──────────────────────────────────────────────────────────┤
│ Task Table                                                │
│ ┌────┬──────────┬──────┬──────┬──────┬──────┬──────────┐│
│ │ #  │ Task명   │서비스│인프라│요청일│상태  │ Action   ││
│ ├────┼──────────┼──────┼──────┼──────┼──────┼──────────┤│
│ │  1 │ DB 제외  │SVC01│ AWS  │02-25│대기  │[승인][반려]│
│ │  2 │ EoS 제거 │SVC02│Azure │02-24│승인  │ [상세]   ││
│ │  3 │ DB 변경  │SVC03│ GCP  │02-23│반려  │ [상세]   ││
│ └────┴──────────┴──────┴──────┴──────┴──────┴──────────┘│
│ [< 1 2 3 >]                                              │
└──────────────────────────────────────────────────────────┘
```

### 공통 API (Board 진입 시)

- `GET /api/v1/task-admin/tasks/summary` — Task 요약 통계
- `GET /api/v1/task-admin/tasks?page=0&size=20` — Task 목록 (기본 로드)

---

### Flow 1: Queue Board 진입 → Task 목록 조회

**관련 US**: ADM-Q-001, ADM-Q-002

```
사용자 진입 (/task_admin)
    │
    ▼
┌─────────────────────────────┐
│ Summary 통계 로드             │ ← GET /task-admin/tasks/summary
│ Task 목록 로드 (page=0)      │ ← GET /task-admin/tasks?page=0&size=20
└─────────────────────────────┘
    │
    ├── 필터 변경 → 목록 재조회 (GET /task-admin/tasks?taskType=...&status=...)
    ├── 검색 입력 → 목록 재조회 (GET /task-admin/tasks?search=...)
    ├── 페이지 이동 → 목록 재조회 (GET /task-admin/tasks?page=N)
    └── Task 행 클릭 → Flow 2 또는 Flow 3 진입
```

#### 사용자 액션

| 액션 | API | 결과 |
|------|-----|------|
| 페이지 진입 | `GET .../tasks/summary` + `GET .../tasks` | 통계 + 목록 표시 |
| 필터 변경 | `GET .../tasks?taskType=...&status=...` | 목록 재조회 |
| 검색 | `GET .../tasks?search=...` | 목록 재조회 |
| 페이지 이동 | `GET .../tasks?page=N` | 해당 페이지 로드 |

---

### Flow 2: Task 상세 확인 → 승인 처리

**관련 US**: ADM-Q-003, ADM-Q-004

```
Task 행 클릭 (PENDING 상태)
    │
    ▼
┌─────────────────────────────┐
│ Task 상세 모달 표시           │ ← GET /task-admin/tasks/{taskId}
│ ├ Task 기본 정보              │
│ ├ 시스템 정보                 │
│ ├ 요청 내용 (DB 목록/사유)    │
│ ├ [시스템 상세 보기] 링크     │
│ └ Task 이력                  │ ← GET /task-admin/tasks/{taskId}/history
└─────────────────────────────┘
    │
    ├── [시스템 상세 보기] → /detail/{targetSourceId} 이동
    │
    └── [승인] 클릭
         │
         ▼
    ┌─────────────────────────┐
    │ 확인 다이얼로그           │
    │ "이 Task를 승인하시겠습니까?"│
    │ [취소] [확인]             │
    └─────────────────────────┘
         │
         └── [확인] → POST /task-admin/tasks/{taskId}/approve
              │
              ├── 성공: 상태 → APPROVED, 목록 갱신
              └── 실패: 에러 메시지 표시
```

#### 사용자 액션

| 액션 | API | 결과 |
|------|-----|------|
| 상세 조회 | `GET .../tasks/{taskId}` | 모달 표시 |
| 이력 조회 | `GET .../tasks/{taskId}/history` | 이력 목록 표시 |
| 시스템 상세 보기 | (로컬 라우팅) | /detail/{id} 이동 |
| 승인 | `POST .../tasks/{taskId}/approve` | 상태 → APPROVED |

---

### Flow 3: Task 상세 확인 → 반려 처리

**관련 US**: ADM-Q-003, ADM-Q-005

```
Task 행 클릭 (PENDING 상태)
    │
    ▼
┌─────────────────────────────┐
│ Task 상세 모달 표시           │ ← GET /task-admin/tasks/{taskId}
└─────────────────────────────┘
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
         └── [반려하기] → POST /task-admin/tasks/{taskId}/reject
              │            Body: { "reason": "..." }
              │
              ├── 성공: 상태 → REJECTED, 목록 갱신
              └── 실패: 에러 메시지 표시
```

#### 사용자 액션

| 액션 | API | 결과 |
|------|-----|------|
| 반려 사유 입력 | (로컬 상태) | 입력값 관리 |
| 반려 제출 | `POST .../tasks/{taskId}/reject` | 상태 → REJECTED |

---

### Flow 4: 원천 담당자 → 반려 사유 확인 → 재요청

**관련 US**: SRC-Q-001, SRC-Q-002

```
원천 담당자 시스템 진입
    │
    ▼
┌─────────────────────────────┐
│ 본인 요청 Task 목록 조회      │ ← GET /target-sources/{id}/tasks
└─────────────────────────────┘
    │
    └── REJECTED Task 확인
         │
         ▼
    ┌─────────────────────────┐
    │ 반려 정보 표시             │
    │ ├ 반려 사유               │
    │ ├ 반려일시                │
    │ └ 반려 담당자             │
    └─────────────────────────┘
         │
         └── [재요청] 클릭
              │
              ▼
         ┌─────────────────────┐
         │ Task 편집 폼          │
         │ (기존 정보 사전 입력)  │
         │ [취소] [요청]         │
         └─────────────────────┘
              │
              └── [요청] → POST /target-sources/{id}/tasks
                   │
                   └── 새 Task (PENDING) 생성, 이전 Task와 연결
```

---

## 4. Task 유형별 상세 시나리오

### 시나리오 A: DB 연동 제외 사유 확인 (DB_EXCLUSION_REVIEW / PRD_EXCLUSION_REVIEW)

```
[원천 담당자]                              [관리자]
     │                                       │
     │ 연동 대상 확정 시 일부 DB 제외          │
     │ (dev, stg, 또는 PRD DB 제외)           │
     │                                       │
     │ ── Task 자동 생성 ──────────────────→  │
     │    (DB_EXCLUSION_REVIEW)               │
     │                                       │ Queue Board에서 Task 확인
     │                                       │ ├ 제외 대상 DB 목록
     │                                       │ ├ 각 DB별 제외 사유
     │                                       │ └ PRD DB 제외 여부 확인
     │                                       │
     │                        ┌── 승인 ──────│ [승인] → 제외 확정
     │                        │              │
     │ ←── 반려 사유 전달 ───┤── 반려 ──────│ [반려] → 사유 입력
     │                        │              │
     │ 반려 사유 확인           └              │
     │ 수정 후 재요청 ────────────────────→   │
```

**관리자 확인 포인트:**
- dev/stg 환경 DB가 연동 대상에서 적절히 제외되었는가?
- PRD DB가 의도적으로 제외된 것인가? (실수가 아닌지 확인)
- 제외 사유가 합리적인가?

### 시나리오 B: 모니터링 모듈 전체 제거 (MODULE_REMOVAL_FULL)

```
[원천 담당자]                              [관리자]
     │                                       │
     │ 인프라 EoS / IRP 폐기 / Migration      │
     │ → 모니터링 모듈 제거 요청               │
     │                                       │
     │ ── Task 생성 ───────────────────────→  │
     │    (MODULE_REMOVAL_FULL)               │
     │    제거 사유: EoS / IRP 폐기 / Migration│
     │                                       │ Queue Board에서 Task 확인
     │                                       │ ├ 대상 시스템 전체 DB 목록
     │                                       │ ├ 제거 사유 (EoS 등)
     │                                       │ └ 시스템 상세 페이지 확인
     │                                       │
     │                        ┌── 승인 ──────│ → Agent/SDU 제거 프로세스 시작
     │                        │              │
     │ ←── 반려 사유 전달 ───┤── 반려 ──────│ → 사유 입력
```

**관리자 확인 포인트:**
- EoS/폐기 대상이 맞는가?
- 다른 서비스가 해당 인프라에 의존하고 있지 않은가?
- 제거 영향 범위가 적절한가?

### 시나리오 C: 모니터링 모듈 일부 제거 (MODULE_REMOVAL_PARTIAL)

```
[원천 담당자]                              [관리자]
     │                                       │
     │ DB 변경 (마이그레이션, 교체 등)         │
     │ → 일부 DB 모니터링 모듈 제거 요청       │
     │                                       │
     │ ── Task 생성 ───────────────────────→  │
     │    (MODULE_REMOVAL_PARTIAL)            │
     │    제거 대상: 특정 DB 목록              │
     │                                       │ Queue Board에서 Task 확인
     │                                       │ ├ 제거 대상 DB (변경 대상)
     │                                       │ ├ 유지 대상 DB
     │                                       │ └ 변경 사유
     │                                       │
     │                        ┌── 승인 ──────│ → 해당 DB Agent/SDU만 제거
     │                        │              │
     │ ←── 반려 사유 전달 ───┤── 반려 ──────│ → 사유 입력
```

**관리자 확인 포인트:**
- 제거 대상 DB가 정확한가?
- 유지 대상 DB에 영향이 없는가?
- DB 변경 사유가 합리적인가?

---

## 5. 상태 전이 다이어그램

```
                                ┌─────────────────┐
                                │                 │
[Task 생성] ──────────────────→ │    PENDING      │
                                │  (접수, 대기)    │
                                └────────┬────────┘
                                         │
                              ┌──────────┼──────────┐
                              │          │          │
                           승인 시     반려 시       │
                              │          │          │
                              ▼          ▼          │
                     ┌──────────┐  ┌──────────┐    │
                     │ APPROVED │  │ REJECTED │    │
                     │ (승인)   │  │ (반려)   │    │
                     └──────────┘  └─────┬────┘    │
                                         │          │
                                    재요청 시        │
                                   (새 Task 생성)    │
                                         │          │
                                         └──────────┘
```

> **주의**: 재요청 시 기존 Task를 변경하지 않고, 새로운 Task를 `PENDING` 상태로 생성한다.
> 이전 Task와 `previousTaskId`로 연결하여 이력 추적이 가능하다.

---

## 6. API 엔드포인트 목록

### 관리자 API (Queue Board)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/task-admin/tasks` | Task 목록 조회 (필터, 정렬, 페이지네이션) |
| GET | `/api/v1/task-admin/tasks/summary` | Task 요약 통계 (유형별/상태별 카운트) |
| GET | `/api/v1/task-admin/tasks/{taskId}` | Task 상세 조회 |
| POST | `/api/v1/task-admin/tasks/{taskId}/approve` | Task 승인 |
| POST | `/api/v1/task-admin/tasks/{taskId}/reject` | Task 반려 (사유 포함) |
| GET | `/api/v1/task-admin/tasks/{taskId}/history` | Task 이력 조회 |

### 원천 담당자 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/target-sources/{targetSourceId}/tasks` | 해당 시스템의 Task 목록 |
| POST | `/api/v1/target-sources/{targetSourceId}/tasks` | Task 생성 (제외 확인, 모듈 제거 요청) |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-26 | 요구사항 기반 초안 작성 |
