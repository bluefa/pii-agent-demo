# Pipeline — Requirements (기능 / 비기능 / 성능)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)이 충족하는 요구사항.
> ADR 본문에는 요약만 두고(Requirements Satisfied), 전체 표는 여기 둔다.
> 기본값·설정은 [operations.md](./operations.md)의 설정 표가 단일 출처다.

---

## 기능 요구사항 (FR)

| ID | 요구사항 | 충족 방식 |
|---|---|---|
| FR-1 | 브라우저 세션 없이 설치/삭제 진행 | DB durable state machine + reconciler tick |
| FR-2 | target별 run history 조회 | `pipeline.target_source_id` + history API |
| FR-3 | task별 attempt/check 추적 | `task_attempt` · `task_check` |
| FR-4 | 재시도 지원 | terminal run 부활 없이 **새 run 생성**(결정 5) |
| FR-5 | 중단 지원 | CANCELLING + in-flight drain(결정 4c) |
| FR-6 | Terraform 로그/결과 보존 | **v2 defer** — terminal snapshot 캡처(구 postCheck)는 v2(v2-deferred.md); v1은 완료 여부·시각만 CHECK 관측에 보존 |
| FR-7 | 알림 제공 | `pipeline_event` transactional outbox |
| FR-8 | BFF-visible active Terraform task 제한 | N-cap admission(결정 4b) |

## 비기능 요구사항 (NFR)

| ID | 요구사항 | 충족 방식 |
|---|---|---|
| NFR-1 | BFF 재시작 후 복구 | DB state + tick 재도출 |
| NFR-2 | 중복 dispatch 안전 | idempotency contract(결정 3) |
| NFR-3 | 무한 대기 방지 | execution timeout + WAIT_EXTERNAL TTL |
| NFR-4 | 다중 replica 안전 | advisory lock 리더 + CAS 전이 |
| NFR-5 | 운영 가시성 | `task_check` · `pipeline_event` |
| NFR-6 | burst 완화 | `max_external_calls_per_tick`(결정 6 D-T7) |
| NFR-7 | worker 결과 유실 흡수 | execution timeout(결정 4a) |
| NFR-8 | 확장 가능한 task 추가 | 새 task = 새 코드 class(대개 기존 kind 재사용; 새 흐름 shape일 때만 새 kind) — 결정 2 |

## 성능 / 용량 요구사항 (PR)

| ID | 목표 | 기준 |
|---|---|---|
| PR-1 | target 2000개 관리 | run history·polling이 견딜 수 있어야 함 |
| PR-2 | BFF-visible active Terraform task 제한 | N≈M (기본값은 operations 설정표 단일 출처); N·K는 retry/orphan headroom 산정 |
| PR-3 | poll burst 제한 | tick당 외부 호출 `max_external_calls_per_tick` 기본 50 |
| PR-4 | WAIT_EXTERNAL 장기 대기 | TTL 기본 7일 |
| PR-5 | job poll cadence | 30~60초 |
| PR-6 | condition polling guard | 최소 10분 |
| PR-7 | task_check 증가량 제한 | retention 90일, reconciler prune |
