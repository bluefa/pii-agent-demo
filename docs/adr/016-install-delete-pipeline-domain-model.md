# ADR-016: Install/Delete Pipeline — Durable State-Machine Domain Model

## Status

Proposed — 2026-06-27.

The **domain half** of the install/delete pipeline design: the durable state, data model,
uniqueness rule, failure semantics, and lifecycle. The **execution model** — how the state
machine is driven forward (runner, worker pool, concurrency, crash recovery) — is a separate,
independently-revisable decision in [ADR-021](021-pipeline-execution-model.md), so the
execution strategy can change without re-opening the domain model.

## Context

Today, installing or deleting a customer's infrastructure means an operator manually runs
Terraform jobs through **InfraManager** from a browser session. We want this automated: started
from the Admin console, then carried to completion on its own — surviving restarts — with a
visible run history.

- **Admin console** creates a pipeline, then closes; no browser stays open.
- **The orchestrator** drives the pipeline forward (its runtime is [ADR-021](021-pipeline-execution-model.md)).
- **InfraManager** runs Terraform jobs asynchronously: it returns a job id, and a Kubernetes
  worker pod runs the apply later.
- **BackendManager** owns integration/approval and target-source data.

Scale: ~2,000 targets; ~12 pipeline shapes (provider × install/delete). Terraform jobs run for
**minutes**; condition checks poll for seconds to days.

Constraints:

1. InfraManager has **no de-duplication** — the same job submitted twice runs twice — but every
   execution API is **idempotent**, so the infrastructure result is unharmed.
2. Results can be lost (rare worker failure); we do not distinguish "still running" from "lost"
   — an execution timeout absorbs both.

## Decision

### 1. The database is the only state

The pipeline's state lives in database rows; there is no in-memory authority to lose. Whatever
runs the pipeline (ADR-021) is stateless with respect to progress — it reads the rows and
resumes. Every decision below depends on this.

### 2. Two domain tables, a small durable state machine

`pipeline` and `task` are the **domain state tables** (schema in spec §6).

```
Task:      BLOCKED ──▶ READY ──▶ IN_PROGRESS ──▶ DONE | FAILED | CANCELLED
Pipeline:  RUNNING ─────────────────────────▶ DONE | FAILED | CANCELLED
```

The **current task** is the lowest-`seq` `READY`/`IN_PROGRESS` task; tasks ahead of it are
explicitly `BLOCKED` until their predecessor reaches `DONE` (a task is created BLOCKED and
flips to READY; the first task starts READY). Pipeline status is a stored projection, written
in the same transaction as the task transition that changes it, so a scan can filter on it
cheaply.

Five core enums (`TaskStatus`, `PipelineStatus`, `TaskKind`, `PipelineType`, `ErrorCode`), plus
a conditional `TaskOperation` when the operation set is closed (an open set is registry-validated).
A task's `kind` selects the executor; its `operation` selects the domain action within it. A
pipeline's recipe (its ordered task list) is a code default per `(type, provider)`.

### 3. Observation is separate from state

Two **observation tables** — `task_attempt` (per-retry-attempt outcome) and `task_check`
(per-attempt poll summary) — carry what an operator needs to first-diagnose a failure: which job
ran per attempt, the final outcome, whether a TTL-expired condition was NOT_MET vs API-failed,
poll counts, the last external response. They are **write-only**: the reconciler never reads
them, and losing them costs only debuggability, never correctness (spec §6.1). They add no state
and no enum.

### 4. One active pipeline per target

A uniqueness rule allows only one non-terminal pipeline per target. A duplicate create — of any
type — returns the existing active run rather than erroring; the trigger endpoint must honor
this **contract**. It is the premise that lets ADR-021 reason about a single owner per pipeline.

### 5. Correctness rests on idempotency, not exactly-once

Every dispatch is idempotent: a duplicate submit still leaves the infrastructure correct
("already in the desired state" counts as success). This lets the execution model be
**at-least-once** and still correct — a crash between "InfraManager started the job" and "we
stored the job id" is healed by re-dispatch — and lets the state machine drop a `DISPATCHING`
state.

### 6. Bounded waiting and retry

- `fail_count` per task. A failed dispatch or poll increments it; below `maxFailCount` the task
  re-runs as a **fresh run** (completed work is a no-op — Terraform converges), at or above it
  the task is `FAILED`.
- Two deadlines: a **per-call** timeout and a **per-task** `executionTimeout` (TF) / `ttl`
  (condition); both map to canonical `ErrorCode` values, not separate states.
- No circuit breaker — a systemic failure is delay (timeout + retry + alert), not corruption.

### 7. Minimal lifecycle

Two task kinds (`TERRAFORM_JOB`, `CONDITION_CHECK`). **Retry is a fresh run.** **Cancel**
converges directly to `CANCELLED` — there is no `CANCELLING` state — and terminalizes every
non-terminal task (`BLOCKED`/`READY`/`IN_PROGRESS` → `CANCELLED`); a `FAILED` pipeline marks the
failing task `FAILED` and the rest `CANCELLED`. A terminal state is never resurrected. *How*
cancel is applied against a live worker is an execution concern (ADR-021).

## Considered Options

| Option | Verdict | Why |
|---|---|---|
| **A. Durable DB state machine — two domain tables, status is the row** | **Chosen** | The row *is* the state; restart-safe; idempotency makes at-least-once execution correct. |
| B. Maximal model (observation ledger, attempt log, event outbox, snapshots; 6 tables) | Rejected | Far too large for "run an ordered chain of two task kinds for one target" (see history). |
| C. One row with an embedded JSON task list | Rejected | Loses per-task query/index (current task, due scan, retry counts); a child `task` table is cheaper. |

## Consequences

**Good**

- Current state is one rule: the row. Self-heals across crashes and redeploys via idempotent
  re-dispatch — no exactly-once machinery.
- Small and stable: two domain tables, five core enums, two task kinds. The model is unchanged
  when the execution strategy (ADR-021) changes.

**Costs we accept**

- No full per-call audit ledger or event outbox. Audit = logs/metrics + the `pipeline`/`task`
  rows + the two observation tables. Worker-outage and queue-wait alerts are deferred.
- Per-target uniqueness rejects a concurrent INSTALL and DELETE for the same target by
  construction — intended, not a limitation.

## Links

- [minimal-redesign.md](../../design/pipeline/minimal-redesign.md) — canonical spec (schema §6, invariants §6.1, enums §7)
- [ADR-021](021-pipeline-execution-model.md) — the execution model that drives this state machine
- [adr-016-history.md](../../design/pipeline/adr-016-history.md) — design history & rationale (maximal → minimal, revisions)
- Related: ADR-006 (confirmation model), ADR-009 (process status). A pipeline runs between CONFIRMED and INSTALLED.

## Glossary

- **InfraManager** — runs Terraform jobs (async; returns a job id; a worker pod runs the apply).
- **BackendManager** — the integration/approval and target-source service.
- **Terraform job** — one infrastructure apply; runs for minutes.
- **Current task** — the lowest-`seq` `READY`/`IN_PROGRESS` task of a RUNNING pipeline.
