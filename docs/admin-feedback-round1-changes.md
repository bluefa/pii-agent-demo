# 어드민 운영 피드백 1차 — 프론트 변경 사항

> 브랜치: `fix/admin-feedback-round1` (커밋 f2da6daa)
> 대상 피드백: ①카탈로그 스크롤/모달 가변 높이 ②작업 예정 시간 초 단위 ④패널·Task 아이콘 상태 불일치
> ⑤PENDING→RUNNING 미전이 착시 (③타임존은 수정 불필요 — Asia/Seoul 고정 설계가 의도대로 동작)

## ① Custom 빌더 카탈로그 — 모달 높이 고정 + 내부 스크롤

**증상.** Custom 작업 구성 모달이 Task 카탈로그 항목 수에 따라 세로로 늘어난다.

**원인.** `.r24-build`(빌더 캔버스)가 `min-height:400px`뿐이라, 우측 도킹 카탈로그 패널의
행 스택 고유 높이가 flex 컨테이너를 키웠다. `.r24-cat-body`의 `overflow-y:auto`는 높이가
제약될 때만 효과가 있는데 제약이 없었다.

**수정.** 캔버스 높이를 **420px 고정**(`height:420px`) — 카탈로그는 패널 내부에서 스크롤되고,
모달 높이는 Task/카탈로그 개수와 무관해진다.

| 파일 | 변경 |
|---|---|
| `app/admin/pipelines/_detail/CustomBuildStep.tsx` | `BUILD_CSS`의 `.r24-build` `min-height:400px` → `height:420px`, 파일 주석에 고정 사유 기록 |

## ② 작업 예정 시간 — 초 단위 노출

**증상.** 작업 현황(PENDING)의 "시작 예정" 시각이 분 단위(`HH:mm`)까지만 보인다.
start-delay가 ~15초라 분 표기로는 "지금"과 구분되지 않는다.

**수정.** 초 포함 포매터 `fmtDateTimeSec`(`YYYY-MM-DD HH:mm:ss`, Asia/Seoul)를 추가하고
PENDING 예정 시각 표기에 적용. 기존 `fmtDateTime`(이력·구간 표기)은 그대로 둔다 —
초가 의미 있는 곳은 스케줄 시각뿐이다.

| 파일 | 변경 |
|---|---|
| `lib/pipeline/format.ts` | `SEOUL_DATETIME`에 `second` 파트 추가, 공통 `seoulDateTime(iso, withSeconds)` 추출, `fmtDateTimeSec` 신설 |
| `app/admin/pipelines/_detail/statusModel.ts` | PENDING 라벨 `... 시작 예정`을 `fmtDateTimeSec`으로 전환 |
| `lib/pipeline/format.test.ts` / `statusModel.test.ts` | 초 표기·자정 정규화·null 폴백 테스트 4건 추가 |

## ④ 패널 값과 Task 아이콘 상태 불일치 — 재시도 상태의 3면 정합

**증상.** 노드 아이콘은 실행 중(스피너)으로 보이는데 패널(드로어)에는 실패가 보인다.

**원인.** 백엔드(`TaskStateMachine.retryOrFail`)는 재시도 가능 실패 후 task를 **READY로
되돌리고 `polling_interval`(기본 10분) 대기** 후 재실행한다. 이 "재시도 중" 상태가 화면마다
다르게 그려졌다:

- 작업 현황 노드: 재실행 중이면 스피너(RUNNING처럼), 대기 중이면 앰버 READY — 실패 문맥 없음
- 드로어: attempt 이력에 FAILED 행(빨강) → "실행 중인데 실패?"로 읽힘
- 타깃 페이지 RunTaskCard: READY를 `PENDING` 라벨로 collapse — 아직 시작도 안 한 것처럼 보임

**수정.** 세 표면이 같은 이야기를 하게 한다: "직전 시도는 실패했고, 지금 재시도 대기/실행 중".

| 파일 | 변경 |
|---|---|
| `app/admin/pipelines/[pipelineId]/_components/PipelineDetailView.tsx` | `resolveMeta`: `fail_count>0`이고 IN_PROGRESS/READY면 노드 메타를 `직전 시도 실패 — 재시도 대기 중/실행 중 (f/m)`으로 표기(현재 task면 분모는 `current_max_fail_count`) |
| `app/admin/pipelines/_detail/r24Task.tsx` | `STATUS_VIEW`의 READY 라벨 `PENDING` → `READY`(드로어의 `PipelineStatusBadge`와 일치), `RunTaskCard` retry 표기를 running 한정에서 해제 |
| `app/admin/pipelines/targets/[targetSourceId]/_components/CurrentPipelineCard.tsx` | retry 카운터를 IN_PROGRESS 한정 → **현재 task**(`current_task_sequence`, READY 재시도 대기 포함)에 표시 |

## ⑤ PENDING → RUNNING 미전이 — 백엔드 결함 아님 (UI 착시), ④ 수정으로 해소

**조사 결과(백엔드).** claim 경로는 건전하다:

- claim 술어가 `status IN (RUNNING, PENDING) AND next_due_at <= now AND lease free`
  (`PipelineRepository.lockClaimableDuePipelines`), `PENDING→RUNNING` 전이는 claim 트랜잭션에서
  lease와 원자적으로 수행(`PipelineClaimer.claimOneDue`).
- 스케줄러 idle sleep은 `max-idle-sleep`(5s) 상한 + nearest-due 캡(`capToNearestDue`)으로 묶여,
  파이프라인 PENDING은 **startDelay(15s) + ≤5s + jitter 안에 반드시 claim**된다.

**착시의 원인.** ④의 READY→`PENDING` 라벨 collapse. 재시도 대기(READY, 최대 10분)가 타깃
페이지에서 `PENDING` 필로 보여 "PENDING에서 안 넘어간다"로 읽혔다. ④ 수정(READY 라벨 교정 +
재시도 문맥 표기)이 이 착시를 제거한다.

**남는 실제 가능성(코드 결함 아님, 재현 시 확인 순서).**

1. 해당 파이프라인 행의 `next_due_at` — 미래면 아직 due가 아님(정상 대기)
2. `claimed_until` — 미래면 다른 워커가 점유 중
3. 활성 claim 수 ≥ `running-pipeline-cap`(기본 100) — soft-cap 포화(데모 규모에선 비현실적)
4. 스케줄러 스레드 생존 여부(`pipeline-scheduler` 데몬) — 파드 로그의 sweep 주기 확인
