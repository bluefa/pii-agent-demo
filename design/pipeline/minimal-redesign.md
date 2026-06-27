# Minimal Installation Pipeline — Redesign

> Status: Adopted minimal direction (owner-approved, 2026-06). Supersedes the maximal
> parts of ADR-016 — ADR-016 is rewritten to match. Execution model: multi-worker
> claim-pull (ADR-021). Still pre-merge (PR #494).

## 0. Why re-scope

ADR-016 maximized every axis at once — durability, observation history,
backpressure cooperation, an event outbox, multi-replica leadership, per-task
knob freezing. The faithful implementation is **9 task states, 14 enums (68
values), 6 tables, ~3,766 lines**. For a tool whose job is "install/delete infra
for one target by running an ordered chain of two task kinds", that surface does
not fit in one engineer's head. This draft keeps the essential job and removes
the maximal extras. Each removal names what is lost (§8) so the trade is explicit.

## 1. Scope

Run an ordered chain of tasks for **one target** to **INSTALL or DELETE** infra.
Each task is a `TERRAFORM_JOB` (run a TF job, poll until it finishes) or a
`CONDITION_CHECK` (poll until a condition is met). Survive process restart. Never
run two active pipelines for the same target. Retry a task a few times, then
fail it. Cancel a running pipeline.

## 2. State machine

```
Task:      BLOCKED ──▶ READY ──▶ IN_PROGRESS ──▶ DONE | FAILED | CANCELLED
Pipeline:  RUNNING ─────────────────────────▶ DONE | FAILED | CANCELLED
```

- **BLOCKED** — a non-terminal task whose predecessor has not completed. Explicit
  (stored), not derived: a task is created BLOCKED and flips to READY when the prior
  task reaches DONE. The first task of a pipeline starts READY.
- **READY** — the current task: the lowest-`seq` startable task (predecessor DONE).
  Exactly one READY task per RUNNING pipeline at a time.
- **IN_PROGRESS** — dispatched and polling. The task `kind` selects the poll
  logic (TF job status vs. condition probe). One state for both kinds.
- **DONE / FAILED / CANCELLED** — terminal. FAILED carries an `errorCode`
  (`JOB_FAILED | EXECUTION_TIMEOUT | TTL_EXPIRED | CHECK_ERROR | CALL_TIMEOUT`, the §7
  canonical set); the timeout/expiry flavors
  are folded here, not separate states.
- Pipeline cancel is applied synchronously to its tasks — no intermediate
  `CANCELLING` state.
- Cancel: an **unclaimed** RUNNING pipeline is terminated immediately by CAS (`WHERE
  status='RUNNING'` and no live claim, clearing the claim so a straggler can't resurrect it);
  a **claimed** one is flagged (`cancel_requested`) and the single claim-holding worker applies
  `CANCELLED` at report. Either way all non-terminal tasks (`BLOCKED`/`READY`/`IN_PROGRESS`) →
  `CANCELLED`; no concurrent second writer, no terminal resurrection.

## 3. Reconciler loop (one tick, every N seconds)

For each RUNNING pipeline's current task (lowest-seq non-terminal):

- **READY** → dispatch (synchronous, idempotent) → **IN_PROGRESS** (store `job_id`
  for a TF task).
- **IN_PROGRESS** → poll:
  - TF: `SUCCEEDED` → DONE; `FAILED` → retry-or-fail; still running past
    `executionTimeout` → `EXECUTION_TIMEOUT` → retry-or-fail.
  - CONDITION: met → DONE; not met → reschedule `next_check_at`; past `ttl` →
    `TTL_EXPIRED` → FAILED.
- Task DONE → next-seq task flips `BLOCKED → READY` (becomes current). Task FAILED →
  pipeline FAILED (remaining `BLOCKED`/`READY` tasks → CANCELLED). All tasks DONE →
  pipeline DONE.

Dispatch/poll are **synchronous calls with a per-call timeout**, run in a bounded
worker pool. How work is claimed and made multi-worker-safe (claim/lease/guarded
write) is the execution model — see ADR-021.

## 4. Failure / retry / timeout

- `fail_count` per task. A failed dispatch or poll increments it; if
  `fail_count < maxFailCount` the task re-dispatches (a fresh run), else FAILED.
- Two deadlines: a **per-call** timeout (abandon one slow IM call) and a
  **per-task** `executionTimeout` (TF) / `ttl` (condition).
- **Idempotency model (Model X):** TF Job dispatch uses only
  **duplicate-harmless (infra-idempotent)** APIs — InfraManager does **not**
  de-duplicate submissions. `(task_id, attempt_no)` is a **logical attempt
  identity for our own records** (stored in `task_attempt`) — it is NOT an
  InfraManager dedup/idempotency key; IM has no such mechanism.
  - Re-dispatch may create a **duplicate TF job**; that is harmless because the
    TF apply API converges the same infrastructure.
  - **Crash recovery:** a crash between "IM created the job" and "we stored
    `job_id`" means a fresh re-dispatch on restart; record the **latest** `job_id`
    in `task_attempt.job_id` and `task.job_id`. The orphaned pre-crash job runs
    harmlessly.
  - Invariants that follow: a `TERRAFORM_JOB` task that is `IN_PROGRESS` has a
    `job_id`; a `READY` TF task is a dispatch / re-dispatch target; **no
    `DISPATCHING` state** is added. Do not write "get-or-create" or "reclaim
    existing job" — IM cannot reclaim.

## 5. Idempotency & uniqueness

- **One active pipeline per target** — a DB partial-unique on
  `(target, status is non-terminal)`. A duplicate create (of any type) returns
  the existing active run; a concurrent INSTALL and DELETE for the same target is
  nonsensical, so uniqueness is per target, not per (target, type).
- **Crash recovery** — the DB row *is* the state. On restart the reconciler
  resumes each IN_PROGRESS task by re-polling (TF, by `job_id`) or re-dispatching
  (idempotent).

## 6. Data model (4 tables)

**Domain state tables (drive the state machine):** `pipeline`, `task`
**Observation/debug summary tables (write-only; never read by the reconciler):** `task_attempt`, `task_check`

Relationship: `pipeline 1:N task 1:N task_attempt 1:0..1 task_check`

- `pipeline(id, type, target, status, created_at, last_activity_at)`
- `task(id, pipeline_id, seq, kind, operation, status, job_id, fail_count,
  error_code, started_at, ready_at, finished_at,
  next_check_at, ttl, polling_interval, execution_timeout, max_fail_count)`
- `task_attempt(id, task_id, attempt_no, job_id, status, error_code,
  dispatch_response_code, dispatch_response_summary, started_at, finished_at)`
- `task_check(id, task_attempt_id, call_count, not_met_count, api_error_count,
  call_timeout_count, last_external_status, last_response_code,
  last_response_summary, last_checked_at)`

`kind` selects the **executor** (`TERRAFORM_JOB` | `CONDITION_CHECK`); `operation` selects the
**domain action** within that executor. A closed operation set is represented as a
`TaskOperation` enum; an open/configured set must be validated through a registry.

`attempt_no` is derivable from `task.fail_count` (current attempt_no = fail_count + 1)
and is recorded in `task_attempt` for convenience — no new counter column is added to
`task`. `task_check` holds AT MOST ONE row per `task_attempt` (1:0..1) and is updated
in-place on each poll: counters are incremented and `last_*` fields overwritten via
UPDATE. Row count grows with attempts, not polls.

### 6.1 Observation-table invariants

1. **Write-only:** The reconciler/dispatch path NEVER reads `task_attempt` or
   `task_check` to make decisions — correctness depends only on `pipeline` and `task`.
2. **UPDATE-in-place:** `task_check` keeps one row per `task_attempt`; counters are
   incremented, `last_*` fields overwritten. No per-poll row inserts, no RLE, no pruner
   needed.
3. **Losable:** Losing the observation tables degrades debuggability only — the state
   machine, retry logic, and failure semantics are unaffected.

Dropped vs ADR-016: `pipeline_event` (outbox), `pipeline_def_snapshot`.

The execution model (ADR-021) adds coordination columns `next_due_at`, `claimed_by`,
`claimed_until`, and `cancel_requested` to `pipeline` — lease/claim plus cooperative-cancel
metadata for multi-worker safety. Listed for completeness; they are not domain state.

## 7. Enums — reduce the CONCEPT, never the representation

**Hard rule:** the goal is fewer *concepts*, not fewer enum files. A concept that
remains is kept as a first-class `enum` — never re-encoded as a raw `String`, a
constant, or two concepts merged into one. Subtly changing how a concept is
*expressed* (enum → String, or forcing two enums together) is the worst possible
move: it loses type safety and scatters the concept across the code. Enum count
falls only as a *consequence* of cutting whole features (§8) — when the feature
is gone, the code that handled that concept is gone, so its enum is gone too.

Surviving concepts (each stays a clean enum):

| enum | values | concept |
|------|--------|---------|
| `TaskStatus` | BLOCKED, READY, IN_PROGRESS, DONE, FAILED, CANCELLED | task lifecycle |
| `PipelineStatus` | RUNNING, DONE, FAILED, CANCELLED | pipeline lifecycle |
| `TaskKind` | TERRAFORM_JOB, CONDITION_CHECK | what a task does |
| `PipelineType` | INSTALL, DELETE | install vs delete |
| `ErrorCode` | JOB_FAILED, EXECUTION_TIMEOUT, TTL_EXPIRED, CHECK_ERROR, CALL_TIMEOUT | why a task failed (each a real, distinct cause — not compressed) |

5 enums (from 14). The drop is concept elimination (§8), not enum merging.

## 8. Cut from ADR-016 — and what is lost

| Cut | Replacement | Lost |
|-----|-------------|------|
| Async single-writer split (D-T2/D-T4) | synchronous calls in a bounded pool | non-blocking tick under many concurrent slow calls (acceptable at small scale) |
| Full per-poll observation ledger (per-poll `task_check` rows, RLE, attempt-correlation history, pruner) | `task_attempt` (per-retry-attempt final outcome + job id) + `task_check` (1:0..1 per-attempt poll summary, UPDATE-in-place) | Full chronological poll/check history; all intermediate responses; fine-grained audit trail. **Gained:** per-attempt job/result tracking, first-cause classification (TTL-expired = NOT_MET vs API-failed), last-external-response for debugging. |
| Backpressure 4-way + Retry-After | 429/503 treated as a retriable failure | graceful throttle cooperation |
| Outbox events (same-tx `pipeline_event`) | optional log line | guaranteed event delivery to consumers |
| Worker-outage / queue-wait alerts | deferred | operational alerting |
| Knob freeze at creation | global settings (or a plain per-task copy) | in-flight isolation from a config change |

**Kept:** durable DB state, per-target uniqueness, the reconciler scan, retry +
timeouts. Execution is multi-worker claim-pull (ADR-021); cross-process safety comes
from DB claim (`FOR UPDATE SKIP LOCKED`) + lease + guarded writes, not from
single-node execution.

## 9. Estimated size

~27–33 files, ~1,900–2,400 lines (from 67 / 3,766). 5 enums / ~17 values (from 14 / 68).

**4 tables** (pipeline, task, task_attempt, task_check) — up from 2. The state machine
and enum count do **NOT** grow: still 6 task statuses
(BLOCKED/READY/IN_PROGRESS/DONE/FAILED/CANCELLED) and 5 core enums. Only the
data/observability layer grew (two simple INSERT/UPDATE paths on existing code paths).
Holdable in one head:

> A pipeline runs its tasks in order; each task dispatches or checks, polls to
> done or fail, retries a few times. The domain row (pipeline + task) tells the
> whole story; task_attempt and task_check are the operator's debug lens.
