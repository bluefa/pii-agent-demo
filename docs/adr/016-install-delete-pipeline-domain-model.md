# ADR-016: Install/Delete Pipeline — Durable State-Machine Domain Model

## Status

Proposed — 2026-06-27.

This is the **domain half** of the install/delete pipeline design: the durable state,
the data model, the uniqueness rule, the failure semantics, and the lifecycle. The
**execution model** — how the state machine is driven forward (the runner, its worker
pool, concurrency, crash recovery) — is a separate, independently-revisable decision in
[ADR-021](021-pipeline-execution-model.md). Splitting them lets the execution strategy
evolve without re-opening the domain model.

The canonical spec is [minimal-redesign.md](../../design/pipeline/minimal-redesign.md).
This supersedes the earlier "maximal" draft (a BFF-internal design with an asynchronous
observation ledger and multi-replica leadership); see **Background** for why.

## Context

Today, installing or deleting a customer's infrastructure means an operator manually runs
Terraform jobs through **InfraManager** from a browser session. We want this automated:
started from the Admin console, then carried to completion on its own — surviving restarts
— with a first-class run history we can show and alert on.

The pieces:

- **Admin console** (UI) creates a pipeline, then closes. No browser stays open.
- **The orchestrator** drives the pipeline forward (its runtime is [ADR-021](021-pipeline-execution-model.md)).
- **InfraManager** runs Terraform jobs (asynchronous: returns a job id; a Kubernetes worker
  pod executes the job later).
- **BackendManager** owns integration/approval and target-source data.

Scale: ~2,000 targets; ~12 pipeline shapes (provider × install/delete). Terraform jobs run
for **minutes**; condition checks poll for seconds to days.

Domain constraints:

1. InfraManager has **no de-duplication** — submitting the same job twice runs it twice,
   but every execution API is **idempotent**, so the infrastructure result is unharmed.
2. Results can be lost (rare worker failure). We do not distinguish "still running" from
   "lost"; an execution timeout absorbs both.
3. Run history (per target, per task) and alerting are first-class — see **Consequences**
   for what V1 keeps versus defers.

## Decision

### 1. The database is the only state

The pipeline's state lives in database rows — there is no in-memory authority to lose.
Whatever runs the pipeline (ADR-021) is stateless with respect to progress: it reads the
rows and resumes. Every decision below depends on this.

### 2. The database is a small, durable state machine (2 tables)

`pipeline` and `task` (schema in the spec). The **current task** is the lowest-`seq`
non-terminal task of a running pipeline — "blocked by a predecessor" is derived, not
stored. Pipeline status is a stored projection, updated in the same transaction as the task
transition that changes it, so a scan can filter on it cheaply.

```
Task:      READY ──▶ IN_PROGRESS ──▶ DONE | FAILED | CANCELLED
Pipeline:  RUNNING ───────────────▶ DONE | FAILED | CANCELLED
```

Five enums total (`TaskStatus`, `PipelineStatus`, `TaskKind`, `PipelineType`, `ErrorCode`);
the spec's §7 table is the canonical value list. A pipeline's recipe (its ordered task
list) is a code default per `(type, provider)`.

### 3. One active pipeline per target

A database uniqueness rule allows only one non-terminal pipeline per target. A duplicate
create — of any type — returns the existing active run rather than erroring (the trigger
endpoint must honor this; it is a **contract**, not an implementation detail). Without it,
"one active owner per pipeline" — the premise behind idempotent reasoning in ADR-021 (a
worker claims a pipeline before driving it forward) — breaks. (ADR-021 enforces single
ownership via a claim/lease; the uniqueness rule ensures only one pipeline exists to own.)

### 4. Correctness rests on idempotency, not exactly-once

Every dispatch is idempotent: a duplicate submit leaves the final infrastructure state
correct ("already in the desired state" counts as success); it may create extra downstream
work, which V1 accepts. This is the property that lets the execution model (ADR-021) be
**at-least-once** and still be correct — a crash between "InfraManager started the job" and
"we stored the job id" is healed by re-dispatch. It also lets the state machine drop a
`DISPATCHING` state.

### 5. Bounded waiting and retry semantics

- `fail_count` per task. A failed dispatch or poll increments it; below `maxFailCount` the
  task re-dispatches as a **fresh run** (not a resume — completed work is a no-op because
  Terraform converges), at or above it the task is `FAILED`.
- Two deadlines bound waiting: a **per-call** timeout (one slow InfraManager call) and a
  **per-task** `executionTimeout` (TF) / `ttl` (condition). Both map to canonical
  `ErrorCode` values, not separate states.
- There is no circuit breaker; a systemic failure is delay (timeout + retry + alert), not
  corruption.

### 6. Minimal lifecycle

Two task kinds only — `TERRAFORM_JOB` and `CONDITION_CHECK`. **Retry is a fresh run**, not
a resume. **Cancel** stops forward progress directly and converges to `CANCELLED` — there
is no intermediate `CANCELLING` state.

Cancel is a **cooperative request**: it is recorded out-of-band as a flag (which also wakes
the pipeline) and does not write task/pipeline status directly. The claim-holding worker is
the **single writer** of task/pipeline status and applies `CANCELLED` itself when it observes
the flag. The domain invariant — cancel converges to `CANCELLED`; no `CANCELLING` state; no
terminal resurrection — is therefore upheld by single-writer cooperation, not by guarding
every write against a concurrent status writer. The execution mechanism (the
`cancel_requested` flag and worker application) lives in ADR-021.

## Considered Options

| Option | Verdict | Why |
|---|---|---|
| A. Durable DB state machine, 2 tables, status as the row | **Chosen** | The row *is* the state; restart-safe; idempotency makes at-least-once execution correct. |
| B. Maximal model (observation ledger, attempt log, event outbox, definition snapshots, 6 tables / 14 enums) | Rejected (was the earlier draft) | ~3,700 lines for "run an ordered chain of two task kinds for one target." Did not fit in one head; audit is served by logs/metrics instead. |
| C. One row with an embedded JSON task list | Rejected | Loses per-task query/index (current task, due scan, retry counts); a child `task` table is cheaper than re-deriving it. |

## Consequences

### Good

- Current state is one rule: the row. The rest is logs/metrics.
- **Self-heals** across crashes and redeploys — idempotency (Decision 4) makes re-dispatch
  safe, so the execution model never needs exactly-once machinery.
- A small model: two tables, five enums, two task kinds, retry = fresh run.
- The domain model is **stable under execution changes** — whatever execution strategy ADR-021
  uses (it is currently multi-worker claim-pull), these exact tables and states are unchanged.

### Costs we accept

- The maximal design's **full per-call audit ledger and event outbox are dropped.** V1's
  audit answer is logs and metrics plus the `pipeline`/`task` rows. Worker-outage and
  queue-wait alerts are deferred. If row-level "attempted vs not attempted" evidence is
  later needed, an optional `last_requested_at` task column can be added (not in V1 schema).
- Per-target uniqueness means a concurrent INSTALL and DELETE for the same target is
  rejected by construction. That is intended (it is nonsensical), not a limitation.

## Links

- [minimal-redesign.md](../../design/pipeline/minimal-redesign.md) — canonical spec (data model §6, uniqueness §5, enums §7)
- [ADR-021](021-pipeline-execution-model.md) — the execution model that drives this state machine
- Related: ADR-006 (3-object confirmation model), ADR-009 (process status model). A pipeline runs between CONFIRMED and INSTALLED.

## Glossary

- **InfraManager** — runs Terraform jobs (asynchronous; returns a job id; a Kubernetes worker pod executes the apply).
- **BackendManager** — the integration/approval and target-source service.
- **Terraform job** — one infrastructure apply; runs for minutes.
- **Current task** — the lowest-`seq` non-terminal task of a RUNNING pipeline.

## Background (why the design moved)

This ADR first went through a **maximal** phase: an asynchronous single-writer split, an
observation ledger (`task_check`), an attempt log, an event outbox, multi-replica
leadership, and per-task knob freezing — about 9 task states, 14 enums, 6 tables, ~3,700
lines. We re-scoped to the minimal spec (5 enums, 2 tables) and, separately, to a single
execution model (ADR-021). This ADR is the durable-domain residue of that re-scope: the
part that does **not** change when the execution strategy changes.

## Revision history

- 2026-06-11 → 06-21: maximal drafts. Detail removed; see git history if needed.
- 2026-06-27: re-scoped to the minimal spec; **split** — domain model kept here, execution
  model moved to ADR-021.
