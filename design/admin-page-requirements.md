# Admin 페이지 요구사항 (Draft — 검토용)

> 대상: 신규 HTML 프로토타입 (`design/SIT Admin Prototype v1.html` 예정)
> 상태: **검토 중** — §6 질문에 답변 필요 (✍️ 표시 칸에 직접 기입하거나 채팅으로 답변)
> 작성일: 2026-06-11
> 참고: `app/` 구현과 `design/SIT Prototype Athena v13.html`은 큰 차이가 있음을 전제.
> 본 문서는 v13 프로토타입의 디자인 언어를 따르되, 기존 API 계약(swagger)이 있는 부분은 그것을 기준으로 삼는다.

---

## 1. 배경 / 목표

서비스 담당자용 SIT 화면(v13)과 별개로, **운영 관리자(Admin)** 가 사용하는 콘솔이 필요하다.
관리자의 일은 크게 4가지다:

1. **Task Queue Board** — 처리해야 할 승인 작업을 한눈에 보고 승인/반려
2. **Service 관리** — 서비스 → TargetSource 목록 → 상세. provider별로 다른 값(nlb_index, agent_id 등)을 승인 전/후에 설정·수정, 확정정보 조회/삭제/재입력, 설치 관리
3. **리소스 설치·삭제 파이프라인** — Terraform 작업을 DAG 파이프라인으로 자동화하고 현황 모니터링
4. **API Dashboard** — API 응답시간 통계와 최근 실패 내역 확인
5. **가이드 관리** — 프로세스 단계별 가이드 콘텐츠(ko/en) 편집 (기존 Guide CMS 설계 편입)

Admin 콘솔은 **서비스 담당자 화면과 완전히 분리된 별도 페이지**다.
v13 프로토타입에서 상단 "관리자" navigation 클릭 시 **아예 다른 페이지로 전환**되는 구조로 처리한다 (결정 #1).

---

## 2. 현황 파악 요약

### 2.1 이미 존재하는 것 (app/ + swagger 기준)

| 영역 | 현황 | 근거 |
|------|------|------|
| 승인 Queue | `GET /task-admin/approval-requests` + `app/integration/task_admin` 페이지. PENDING / IN_PROGRESS / APPROVED / REJECTED 탭, 승인·반려(사유) 모달 | `task_dashboard.yaml` |
| 승인 액션 | `POST /approval-requests/{approve,reject,cancel,system-reset}` | `confirm.yaml` |
| 프로세스 상태 | BFF 7단계: `IDLE → PENDING → CONFIRMING → CONFIRMED → INSTALLED → CONNECTED → COMPLETED` | ADR-009 |
| 설치 완료 확정 | `POST /target-sources/{id}/pii-agent-installation/confirm` (CONNECTED 상태에서 호출) | `confirm.yaml` |
| 확정정보 모델 | 3-객체 모델: 확정정보(=Infra Manager의 현재 TF 상태, 수정 API 없음) / 승인 요청 / 승인 완료 | ADR-006 |
| 확정정보 조회 | `GET /target-sources/{id}/confirmed-integration`, `GET .../approved-integration` | `confirm.yaml` |
| Provider별 설치 상태 | aws/azure/gcp/idc/sdu 각각 `installation-status`(GET, 캐시) + `check-installation`(POST, 강제 갱신) | 각 provider yaml |
| 서비스 측 대기 지점 | AWS 수동 TF 실행 / Azure PE 승인·VM TF / GCP TF 권한 / IDC 방화벽 — 문서화됨 | `cloud-provider-states.md` |
| Credential 수정 | `PUT /target-sources/{id}/resources/credential` (resourceId + credentialId) | `confirm.yaml` |
| TestConnection | 비동기: `POST /test-connection` → 202 → `GET .../latest` 폴링 | `test-connection.yaml` |
| 가이드 CMS | `GET/PUT /admin/guides/{name}` (ko/en 콘텐츠), Admin UI 설계 기존 존재 | `guides.yaml` |

### 2.2 존재하지 않는 것 (이번 스펙에서 신규 정의)

- ❌ **NLB table API** — nlb_index / IP List / Listener 점유 수. swagger·도메인 문서 모두 없음
- ❌ **ResourceId 기준 admin 값 수정 API** — agent_id, does_support_raw (credential만 PUT 존재)
- ❌ **확정정보 삭제 / "승인정보대로 확정 입력"** 액션
- ❌ **설치/삭제 작업 Queue** — 현재는 Infra Manager API를 순차 수동 호출
- ❌ **API 메트릭** — admin_dashboard.yaml은 연동 KPI만 있고 응답시간/실패 통계 없음

---

## 3. 갭 분석

| # | 사용자 요구사항 | 현재 상태 | 갭 | 필요 작업 |
|---|---------------|----------|-----|----------|
| 1 | Queue Board: 승인 요청 내역 + TestConnection 완료(관리자 확정 대기) 조회·승인·반려 | 승인 요청 Queue는 원형 존재. CONNECTED 상태 건의 횡단 조회 없음 | "설치 확정 대기" 건이 Queue에 없음 | Queue Board에 두 번째 작업 유형 추가 |
| 2-a | IDC nlb_index 설정 — nlb table 조회, 확정 시점에 빈 값 업데이트 | 개념 없음 (Source IP 추천 API만) | 신규 | nlb table 조회 UI + index 할당 UX + API 정의 |
| 2-b | AWS/Azure/GCP: ResourceId 기준 agent_id, does_support_raw, db_credential 수정 | credential PUT만 존재 | 필드 확장 | 상세 페이지 내 리소스 값 편집 UI |
| 2-c | 확정정보 조회 / 삭제 / "승인정보대로 확정 입력" | 조회만 존재 | 액션 신규 | 액션 버튼 3종 + 가드 규칙 |
| 2-d | 승인 전/후 동일 UI로 값 수정. Infra Manager 반영 후엔 확정정보 삭제 선행 | — | 신규 | 편집 잠금 + 배너 가드 |
| 3 | 설치/삭제 Terraform Queue (작업 Set, 외부 대기, 확인주기 ≥10분, 최대 체류시간) | 순차 수동 호출 | 신규 (모델 자체를 설계) | §4.4 초안 — 검토 필요 |
| 4 | API Dashboard: 응답시간 통계 + 최근 실패 내역 | 없음 | 신규 | §4.5 초안 |

---

## 4. 설계 초안

### 4.1 전체 구조 (IA) — ✅ 확정 (결정 #1)

**Admin은 별도 navigation을 가진 독립 페이지.** v13의 상단 nav에 "관리자" 항목을 두고,
클릭 시 서비스 담당자 화면(7-step 프로세스)에서 **완전히 다른 페이지로 전환**된다.
메뉴는 5개: Queue Board / Service 관리 / 설치·삭제 파이프라인 / API 현황 / **가이드 관리**.

```
┌─ 상단 nav: [SIT 연동]  [관리자●] ────────────────────────────────┐
├──────────┬──────────────────────────────────────────────────────┤
│ PII Admin│  [선택된 메뉴의 콘텐츠 영역]                              │
│          │                                                      │
│ ▸ Queue  │                                                      │
│   Board  │                                                      │
│ ▸ Service│                                                      │
│   관리    │                                                      │
│ ▸ 설치/삭제│                                                      │
│   파이프라인│                                                     │
│ ▸ API    │                                                      │
│   현황    │                                                      │
│ ▸ 가이드  │                                                      │
│   관리    │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

- 단일 HTML 파일 내에서 "관리자" nav 클릭 → 전체 페이지 교체 (서비스 화면의 pbar·identity bar 등은 모두 숨김)
- Admin 내부는 좌측 사이드바로 5개 뷰 전환 (v13의 `data-prov-view` 패턴 재활용)
- Service 관리 메뉴는 서비스 선택 → TargetSource 목록 → 상세 2-depth

### 4.2 Task Queue Board

#### 작업 유형 2종

| 유형 | 대상 상태 | 액션 | 의미 |
|------|----------|------|------|
| **연동 승인** | `PENDING` (승인 대기) | 승인 / 반려(사유) | 미래 상태(연동 대상 구성)를 승인 |
| **설치 확정** | `CONNECTED` (TestConnection 성공) | 확정 / 반려(사유) | 설치 결과를 최종 확정 → `COMPLETED`. 반려 시 `INSTALLED`로 되돌려 재테스트 유도 |

추천안(Q2-B: 유형별 탭 + 건수 뱃지) 기준 와이어프레임:

```
┌─ Task Queue Board ──────────────────────────────────────────────┐
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │ 연동 승인 대기│ │ 설치 확정 대기│ │ 오늘 처리됨   │ │ 반려        │  │
│  │     4건      │ │     2건      │ │     7건      │ │   1건      │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
│                                                                  │
│  [연동 승인 대기 ④] [설치 확정 대기 ②] [처리 완료]    🔍 검색  ⟳    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 서비스      TargetSource   Provider  요청자   요청일    액션  │  │
│  │ svc-alpha  ts-aws-001     AWS       김영희   06-10  [상세] │  │
│  │ svc-beta   ts-idc-003     IDC       박철수   06-09  [상세] │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- [상세] 클릭 → 상세 모달 또는 TargetSource 상세 페이지로 이동 (Q2-c)
- 상세에서 요청 리소스 목록(승인 요청의 resource_inputs / excluded)을 확인 후 [승인] / [반려]
- 반려는 사유 입력 필수 (기존 reject API와 동일)
- **연동 승인 탭과 설치 확정 탭은 컬럼이 다름** — 설치 확정 탭에는 TestConnection 성공 시각, 리소스별 연결 결과 요약(성공 N/N) 추가

#### 상태 전이

| 작업 유형 | 액션 | 전이 |
|----------|------|------|
| 연동 승인 | 승인 | PENDING → CONFIRMING (자동 진행) |
| 연동 승인 | 반려 | PENDING → IDLE (반려 사유 노출) |
| 설치 확정 | 확정 | CONNECTED → COMPLETED |
| 설치 확정 | 반려 | CONNECTED → INSTALLED (연결 테스트 재요구, 결정 #2) — 반려 사유 필수 |

### 4.3 Service 관리 → TargetSource 상세 — ✅ 구조 확정 (결정 #3, #4)

#### 4.3.1 Service 관리 페이지 (목록 → 상세 진입)

사이드바 메뉴는 **"Service 관리"**. 서비스를 선택하면 해당 서비스의 TargetSource 목록이 보인다.
목록 컬럼은 **Provider / TargetSourceId** 만으로 최소화 (결정 #3).
행 클릭 → TargetSource 관리 상세 화면으로 이동.

```
┌─ Service 관리 ──────────────────────────────────────────────────┐
│  ┌─ 서비스 ────────┐  ┌─ svc-alpha의 TargetSource ────────────┐  │
│  │ 🔍 검색         │  │ Provider   TargetSourceId             │  │
│  │ ● svc-alpha    │  │ AWS        ts-aws-001              ›  │  │
│  │   svc-beta     │  │ GCP        ts-gcp-002              ›  │  │
│  │   svc-gamma    │  │ IDC        ts-idc-003              ›  │  │
│  └────────────────┘  └───────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

#### 4.3.2 TargetSource 관리 상세 — 탭 2개: 연동 정보 관리 | 설치 관리 (결정 #4)

- 상세 화면 내부는 **`연동 정보 관리` | `설치 관리`** 2개 탭으로 구성한다.
- Provider(AWS/Azure/GCP/IDC)별로 탭 안의 화면 구성은 달라질 수 있다 — 공통 골격(탭·헤더)은 유지하고 내용물만 provider 분기.
- process-status로 현재 단계를 알 수 있으므로 승인 전/후 모두 동일 화면이 커버한다.

```
┌─ Service 관리 › svc-alpha › ts-aws-001 (AWS) ──────────────────┐
│  상태: CONNECTED   Health: HEALTHY   [⟳ 상태 새로고침]           │
│                                                                │
│  [ 연동 정보 관리 ]  [ 설치 관리 ]                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  ▼ 연동 정보 관리 탭                                             │
│  ℹ 확정정보가 Infra Manager에 반영되어 있어요.                    │
│    수정한 값을 실제 인프라에 반영하려면 확정정보 삭제 후            │
│    다시 확정 입력이 필요해요.              [확정정보 삭제]          │
│                                                                │
│  ── ① 리소스 값 관리 (provider별 분기) ─────────────────────────│
│  │ ResourceId      agent_id   does_support_raw  db_credential ││
│  │ db-prod-01 📋   ag-101 ✎   true ✎            cred-55 ✎     ││  ← 편집 항상 가능 (결정 #10)
│  │ db-prod-02 📋   ag-102 ✎   false ✎           cred-56 ✎     ││
│  │ (IDC는 §4.3.5 — nlb_index 컬럼 구성)                        ││
│                                                                │
│  ── ② 확정정보 ───────────────────────────────────────────────│
│  │ [확정정보 조회]  [확정정보 삭제]  [승인정보대로 확정 입력]      ││
│  │ (조회: 현재 확정 스냅샷 테이블 / 없으면 빈 상태)               ││
│                                                                │
│  ▼ 설치 관리 탭                                                  │
│  │ provider별 설치 상태 (installation-status 기반)              ││
│  │ [설치 시작]  [삭제 시작]   진행 중 Pipeline: 3/4 단계         ││
│  │ Task DAG 패널 (§4.4.5 행 클릭 패널과 동일 컴포넌트)           ││
│  │ [파이프라인 보드에서 보기 →]                                  ││
└────────────────────────────────────────────────────────────────┘
```

#### 4.3.3 편집 규칙 — ✅ 확정 (결정 #10): 잠금 없음, 항상 수정 가능

| 조건 | 편집 가능 여부 | UI |
|------|--------------|-----|
| 확정정보 없음 | ✅ 가능 | 인라인 ✎ 활성 |
| 확정정보 있음 (Infra Manager 반영됨) | ✅ **가능** — 단, 인프라 반영 조건 안내 | ℹ 안내 배너 + 저장 시 확인 모달: "이 수정은 확정정보를 삭제하고 다시 확정 입력하기 전까지 실제 인프라에 반영되지 않아요" |

#### 4.3.4 액션 버튼 3종

| 버튼 | 활성 조건 | 동작 |
|------|----------|------|
| 확정정보 조회 | 항상 (없으면 빈 상태 표시) | 현재 확정 스냅샷(resource_infos) 테이블 표시 |
| 확정정보 삭제 | 확정정보 존재 시 | 확인 모달(경고: TF 관리 상태와 분리됨) → 삭제 |
| 승인정보대로 확정 입력 | 승인 완료 정보(ApprovedIntegration) 존재 + 확정정보 없음 | 승인 스냅샷을 확정정보로 입력 |

#### 4.3.5 IDC 전용 — nlb_index 설정

- 백엔드의 `nlb_index` = SIT 화면의 Source IP. **연동 승인 전에 설정**해야 함
- nlb table: `Index / IP List(최대 2) / 현재 점유 Listener 수`. API Call로 값이 갱신됨
- 확정 시점에 nlb table의 비어 있는 값을 업데이트하는 구조

```
│  ── ① 리소스 값 관리 (IDC) ───────────────────────────────────│
│  │ 구분        연동 대상         Port   nlb_index             ││
│  │ [Single]   10.20.30.40      3306   #3 (10.0.1.5, 10.0.1.6) ✎ ││
│  │ [Domain]   db.svc-a.io      5432   미설정 ⚠ [설정]          ││
│                                                                │
│  nlb_index 설정 모달:                                           │
│  ┌─ NLB Index 선택 ────────────────────────────────┐           │
│  │ Index  IP List              점유 Listener        │           │
│  │ ○ #2   10.0.1.3, 10.0.1.4   12                  │           │
│  │ ● #3   10.0.1.5, 10.0.1.6   4   ← 여유 많은 순?  │           │
│  │ ○ #4   10.0.1.7             0                   │           │
│  │                              [취소] [선택 적용]   │           │
│  └─────────────────────────────────────────────────┘           │
```

- 미설정 리소스가 있으면 승인 차단? → **Q3-c 답변 필요**

### 4.4 리소스 설치/삭제 파이프라인 (명칭: 결정 #9)

> 명칭 결정: "Queue"는 쌓이는 대기열 뉘앙스라 실체와 다름. 실체는 **정해진 단계(DAG)를 스케줄에 따라
> 순차 실행 + 외부 승인 대기(manual gate) + 실패 시 중단/재시도** — CI/CD **파이프라인** 멘탈 모델과 일치.
> 이하 작업 Set = **Pipeline**, 개별 작업 = **Task** 로 부른다.

#### 4.4.1 개념 모델 — DAG 기반 (결정 #5)

Pipeline은 **DAG(Directed Acyclic Graph)** 구조로 정의하되, **실행은 엄격 순차** 다 (결정 #14) —
동시에 RUNNING인 Task는 1개뿐이며, 선행 Task가 DONE이 되어야 다음 Task가 시작된다. 병렬 진행은 없다.

```
Pipeline (설치/삭제 1회 실행 단위, 구 JobSet)
 ├─ 트리거: TargetSource 상세의 [설치 시작] / [삭제 시작]
 ├─ 생성 시 provider별 Task DAG가 한 번에 등록
 │   (삭제 Pipeline은 설치 DAG의 역방향, BDC Common 제외)
 ├─ Pipeline 상태: QUEUED / RUNNING / DONE / FAILED / CANCELLED
 └─ Task
     ├─ 유형 2종
     │   · EXECUTE        — 시스템이 직접 수행 (Infra Manager Terraform API 호출)
     │   · WAIT_EXTERNAL  — 서비스 측 액션 대기 (확인주기마다 상태 체크)
     ├─ depends_on: [선행 Task ID...]  — 비어 있으면 즉시 실행 가능
     └─ 수정 가능 속성 (결정 #6, #8): 관리자가 Task 상세에서 수정 가능 (DONE/RUNNING 제외)
         · polling 주기(확인주기) — ≥10분 가드
         · TTL(최대 체류시간)
         · max_fail_count(최대 허용 실패 횟수) — ∞ 허용 (확인성 Task는 무한 권장)
```

> 모든 provider DAG(§4.4.2)는 선형 체인이며, 실행 모델도 순차만 가정한다 (결정 #14 — 병렬 진행 없음).
> Q4-e(병렬 갈래 실패 처리)는 이 결정으로 해당 없음 처리.

#### 4.4.2 Provider별 Task DAG — ✅ 확정 (결정 #7)

`→` 는 의존성(선행 완료 후 실행). Task 유형(EXECUTE/WAIT_EXTERNAL)은 AI 추정이므로 틀린 곳이 있으면 정정 필요.

**설치 DAG**

| Provider | 설치 DAG |
|----------|------------|
| AWS (자동) | ① TF 권한 확인 `WAIT_EXTERNAL` → ② SVC TF `EXECUTE` → ③ BDC Common TF `EXECUTE` → ④ BDC Service Level TF `EXECUTE` |
| AWS (수동) | ① SVC TF 설치 확인 `WAIT_EXTERNAL` → ② BDC Common TF `EXECUTE` → ③ BDC Service Level TF `EXECUTE` |
| Azure | ① AzureVM 설치 확인 `WAIT_EXTERNAL` (DB-only여도 생략 없이 확인 — 결정 #13) → ② PE 승인 요청 `EXECUTE` → ③ PE 승인 확인 `WAIT_EXTERNAL` |
| GCP | ① TF 권한 확인 `WAIT_EXTERNAL` → ② Subnet 생성 확인 → ③ SVC TF 동작 `EXECUTE` → ④ BDC TF 동작 `EXECUTE` |
| IDC | ① BDC CX TF `EXECUTE` → ② BDP TF `EXECUTE` — **방화벽 오픈 확인은 파이프라인 범위 밖** (기존 수동 확정 유지, 결정 #13) |

**삭제 DAG** — 설치의 역순. 단, **BDC Common TF는 삭제하지 않는다** (결정 #7).

| Provider | 삭제 DAG |
|----------|------------|
| AWS (자동) | ① BDC Service Level TF 삭제 → ② SVC TF 삭제 (BDC Common 유지) |
| AWS (수동) | ① BDC Service Level TF 삭제 → ② SVC TF 삭제 확인 (BDC Common 유지) |
| Azure | ① PE 삭제 → ② (AzureVM은 서비스 측 자산 — 삭제 범위 외 추정) |
| GCP | ① BDC TF 삭제 → ② SVC TF 삭제 |
| IDC | ① BDP TF 삭제 → ② BDC CX TF 삭제 |

> 현재 확정된 provider DAG는 모두 선형이지만, 모델 자체는 병렬 갈래를 지원한다(§4.4.1).

**확인 필요 (잔여)**:
- 삭제 DAG의 세부 단계(특히 Azure·수동 AWS)는 위 추정이 맞는가?

#### 4.4.3 Task 상태 머신 — 실패 카운트 기반 (결정 #8)

시도가 실패하면 `fail_count`를 올리고, **`max_fail_count` 이내면 자동 재시도**(다음 스케줄에),
초과하면 그때 FAILED로 확정된다. 확인성 Task(TF 권한 확인 등)는 `max_fail_count = ∞` 가능.

```
            ┌─────────┐
 QUEUED ──→ │ RUNNING │ ──→ DONE ──→ (후행 Task 실행 가능)
            └─────────┘ ──→ (시도 실패) fail_count++
                              ├─ fail_count ≤ max_fail_count → 재시도 대기 (다음 주기)
                              └─ 초과 → FAILED → Pipeline 중단, 관리자 [재시도]/[중단]
 QUEUED ──→ WAITING_EXTERNAL ──(확인주기마다 체크, 미충족은 실패로 안 침)──→ DONE
                            └──(TTL 초과)──→ EXPIRED(타임아웃) ──→ Pipeline FAILED (결정 #11)
                                              └─ 관리자 [재시도(타이머 리셋)] / [중단]
```

> 구분 주의: WAIT_EXTERNAL의 "아직 안 됨"(외부 액션 미완)은 실패가 아니라 대기 — TTL로만 관리.
> "확인 API 호출 자체가 에러"인 경우가 fail_count 대상이다.

#### 4.4.4 정책 (초안)

| 항목 | 초안 | 비고 |
|------|------|------|
| 확인주기(polling 주기) | Task별 기본값 보유, **관리자가 Task 상세에서 수정 가능** (결정 #6). **10분 미만 불가** 가드 | DONE/RUNNING Task는 수정 불가 |
| 최대 체류시간(TTL) | WAIT_EXTERNAL Task별 설정 (예: 7일), Task 상세에서 수정 가능 | 초과 시 EXPIRED |
| TTL 초과 처리 | Task **EXPIRED(타임아웃) → Pipeline FAILED** (결정 #11). 보드에 경고, 관리자가 [재시도(타이머 리셋)] / [중단] | 보류(ON_HOLD) 상태 폐기 |
| 최대 실패 횟수(max_fail_count) | Task별 설정·수정 가능, **∞ 허용** (결정 #8). 기본값 확정 (결정 #12): EXECUTE TF = 1, 확인성(WAIT/권한 확인) = ∞ | |
| 실패 처리 | fail_count ≤ max → 다음 주기에 자동 재시도. 초과 → FAILED, 관리자가 로그 확인 후 [재시도(카운트 리셋)] / [중단] | Q4-b는 본 정책으로 통합 해소 |
| 실행 순서 | **엄격 순차** (결정 #14) — 동시에 RUNNING Task 1개, 병렬 진행 없음 | |
| 중복 방지 | 동일 TargetSource에 진행 중 Pipeline 있으면 신규 생성 차단 | |
| 설치↔삭제 충돌 | 진행 중 설치 Pipeline이 있는데 삭제 요청 → 차단 (중단 후 삭제만 허용) | |

#### 4.4.5 파이프라인 보드 와이어프레임

```
┌─ 설치/삭제 파이프라인 ────────────────────────────────────────────┐
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                     │
│  │ 진행 중  │ │ 외부 대기│ │ 실패    │ │ 완료(7일)│                    │
│  │   3     │ │   2     │ │   1    │ │   12   │                    │
│  └────────┘ └────────┘ └────────┘ └────────┘                     │
│                                                                  │
│  TargetSource  유형   Provider  진행          현재 Task        경과  │
│  ts-aws-001   설치    AWS      ▓▓▓░ 3/4    BDC Common 실행중  4분  │
│  ts-gcp-002   설치    GCP      ▓░░░ 1/4    TF권한 확인 ⏱      2일  │
│  ts-idc-003   삭제    IDC      ▓░ 1/2      BDC CX TF 삭제     6분  │
│  ts-az-004    설치    Azure    ✕ FAILED    PE 요청 실패(3/3) [재시도]│
│                                                                  │
│  행 클릭 → Task DAG 패널 (AWS 자동 설치 예시):                      │
│  ┌─────────────────────────────────────────────────────┐         │
│  │ ✔ ① TF 권한 확인           06-10 14:02 (2회 확인)     │         │
│  │ ✔ ② SVC TF 실행            06-10 14:25 (3분)         │         │
│  │ ▶ ③ BDC Common TF 실행     진행 중 (4분 경과)         │         │
│  │ ○ ④ BDC Service Level TF  대기 · 확인주기 10분  ✎     │         │
│  │   (✎: 대기/예정 Task의 확인주기·TTL 수정 — ≥10분 가드)  │         │
│  └─────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

### 4.5 가이드 관리 (기존 Guide CMS 편입)

기존 설계(Provider 탭 → Step별 인라인 편집)를 Admin 사이드바의 한 메뉴로 편입한다.

```
┌─ 가이드 관리 ────────────────────────────────────────────────────┐
│  [AWS] [Azure] [GCP] [IDC] [SDU]                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Step 4 · TerraformExecutionRole 등록 가이드        [편집 ✎] │  │
│  │ ko: Role을 등록하려면 ...                                   │  │
│  │ en: To register the role ...                               │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- API: `GET/PUT /admin/guides/{name}` (기존 guides.yaml 그대로)
- 편집 시 ko/en 모두 필수 — 기존 계약 유지
- 본 문서에서는 신규 설계 없음, 메뉴 배치만 결정

### 4.6 API Dashboard (추천안 A — 경량 기준)

```
┌─ API 현황 ──────────────────────────────────────────────────────┐
│  기간: [최근 24시간 ▾]                              ⟳ 갱신        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ 총 호출    │ │ 에러율    │ │ 평균 응답  │ │ p95 응답  │            │
│  │ 12,408   │ │ 0.8%     │ │ 142ms    │ │ 890ms    │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                  │
│  ── API별 통계 ──────────────────────── 정렬: [p95 ▾]            │
│  │ API                          호출수   에러율  평균    p95     │ │
│  │ POST /test-connection        320     2.1%   1.2s   4.8s    │ │
│  │ GET  /installation-status    2,840   0.1%   95ms   210ms   │ │
│                                                                  │
│  ── 최근 실패 내역 ──────────────────────────────────────────────│
│  │ 시각         API                       코드   응답   TargetSource │
│  │ 06-11 09:12 POST /check-installation  504   30.0s  ts-az-004  │
│  │ 06-11 08:55 POST /test-connection     500   1.1s   ts-idc-003 │
│  │ (행 클릭 → 에러 메시지 상세)                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. 신규 정의가 필요한 API (가정 목록)

프로토타입은 Mock으로 동작하지만, 명세에 다음 API들을 가정으로 기록한다:

| Method | Path (가정) | 용도 |
|--------|------------|------|
| GET | `/admin/services` · `/admin/services/{code}/target-sources` | 서비스 목록 + 서비스별 TargetSource 목록 (provider, target_source_id) |
| GET | `/task-admin/installation-confirmations` | 설치 확정 대기(CONNECTED) 건 횡단 조회 |
| PUT | `/admin/target-sources/{id}/resources/{resourceId}` | agent_id, does_support_raw, db_credential 수정 |
| GET | `/admin/nlb` | nlb table 조회 (index, ip_list[≤2], occupied_listener_count) |
| PUT | `/admin/target-sources/{id}/nlb-index` | nlb_index 할당 |
| DELETE | `/admin/target-sources/{id}/confirmed-integration` | 확정정보 삭제 |
| POST | `/admin/target-sources/{id}/confirmed-integration/from-approved` | 승인정보대로 확정 입력 |
| POST | `/admin/target-sources/{id}/pipelines` | 설치/삭제 Pipeline 생성 (body: type=INSTALL\|DELETE) |
| GET | `/admin/pipelines` | Pipeline 보드 조회 |
| POST | `/admin/pipelines/{pipelineId}/{retry,cancel}` | 실패 재시도(타이머·카운트 리셋) / 중단 |
| PATCH | `/admin/pipelines/{pipelineId}/tasks/{taskId}` | Task 상세 수정 (polling 주기 ≥10분, TTL, max_fail_count — DONE/RUNNING 제외) |
| GET | `/admin/api-metrics` | API별 통계 (기간 파라미터) |
| GET | `/admin/api-failures` | 최근 실패 내역 |

---

## 6. 질문 사항 (✍️ 답변 기입)

### Q1. Admin 페이지 전체 구조 (IA) — ✅ 답변 완료

✅ **확정 (결정 #1)**: 별도 navigation의 독립 페이지. v13 상단 nav "관리자" 클릭 시 완전히 다른 페이지로 전환.
사이드바 메뉴 5개 (가이드 관리 포함). §4.1 반영 완료.

### Q2. Queue Board

**Q2-a. 두 작업 유형(연동 승인 / 설치 확정)의 배치**

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| A: 통합 보드 + 유형 필터 | 할 일을 한 화면에 | 컬럼·액션이 이질적 |
| **B: 유형별 탭 + 건수 뱃지 + 상단 요약 카드** | 탭별 컬럼 최적화 | 전체 수는 요약 카드로 보완 |
| C: 직접 제안 | | |

💡 추천: **B** — 두 유형은 상세 정보와 액션 의미가 다름.

✍️ 답변:

**Q2-b. 설치 확정 대기(CONNECTED) 건의 "반려"는 어떤 의미인가? — ✅ 답변 완료**

✅ **확정 (결정 #2)**: A — 반려 시 `CONNECTED → INSTALLED` 전이 (연결 테스트 재요구). §4.2 상태 전이표 반영 완료.

**Q2-c. Queue Board [상세]의 동작**

| 선택지 | 설명 |
|--------|------|
| A: 상세 모달 (요청 리소스 목록 + 승인/반려 버튼) — 보드를 벗어나지 않음 | 빠른 일괄 처리에 유리 |
| B: TargetSource 상세 페이지로 이동 — 값 수정(nlb_index 등)까지 한 흐름 | "승인 전에 값 설정" 워크플로우와 자연스럽게 연결 |
| C: 모달 기본 + 모달 안에 "상세 페이지로 이동" 링크 | 둘 다 |

💡 추천: **C** — 승인 전 nlb_index 설정처럼 값 수정이 필요한 경우가 있어 이동 경로는 필수, 단순 승인은 모달로 빠르게.

✍️ 답변:

### Q3. Service 관리 / TargetSource 상세

**Q3-a. 상세 페이지 구성 — ✅ 답변 완료 (일부)**

✅ **확정 (결정 #3, #4)**: Service 관리 페이지(서비스 → TargetSource 목록, 컬럼은 Provider/TargetSourceId만) → 행 클릭 시 상세.
상세는 `연동 정보 관리 | 설치 관리` 2-탭, provider별로 내용물 분기. §4.3 반영 완료.

✅ **편집 규칙 확정 (결정 #10)**: 확정정보가 있어도 **수정 항상 가능** — 잠금 없음.
확정정보 존재 시 안내 배너 + 저장 시 "확정정보 삭제 → 재확정 전까지 인프라 미반영" 확인 모달. §4.3.3 반영 완료.

**Q3-b. nlb_index 할당 단위**

| 선택지 | 설명 |
|--------|------|
| A: TargetSource당 1개 index | IDC 연동 전체가 index 하나 점유. Source IP 1~2개 = 그 index의 IP List |
| B: 리소스(연동 대상)당 1개 index | 연동 대상 DB마다 별도 index 점유 (§4.3.5 와이어프레임은 B 기준으로 그림) |
| C: 직접 제안 | |

💡 "확정 시점에 nlb table의 비어 있는 값을 업데이트"라는 설명은 A처럼 들리는데, §4.3.5 와이어프레임은 일단 B(리소스별)로 그려둠. 어느 쪽인지 확인 필요.

✍️ 답변:

**Q3-c. IDC에서 nlb_index 미설정 리소스가 있으면 연동 승인을 차단하는가?**

| 선택지 | 설명 |
|--------|------|
| A: 차단 — 승인 버튼 비활성 + "nlb_index 미설정 N건" 경고 | nlb_index는 승인 전 필수라는 말씀과 부합 |
| B: 경고만 — 승인은 가능, 확정 입력 시점에 차단 | |

💡 추천: **A** — "연동 승인 전에 수행해야 될 것 같다"는 판단을 그대로 가드로 옮김.

✍️ 답변:

**Q3-d. nlb table에서 index 선택 시 추천 기준이 필요한가?** (예: 점유 Listener 적은 순 정렬 + 기본 선택)

✍️ 답변:

### Q4. 설치/삭제 파이프라인

**Q4-a. TTL(최대 체류시간) 초과 시 처리 — ✅ 답변 완료 (결정 #11)**

✅ **확정**: 타임아웃 = 실패. Task EXPIRED → **Pipeline FAILED** 처리, 관리자가 [재시도(타이머 리셋)] / [중단].
보류(ON_HOLD) 상태는 폐기. §4.4.1·§4.4.3·§4.4.4 반영 완료.

**Q4-b. EXECUTE Task 실패 시 자동 재시도 — ✅ 답변 완료 (결정 #8로 통합)**

✅ **확정**: Task별 `max_fail_count`(최대 허용 실패 횟수)로 통합 — 이내면 자동 재시도, 초과 시 FAILED.
∞ 허용 (TF 권한 확인 등 확인성 Task는 무한 권장). §4.4.1·§4.4.3·§4.4.4 반영 완료.

✅ **기본값 확정 (결정 #12)**: EXECUTE TF = 1, 확인성(WAIT/권한 확인) = ∞.

**Q4-c. Provider별 Task 시퀀스 — ✅ 답변 완료 (결정 #7)**

✅ 확정: AWS 자동(TF권한→SVC TF→BDC Common→BDC Service Level) / AWS 수동(SVC TF 확인→BDC Common→BDC Service Level) /
Azure(VM 설치 확인→PE 승인 요청→PE 승인 확인) / GCP(TF권한→Subnet 확인→SVC TF→BDC TF) / IDC(BDC CX TF→BDP TF).
삭제는 역순이되 **BDC Common은 삭제하지 않음**. §4.4.2 반영 완료.

✅ **추가 확정 (결정 #13)**: Azure는 DB-only여도 AzureVM 설치 확인을 생략하지 않음. IDC 방화벽 오픈 확인은 파이프라인 범위 밖(기존 수동 확정 유지).

⏳ 잔여: 삭제 DAG 세부 단계(Azure·AWS 수동) 추정 검증.

✍️ 답변:

**Q4-d. 확인주기·TTL의 설정 주체 — ✅ 답변 완료**

✅ **확정 (결정 #6)**: Task별 기본값 + **관리자가 Task 상세에서 수정 가능** (polling 주기 등).
가드: 10분 미만 불가, DONE/RUNNING Task는 수정 불가. §4.4.1·§4.4.4 반영 완료.

**Q4-e. 병렬 갈래 실패 처리 — ✅ 해당 없음 (결정 #14)**

✅ **확정**: 병렬 진행 자체가 없음 — 모든 Pipeline은 엄격 순차(동시 RUNNING Task 1개). 질문 자체가 무효화됨.

### Q5. API Dashboard

**Q5-a. 범위 — ✅ 답변 완료 (결정 #15)**

✅ **확정**: 경량 — KPI 4개 + API별 통계 테이블 + 최근 실패 목록 (최근 24h). §4.6 와이어프레임 기준.

**Q5-b. "API"의 범위는?** BFF API만인가, Infra Manager 등 upstream 호출도 포함인가?

✍️ 답변:

---

## 7. 다음 단계

1. §6 답변 수렴 → 본 문서를 확정판으로 갱신 (상태 전이표·와이어프레임 보강, 결정 이력 기록)
2. `design/SIT Admin Prototype v1.html` 작성 — v13 디자인 토큰·컴포넌트 재사용, Mock 데이터 시뮬레이션

## 8. 설계 결정 이력

| # | 결정 사항 | 선택 | 근거 | 제안자 |
|---|----------|------|------|--------|
| 1 | Admin 전체 구조 | 별도 navigation의 독립 페이지 — v13 상단 nav "관리자" 클릭 시 전체 페이지 전환, 사이드바 5메뉴 (가이드 관리 포함) | TargetSource 관리 2-depth 등 콘솔형 IA 필요. 서비스 담당자 화면과 역할 분리 | 사용자 |
| 2 | 설치 확정 건의 반려 의미 | `CONNECTED → INSTALLED` 전이 (연결 테스트 재요구) | 설치 자체는 유효하므로 롤백이 아닌 재검증으로 처리 | 사용자 |
| 3 | TargetSource 진입 구조 | Service 관리 페이지 → 서비스 선택 → TargetSource 목록 (Provider/TargetSourceId만) → 행 클릭 시 상세 | 서비스 단위 운영 관점. 목록은 최소 컬럼으로 단순화 | 사용자 |
| 4 | TargetSource 상세 구성 | `연동 정보 관리 \| 설치 관리` 2-탭, provider별 내용물 분기 (공통 골격 유지) | AWS/Azure/GCP/IDC 화면 차이를 탭 내부 분기로 흡수 | 사용자 |
| 5 | 설치/삭제 작업 Set 모델 | 선형 시퀀스가 아닌 **DAG** — Task별 `depends_on`, 선행 완료 시 실행, 독립 갈래 병렬 (예: Azure PE 승인 ∥ VM TF) | 외부 대기 Task가 섞이면 선형 직렬화는 불필요한 지연 유발 | 사용자 |
| 6 | Task 상세 수정 | 관리자가 대기/예정 Task의 polling 주기·TTL 수정 가능 (≥10분 가드, DONE/RUNNING 불가) | 운영 중 외부 상황에 맞춰 확인 빈도 조절 필요 | 사용자 |
| 7 | Provider별 Task DAG | AWS 자동: TF권한→SVC TF→BDC Common→BDC Service Level / AWS 수동: SVC TF 확인→BDC Common→BDC Service Level / Azure: VM 확인→PE 요청→PE 확인 / GCP: TF권한→Subnet 확인→SVC TF→BDC TF / IDC: BDC CX TF→BDP TF. 삭제는 역순, **BDC Common 미삭제** | 실제 운영 순서 기준. BDC Common은 공유 인프라로 추정되어 삭제 제외 | 사용자 |
| 8 | Task 최대 실패 횟수 | Task별 `max_fail_count` 설정·수정 가능, ∞ 허용 — 이내 자동 재시도, 초과 시 FAILED. 확인성 Task(TF 권한 확인 등)는 무한 권장 | 일시 오류는 자동 흡수하되 한도로 폭주 방지. Q4-b를 본 정책으로 통합 | 사용자 |
| 9 | 작업 Set 명칭 | "Queue" → **"파이프라인(Pipeline)"** (작업 Set=Pipeline, 개별 작업=Task 유지) | 실체가 대기열이 아니라 단계 순차 실행 + manual gate + 재시도 — CI/CD 파이프라인 멘탈 모델과 일치 | AI 제안 |
| 10 | 리소스 값 편집 규칙 | 확정정보가 있어도 **항상 수정 가능** (잠금 없음). 안내 배너 + 저장 시 "삭제→재확정 전 인프라 미반영" 확인 모달 | 운영상 수정 자체를 막을 이유 없음 — 반영 조건만 알리면 됨 | 사용자 |
| 11 | TTL 초과 처리 | Task EXPIRED(타임아웃) → **Pipeline FAILED**. ON_HOLD(보류) 상태 폐기 | 타임아웃은 곧 실패 — 상태 수를 줄여 단순화 | 사용자 |
| 12 | max_fail_count 기본값 | EXECUTE TF = 1, 확인성 Task = ∞ | AI 제안 기본값 채택 | 사용자 |
| 13 | Pipeline 범위 보정 | Azure는 DB-only여도 VM 설치 확인 포함. IDC 방화벽 오픈 확인은 파이프라인 밖(수동 확정 유지) | 운영 실태 기준 | 사용자 |
| 14 | 실행 모델 | 병렬 진행 없음 — **엄격 순차** (동시 RUNNING Task 1개). DAG는 정의 구조로만 사용 | 모든 provider 체인이 선형, 병렬 필요 없음 | 사용자 |
| 15 | API Dashboard 범위 | 경량 (KPI 4 + API별 통계 + 최근 실패 목록, 24h) | 핵심 운영 질문에 충분 | 사용자 |
