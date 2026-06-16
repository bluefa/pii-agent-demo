# Pipeline — Console UX (운영 콘솔 UX 명세, 종합)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md) 설치/삭제 파이프라인 **운영
> 콘솔의 종합 UX 명세**. 메커니즘·데이터는 [orchestrator-design.md](./orchestrator-design.md), API는
> [api.md](./api.md), 설정은 [operations.md](./operations.md), Task 조회 보강은
> [task-query-api.md](./task-query-api.md) 참조.
>
> **현행 기준: ADR 개정 4판(2026-06-15, b57126a).** 9-state 모델, `Check.name/detail/errorCode`,
> `Attempt.outcome`, checks 페이지네이션, O19/O20 해소가 모두 반영됨.
>
> **원칙:** 콘솔이 보여주는 거의 모든 것은 이미 기록되는 `task_attempt`·`task_check`·`pipeline_event` 위의
> **read-side 파생·표현**이다. 상태기계·전이·정합성 모델은 건드리지 않는다. 신규로 *추가가 필요한* 데이터는
> §8에 "이미 ADR이 제공 / 아직 신규"로 명시 구분한다.
>
> **이 명세를 실제로 구현한 프로토타입:** `design/SIT Prototype Athena v16 (n8n).html`
> (branch `chore/sit-v16-n8n`) — §2 노드 캔버스 + §3 인스펙터를 N8N 스타일로 구현·검증함.

---

## 1. 보드 — 파이프라인 현황

### 1.1 헤더
- **slot 게이지** `slot 7/10` — 동시 Terraform job 사용량 (`GET /admin/pipelines/concurrency` →
  `{slotsInUse, slotCap}`). 포화 시 강조.
- **대기 큐 카드** — 대기 건수 + 최장 대기.
- **systemic health 배너**(조건부, §4.3): worker outage를 30분 timeout *전에* 노출.

### 1.2 목록 (`GET /admin/pipelines`)
한 행 = TargetSource 하나의 설치/삭제 run. 컬럼: TargetSource · 유형 · Provider · 진행(done/total) ·
현재 Task · 경과 · **liveness**(§4.2). 정렬·필터·페이지네이션은 Spring Pageable.

### 1.3 상태 라벨 — 내부 9-state → UI 6라벨
내부 상태는 풍부하지만(9종) UI는 단순화한다(개정 4판: WAITING_SLOT 제거):

| 내부(9종) | 보드 라벨 |
|---|---|
| BLOCKED / READY | **대기** (slot 대기 = `READY ∧ kind=TERRAFORM_JOB`는 "slot 대기" 추가 표기) |
| DISPATCHING / RUNNING | **실행 중** |
| WAITING_EXTERNAL | **외부 대기** |
| DONE / FAILED / EXPIRED / CANCELLED | **완료 / 실패 / 타임아웃 / 중단** |

---

## 2. 노드 캔버스 (N8N 스타일) — 파이프라인 워크플로 시각화

행을 펼치면 그 run이 **노드 캔버스**로 보인다(표/스텝퍼가 아니라 워크플로 그래프). N8N/LangFlow 멘탈모델.

- **노드** = task. 카드에 `kind` 배지(TERRAFORM_JOB/GENERAL_JOB/CONDITION_CHECK), 이름, 상태 아이콘/색,
  메타(경과/의존), **입출력 핸들 포트**(좌/우 점). 상태별 색: 완료=초록 · 실행중=파랑(펄스) · 외부대기=앰버 ·
  실패=빨강(글로우) · 대기=점선. `READY∧TERRAFORM_JOB`은 `slot 대기` 배지.
- **엣지** = `dependsOn`(현재 선형 체인). SVG 베지어. 상태색: 완료=초록 · 진행=파랑 점선 흐름 애니메이션 ·
  실패로 향함=빨강 점선.
- **캔버스 조작** — 드래그 팬(즉각) · 휠 커서기준 줌 · ＋／－·맞춤 툴바(이징) · 줌 라벨 · 미니맵 · dot-grid.
  노드 클릭 → §3 인스펙터가 우측에서 슬라이드인하고, fit이 패널 폭을 비워 노드를 가리지 않게 배치한다.
- **모션 원칙(자연스러움):** 프로그램적 이동(맞춤·버튼 줌·노드 포커스)은 `cubic-bezier(.22,1,.36,1)`로
  부드럽게, 드래그/휠은 1:1 즉각.

---

## 3. Task 인스펙터 (드릴다운) — 최신 API 기반 상세

노드 선택 시 우측 패널. 데이터는 `GET /admin/pipelines/{id}/tasks/{taskId}` →
`{ task, attempts[], checks(페이지네이션) }`. **개정 4판이 노출한 필드를 그대로 쓴다.**

| 섹션 | 표시 | 데이터(최신 API) |
|---|---|---|
| 헤더 | kind 배지 + task 이름 + **operation id** | `Check.name`(예 `im.terraformApply`·`im.jobStatus`) |
| 상태 | 상태 pill(6라벨) + **errorCode 진단 칩**(실패 시) | `task.status` · `Attempt.errorCode`/`Check.errorCode` |
| 기본 정보 | `kind` · `dependsOn` · `failCount/maxFailCount` · 확인주기/TTL(편집) · `latestCheck` | `Task` 필드 |
| **머지 타임라인** | attempt + check 시간순 (O20: dispatch가 `attempts[]`·`checks[](DISPATCH)` 양쪽) | `attempts[]`·`checks[]` |
| **check 요약(집계)** | `확인 N회 · 마지막 14:31 · observed MET` + "개별 폴링 펼치기"(notable만) | `checks` 집계 + `latestCheck` |
| **postCheck 결과** | TERRAFORM_LOG 발췌 + `전체 로그 열기`(logPointer 위임) | `Check(kind=POST_CHECK).detail`={type:"TERRAFORM_LOG", logPointer, excerpt} (S27) |
| 컨트롤 | **취소** · **재시도(새 run)** 만 | `POST .../cancel` · `POST .../retry` |

- **errorCode enum**(개정 4판): `CALL_TIMEOUT · EXECUTION_TIMEOUT · TTL_EXPIRED · IM_REJECTED ·
  CHECK_ERROR · DISPATCH_NO_RESPONSE`. 칩에 코드 + 한글 풀이.
- **observed 어휘**(O19): 원시 kind별 값이 canonical — 폴링 `RUNNING/SUCCEEDED/FAILED`, 조건
  `MET/NOT_MET`. 통합 verdict는 `(kind, observed)`에서 파생.
- **편집 가능 필드**: `READY/WAITING_EXTERNAL` task만 확인주기(≥10분 가드)·TTL·maxFail 편집(✎).
  실행/완료 task는 읽기 전용. (per-task 편집 UI지만 ADR 제어 표면은 cancel/retry뿐 — 설정 변경은
  R5 settings 경유로 합의 필요. §8 참조.)

### 3.1 check는 "집계가 기본" (논의 확정)
진행 중 폴링 한 건 한 건은 판단 가치가 없다("성공 전까진 그냥 check"). 기본 표시는 **집계**
(`checkCount` + 마지막 `checkedAt` + 마지막 `observed`). 개별로 남겨 보여줄 것은 **notable만** —
`apiResult=ERROR`(확인 호출 실패), `apiResult=PENDING`이 오래 머문 것("시도 vs 미시도", D-T5), observed
전이(미충족→충족·실행중→성공). 전체 폴링 이력은 페이지네이션 엔드포인트(`checks`)에 옵션으로만.

---

## 4. 장기 실행 가시성 (핵심 — false-green 방지)

> TF 작업은 구조적으로 30분+ 걸릴 수 있다(회피 불가). UX의 일은 "오래 걸림"을 없애는 게 아니라
> **정상 장기 실행인지 / 망가진 건지 구분**시키는 것이다.

해결할 세 오인:

| 오인 | 실제 | UX 신호 |
|---|---|---|
| "멈춘 것 같다" | 정상 장기 실행, 폴링 중 | 최근 확인 시각 + 다음 확인 카운트다운 + **기준 대비 진행** |
| "잘 도는 것 같다"(false-green) | 장애인데 공손히 폴링만 | 기준 초과 · 연속 timeout · **systemic 조기 신호** |
| "재시도하면 이어지겠지" | terminal 부활 없음, 새 run | 정직한 라벨 + 계보 + 실패 진단(§5) |

### 4.1 개별 task — "살아있음 + 정상 여부"
- 다음 확인 카운트다운(`nextCheckAt`), 최근 확인(`latestCheck.checkedAt/observed/apiResult`),
  현재 단계 경과(`startedAt`), **정상 기준 대비**(`expectedDuration` p50 / `warnThreshold` p95).
- `apiResult=PENDING` = "지금 확인 중"(별도 CHECKING 상태 안 만듦 — D-T6).

### 4.2 파생 liveness 라벨 (4종, 표현용)
`진행 정상` / `예정 대기` / `지연`(기준 초과·아직 실패 아님) / `의심`(timeout 임박·systemic).
`지연·의심`만 강조 — "오래 걸림 = 빨강" 오학습 방지.

### 4.3 systemic 조기 경고
worker outage 알림(`WORKER_OUTAGE_SUSPECTED`)은 execution timeout(~30분)에 종속돼 느리다(ADR Negative).
그 공백을 메우는 read-side 집계 배너: `GET /admin/pipelines/health`(연속 EXECUTION_TIMEOUT 수 · 기준
초과 task 수 · slot 포화 지속). **표시 전용** — circuit breaker를 되살리지 않는다.

---

## 5. retry 표현 — 재생성 정책(결정 5)을 정직하게

정책 유지: **terminal 부활 없음, [재시도] = 같은 definition으로 새 run 생성.** 표현만 보강:

| 보강 | 내용 |
|---|---|
| **정직한 라벨** | `[재시도]` → `[다시 실행]`. "이어하기" 어휘 금지 |
| **확인 모달** | "이 run은 되살릴 수 없어요. 같은 구성으로 새 run을 만듭니다. 완료 단계는 terraform 수렴으로 빠르게 통과." |
| **실패 진단** | 실패 단계·`errorCode`·마지막 check 강조 + "원인을 고친 뒤 다시 실행". (일시 오류는 attempt 자동 재시도가 흡수 → 운영자 재실행은 자동회복 소진된 진짜 문제만) |
| **run 계보** | 새 run ↔ 원 run 양방향: `#1234 다시 실행 → #1240`. 보드·이력 체인 |

---

## 6. 취소(cancel) 가시성 (결정 4c)

- **CANCELLING 표시** — `중단 중 · 실행 중 job 종료 대기` + drain 대상 task 명시.
- **slot 점유 안내** — drain 중 task는 slot 보유 → "slot 점유 중" 표기(게이지가 안 줄어드는 이유).
- 수렴: drain 완료 → `CANCELLED`. drained job terminal 결과는 attempt 이력에만(파이프라인 상태 무영향).

---

## 7. 설정 · 가이드 · API 현황 (콘솔 보조 면)
- **설정 페이지(R5)** — `GET/PUT /admin/pipelines/settings`(N·timeout·polling 기본·알림 라우팅 등),
  재배포 불필요. 변경은 `pipeline_event`로 감사.
- **알림 센터(벨)** — `pipeline_event` 기반(TASK_FAILED·TASK_EXPIRED·WORKER_OUTAGE_SUSPECTED 등).
- API 현황·가이드 관리는 admin-page-requirements §4.5/§4.6.

---

## 8. 데이터 / API — "이미 ADR 제공 ✅ / 아직 신규 ➕"

콘솔이 위 UX를 그리는 데 필요한 것 중, **개정 4판이 이미 제공**하는 것과 **아직 추가가 필요**한 것:

| 항목 | 상태 | 근거 / 비고 |
|---|---|---|
| `Check.name`(operation id) | ✅ 이미 | S27/S28 — "각 phase가 어떤 API" 충족 |
| `Check.detail`(typed; TERRAFORM_LOG logPointer/excerpt) | ✅ 이미 | S27 (단 detail의 kind별 정확한 스키마·full 로그 경로는 **O29** 미해결) |
| `Check.errorCode` · `Attempt.errorCode` · `Attempt.outcome`(파생) | ✅ 이미 | S27/S30 |
| checks 페이지네이션 | ✅ 이미 | `GET .../tasks/{taskId}` Pageable |
| dispatch 양쪽 노출(O20) · observed 원시값(O19) | ✅ 이미(해소) | 머지 타임라인 구분 표시 |
| slot 게이지(`concurrency`) | ✅ 이미 | — |
| **Task 런타임 필드** `nextCheckAt·deadlineAt·startedAt·checkCount` | ➕ 신규(projection) | DB엔 존재, **API `Task` 모델 누락** — [task-query-api.md](./task-query-api.md) FR-TA-1 |
| **Task definition 조회**(dispatch/check/postCheck target + 유효 설정) | ➕ 신규 | snapshot 노출 — task-query-api.md FR-TD-1/2 |
| **`GET /admin/pipelines/health`**(systemic 집계) | ➕ 신규 | §4.3 |
| **`pipeline.retryOf`/`retriedAs`**(계보) | ➕ 신규 | §5 |
| **`expectedDuration`/`warnThreshold`**(기준 baseline) | ➕ 신규 | §4.1 — 초기 설정값 → 이력 p50/p95 |

**상태기계·전이 변경 없음.** 신규는 projection 확장 + 집계/계보/baseline 데이터뿐.

---

## 9. 수용 기준
- [ ] 보드: 9-state→6라벨 매핑, slot 게이지, liveness, health 배너(조건부)가 보인다.
- [ ] 행 펼침 → 노드 캔버스(노드·엣지·팬/줌/미니맵)로 보이고, 노드 클릭 시 인스펙터가 노드를 가리지 않는다.
- [ ] 인스펙터: operation id·머지 타임라인·check 집계·errorCode 칩·postCheck TERRAFORM_LOG·취소/재시도.
- [ ] 30분+ 정상 실행이 `진행 정상`(빨강 아님), 기준 초과는 `지연`, outage는 timeout 전 배너.
- [ ] `[다시 실행]`이 "새 run 생성"임을 모달 고지 + 계보 연결.
- [ ] CANCELLING 중 drain 대상·slot 점유 사유 노출.

## 10. 미해결 / 가정
| # | 질문 | 방향 |
|---|---|---|
| UX-O1 | `expectedDuration`/`warnThreshold` 산출 위치(정의 vs 설정) | 초기 설정값 → 이력 p50/p95 |
| UX-O2 | `health` 집계 임계값 | operations.md 설정 표(R5) |
| UX-O3 | liveness 파생 위치(서버 vs 클라) | 서버 권장, 새 상태 미승격(D-T6) |
| UX-O4 | per-task 설정 편집(확인주기/TTL) 노출 방식 | ADR 제어는 cancel/retry뿐 — R5 settings 경유 합의 필요 |
| UX-O5 | `Check.detail` kind별 스키마 + full terraform 로그 경로 | **ADR O29에 종속** |

## 11. 연관 문서 (파편화 정리)
| 문서 | 역할 |
|---|---|
| **console-ux.md** (본 문서) | 콘솔 UX **단일 종합 명세** |
| [task-query-api.md](./task-query-api.md) | Task 현재상태·definition 조회 API 요구(§3·§8 신규 항목의 상세) |
| [api.md](./api.md) · [operations.md](./operations.md) | API 표면 · 설정/알림 정본 |
| `design/admin-console-capabilities.md` | Admin 전 영역(5메뉴) 권한 카탈로그 |
| `SIT Prototype Athena v16 (n8n).html` (branch `chore/sit-v16-n8n`) | §2·§3을 구현한 프로토타입 |
