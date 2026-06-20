# Pipeline — Migrations · 인덱스 · Retention

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 DB migration·인덱스·retention 및 영향 파일.
> 스키마 전체는 [orchestrator-design.md 결정 1.2](./orchestrator-design.md) 참조.

---

## B. Affected files

- `design/pipeline-interfaces.md` — 동반 구현 스펙. **결정 5(retry=새 run)·결정 6(async 호출
  모델, 관측/상태 분리, 선기록)·dispatch 멱등성 불변식·crash 복구 fail_count++ 규칙(3.1, P0-1) 반영 필요.**
- `design/pipeline-api.md` — admin API 정본; swagger 원천. **retry 엔드포인트 의미론, O10 확정,
  per-call deadline 설정 표면, IM run API 멱등 계약(DELETE의 not-found=성공) 반영 필요(P0-1).
  개정 4판 단순화(breaker·C-budget·force-check 제거, target_source_id) + v1 범위(TaskKind 2종)
  반영 필요.**
- `design/admin-page-requirements.md` — §4.4 모델 원천; §5 admin API 가정 목록.
- `design/SIT Prototype Athena v14.html` — 파이프라인 보드; 결정 1.4 delta 대상.
- `docs/swagger/` — 향후 admin-pipelines.yaml.
- `docs/cloud-provider-states.md` — task 시퀀스 정의가 인코딩하는 provider별 순서.
- **DB migration** — task_check.api_result에 PENDING 추가, task_check.started_at 추가,
  task.last_checked_at 추가 (결정 6). task_check.kind: JOB_POLL+CONDITION_CHECK → CHECK 통합,
  **FORCE_CHECK 제거** (`DISPATCH|CHECK`). **task_check.call_deadline_at 미도입**(C-budget
  제거, 개정 4판). **pipeline.parameters(jsonb) 미도입 — pipeline.target_source_id 컬럼**으로 고정
  (조회 인덱스 `pipeline(target_source_id, started_at DESC)`, 개정 4판). **task.kind
  (TERRAFORM_JOB|CONDITION_CHECK)** — 구 task.type(EXECUTE|WAIT_EXTERNAL) 대체(결정 2).
  **task_attempt.external_handle 제거 → response(jsonb)**(dispatch 원응답, write-once;
  terraform_job_id 전용 컬럼 없음); **task.external_handle(단수) 제거**
  (handle home=attempt.response). task_check 행 = check 호출 1회(O24); **attempt_id 컬럼 미도입**
  (O26 — job_id 고유 발급이라 soft-link로 충분). **crash 복구가 fail_count를 증가시키는 경로 추가**
  (K=max_fail_count 겸용이라 신규 컬럼 불요 — P0-1). **task_attempt.result enum은 OK|FAIL 유지 —
  EXECUTION_TIMEOUT은 별도 result 값이 아니라 error_code로 표현**(옵션 B; result→API outcome 파생, DB 변경 없음).
  `pipeline_def_snapshot`은 무변경(결정 7 실행 기록). **`pipeline`에 부분 unique 제약
  `unique(target_source_id) WHERE status NOT IN (DONE,FAILED,CANCELLED)`**(결정 5 — target당 non-terminal
  pipeline 1건; 중복 생성은 기존 1건 반환).

## 인덱스 / Retention

- **인덱스** (스키마는 orchestrator-design 결정 1.2):
  - `pipeline(target_source_id, started_at DESC)` — target별 run 이력 조회
  - `task_check(task_id, checked_at)` — task 타임라인
  - `pipeline_event(pipeline_id, created_at)` — 이벤트 / 감사 로그
  - `pipeline(target_source_id) WHERE status NOT IN (DONE,FAILED,CANCELLED)` **unique** — target당 non-terminal pipeline 1건 강제·중복 생성 차단(결정 5)
  - `task(pipeline_id, seq)` **unique** — 순차 chain 순서·중복 seq 방지(결정 2; `depends_on` 배열 대신 seq predecessor)
- **Retention** — `task_check`만 폴링 cadence에 비례해 증가하므로 보존 기간(기본 90일) 후 reconciler가 prune. `pipeline`·`task`·`task_attempt`·`pipeline_event`는 무기한 보존(결정 1.3; 결정 5 확장 경로 전제).
