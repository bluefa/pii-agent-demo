# Pipeline — v2 Deferred Surface

> ADR-016 v2 — deferred surface. 구체적 need 생길 때 설계. 여기서 설계하지 않음(YAGNI).
>
> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md) v1(개정 6판)에서 잘라낸 표면.
> 각 항목은 v1에 실제 요구가 없어 제외됐다 — 필요해지면 그때 설계한다.

| 항목 | 왜 v2인가 (한 줄) |
|---|---|
| **scheduling** (`scheduled_at`·예약 실행·not-yet-due 큐 파생) | v1은 모든 pipeline이 즉시 실행 — 예약 실행 요구가 아직 없다. |
| **per-target 실행 직렬화 큐 (구 결정 8)** (active 게이트·다중 non-terminal 허용·`maxNonTerminalPipelinesPerTarget`) | v1은 target당 non-terminal pipeline을 unique 제약으로 1건만 허용해 충분 — 큐·게이트 불요. |
| **custom per-target recipe (구 결정 7 데이터 layer)** (`custom_pipeline_recipe`·override·편집 version·catalog validation·편집 API) | v1은 코드 default recipe로 모든 target을 커버 — per-target 커스터마이즈 요구가 아직 없다. |
| **postCheck + O29** (terminal 스냅샷 관측·`task_check.detail` 스키마·full 로그 조회·redaction) | terminal 로그/결과 본문 보존은 안전한 write-once 캡처법(redaction-before-store + IM 로그 API 사실)이 확정된 뒤 켠다. |
| **알림 라우팅 + Slack/Email 채널** (`notificationRouting` 설정·event/severity/channel 표·외부 채널 어댑터) | v1은 인앱 알림(`pipeline_event` outbox)만으로 충분 — 라우팅 설정·외부 채널 요구가 아직 없다. |
| **skip-completed (content-hash)** (완료 task 시드·부분 재실행·task content-hash 비교) | v1 재시도 = full re-run이 terraform 수렴·읽기 멱등으로 안전 — 부분 재실행이 실측 문제가 될 때 켠다. |
| **GENERAL_JOB** (비-terraform 비동기 job TaskKind) | v1 task는 TERRAFORM_JOB + CONDITION_CHECK 2종으로 모든 흐름을 표현 — 구체적 비-terraform job 사용처가 없다. |
