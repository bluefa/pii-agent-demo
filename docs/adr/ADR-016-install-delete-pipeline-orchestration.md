# ADR-016: Install/Delete Pipeline Orchestration on a Dedicated Server

## Status

Proposed — 2026-06-27.

This supersedes the earlier "maximal" draft of this ADR (a BFF-internal design with
an asynchronous observation ledger and multi-replica leadership). The canonical
spec is now [minimal-redesign.md](../../design/pipeline/minimal-redesign.md); the
execution model is the [Single Pipeline Tick proposal (PR #509)](https://github.com/bluefa/pii-agent-demo/pull/509).
See **Background & rationale** for why the design moved.

## Context

Today, installing or deleting a customer's infrastructure means an operator manually
runs Terraform jobs through **InfraManager** from a browser session. We want this
automated: started from the Admin console, then carried to completion on its own —
surviving restarts — with a first-class run history we can show and alert on.

The pieces:

- **Admin console** (UI) creates a pipeline, then closes. No browser stays open.
- **The orchestrator** (this ADR) drives the pipeline forward.
- **InfraManager** runs Terraform jobs (asynchronous: it returns a job id and a
  Kubernetes worker pod executes the job later).
- **BackendManager** owns integration/approval and target-source data.

Scale: ~2,000 targets; ~12 pipeline shapes (provider × install/delete). Terraform
jobs run for **minutes**; condition checks poll for seconds to days.

Fixed constraints:

1. **The orchestrator runs as a dedicated server** (decided), not inside the BFF.
   The Admin console creates a pipeline through its API; after that the pipeline
   advances with no browser open.
2. InfraManager's "run" API is **asynchronous** — it returns a job id and a worker
   executes it later. Some calls have no job id and are judged by a condition.
3. InfraManager has **no de-duplication** — submitting the same job twice runs it
   twice, but every execution API is **idempotent**, so the infrastructure result
   is unharmed.
4. Results can be lost (rare worker failure). We do not distinguish "still running"
   from "lost"; an execution timeout absorbs both.
5. InfraManager's own fixed worker pool is the real ceiling on concurrent Terraform
   jobs. The orchestrator does not need its own hard cap in V1.
6. Run history (per target, per task) and alerting are first-class — but see
   **Consequences** for what V1 keeps versus defers.

## Decision

Listed most load-bearing first. Items 1–6 are the architecture; the throttle/sizing
knobs that used to sit alongside them are demoted to **Safety mechanisms** below,
because their values churn and they are not architectural choices.

### 1. A dedicated server owns the orchestration; the database is the only state

A single dedicated server runs a durable state machine. The database row **is** the
state — there is no in-memory authority to lose. On restart the server reads the
rows and resumes. This is the one decision everything else depends on.

### 2. The database is a small, derived state machine (2 tables)

`pipeline` and `task` (schema in the spec). The **current task** is the lowest-`seq`
non-terminal task of a running pipeline — "blocked by a predecessor" is derived, not
stored. Pipeline status is a stored projection, updated in the same transaction as the task
transition that changes it, so the scan can filter on it cheaply.

```
Task:      READY ──▶ IN_PROGRESS ──▶ DONE | FAILED | CANCELLED
Pipeline:  RUNNING ───────────────▶ DONE | FAILED | CANCELLED
```

Five enums total (`TaskStatus`, `PipelineStatus`, `TaskKind`, `PipelineType`,
`ErrorCode`); the spec's §7 table is the canonical value list. The pipeline's recipe (its ordered task list) is a code default per
`(type, provider)`.

### 3. One active pipeline per target

A database uniqueness rule allows only one non-terminal pipeline per target. A
duplicate create — of any type — returns the existing active run rather than erroring
(the trigger endpoint must honor this; it is a contract, not an implementation
detail). Without it, "one runner per target" — the premise behind single-writer and
idempotent reasoning — breaks.

### 4. Execution model: a single server with a bounded worker pool

The server (one instance) scans the pipelines that are due, and hands each to a
**bounded worker pool**. Each worker makes **one synchronous external call** for that
pipeline's current task and commits the resulting state transition in **one database
transaction**. Because there is one server (plus an in-memory "in-flight" guard), one
pipeline is only ever worked by one worker — the **single writer is in-process**, so
there is no row lease, no ownership check, and no leader election. Each external API call is short — it returns a job id or a status, not the job's
result; a Terraform job runs for minutes but is **polled across scans**, never blocked
on. A slow API call (bounded by the per-call timeout) ties up only its own worker
thread, and the pool size is the limit on concurrent calls. (Mechanism detail: PR #509.)

### 5. Safe under at-least-once dispatch

Correctness comes from **idempotency by construction**, not an exactly-once machine.
Every dispatch is idempotent (a duplicate submit leaves the final infrastructure state
correct — it may create extra downstream work, which V1 accepts; "already in the
desired state" counts as success), so a crash between "InfraManager started the job" and "we
stored the job id" is healed by re-dispatch. Two deadlines bound waiting: a per-call
timeout (abandon one slow call) and a per-task execution timeout / TTL.

### 6. Minimal lifecycle

Two task kinds only — `TERRAFORM_JOB` and `CONDITION_CHECK`. **Retry is a fresh run**,
not a resume (no terminal resurrection; completed work is a no-op because Terraform
converges). **Cancel** stops forward progress directly and converges to `CANCELLED` —
there is no intermediate `CANCELLING` state.

### Safety mechanisms & tuning knobs (not architectural decisions)

These keep the system stable; their exact values live in operational config, not
here:

- **Worker-pool size N** caps *concurrent external calls* (`≤ min(N, due pipelines)`).
  It is **not** a requests-per-second guarantee — V1 has **no hard QPS limiter**.
  `429`/`503` responses back off by pushing the task's next check time.
- **Terraform-job concurrency cap** is **deferred** to a later version. InfraManager's
  fixed worker pool is the real ceiling, and over-submission only deepens its queue
  (harmless because dispatch is idempotent). Add a client-side cap only if a concrete
  need appears.
- **Timeouts and TTLs** prevent unbounded waits. There is no circuit breaker; a
  systemic failure is handled as delay (timeout + retry + alert), not corruption.

## Considered Options

| Option | Verdict | Why |
|---|---|---|
| A. Dedicated server, durable DB reconciler | **Chosen** | Matches the workload; restart-safe; one writer, no leader election; minimal moving parts. |
| B. Keep it inside the BFF as a module | Rejected (was the earlier choice) | The BFF scales out for request traffic; a single-writer reconciler wants its own deployment. Splitting it out removes leader election entirely. |
| C. Workflow engine (Temporal / Airflow / broker) | Rejected | A 2–4 step linear chain of minute-scale polls does not justify the operational cost; V1 owns its own retry/polling/visibility instead. |
| D. In-memory async chain | Rejected | Loses runs on restart/deploy; cannot durably express multi-day waits. |

## Consequences

### Good

- Manual, operator-sequenced Terraform work becomes **restart-safe automation** with a
  visible queue.
- **Self-heals** across crashes, redeploys, and worker outages (retry, timeout,
  idempotent re-dispatch).
- One record-keeping rule: current state is the row; the rest is logs/metrics.
- Absorbs slow external API calls without stalling the scan, via the worker pool (a
  minutes-long Terraform job is polled across scans, not waited on).
- A small model: two task kinds, retry = fresh run.

### Costs we accept

- A **single server has no high-availability and no horizontal scale.** A crash or
  deploy pauses progress briefly — with **no data loss** (durable DB + idempotent
  re-dispatch). This is fine at this scale; **active-active** (a multi-pod claim/lease
  design) is the documented upgrade path (PR #509 §8.1) if scale or HA is needed later.
- The maximal design's **full per-call audit ledger and event outbox are dropped.**
  V1's audit answer is the dedicated server's **logs and metrics**: the `pipeline` and
  `task` rows give visible run state and history, and timeout/failure metrics drive
  alerting. Worker-outage and queue-wait alerts are **deferred**. If row-level
  "attempted vs not attempted" evidence is later needed, an optional `last_requested_at`
  task column can be added (it is not in the V1 schema).

## What this gives the product

- A pipeline runs to completion with no browser open.
- Every target's run history is visible.
- What happened on each task is auditable — through the server's logs and metrics.
- Nothing waits forever; timeouts and TTLs bound every step.
- A restart never loses a run, and re-running a dispatch is always safe.

## Background & rationale (why the design moved)

This ADR first went through a **maximal** phase: an asynchronous single-writer split,
an observation ledger (`task_check`), an attempt log, an event outbox, multi-replica
leadership, and per-task knob freezing — about **9 task states, 14 enums, 6 tables,
~3,700 lines**. For a job that is "run an ordered chain of two task kinds for one
target," that surface did not fit in one engineer's head.

We re-scoped to the minimal spec (5 enums, 2 tables;
[minimal-redesign.md](../../design/pipeline/minimal-redesign.md)), then picked the
simplest execution model that still tolerates **unbounded external-call latency**: a
single dedicated server with a bounded worker pool. Two large mechanisms fell away
once we accepted a single server for V1 — the asynchronous observation ledger (the
worker pool gives concurrency without it) and the multi-pod claim/lease coordination
(unnecessary with one writer in one process).

## Links

- [minimal-redesign.md](../../design/pipeline/minimal-redesign.md) — canonical spec
- [PR #509](https://github.com/bluefa/pii-agent-demo/pull/509) — Single Pipeline Tick (single-server execution model)
- Related: ADR-006 (3-object confirmation model), ADR-009 (process status model). A pipeline runs between CONFIRMED and INSTALLED.

## Glossary

- **InfraManager** — the service that runs Terraform jobs (asynchronous; returns a job
  id; a Kubernetes worker pod executes the apply).
- **BackendManager** — the integration/approval and target-source service.
- **Terraform job** — one infrastructure apply; runs for minutes.
- **Reconciler / scan** — the periodic pass that advances each running pipeline's
  current task.
- **Dispatch / poll** — start an external job / check its status.

## Revision history

- 2026-06-11 → 06-21: maximal drafts (durable state machine, async ledger, slot
  admission, definition snapshots). Detail removed; see git history if needed.
- 2026-06-27: re-scoped to the minimal spec and a single-server execution model;
  orchestration moved from the BFF to a dedicated server; throttle/sizing knobs demoted
  to Safety mechanisms; audit trail moved to logs/metrics + an attempt marker.
