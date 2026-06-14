# Pipeline — Console UX Additions (장기 실행 가시성 · retry 표현 · 취소 가시성)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md) 운영 콘솔의 **UX 보강 명세**.
> [orchestrator-design.md §1.4](./orchestrator-design.md)(관리 콘솔)를 보강한다.
> 메커니즘·데이터 모델은 [orchestrator-design.md](./orchestrator-design.md), API는 [api.md](./api.md),
> 설정은 [operations.md](./operations.md) 참조.
>
> 본 문서는 **"콘솔이 추가로 제공해야 하는 UX 기능"만** 다룬다. 핵심 원칙: 여기 정의하는 거의 모든 것은
> 이미 기록되는 `task_attempt`·`task_check`·`pipeline_event` 위의 **read-side 파생·표현**이며,
> 상태기계·전이·정합성 모델은 건드리지 않는다(아키텍처 변경 아님).

---

## 배경 — 왜 보강이 필요한가

확정 전제:

1. **TF 작업은 구조적으로 30분 이상 걸릴 수 있다.** Terraform/Infra Manager의 실제 제약이며 회피 불가하다
   (ADR `execution timeout` 기본 30분도 이를 전제로 "드문 버그 안전망"으로만 둔다 — operations.md 설정 표).
2. 따라서 "오래 걸림" 자체는 없앨 수 없다. UX의 일은 **"오래 걸리는 게 정상인지 / 문제인지"를 운영자가
   한눈에 구분**하게 만드는 것이다.
3. `attempt`/`check`는 폴링 cadence마다 누적된다(TERRAFORM_JOB 30–60초 · WAIT_EXTERNAL ≥10분 · 호출 전
   PENDING 선기록). **liveness 증거는 이미 데이터로 존재**하므로 보드는 파생·표현만 하면 된다.

해결해야 할 세 가지 오인(misread):

| 운영자의 오인 | 실제 | UX가 줘야 할 신호 |
|---|---|---|
| "멈춘 것 같다" | 정상 장기 실행, 폴링 진행 중 | 최근 활동 증거 + 다음 확인 시각 + **정상 기준 대비 진행** |
| "잘 도는 것 같다"(false-green) | 장애인데 공손히 폴링만 반복 | 기준 초과 · 연속 timeout · **systemic 조기 신호** |
| "재시도하면 이어지겠지" | terminal은 부활 없음, 새 run 생성 | **정직한 라벨 + 계보 링크 + 실패 진단** |

---

## UX-1. 장기 실행 가시성 (핵심)

목표: 30분+ 실행이 **정상일 때는 안심**시키고, **비정상일 때는 30분 timeout/알림이 뜨기 전에** 알아채게 한다.

### 1.1 개별 task — "살아있음 + 정상 여부"를 한 줄로

드릴다운 패널의 진행 중 task 행에 다음을 노출한다(대부분 기존 필드):

| 표시 | 데이터 출처 | 기존/신규 |
|---|---|---|
| 다음 확인 카운트다운 `다음 확인 14:32` | `nextCheckAt` (이미 노출 — orchestrator-design §1.3) | 기존 |
| 최근 확인 `8초 전 · 응답 RUNNING` / `확인 중…` | `latestCheck.checkedAt` · `observed` · `apiResult`(PENDING=확인 중) | 기존(Task.latestCheck) |
| 현재 단계 경과 `22분 경과` | `task.startedAt` 기반 파생 | 기존 파생 |
| **정상 기준 대비** `보통 ~25분 · 현재 22분 (정상)` / `현재 48분 (지연 ⚠)` | **`expectedDuration`(p50)·`warnThreshold`(p95)** | **신규** |

> `latestCheck.apiResult = PENDING`(호출 직전 선기록, 결정 6 D-T5)이 곧 **"지금 확인 중"**의 파생 근거다 —
> 별도 task 상태(CHECKING)를 만들지 않는다는 D-T6과 정합한다.

### 1.2 task 파생 liveness 라벨 (4종)

상태(10종)는 그대로 두고, **표현용 liveness만 파생**한다(서버 파생 권장, 클라 계산도 가능):

| liveness | 의미 | 파생 규칙(예) |
|---|---|---|
| `진행 정상` | 폴링 활동 있고 기준 이내 | 최근 check 신선 + 경과 ≤ `expectedDuration` |
| `예정 대기` | WAIT_EXTERNAL, 다음 확인 예약됨 | `nextCheckAt` 미래 + 경과 ≤ TTL 여유 |
| `지연` | 정상 범위 초과(아직 실패 아님) | 경과 > `warnThreshold` 이고 timeout 미발화 |
| `의심` | 곧 실패하거나 systemic 신호 | execution timeout 임박, 또는 §1.3 health가 outage 의심 |

`지연`·`의심`만 시각 강조(accent/⚠). `진행 정상`·`예정 대기`는 **차분하게** 표시해 "오래 걸림 = 빨강"이라는
잘못된 학습을 막는다.

### 1.3 systemic 조기 경고 — false-green을 잡는 핵심

개별 폴링은 "살아있음"만 증명하지 정작 **그 작업이 끝날지**는 말해주지 못한다. worker outage 중에는
보드가 건강하게 폴링을 찍지만 실제 작업은 죽어 있다. ADR의 `WORKER_OUTAGE_SUSPECTED` 알림은 execution
timeout(~30분)에 종속되어 **느리다(ADR Negative 명시)**. 그 30분 공백을 메우는 read-side 집계를 둔다:

- **`GET /admin/pipelines/health` (신규)** — systemic 신호 집계:
  - 최근 N분 내 서로 다른 target의 연속 `EXECUTION_TIMEOUT` 수
  - `expectedDuration`/`warnThreshold` 초과 진행 task 수
  - slot 포화 지속 시간(`slotsInUse == slotCap` 유지 시간)
- **보드 상단 배너**(경고): `최근 15분 동안 3개 target에서 연속 timeout — worker 상태 점검 권장`
  → critical 알림이 뜨기 **전에** 노출. 단순 집계 쿼리이므로 circuit breaker(개정 4판에서 제거됨)를
  되살리지 않는다 — **표시 전용 신호**다.

### 1.4 "정상 장기 실행" 안내 카피

- `expectedDuration`이 36분인 task는 36분까지 `진행 정상`으로 표시한다(30분을 무조건 지연으로 보지 않음).
- 진행 중 task 툴팁: `Terraform 작업은 30분 이상 걸릴 수 있어요. 다음 확인 14:32 · 최근 응답 RUNNING(8초 전)`.

---

## UX-2. retry 표현 — 재생성 정책(결정 5)을 정직하게

정책은 유지한다: **terminal 부활 없음, [재시도] = 같은 definition으로 새 run 생성.** 문제는 표현 계층뿐이다.

| 보강 | 내용 | 데이터 |
|---|---|---|
| **정직한 라벨** | `[재시도]` → **`[다시 실행]`**. "이어하기"를 연상시키는 어휘 금지 | — |
| **확인 모달** | "이 run은 되살릴 수 없어요. 같은 구성으로 **새 파이프라인 run**을 만듭니다. 완료된 단계는 terraform 수렴으로 빠르게 통과해요." | — |
| **실패 진단 surface** | 재실행 전 root cause를 보게: 실패 **단계 · error_code · 마지막 check 결과** 강조 + "원인을 고친 뒤 다시 실행하세요" | `task.status=FAILED` · `attempt.outcome` · `latestCheck.errorCode`(기존) |
| **run 계보 링크** | 새 run이 어느 run의 재실행인지 양방향 표시: `#1234 다시 실행 → #1240`. 보드·이력에서 체인으로 묶임 | **신규 `pipeline.retryOf` / 파생 `retriedAs`** |

> 실패 진단이 없으면 설정 오류(잘못된 `agent_id`, IM 권한 등)는 재실행해도 같은 단계에서 또 실패한다.
> "고치고 → 다시 실행"이 되게 하는 것이 핵심. 일시 오류는 이미 attempt 레벨 자동 재시도(`max_fail_count`)가
> 흡수하므로, 운영자의 [다시 실행]은 **drained 자동 회복이 소진된 진짜 문제**에만 쓰인다.

---

## UX-3. 취소(cancel) 가시성

ADR 결정 4c: 취소는 죽이지 않고 전진만 멈춘다(forward edge만 gate, in-flight job은 drain).

- **CANCELLING 표시**: `중단 중 · 실행 중 job 종료 대기` + drain 중인 task 명시(보드는 이미 이 문구를 표시 —
  orchestrator-design §결정 4c). 어느 job을 기다리는지 task 행에 표기.
- **slot 점유 안내**: drain 중 task는 slot을 계속 보유하므로(결정 4c) `slot 점유 중`을 표시 — slot 게이지가
  "줄지 않는" 이유를 설명한다.
- 최종 수렴: drain 완료 → `CANCELLED`. drained job의 terminal 결과는 attempt 이력에만 남고 pipeline 상태엔
  영향 없음(결정 4c)을 드릴다운에서 확인 가능.

---

## 데이터 / API 요구 정리 (대부분 read-side · additive)

| 항목 | 기존/신규 | 출처 / 방식 |
|---|---|---|
| `nextCheckAt` 카운트다운 | 기존 | orchestrator-design §1.3 (이미 노출) |
| `latestCheck`(checkedAt·observed·apiResult·errorCode·latencyMs) | 기존 | api.md `Task.latestCheck` |
| 현재 단계 경과 | 기존 파생 | `task.startedAt` |
| slot 게이지 / 대기 큐 | 기존 | `GET /admin/pipelines/concurrency` |
| attempt 이력 · 호출별 check 로그 | 기존 | `GET /admin/pipelines/{id}/tasks/{taskId}` |
| **`expectedDuration`(p50) · `warnThreshold`(p95)** | **신규** | TaskKind/definition별 baseline. 초기 **설정 고정값**(operations.md R5), 이력 축적 후 `task_attempt` 집계로 자동화(확장) |
| **liveness 파생 enum**(진행 정상/예정 대기/지연/의심) | **신규(파생)** | 서버 파생 권장 — 새 상태 아님, 위 필드의 함수 |
| **`GET /admin/pipelines/health`** | **신규** | systemic 집계(연속 timeout·기준 초과 수·slot 포화) → 보드 배너 |
| **`pipeline.retryOf` / `retriedAs`** | **신규** | 컬럼 1개 + 역방향 파생. 보드·이력 계보 표시 |
| 설정: `expectedDuration` 기본값, health 임계 | **신규(설정)** | operations.md 설정 표에 추가(R5 — 재배포 불필요) |

**상태기계·전이·정합성 모델 변경 없음.** 신규는 ① 표시용 baseline/집계 데이터, ② 계보 컬럼 1개, ③ 라벨·카피뿐.

---

## 와이어프레임 스케치

```
┌─ 설치/삭제 파이프라인 ────────────────────────────────────────────────────┐
│ ⚠ 최근 15분 3개 target 연속 timeout — worker 점검 권장   [health 보기]    │ ← UX-1.3 배너(조건부)
│ TF slot 7/10 ▓▓▓▓▓▓▓░░░         대기 2건 · 최장 18분                      │
│                                                                          │
│ TargetSource  유형  Provider  진행       현재 단계        liveness         │
│ ts-aws-001   설치   AWS      ▓▓▓░ 3/4  BDC Common 실행   진행 정상 22/~25분│
│ ts-gcp-002   설치   GCP      ▓░░░ 1/4  TF권한 확인       예정 대기 ⏱14:32 │
│ ts-az-004    설치   Azure    ▓▓░░ 2/4  PE 승인 확인      지연 ⚠ 48/~30분  │
│ ts-idc-003   삭제   IDC      ✕ 실패    BDP TF 삭제       실패 [다시 실행]  │
│                                                                          │
│ 행 클릭(ts-az-004) → 드릴다운:                                            │
│  ✔ ① VM 설치 확인     06-10 14:02                                        │
│  ✔ ② PE 승인 요청     06-10 14:25 (3분)                                  │
│  ▶ ③ PE 승인 확인     48분 경과 · 보통 ~30분 (지연 ⚠)                     │
│        최근 확인 9초 전 · 응답 RUNNING · 다음 확인 14:33                  │
│        "Terraform 작업은 30분+ 걸릴 수 있어요" ⓘ                          │
└──────────────────────────────────────────────────────────────────────────┘

[다시 실행] 확인 모달:
┌─ 다시 실행 ─────────────────────────────────────────────┐
│ 이 run은 되살릴 수 없어요. 같은 구성으로 새 파이프라인     │
│ run을 만듭니다. 완료된 단계는 빠르게 통과해요.            │
│ 실패 원인: ③ PE 승인 확인 — ERROR(IM_TIMEOUT)            │
│ → 원인을 확인/수정한 뒤 진행하세요.                      │
│                               [취소]  [새 run 만들기]    │
└─────────────────────────────────────────────────────────┘
```

---

## 수용 기준 (acceptance)

- [ ] 진행 중 task에 `다음 확인`·`최근 확인`·`경과`·`정상 기준 대비`가 보인다.
- [ ] 30분+ 정상 실행이 `진행 정상`으로(빨강 아님) 표시되고, 기준 초과 시 `지연`으로 강조된다.
- [ ] worker outage가 execution timeout(30분) **전에** 보드 배너로 노출된다.
- [ ] 실패 run에서 실패 단계·error_code가 보이고, `[다시 실행]`은 "새 run 생성"임을 모달로 고지한다.
- [ ] 다시 실행 시 새 run이 원 run과 계보로 연결되어 이력에서 추적된다.
- [ ] CANCELLING 중 drain 대상과 slot 점유 사유가 보인다.

---

## 미해결 / 가정

| # | 질문 | 방향 |
|---|---|---|
| UX-O1 | `expectedDuration`/`warnThreshold` 산출 | 초기 설정 고정값 → 이력(`task_attempt`) 축적 후 p50/p95 자동. 산출 위치(정의 vs 설정) 확정 필요 |
| UX-O2 | `health` 집계 임계값(연속 timeout 수·관측 윈도우) | operations.md 설정 표 항목으로(R5). 기본값 운영 통계로 조정 |
| UX-O3 | liveness 파생 위치(서버 vs 클라) | 서버 파생 권장(일관성·재사용). 단 새 task 상태로 승격하지 않음(D-T6 준수) |
| UX-O4 | `retryOf` 계보를 N단계 체인까지 표시할지 | 1-hop(직전 원 run) 우선, 전체 체인은 이력 뷰에서 |
