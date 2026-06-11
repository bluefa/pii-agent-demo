# ADR-016: Install/Delete Pipeline Orchestration in the BFF

## Status

Proposed (2026-06-11)

- Updated 2026-06-12 — O1/O2/O3/O6/A1 resolved with the platform owner;
  execution timeout added to D3/D4; D10 (cancellation) added.
- Updated 2026-06-12 — execution-history & queryability requirement folded in
  (`task_check` observation log, history/query API, history UI in D8);
  architecture overview diagram added.
- Updated 2026-06-12 — best-effort post-completion checks added to D3
  (e.g. Terraform log fetch, 0..N per task); D11 consolidates the full
  timeout budget incl. per-call HTTP deadlines; error taxonomy splits
  `CALL_TIMEOUT` / `EXECUTION_TIMEOUT`.
- Updated 2026-06-12 — D12 (crash & N-pod walkthrough; CAS transitions; R6
  "correctness never depends on the leader lock") and D13 (TerraformWorker
  outage circuit breaker — detect, pause dispatch, auto-resume; minimal admin
  intervention) added.
- Updated 2026-06-12 — companion implementation spec
  `design/pipeline-interfaces.md` added (Java interfaces, admin API,
  cancellation concurrency analysis); D10 refined with the CANCELLING drain
  state and the forward/drain-edge rule.

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
7. Execution times and **full execution history** are first-class: per-target
   run history, per-task detail, and the outcome of every external call — both
   "did the execution succeed" and "did the status-confirming poll call itself
   succeed" — queryable by target source and by time range. Notifications are
   equally first-class.
8. The plane should be operable by an AI agent later without rework.

## Decision

### Architecture overview

```
┌─────────────────────────────── Admin Console (v14 + D8) ───────────────────────────────┐
│ Pipeline Board · Run History · TargetSource detail (install tab) · Notifications · Settings │
└────────────────┬─────────────────────────────────────────────────────────────────────────┘
                 │  Admin API — UI = API parity (R-AI1); same surface for humans and AI
┌────────────────▼─────────────────────────────────────────────────────────────────────────┐
│ BFF                                                                                       │
│                                                                                           │
│  API handlers ──write intents──────────────┐           History / Query API                │
│  (create · retry · cancel · force-check)   │           (by target source · by period ·    │
│                                            │            run → task → attempt → check)     │
│                                            ▼                           ▲                  │
│                                  ┌───────────────────┐                 │ reads            │
│                                  │      BFF DB       │─────────────────┘                  │
│                                  │ pipeline · task   │                                    │
│                                  │ task_attempt      │      ┌────────────────────────────┐│
│                                  │ task_check        │◄─────│ Reconciler — 30 s tick     ││
│                                  │ pipeline_event    │─────►│ (leader via advisory lock) ││
│                                  │   (= outbox)      │      │  · slot scheduler (N, FIFO)││
│                                  └─────────┬─────────┘      │  · JobAdapter              ││
│                                            │                │  · ConditionAdapter        ││
│                                            │                │  · post-checks (D3)        ││
│  Notifier loop ◄──unnotified events────────┘                └────┬───────────────┬───────┘│
│       │                                                          │               │        │
└───────┼──────────────────────────────────────────────────────────┼───────────────┼────────┘
        │ channel adapters                       run API + job status polls    condition checks
        ▼                                                          │               │
  In-app center (v1)                             ┌─────────────────▼────┐  ┌───────▼──────────┐
  Slack / Email (later)                          │ Infra Manager        │  │ Backend Manager / │
                                                 │  issues job_id,      │  │ provider status   │
                                                 │  publishes pubsub    │  │ APIs              │
                                                 └───────┬──────▲───────┘  └───────────────────┘
                                                  pubsub │      │ result — can be lost
                                                         ▼      │ (absorbed by execution timeout)
                                                 ┌──────────────┴──────┐
                                                 │ TerraformWorker     │
                                                 │ dedup: same work    │
                                                 │ executes only once  │
                                                 └─────────────────────┘
```

Every arrow into the DB is also a history record: the state tables, the attempt
log, the observation log (`task_check`), and the event outbox are written in
the same transactions that advance the state machine (D6, R1).

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
  on in-memory state, so restart/redeploy mid-run is safe by construction
  (full crash & N-pod walkthrough: D12).
- UI actions (retry / cancel / force-check) do not call Infra Manager directly;
  they record an *intent* on the row, which the next tick executes. This keeps
  external calls and slot accounting single-writer (see R2).

Rejected alternatives are listed under *Options considered*.

### D2. Data model (BFF DB)

```
pipeline        id, target_source_id, type(INSTALL|DELETE), provider,
                definition_version,
                status(QUEUED|RUNNING|CANCELLING|DONE|FAILED|CANCELLED),
                triggered_by(actor), created_at, started_at, finished_at, fail_reason

task            id, pipeline_id, seq, name, type(EXECUTE|WAIT_EXTERNAL),
                status(BLOCKED|READY|WAITING_SLOT|DISPATCHING|RUNNING|
                       WAITING_EXTERNAL|DONE|FAILED|EXPIRED|CANCELLED),
                depends_on, polling_interval(≥10m guard), ttl, execution_timeout,
                deadline_at, max_fail_count, fail_count,
                external_job_id, next_check_at, started_at, finished_at

task_attempt    id, task_id, attempt_no, started_at, finished_at,
                result(OK|FAIL), error_code, error_detail, external_job_id

task_check      id, task_id, attempt_no, checked_at,
                kind(JOB_POLL|CONDITION_CHECK|POST_CHECK), name,
                api_result(OK|ERROR), observed(RUNNING|SUCCEEDED|FAILED|MET|NOT_MET),
                error_code, latency_ms, external_job_id, detail(jsonb)
                -- one row per external call: the "did the call itself succeed,
                -- and what did it say" record (D6). `detail` holds small
                -- excerpts/references only (e.g. a Terraform log pointer).

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
  `error_code` extraction. Every poll is persisted as a `task_check` row (D6).
- **ConditionAdapter** (WAIT_EXTERNAL, and any call that returns no `job_id`):
  call a provider-specific check API every `polling_interval` and judge
  done/not-yet with a predicate. Per requirements §4.4.3, "not yet" is not a
  failure; only a check-API error increments `fail_count`. Every check call —
  met, not-yet, or error — is persisted as a `task_check` row (D6).
- **Post-completion checks** (0..N per task, best-effort): a task definition
  may list verification calls that run after the task reaches DONE — e.g.
  fetch the Terraform log via API, capture a final status snapshot. They
  execute once each (no retry) with their own call timeout (default 60 s),
  **do not gate the successor task** (the pipeline advances immediately), and
  **never** affect task/pipeline state or `fail_count`. The outcome is
  recorded as `task_check` kind=POST_CHECK — on failure just the simple reason
  (`error_code`), on success an optional excerpt/reference in `detail`.

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

### D6. Timestamps, history, and queryability

History is recorded at **four grains**, all append-only — never overwritten:

| Grain | Table | One row per |
|---|---|---|
| Run | `pipeline` | install/delete execution per target source |
| Step | `task` | task within a run (current state + timings) |
| Attempt | `task_attempt` | execution attempt (dispatch → terminal), incl. run-API call failures |
| Observation | `task_check` | every external status call — TerraformJob poll or condition/WAIT_EXTERNAL check — with `api_result` (did the call succeed) and `observed` (what it reported) |

What gets recorded when:

| Lifecycle moment | Recorded as |
|---|---|
| Pipeline created / started / finished | `pipeline` timestamps + `pipeline_event` |
| Task state transition | `task` update + `pipeline_event` |
| Execution attempt | `task_attempt`: attempt_no, timings, result, `error_code`, `external_job_id` |
| Each job status poll | `task_check` kind=JOB_POLL: `api_result`, observed RUNNING/SUCCEEDED/FAILED, latency |
| Each condition / WAIT_EXTERNAL check | `task_check` kind=CONDITION_CHECK: `api_result`, observed MET/NOT_MET (an `api_result=ERROR` also bumps `fail_count`) |
| Each post-completion check | `task_check` kind=POST_CHECK: `api_result`, simple failure reason or success excerpt/reference in `detail` — never affects state |
| Notification dispatch | `pipeline_event.notified_at` |

This makes "did the execution succeed", "did the success-confirming poll call
itself succeed", and "what did every check observe" first-class queryable
facts — not log-file archaeology.

**Query surface** — one list endpoint plus drill-downs, feeding both the board
and the history views:

- `GET /admin/pipelines?targetSourceId=&provider=&type=&status=&from=&to=&cursor=`
  — cross-cutting query. Period filtering uses **overlap semantics**: a run
  matches if it was active at any point in `[from, to]`
  (`started_at <= to AND (finished_at IS NULL OR finished_at >= from)`).
  Per-target history is this same endpoint filtered by `targetSourceId`.
- `GET /admin/pipelines/{id}` — run detail with task states.
- `GET /admin/pipelines/{id}/tasks/{taskId}/history` — merged attempt + check
  timeline for one task, paginated.

The merged task timeline is the **incident-investigation surface**: one
ordered view of every external interaction — dispatch attempts, job polls,
condition checks, post-completion checks — each with its outcome and, on
timeout, *which* timeout layer fired (`CALL_TIMEOUT` vs `EXECUTION_TIMEOUT`
vs TTL `EXPIRED`, D11). Investigating an issue never requires log-file access.

Indexes to match: `pipeline(target_source_id, started_at DESC)`,
`pipeline(started_at)`, `task_check(task_id, checked_at)`,
`pipeline_event(pipeline_id, created_at)`.

- Also recorded: `next_check_at`, so the admin sees "다음 확인 14:32" instead
  of guessing the polling schedule.
- A denormalized per-target summary (`last_install_run_at`, `last_delete_run_at`,
  last result, running pipeline id) feeds list views without scanning history.
- **Retention**: `pipeline` / `task` / `task_attempt` / `pipeline_event` are
  kept indefinitely (runs are rare per target). `task_check` is the only table
  that grows with polling cadence — bounded (a 7-day WAIT_EXTERNAL at 10-min
  cadence ≈ ≤1,008 rows; a 30-min job at 30–60 s polls ≈ ≤60 rows) — default
  retention 90 days, admin-tunable, pruned by the reconciler. The board's
  "완료" card still defaults to the last 7 days per the requirements wireframe;
  older runs live in the history view.

### D7. Notifications: event-log-driven, channel-pluggable

- The `pipeline_event` row written in the same transaction as a state change is
  the single source of notifications (**transactional outbox**) — no lost or
  duplicated alerts, and the audit log is the same data.
- A notifier loop consumes events where `notified_at IS NULL` (claimed via
  `FOR UPDATE SKIP LOCKED`, so N pods share the work without a leader),
  resolves routing, and fans out through a `NotificationChannel` interface.
  Push channels are at-least-once; the in-app center is exactly-once by
  construction — the event row itself is what it renders.
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
| WORKER_OUTAGE_SUSPECTED / WORKER_RECOVERED — one rolled-up alert, not per task (D13) | critical / info | in-app |
| SETTINGS_CHANGED (N, defaults) | info | in-app |

### D8. Admin console composition (delta on v14)

v14 already renders the pipeline board (summary cards, sequence panel, table).
Operating principle: **the board is read-mostly** — routine operation,
transient failures, BFF restarts, and worker outages self-heal without admin
action (D12, D13); buttons are escape hatches, not duties. This ADR adds:

1. **Board header**: TF slot gauge (`실행 중 n / N`) + waiting-queue card
   (count, oldest wait time).
2. **Row / task panel**: next-check countdown; queue position for WAITING_SLOT;
   **[지금 확인]** force-check button (one-shot immediate poll, rate-limited,
   audited as `actor=human`) — the escape hatch from the ≥10 min cadence.
3. **Task panel**: attempt history (timestamps, error codes), the per-call
   check log (every poll/check/post-check with `api_result` + `observed`,
   paginated), post-completion check results (e.g. Terraform log
   excerpt/reference from `detail`), and a read-only TerraformJob drill-down
   listing the job's internal tasks.
4. **TargetSource 상세 · 설치 관리 탭**: last install/delete run summary
   (time, result) plus the target's full run-history list — row click opens
   the run detail with its task → attempt → check drill-down.
5. **Notification center** (bell) and a **settings page** (N, default
   polling/TTL/max_fail_count, execution timeout, `task_check` retention,
   queue-wait threshold, future channel routing).
6. **History**: pipeline events merge into the 변경 이력 tab — requirements
   §9.10 already lists pipeline start/fail/done there; same event stream.
7. **Run-history view**: the board gains a history mode — period picker
   (overlap semantics), provider/type/status/target filters, pagination —
   backed by the same list endpoint as the board (D6).

### D9. AI-ready management plane

Rules that make later AI operation an addition, not a rewrite:

- **R-AI1 — UI = API parity.** Every admin action is a public BFF admin API
  (the §5 assumed list); the UI holds no behavior of its own. An AI operator is
  just another API principal with scoped permissions.
- **R-AI2 — Machine-readable events.** Every transition carries a reason code.
  Error taxonomy: `TRANSIENT_INFRA | AUTH | QUOTA | TF_ERROR | CALL_TIMEOUT |
  EXECUTION_TIMEOUT | WORKER_OUTAGE | EXTERNAL_NOT_READY | UNKNOWN` — the two
  timeout codes distinguish "the API call itself hung" from "the job ran too
  long" (D11); `WORKER_OUTAGE` marks systemic downstream failure (D13). This
  log is simultaneously audit trail, notification source, and future
  diagnosis/training data.
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

- The pipeline moves to **CANCELLING**: cancellation gates the state machine's
  *forward* edges only (readying, dispatching, retrying, breaker requeue) —
  never its *drain* edges (recording a returned `job_id`, polling a running
  job to terminal). Tasks not yet dispatched are CANCELLED immediately.
- An in-flight TerraformJob runs to its natural end (or to execution timeout)
  and **keeps holding its TF slot until then** — the cap protects Infra
  Manager, and that job is genuinely still consuming worker capacity. When it
  reaches a terminal state, the pipeline finalizes to CANCELLED.
- The board shows "중단 중 · 실행 중 job 종료 대기" while the last job drains.
  Its final status is recorded on the task attempt for history but no longer
  affects pipeline state.
- Race-by-race concurrency analysis and the implementing interfaces live in
  `design/pipeline-interfaces.md` §5. Conclusion: cancellation cannot fail or
  leak (no double transition, no slot leak, no orphan job) — it can only be
  late, bounded by the execution timeout.

### D11. Timeout budget — no unbounded wait anywhere

Every layer that can hang has an explicit deadline:

| Layer | Scope | Default | On expiry |
|---|---|---|---|
| Per-call HTTP deadline | every external call: run API, job poll, condition check, post-check | 30 s (post-check 60 s) | call recorded as `CALL_TIMEOUT` on the attempt / `task_check` row |
| Dispatch recovery | DISPATCHING age without a stored `job_id` | 5 min | re-dispatch (at-least-once, D5) |
| Execution timeout | EXECUTE task: dispatch → job terminal | 30 min | failed attempt `EXECUTION_TIMEOUT`; TF slot released; fail-count policy (D3) |
| WAIT_EXTERNAL TTL | total dwell time | per task (e.g. 7 d) | task EXPIRED → pipeline FAILED (requirements decision #11) |
| Post-check call | each post-completion check | 60 s, single attempt | simple reason recorded; never affects state (D3) |

How `CALL_TIMEOUT` propagates depends on what was being called:

- **Run API timed out** → the outcome is *unknown* (the job may or may not
  have been issued). This is exactly the D5 dual-write gap: the task stays
  DISPATCHING and the 5-minute recovery re-dispatches; TerraformWorker dedup
  makes the re-call safe.
- **Condition check timed out** → counts as a check-API error
  (`fail_count`++ per requirements §4.4.3).
- **Job status poll timed out** → recorded, retried at the next poll cadence;
  only the execution timeout decides the attempt's fate.
- **Post-check timed out** → recorded with its reason; nothing else happens.

The reconciler runs all external calls with these per-call deadlines and
bounded parallelism, so a single slow upstream cannot stall the tick — the
leader loop's worst-case duration stays predictable even when Infra Manager
hangs.

Two refinements: expiry is judged **after a fresh status read** (D12), so an
outage longer than a timeout cannot fail work that actually completed; and a
timeout that fires while the worker-outage breaker is open is reclassified
`WORKER_OUTAGE` without consuming `fail_count` (D13).

### D12. Crash & multi-replica safety

The orchestrator runs **inside the BFF process** (D1) — the same deployable as
the admin API — so BFF instability is a design input, not an edge case. Two
invariants make it safe:

1. **The DB is the only state, and every transition is a guarded write.** The
   transition function (R1) carries the expected prior state in its `WHERE`
   clause (compare-and-set): a stale or duplicate writer updates zero rows.
   Concurrency degrades to no-ops, never to double transitions.
2. **Every external side effect is safe to repeat.** Run-API re-calls converge
   to one execution (TerraformWorker dedup, D5); job polls and condition
   checks are reads; post-checks are read-only by contract (D3).

Consequently the **leader lock is an efficiency device, not a correctness
device** (R6): if it misfires, the system wastes a few duplicate calls and
no-op writes — state stays consistent.

Crash walkthrough (a pod dies at the worst moment):

| Crash point | Recovery behavior |
|---|---|
| Mid-tick, between tasks | Transitions commit independently; committed ones persist, the rest re-derive next tick. No partial-batch state. |
| After the run-API call, before `job_id` is persisted | Task stays DISPATCHING → the 5-min recovery re-dispatches (D5); worker dedup absorbs the duplicate. |
| After a poll/check response, before recording it | Observation lost; the next cadence re-reads. Reads are idempotent. |
| After a state write, before the notification goes out | The outbox row still has `notified_at IS NULL` → the notifier retries (D7 delivery semantics). |
| While holding the advisory lock | Advisory locks are session-scoped: the dead pod's connection closes, the lock frees itself, another pod wins the next tick. No lease cleanup. |
| During a post-check | May re-run on recovery (read-only by contract); worst case a duplicate `task_check` row. |
| Long outage (hours) | Overdue work fires on the first ticks back, absorbed by bounded parallelism and the N-slot cap. Timeouts are judged after a fresh status read (D11), so completed work is recorded SUCCEEDED, never falsely timed out. An outage delays pipelines; it cannot corrupt or wrongly fail them. |

N-pod walkthrough:

| Concern | Answer |
|---|---|
| Who runs the tick? | Every pod tries `pg_try_advisory_lock` each tick; one wins, the rest skip. Failover is automatic within one tick interval (≤30 s). |
| Split brain (two leaders)? | Only possible via lock-session loss, and harmless: CAS transitions + repeat-safe side effects (R6). |
| Admin API on N pods? | Stateless — any pod serves reads and writes intents (create/retry/cancel/force-check are guarded DB writes); the leader's tick executes them (R2). |
| Notifier on N pods? | Needs no leader: events are claimed with `FOR UPDATE SKIP LOCKED`, so concurrent notifiers share work without double-claiming (D7). |
| Rolling deploy (two versions live)? | Same as split brain, plus `definition_version` pins in-flight runs to the DAG they started with. |
| DB outage / scale to zero? | The orchestrator pauses; TerraformJobs already running in Infra Manager continue unaffected; polls catch up on recovery. Degradation is always delay, never corruption. The BFF DB is the availability anchor — accepted; it already is one for the admin console. |

### D13. Systemic failure: TerraformWorker outage circuit breaker

A single failed job is a task-level event. A **worker outage looks different**:
every dispatched job stops reporting at once. Without a systemic view, the
board would degrade into N independent 30-minute timeouts, N fail-count
retries against a dead worker, and N separate critical alerts — maximum admin
noise for a problem no retry can fix. The operating principle is the opposite
(minimal admin intervention), so the dispatcher carries a **circuit breaker**:

- **Detect (breaker opens).** Primary signal: a dispatched job is not picked
  up within the pickup window (default 5 min) — requires job status to
  distinguish "queued" from "running" (open question O7). Fallback when that
  granularity is missing: ≥3 consecutive `EXECUTION_TIMEOUT`s across distinct
  targets within 15 min.
- **Pause, don't fail.** While open: no new TF dispatches — tasks stay in
  WAITING_SLOT keeping their original FIFO position; running tasks whose
  timeout fires are recorded `WORKER_OUTAGE` and **requeued without consuming
  `fail_count`** — a dead worker is not the task's fault, the same logic as
  WAIT_EXTERNAL's "not yet is not a failure".
- **Probe (half-open).** Every probe interval (default 5 min) one canary
  dispatch goes through; when it gets picked up / reports, the breaker closes
  and the queue drains FIFO automatically. A worker health endpoint, if Infra
  Manager offers one, replaces the canary (O7).
- **Alert once, rolled up.** Opening emits a single critical
  `WORKER_OUTAGE_SUSPECTED` event ("dispatch paused, M tasks waiting") instead
  of M task alerts; closing emits `WORKER_RECOVERED`. The board shows one
  banner with the waiting count; affected rows get a "worker 중단 추정" chip.
- **No new pipeline states.** Pipelines stay RUNNING; only dispatch admission
  is gated. Manual force-resume / force-pause of dispatch exists as an audited
  escape hatch.

Recovery is fully automatic: worker returns → canary succeeds → queue drains →
one recovery notice. Zero admin clicks on the expected path of an outage.

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
in one transaction, (c) carries the expected prior state in the `WHERE` clause
(compare-and-set), so stale or duplicate writers update zero rows. No code
path writes `status` directly.

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
timeout, per-call HTTP deadlines (incl. post-check), breaker thresholds
(pickup window, probe interval), `task_check` retention, and routing live in
DB-backed runtime config, editable in the admin settings page, with
changes audited as events. No redeploy to tune operations.

### R6 — Correctness never depends on the leader lock

Every transition is a compare-and-set (R1); every external side effect is
repeat-safe (D5, D12). The advisory lock only prevents duplicate work. Any
change that makes a transition or side effect unsafe to repeat must bring its
own idempotency mechanism or be rejected in review.

## Consequences

### Positive

- Today's manual, human-sequenced Terraform operation becomes restart-safe
  automation with a visible queue and enforced concurrency.
- Transient failures, BFF crashes/redeploys, and worker outages self-heal
  (fail-count retry, D12 invariants, D13 breaker) — the board is read-mostly
  and admin intervention is the exception, not the routine.
- Execution history at every grain (run → task → attempt → individual
  poll/check), last-run timestamps, audit trail, and notifications all derive
  from the same append-only recording discipline — no second bookkeeping
  system, no log-file archaeology.
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
- The observation log (`task_check`) writes a row on every poll/check. Volume
  is bounded by cadence and pruned by retention, but it is real DB traffic a
  log-file approach would not create (accepted — queryability is the
  requirement).

## Open questions

| # | Question | Default until answered |
|---|---|---|
| O4 | Scheduled (cron-style) pipeline runs in scope? | Out of scope; `triggered_by` and the event model leave room. |
| O5 | UI label for TerraformJob internal tasks vs pipeline Task (naming collision) | Drill-down panel titled "Terraform Job 상세 단계"; confirm with UX. |
| O7 | Does TerraformJob status distinguish "queued (not yet picked up)" from "running"? Is there a worker health endpoint? Determines the breaker's primary detection signal (D13). | Fallback signal: ≥3 consecutive `EXECUTION_TIMEOUT`s across distinct targets within 15 min opens the breaker; canary dispatch probes recovery. |

### Resolved (2026-06-12, with the platform owner)

| # | Resolution |
|---|---|
| O1 | `terraform_job_id` is issued server-side per request and handed to TerraformWorker via pubsub; duplicates execute once; lost worker results are absorbed by the execution timeout. → D3, D5 |
| O2 | No cancel API exists — cancellation never kills an in-flight job. → D10 |
| O3 | Slot queue stays global FIFO, no priority classes. → D4 |
| O6 | N=10 (raised from the N=3 proposal), execution timeout 30 min, queue-wait alert 30 min, dispatch timeout 5 min — all runtime-tunable. → D4, D8, R5 |
| A1 | The ≥10-minute guard applies to WAIT_EXTERNAL checks only; job status polls are system-level 30–60 s. → D3, R3 |

## Affected files

- `design/pipeline-interfaces.md` — companion implementation spec: Java interfaces, cancellation concurrency analysis (Korean)
- `design/pipeline-api.md` — canonical admin API set with rough request/response schemas and error codes (Korean); source for the future swagger
- `design/admin-page-requirements.md` — §4.4 model source; §5 assumed admin API list (pipeline endpoints will become swagger specs)
- `design/SIT Prototype Athena v14.html` — pipeline board exists; D8 deltas target the next prototype revision
- `docs/swagger/` — future `admin-pipelines.yaml` (create/board/retry/cancel/force-check/task PATCH/settings/notifications)
- `docs/cloud-provider-states.md` — provider install/delete sequences the DAG definitions encode
