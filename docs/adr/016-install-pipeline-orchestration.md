# ADR-016: Install/Delete Pipeline Orchestration in the BFF

## Status

Proposed (2026-06-11) · Updated 2026-06-12 — O1/O2/O3/O6/A1 resolved with the
platform owner; execution timeout added to D3/D4; D10 (cancellation) added.

**Relates to:**
- `design/admin-page-requirements.md` §4.4 — fixes the pipeline *model* (decisions #5–#14: Pipeline/Task, EXECUTE/WAIT_EXTERNAL, strict-sequential DAG, fail-count retry, TTL expiry). This ADR fixes the *runtime architecture* underneath that model.
- ADR-006 (3-object confirmation model), ADR-009 (process status model) — the pipeline runs between `CONFIRMED` and `INSTALLED`.

## Context

System layering:

```
Frontend (Admin console)
   → BFF                      ← pipeline orchestration lives here (decided)
       → Backend Manager      ← domain: integration, approval, target sources
       → Infra Manager        ← Terraform job API; execution by TerraformWorker
```

What the pipeline actually does is intentionally simple: call an API, then either
(a) the response contains a `job_id` — poll that TerraformJob until it reaches a
terminal state, or (b) there is no `job_id` — evaluate a provider-specific
condition (e.g. an installation-status check) until it is satisfied.

Established facts and constraints:

1. **The BFF owns pipeline management** (user decision). Pipelines are created from
   the Admin console ([설치 시작] / [삭제 시작]) and advance without a browser session.
2. **Infra Manager's run API is async**: it returns a `job_id`; a TerraformJob
   contains multiple internal tasks. Some calls return no `job_id` and must be
   judged by condition.
3. **Job lifecycle is pubsub-async**: Infra Manager issues `terraform_job_id`
   server-side at request time and publishes a pubsub message carrying it; a
   separate **TerraformWorker** consumes the message, runs Terraform, and
   reports the result back to Infra Manager. Submitting the same work N times
   concurrently still executes only one actual run (worker-level dedup).
4. **Results can be lost**: occasionally the worker never reports back and the
   job stays non-terminal forever. The BFF deliberately does not distinguish
   "still running" from "result lost" — both are absorbed by an execution
   timeout (user decision).
5. **Concurrency cap**: the number of concurrently running TerraformJobs must stay
   below N (Infra Manager capacity concern).
6. **Today, all Infra Manager TF calls are made manually by human operators.**
   The pipeline becomes the first and only automated caller.
7. Execution times (start, finish, last run per target) and notifications are
   first-class operational requirements.
8. The plane should be operable by an AI agent later without rework.

## Decision

### D1. Orchestration pattern: durable state machine + reconciler tick, inside the BFF

A `pipeline-orchestrator` module inside the BFF. No workflow engine, no message
broker, no separate service.

- **All Pipeline/Task state lives in a BFF-owned database** (user decision).
  Backend Manager keeps domain state only; Infra Manager keeps Terraform state only.
- A single logical scheduler (the **reconciler**) wakes on a fixed tick
  (default 30 s), selects due work from the DB, performs the next transition for
  each due task, and persists state + event **in the same transaction**.
- If the BFF runs multiple replicas, one leader runs the tick via a DB advisory
  lock (`pg_try_advisory_lock` or equivalent); the others skip. Nothing depends
  on in-memory state, so restart/redeploy mid-run is safe by construction.
- UI actions (retry / cancel / force-check) do not call Infra Manager directly;
  they record an *intent* on the row, which the next tick executes. This keeps
  external calls and slot accounting single-writer (see R2).

Rejected alternatives are listed under *Options considered*.

### D2. Data model (BFF DB)

```
pipeline        id, target_source_id, type(INSTALL|DELETE), provider,
                definition_version, status(QUEUED|RUNNING|DONE|FAILED|CANCELLED),
                triggered_by(actor), created_at, started_at, finished_at, fail_reason

task            id, pipeline_id, seq, name, type(EXECUTE|WAIT_EXTERNAL),
                status(BLOCKED|READY|WAITING_SLOT|DISPATCHING|RUNNING|
                       WAITING_EXTERNAL|DONE|FAILED|EXPIRED|CANCELLED),
                depends_on, polling_interval(≥10m guard), ttl, execution_timeout,
                deadline_at, max_fail_count, fail_count,
                external_job_id, next_check_at, started_at, finished_at

task_attempt    id, task_id, attempt_no, started_at, finished_at,
                result(OK|FAIL), error_code, error_detail, external_job_id

pipeline_event  id, pipeline_id, task_id?, type, severity, payload(jsonb),
                actor(human|system|ai), created_at, notified_at
                -- append-only; doubles as audit log and notification outbox
```

- The per-provider DAG definitions (requirements §4.4.2) are **code, not DB
  rows** — reviewable and versioned. Each pipeline stores a
  `definition_version` snapshot so old runs render correctly after a definition
  change.
- Internal task states are richer than the UI vocabulary on purpose. Mapping:

| Internal | Board label |
|---|---|
| BLOCKED / READY / WAITING_SLOT | 대기 (WAITING_SLOT additionally shows queue position) |
| DISPATCHING / RUNNING | 실행 중 |
| WAITING_EXTERNAL | 외부 대기 |
| DONE / FAILED / EXPIRED / CANCELLED | 완료 / 실패 / 타임아웃 / 중단 |

### D3. Two completion adapters per task

Every task executes through exactly one of two adapters:

- **JobAdapter** (EXECUTE that launches Terraform): call Infra Manager run API →
  store `external_job_id` → poll job status every `JOB_POLL_INTERVAL`
  (system-level, default 30–60 s) until terminal, **or until
  `execution_timeout` elapses** (default 30 min, admin-tunable). A timed-out
  job is a failed attempt (`error_code=TIMEOUT`): the TF slot is released and
  the normal fail-count policy decides retry vs FAILED. Re-running is safe —
  the worker dedupes and `terraform apply` is convergent. This timeout is what
  absorbs the lost-result case (Context fact 4). The TerraformJob's internal
  task list is mirrored read-only for the drill-down UI; orchestration consumes
  only the job-level terminal status plus the failed internal task's error for
  `error_code` extraction.
- **ConditionAdapter** (WAIT_EXTERNAL, and any call that returns no `job_id`):
  call a provider-specific check API every `polling_interval` and judge
  done/not-yet with a predicate. Per requirements §4.4.3, "not yet" is not a
  failure; only a check-API error increments `fail_count`.

**Polling cadence split (R3).** The admin-tunable ≥10-minute guard (requirements
decision #6) applies to **WAIT_EXTERNAL condition checks** — they track
human-speed external actions. TerraformJob status polls are system-configured
(30–60 s) and exempt; a 3-minute Terraform run must not take 10+ minutes to
detect. *(A1 — confirmed by the requirements owner, 2026-06-12.)*

### D4. Concurrency cap: BFF-side admission control only

- A task that needs a TerraformJob enters `WAITING_SLOT`. Each tick the
  scheduler counts tasks in `DISPATCHING|RUNNING` that hold a TF slot and admits
  from the queue **FIFO by ready time** while the count < N. Global FIFO, no
  priority classes (confirmed 2026-06-12); revisit only if DELETE-priority or
  per-provider fairness becomes a demonstrated need.
- N is runtime configuration, editable on the admin settings page (default
  N=10 — sized up from the initial N=3 proposal by the platform owner),
  changes audited as events.
- A task that hits its execution timeout releases its slot even though the
  underlying job may still be running — effective concurrency can transiently
  exceed N. Accepted: same family as the manual-run blind spot below.
- Enforcement lives **only in the BFF** (user decision). Rationale: today the
  only other TF callers are human operators, and the pipeline is the sole
  automated caller. **Documented blind spot:** jobs launched directly by humans
  in Infra Manager are invisible to the BFF counter, so the *effective* total
  can exceed N by however many manual jobs are running.
- **Re-trigger:** if another automated caller appears, or manual runs become
  frequent enough to threaten capacity, add an Infra-Manager-side limit
  (reject-with-429) as a second line of defense; the BFF then treats 429 as a
  transient requeue, not a task failure.

### D5. Dispatch reliability: at-least-once dispatch, downstream dedup

The crash window — BFF calls the run API, then dies before persisting
`job_id` — is the classic dual-write gap. Because **TerraformWorker already
collapses duplicate submissions into a single execution**, the BFF does not
build exactly-once machinery:

1. Mark `DISPATCHING` + write `task_attempt` row (tx 1).
2. Call the run API.
3. Persist `external_job_id`, move to `RUNNING` (tx 2).
4. Recovery rule: a `DISPATCHING` row older than a dispatch timeout without a
   `job_id` is simply re-dispatched. Worst case, a duplicate submission reaches
   TerraformWorker, which executes the work once.

**Resolved (2026-06-12):** `terraform_job_id` is issued server-side per
request, so a re-dispatch always yields a *new* job_id. The BFF polls only the
latest `external_job_id` it persisted; an earlier orphaned submission is
abandoned — worker dedup prevents a second execution, and if an orphan job
never reports a result, nobody is polling it. The execution timeout (D3)
bounds every waiting path, including jobs whose results are lost.

### D6. Timestamps, history, and "last run"

- Pipelines, tasks, and attempts are append-only — never overwritten. This
  yields full execution history per target source for free.
- Recorded everywhere: `created_at` / `started_at` / `finished_at` (pipeline,
  task), per-attempt timing, and `next_check_at` so the admin sees "다음 확인
  14:32" instead of guessing the polling schedule.
- A denormalized per-target summary (`last_install_run_at`, `last_delete_run_at`,
  last result, running pipeline id) feeds list views without scanning history.
- Retention: keep everything (volume is low — pipelines are rare per target).
  The board's "완료" card filters to the last 7 days per the requirements
  wireframe; history remains queryable.

### D7. Notifications: event-log-driven, channel-pluggable

- The `pipeline_event` row written in the same transaction as a state change is
  the single source of notifications (**transactional outbox**) — no lost or
  duplicated alerts, and the audit log is the same data.
- A notifier loop consumes events where `notified_at IS NULL`, resolves routing,
  and fans out through a `NotificationChannel` interface.
- **v1 ships the in-app notification center only** (bell + unread badge +
  severity filter). Slack webhook and email are later channel adapters —
  config-only additions, no orchestrator change (user decision: web now,
  extensible for Slack/Email later).

Default routing (admin-editable later):

| Event | Severity | v1 channel |
|---|---|---|
| TASK_FAILED (max_fail_count exceeded) | critical | in-app |
| TASK_EXPIRED (TTL) → PIPELINE_FAILED | critical | in-app |
| PIPELINE_DONE | info | in-app |
| QUEUE_WAIT_EXCEEDED (slot wait > threshold, proposed 30 min) | warning | in-app |
| SETTINGS_CHANGED (N, defaults) | info | in-app |

### D8. Admin console composition (delta on v14)

v14 already renders the pipeline board (summary cards, sequence panel, table).
This ADR adds:

1. **Board header**: TF slot gauge (`실행 중 n / N`) + waiting-queue card
   (count, oldest wait time).
2. **Row / task panel**: next-check countdown; queue position for WAITING_SLOT;
   **[지금 확인]** force-check button (one-shot immediate poll, rate-limited,
   audited as `actor=human`) — the escape hatch from the ≥10 min cadence.
3. **Task panel**: attempt history (timestamps, error codes) and a read-only
   TerraformJob drill-down listing the job's internal tasks.
4. **TargetSource 상세 · 설치 관리 탭**: last install/delete run summary
   (time, result, link to the board).
5. **Notification center** (bell) and a **settings page** (N, default
   polling/TTL/max_fail_count, execution timeout, queue-wait threshold, future
   channel routing).
6. **History**: pipeline events merge into the 변경 이력 tab — requirements
   §9.10 already lists pipeline start/fail/done there; same event stream.

### D9. AI-ready management plane

Rules that make later AI operation an addition, not a rewrite:

- **R-AI1 — UI = API parity.** Every admin action is a public BFF admin API
  (the §5 assumed list); the UI holds no behavior of its own. An AI operator is
  just another API principal with scoped permissions.
- **R-AI2 — Machine-readable events.** Every transition carries a reason code.
  Error taxonomy: `TRANSIENT_INFRA | AUTH | QUOTA | TF_ERROR | TIMEOUT |
  EXTERNAL_NOT_READY | UNKNOWN`. This log is simultaneously audit trail,
  notification source, and future diagnosis/training data.
- **R-AI3 — Actor everywhere.** `human | system | ai` on every event and
  trigger; the 변경 이력 tab renders it.
- **R-AI4 — Phased autonomy with guardrails.**
  - Phase 0: read-only insights (failure summaries, anomaly flags on
    duration/queue metrics).
  - Phase 1: propose-only (AI recommends retry/cancel/setting changes; human
    clicks the same API the UI uses).
  - Phase 2: bounded auto-actions (e.g. auto-retry `TRANSIENT_INFRA` within
    `max_fail_count`). Creating INSTALL/DELETE pipelines and any destructive
    action stay human-approved indefinitely.
- **R-AI5 — Metrics.** Per-task duration, queue wait, success rate by
  provider/task name, slot utilization — exported for dashboards and anomaly
  detection (feeds Phase 0).
- Future: an MCP server can expose the same admin APIs as tools; no new surface
  is required because of R-AI1.

### D10. Cancellation: stop advancing, never kill

Infra Manager has no cancel API for an issued TerraformJob, and the pubsub
hand-off makes recalling a published message impractical (confirmed
2026-06-12). Pipeline [중단] therefore means:

- The pipeline moves to CANCELLED and no further task is readied or dispatched.
- An in-flight TerraformJob runs to its natural end (or to execution timeout)
  and **keeps holding its TF slot until then** — the cap protects Infra
  Manager, and that job is genuinely still consuming worker capacity.
- The board shows "중단됨 · 실행 중 job 종료 대기" while the last job drains.
  Its final status is recorded on the task attempt for history but no longer
  affects pipeline state.

## Options considered

| Option | Decision | Reason |
|---|---|---|
| A. BFF-internal durable reconciler (DB rows + tick loop) | **Chosen** | Matches the actual workload ("call API, poll job_id, else check condition"); restart-safe; admin-tunable polling maps naturally to `next_check_at` columns; smallest operational footprint. |
| B. Separate orchestrator microservice | Rejected for now | A deployable service's worth of overhead for a module's worth of logic. The module boundary (`pipeline-orchestrator`, own schema) keeps extraction cheap if scale demands it. |
| C. Workflow engine (Temporal / Airflow / queue-broker) | Rejected | Linear 2–4 step chains with ≥10-minute polling do not justify the operational and conceptual cost. |
| D. In-memory async chains in the BFF | Rejected | Loses runs on restart/deploy; cannot represent durable queue, history, or WAIT_EXTERNAL spanning days. |
| E. Pipeline state stored in Backend Manager | Rejected (user decision) | Splits orchestration logic and state across services; atomic slot accounting through a remote API is awkward and racy. |
| F. Concurrency limit in Infra Manager (now) | Deferred (user decision) | BFF is the only automated caller today; revisit per D4's re-trigger. |

## Architectural Rules

### R1 — Single transition function

Every state change goes through one transition function that (a) validates
against the transition table, (b) writes the new state and the `pipeline_event`
in one transaction. No code path writes `status` directly.

### R2 — The reconciler is the only Infra Manager caller

UI/API actions (retry, cancel, force-check, create) only write intent; the tick
executes it. External calls and slot accounting stay single-writer, which is
what makes the N-cap and at-least-once dispatch reasoning valid.

### R3 — Two polling cadences, one guard

The ≥10-minute admin-tunable guard governs WAIT_EXTERNAL condition checks only.
TerraformJob status polling is a system setting (30–60 s), not exposed per-task.

### R4 — Notify from events only

No request handler sends a notification inline. If it isn't a `pipeline_event`,
it doesn't notify — and everything that matters is a `pipeline_event`.

### R5 — Settings are data

N, default polling interval, default TTL, default max_fail_count, execution
timeout, and routing live in DB-backed runtime config, editable in the admin
settings page, with
changes audited as events. No redeploy to tune operations.

## Consequences

### Positive

- Today's manual, human-sequenced Terraform operation becomes restart-safe
  automation with a visible queue and enforced concurrency.
- Execution history, last-run timestamps, audit trail, and notifications all
  derive from one append-only event stream — no second bookkeeping system.
- Slack/email channels and AI operation are additive (adapter / API principal),
  not architectural changes.

### Negative / accepted costs

- The BFF gains a database and a background loop — it is no longer a stateless
  proxy. Leader election is required for multi-replica deployments (an advisory
  lock keeps this small, but it is real operational surface).
- The N-cap is blind to human-launched jobs in Infra Manager (accepted; D4
  re-trigger documented).
- At-least-once dispatch can produce occasional duplicate/orphaned jobs in
  Infra Manager history, and timeout-released slots can transiently push
  effective concurrency past N (both accepted; TerraformWorker dedup prevents
  double execution).

## Open questions

| # | Question | Default until answered |
|---|---|---|
| O4 | Scheduled (cron-style) pipeline runs in scope? | Out of scope; `triggered_by` and the event model leave room. |
| O5 | UI label for TerraformJob internal tasks vs pipeline Task (naming collision) | Drill-down panel titled "Terraform Job 상세 단계"; confirm with UX. |

### Resolved (2026-06-12, with the platform owner)

| # | Resolution |
|---|---|
| O1 | `terraform_job_id` is issued server-side per request and handed to TerraformWorker via pubsub; duplicates execute once; lost worker results are absorbed by the execution timeout. → D3, D5 |
| O2 | No cancel API exists — cancellation never kills an in-flight job. → D10 |
| O3 | Slot queue stays global FIFO, no priority classes. → D4 |
| O6 | N=10 (raised from the N=3 proposal), execution timeout 30 min, queue-wait alert 30 min, dispatch timeout 5 min — all runtime-tunable. → D4, D8, R5 |
| A1 | The ≥10-minute guard applies to WAIT_EXTERNAL checks only; job status polls are system-level 30–60 s. → D3, R3 |

## Affected files

- `design/admin-page-requirements.md` — §4.4 model source; §5 assumed admin API list (pipeline endpoints will become swagger specs)
- `design/SIT Prototype Athena v14.html` — pipeline board exists; D8 deltas target the next prototype revision
- `docs/swagger/` — future `admin-pipelines.yaml` (create/board/retry/cancel/force-check/task PATCH/settings/notifications)
- `docs/cloud-provider-states.md` — provider install/delete sequences the DAG definitions encode
