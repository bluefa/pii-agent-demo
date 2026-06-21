# Pipeline — Migrations · 인덱스 · Retention

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 DB migration·인덱스·retention 및 영향 파일.
> 스키마 전체는 [orchestrator-design.md 결정 1.2](./orchestrator-design.md) 참조.

---

## B. Affected files

- `design/pipeline/orchestrator-design.md` · `design/pipeline/task-model.md` — 설계 정본(상태기계·DB 모델·
  dispatch 5단계·멱등성 계약·crash 복구). migration DDL은 결정 1.2 스키마를 따른다.
- `design/pipeline/api.md` — admin API 표면(swagger 원천); retry 의미론·per-call deadline·IM run API 멱등
  계약(DELETE not-found=성공) 반영. v1 범위(TaskKind 2종, response(jsonb), seq predecessor) 정합.
- `design/admin-page-requirements.md` — §4.4 모델 원천; §5 admin API 가정 목록.
- `design/SIT Prototype Athena v14.html` — 파이프라인 보드; 결정 1.4 delta 대상.
- `docs/swagger/` — 향후 admin-pipelines.yaml.
- `docs/cloud-provider-states.md` — task 시퀀스 정의가 인코딩하는 provider별 순서.
- **DB migration** (이 단락은 리비전 **delta**이지 DDL 전량 목록 아님 — **전체 task/task_check 컬럼 정본 = orchestrator §1.2**; `task.started_at·finished_at·deadline_at·next_check_at`도 §1.2가 정의) — task_check.api_result에 PENDING 추가, task_check.started_at 추가,
  task.last_checked_at 추가 (결정 6). task_check.kind: JOB_POLL+CONDITION_CHECK → CHECK 통합,
  **FORCE_CHECK 제거** (`DISPATCH|CHECK`). **task_check.call_deadline_at 미도입**(C-budget
  제거, 개정 4판). **pipeline.parameters(jsonb) 미도입 — pipeline.target_source_id 컬럼**으로 고정
  (조회 인덱스 `pipeline(target_source_id, started_at DESC)`, 개정 4판). **task.kind
  (TERRAFORM_JOB|CONDITION_CHECK)** — 구 task.type(EXECUTE|WAIT_EXTERNAL) 대체(결정 2).
  **task.handler_key 추가**(안정 코드 class 식별자 — reconciler 라우팅; 미해결 시 task FAILED/HANDLER_NOT_FOUND, 결정 2).
  **task_attempt.external_handle 제거 → response(jsonb)**(dispatch 원응답, write-once;
  terraform_job_id 전용 컬럼 없음); **task.external_handle(단수) 제거**
  (handle home=attempt.response). **task_check.poll_count 추가 + 행 단위 = RLE(O24→RLE 후속17):** DISPATCH는
  호출당 1행, CHECK는 관측 run(연속 동일 collapse, poll_count++); started_at=run 첫 발사·checked_at=run 마지막 관측.
  **attempt_id 컬럼 미도입** (O26 — job_id 고유 발급이라 soft-link로 충분). **crash 복구가 fail_count를 증가시키는 경로 추가**
  (maxFailCount=max_fail_count 컬럼 겸용이라 신규 컬럼 불요 — P0-1). **task_attempt.result enum은 OK|FAIL 유지 —
  EXECUTION_TIMEOUT은 별도 result 값이 아니라 error_code로 표현**(옵션 B; result→API outcome 파생, DB 변경 없음).
  `pipeline_def_snapshot`은 결정 1.2/7 스키마(`pipeline_id, definition_key, definition_version, type, provider, spec(jsonb)`)로 **생성 대상**(이전 리비전 대비 *무변경*이지만 DDL상 신규 테이블 — `pipeline.definition_version`은 두지 않고 버전은 snapshot에만). **`pipeline`에 부분 unique 제약
  `unique(target_source_id) WHERE status NOT IN (DONE,FAILED,CANCELLED)`**(결정 5 — target당 non-terminal
  pipeline 1건; 중복 생성은 기존 1건 반환). **`pipeline.definition_version` 컬럼 제거** — 버전·구성은
  `pipeline_def_snapshot` 단일 보유(중복 비정규화 제거). **`pipeline.last_activity_at` 추가** — 마지막 상태
  전이 시각(보드 기본 정렬 키; 매 전이 tx에서 갱신).

## 인덱스 / Retention

- **인덱스** (스키마는 orchestrator-design 결정 1.2):
  - `pipeline(target_source_id, started_at DESC)` — target별 run 이력 조회
  - `pipeline(started_at)` — 기간(overlap) 횡단 조회(결정 1.3)
  - `pipeline(last_activity_at DESC)` — 보드 기본 정렬(최근 활동순, 결정 1.2/api §1)
  - `task_check(task_id, started_at)` — task 타임라인 (latestCheck = started_at 최대; checks 정렬 startedAt,desc — api §1)
  - `pipeline_event(pipeline_id, created_at)` — 이벤트 / 감사 로그
  - `pipeline(target_source_id) WHERE status NOT IN (DONE,FAILED,CANCELLED)` **unique** — target당 non-terminal pipeline 1건 강제·중복 생성 차단(결정 5)
  - `task(pipeline_id, seq)` **unique** — 순차 chain 순서·중복 seq 방지(결정 2; `depends_on` 배열 대신 seq predecessor)
- **Retention** — `task_check`(CHECK)는 RLE라 폴 수가 아니라 **구별되는 관측 run 수에 비례**해 증가(동일 관측은 poll_count로 접힘 — 후속17); 그래도 보존 기간(기본 90일) 후 reconciler가 prune. `pipeline`·`task`·`task_attempt`·`pipeline_event`는 무기한 보존(결정 1.3; 결정 5 확장 경로 전제).
