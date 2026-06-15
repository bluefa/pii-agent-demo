# Pipeline — Operations (운영 설정 · 알림 · 장애 대응)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 운영 문서.
> 메커니즘은 [orchestrator-design.md](./orchestrator-design.md), API는 [api.md](./api.md) 참조.

---

## 설정 (R5 — 설정은 데이터다)

**R5 — 설정은 데이터다.** 아래는 모두 DB 기반 런타임 설정으로, 관리자 설정 페이지(결정 1.4-5)에서
변경하며 변경은 pipeline_event로 감사된다. 운영 튜닝에 재배포가 필요 없다. **결정 본문은 메커니즘만
기술하고, 구체 기본값은 이 표를 단일 출처로 참조한다.**

| 설정 | 기본값 | 범위 | 비고 / 출처 |
|---|---|---|---|
| tick 주기 | 30초 | 전역 | reconciler 깨어나는 빈도; 호출 deadline과 무관 (D-T1) |
| per-call HTTP deadline | 30초 (post-check 60초) | 전역 + TaskKind별 오버라이드 | 느린 check는 정상 응답시간+여유(예 90/240초) (D-T3) |
| Dispatch 복구 timeout | 5분 | 전역 | response 없는 DISPATCHING 재dispatch (3.1) |
| Execution timeout | 30분 | 전역 (task별 차등 가능) | dispatch→terminal; 드문 worker 버그 안전망 (4a) |
| WAIT_EXTERNAL TTL | 7일 (예) | task별 | 초과 시 EXPIRED → pipeline FAILED (4a) |
| WAIT_EXTERNAL polling guard | ≥10분 | task별, 관리자 조정 | 조건 확인 cadence (결정 2) |
| job-poll cadence | 30–60초 | 전역(시스템) | TerraformJob 상태 폴링; task별 비노출 (결정 2) |
| N (slot cap) | 10 (초안 3) | 전역 | BFF-visible active Terraform task 수를 N 이하로 admission 제어; global worker hard cap 아님 (4b) |
| max_external_calls_per_tick (외부 호출 발사 상한) | 50 (초기값, 런타임 조정) | 전역 | tick당 최대 발사 호출 수; burst 완화(정확한 동시성 보장 아님), poll 부하 보호 (D-T7) |
| max_fail_count | task별 | task별 | 자동 재시도 한도 = **K (초기 dispatch 포함 최대 attempt 수)** (1.2, 3.1) |
| K (= max_fail_count = 최대 attempt 수, 초기 포함) | IM 스펙 기반 (예 2~3) | task별 또는 전역 | 최대 총 attempt(재dispatch ≤ K−1); **N·K = retry/orphan worst-case 제출 여유 산정값**, BFF 단독 global concurrency 보장식 아님 (3.1, 4b) |
| task_check 보존 | 90일 | 전역 | reconciler prune (1.3) |
| queue-wait 알림 임계 | 30분 (제안) | 전역 | QUEUE_WAIT_EXCEEDED (1.3) |
| 알림 라우팅 | 기본 표 (1.3) | 이벤트별 | 관리자 편집 |

(구 아키텍처 룰 R1·R2·R6은 결정 3.2로, R3은 결정 2로, R4는 결정 1.3으로 흡수되었고, 독립 룰로
남는 것은 R5뿐이다.)

---

## 알림

- 모든 알림은 `pipeline_event`(transactional outbox)에서 나간다 — 유실·중복 없음(결정 1.3).
- **WORKER_OUTAGE_SUSPECTED** (critical) — execution timeout 연속 발생 시 systemic worker 장애 의심, 단일 롤업 알림(개정 4판: circuit breaker 없이 알림만).
- **QUEUE_WAIT_EXCEEDED** — slot 대기가 임계(기본 30분) 초과.
- 라우팅은 설정 표의 알림 라우팅에서 관리자 편집.

## 장애 대응 — 신호 해석

| 신호 | 의미 | 대응 |
|---|---|---|
| execution timeout 1건 | 그 job이 30분 내 terminal 미도달 | 재시도(fail_count++); K회 소진 시 task FAILED |
| execution timeout 연속 | worker outage 의심 | WORKER_OUTAGE_SUSPECTED 확인, worker 상태 점검 |
| queue wait 길어짐 | slot(N) 포화 또는 worker 정체 | N과 N·K headroom, worker 용량 점검 |
| task FAILED | K회 시도 모두 실패 | error_code 확인 후 retry=새 run |

## 동시성 제어의 의미

- **N-cap (slot)** — BFF-visible active Terraform task 수를 N 이하로 admission 제어한다. 실제 global
  TerraformWorker job concurrency의 hard cap은 아니며, 모든 caller·수동 job·orphan job까지 포함한 hard
  cap이 필요하면 IM 429/503이 맡는다(결정 4b).
- **max_external_calls_per_tick** — tick당 발사 호출 수 상한(burst 완화). 정확한 global 동시성 보장이 아니라 완화 장치이며 정밀 강제는 IM 429/503에 위임(결정 6 D-T7).

## 없는 버튼 (개정 4판)

- **force-check 없음** — 모든 상태 확인은 polling 정책으로만.
- **task 재시작 없음** — task 레벨 수동 재실행 없음. retry는 **새 run 생성**(결정 5).
- **pause/resume 없음** — dispatch admission gate 없음(circuit breaker 제거).
- 제어는 **cancel · retry** 둘뿐([api.md](./api.md)).
