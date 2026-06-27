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
Task:      READY ──▶ IN_PROGRESS ──▶ DONE | FAILED | CANCELLED
Pipeline:  RUNNING ───────────────▶ DONE | FAILED | CANCELLED
```

- **READY** — the lowest-`seq` non-terminal task of a RUNNING pipeline. "Blocked
  by a predecessor" is *derived* (a higher-seq task is simply not picked), never
  stored.
- **IN_PROGRESS** — dispatched and polling. The task `kind` selects the poll
  logic (TF job status vs. condition probe). One state for both kinds.
- **DONE / FAILED / CANCELLED** — terminal. FAILED carries an `errorCode`
  (`JOB_FAILED | EXECUTION_TIMEOUT | TTL_EXPIRED | CHECK_ERROR | CALL_TIMEOUT`, the §7
  canonical set); the timeout/expiry flavors
  are folded here, not separate states.
- Pipeline cancel is applied synchronously to its tasks — no intermediate
  `CANCELLING` state.
- Cancel is recorded as a flag (cooperative request); the single claim-holding worker
  applies `CANCELLED` — no concurrent second writer, no terminal resurrection.

## 3. Reconciler loop (one tick, every N seconds)

For each RUNNING pipeline's current task (lowest-seq non-terminal):

- **READY** → dispatch (synchronous, idempotent) → **IN_PROGRESS** (store `job_id`
  for a TF task).
- **IN_PROGRESS** → poll:
  - TF: `SUCCEEDED` → DONE; `FAILED` → retry-or-fail; still running past
    `executionTimeout` → `EXECUTION_TIMEOUT` → retry-or-fail.
  - CONDITION: met → DONE; not met → reschedule `next_check_at`; past `ttl` →
    `TTL_EXPIRED` → FAILED.
- Task DONE → next-seq task becomes current. Task FAILED → pipeline FAILED. All
  tasks DONE → pipeline DONE.

Dispatch/poll are **synchronous calls with a per-call timeout**, run in a bounded
worker pool. How work is claimed and made multi-worker-safe (claim/lease/guarded
write) is the execution model — see ADR-021.

## 4. Failure / retry / timeout

- `fail_count` per task. A failed dispatch or poll increments it; if
  `fail_count < maxFailCount` the task re-dispatches (a fresh run), else FAILED.
- Two deadlines: a **per-call** timeout (abandon one slow IM call) and a
  **per-task** `executionTimeout` (TF) / `ttl` (condition).
- Idempotency (O28): re-dispatching a TF job is safe — a duplicate submit is
  harmless and "already in the desired state" counts as success. This is what
  lets §2 drop the `DISPATCHING` state: a crash between "IM started the job" and
  "we stored job_id" is recovered by an idempotent re-dispatch.

## 5. Idempotency & uniqueness

- **One active pipeline per target** — a DB partial-unique on
  `(target, status is non-terminal)`. A duplicate create (of any type) returns
  the existing active run; a concurrent INSTALL and DELETE for the same target is
  nonsensical, so uniqueness is per target, not per (target, type).
- **Crash recovery** — the DB row *is* the state. On restart the reconciler
  resumes each IN_PROGRESS task by re-polling (TF, by `job_id`) or re-dispatching
  (idempotent).

## 6. Data model (2 tables)

- `pipeline(id, type, target, status, created_at, last_activity_at)`
- `task(id, pipeline_id, seq, kind, operation, status, job_id, fail_count,
  error_code, started_at, ready_at, finished_at, next_check_at,
  ttl, polling_interval, execution_timeout, max_fail_count)`

Dropped vs ADR-016: `task_check` (observation ledger), `task_attempt` (attempt
history), `pipeline_event` (outbox), `pipeline_def_snapshot`.

The execution model (ADR-021) adds coordination columns `next_due_at`, `claimed_by`,
`claimed_until` to `pipeline` — lease/claim metadata for multi-worker safety. Listed
for completeness; they are not domain state.

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
| `TaskStatus` | READY, IN_PROGRESS, DONE, FAILED, CANCELLED | task lifecycle |
| `PipelineStatus` | RUNNING, DONE, FAILED, CANCELLED | pipeline lifecycle |
| `TaskKind` | TERRAFORM_JOB, CONDITION_CHECK | what a task does |
| `PipelineType` | INSTALL, DELETE | install vs delete |
| `ErrorCode` | JOB_FAILED, EXECUTION_TIMEOUT, TTL_EXPIRED, CHECK_ERROR, CALL_TIMEOUT | why a task failed (each a real, distinct cause — not compressed) |

5 enums (from 14). The drop is concept elimination (§8), not enum merging.

## 8. Cut from ADR-016 — and what is lost

| Cut | Replacement | Lost |
|-----|-------------|------|
| Async single-writer split (D-T2/D-T4) | synchronous calls in a bounded pool | non-blocking tick under many concurrent slow calls (acceptable at small scale) |
| Observation ledger (`task_check` / RLE / attempt correlation / pruner) | `status` + `error_code` on the task | full observation/audit history |
| Backpressure 4-way + Retry-After | 429/503 treated as a retriable failure | graceful throttle cooperation |
| Outbox events (same-tx `pipeline_event`) | optional log line | guaranteed event delivery to consumers |
| Worker-outage / queue-wait alerts | deferred | operational alerting |
| Knob freeze at creation | global settings (or a plain per-task copy) | in-flight isolation from a config change |

**Kept:** durable DB state, per-target uniqueness, the reconciler scan, retry +
timeouts. Execution is multi-worker claim-pull (ADR-021); cross-process safety comes
from DB claim (`FOR UPDATE SKIP LOCKED`) + lease + guarded writes, not from
single-node execution.

## 9. Estimated size

~25–30 files, ~1,800–2,200 lines (from 67 / 3,766). 5 enums / ~17 values
(from 14 / 68). Holdable in one head:

> A pipeline runs its tasks in order; each task dispatches or checks, polls to
> done or fail, retries a few times. One DB row per task tells the whole story.
