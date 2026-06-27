# ADR-021: Install/Delete Pipeline — Single-Server Execution Model

## Status

Proposed — 2026-06-27.

This is the **execution half** of the install/delete pipeline design: how the durable state
machine of [ADR-016](016-install-delete-pipeline-domain-model.md) is actually driven forward.
The domain model (tables, states, uniqueness, lifecycle, idempotency contract) lives in
ADR-016 and does not change when this decision changes. Keeping the runtime model in its own
ADR means a future move to a multi-pod design **supersedes only this ADR**, leaving the
domain model intact.

Detailed mechanism: [single-pipeline-tick proposal (PR #509)](https://github.com/bluefa/pii-agent-demo/pull/509).

## Context

ADR-016 establishes that the database row **is** the pipeline's state and that every
dispatch is idempotent (so at-least-once delivery is correct). What it does not decide is
the runtime: where the orchestrator runs, how many instances, how it finds due work, and how
it bounds concurrent external calls.

The dominant runtime constraint is **unbounded external-call latency**. InfraManager's "run"
API is asynchronous — a short call returns a job id, but the Terraform job it starts runs for
**minutes**, and condition checks poll for seconds to days. The execution model must absorb
that without stalling, and must survive process restarts (ADR-016 guarantees no state is
lost, only that progress pauses).

Operational facts that shape the choice:

- InfraManager has its **own fixed worker pool** — that is the real ceiling on concurrent
  Terraform jobs. The orchestrator does not need its own hard cap in V1.
- Over-submitting to InfraManager is harmless (idempotent; it only deepens InfraManager's
  queue).
- Scale is small: ~2,000 targets, minute-scale jobs. High availability is not a V1 goal.

## Decision

### 1. A dedicated server owns orchestration — not the BFF

The orchestrator runs as its **own deployable server**, not inside the BFF. The BFF scales
out horizontally for request traffic; a single-writer reconciler wants the opposite. Giving
it its own deployment lets us run **exactly one instance** (replicas = 1), which is what
removes leader election entirely. The Admin console creates a pipeline through an API; after
that the pipeline advances with no browser open.

### 2. A single instance with a bounded worker pool

The one server runs a periodic scan: find the pipelines that are **due** (current task READY,
or IN_PROGRESS past its next check time) and hand each to a **bounded worker pool** of size
`N`. Each worker makes **one synchronous external call** for that pipeline's current task and
commits the resulting state transition in **one database transaction**.

Because there is exactly one server (plus an in-memory in-flight guard), one pipeline is only
ever worked by one worker at a time — the **single writer is in-process**. So there is:

- **no row lease**, no `claimed_by` / `claimed_until` columns,
- **no ownership CAS** on write-back,
- **no leader election**, no `FOR UPDATE SKIP LOCKED` claim.

This is the entire payoff of "one instance": the coordination machinery a multi-pod design
would need simply does not exist.

### 3. Short calls, long jobs polled across scans

Each external call is short — it returns a job id or a status, never the job's result. A
minute-scale Terraform job is **polled across successive scans**, never blocked on. A slow
call is bounded by the **per-call timeout** and ties up only its own worker thread; the pool
size `N` is therefore the cap on *concurrent external calls*, and a stuck InfraManager cannot
freeze the scan.

### 4. Crash recovery by re-dispatch, not by recovery log

On restart the server reads the rows (ADR-016) and resumes: an IN_PROGRESS TF task is
re-polled by `job_id`; anything ambiguous is **re-dispatched**, which is safe because
dispatch is idempotent (ADR-016 Decision 4). There is no separate recovery journal — the
state machine plus idempotency is the recovery mechanism.

### Safety mechanisms & tuning knobs (not architectural decisions)

Their exact values live in operational config, not in this ADR:

- **Worker-pool size `N`** caps *concurrent external calls* (`≤ min(N, due pipelines)`). It
  is **not** a requests-per-second guarantee — V1 has **no hard QPS limiter**. `429`/`503`
  back off by pushing the task's next check time.
- **Terraform-job concurrency cap (`slotCap`)** is **deferred**. InfraManager's fixed pool is
  the real ceiling; over-submission only deepens its (idempotent) queue. Add a client-side cap
  only if a concrete need appears.
- **Scan cadence / per-call timeout** prevent unbounded waits. No circuit breaker; systemic
  failure is handled as delay (timeout + retry + alert), per ADR-016.

## Considered Options

| Option | Verdict | Why |
|---|---|---|
| A. One dedicated server (replicas=1) + bounded worker pool | **Chosen** | Simplest model that tolerates unbounded call latency; one writer ⇒ no leader/lease/CAS; restart-safe via ADR-016. |
| B. Reconciler inside the BFF | Rejected | The BFF scales out for requests; a single-writer reconciler in a multi-replica deployment forces leader election back in. |
| C. Active-active multi-pod (claim-pull: `FOR UPDATE SKIP LOCKED` + lease + ownership CAS) | Rejected for V1 — documented upgrade path | Correct and HA, but adds claim/lease/CAS machinery for scale we do not have. Reuses ADR-016 unchanged; adopt by superseding **this** ADR only. (PR #509 §8.1) |
| D. Workflow engine (Temporal / Airflow / broker) | Rejected | A 2–4 step linear chain of minute-scale polls does not justify the operational cost. |
| E. In-memory async chain (no scan) | Rejected | Loses runs on restart/deploy; cannot durably express multi-day waits. ADR-016 already requires the DB to be the only state. |

## Consequences

### Good

- Manual, operator-sequenced Terraform work becomes **restart-safe automation** with a
  visible queue, and **no coordination layer** to operate or debug.
- Absorbs slow external calls without stalling the scan (worker pool + poll-across-scans).
- The cheapest possible correct runtime: no lease, no leader, no claim query.

### Costs we accept

- A **single server has no high availability and no horizontal scale.** A crash or deploy
  pauses progress briefly — with **no data loss** (ADR-016: durable rows + idempotent
  re-dispatch). Fine at this scale; **active-active** (Option C) is the documented upgrade
  path, and adopting it changes only this ADR.
- Worker-pool size and scan cadence must be tuned to InfraManager's capacity; mis-tuning
  deepens InfraManager's queue (harmless) or slows throughput (visible), never corrupts state.

## Links

- [ADR-016](016-install-delete-pipeline-domain-model.md) — the durable domain model this drives
- [minimal-redesign.md](../../design/pipeline/minimal-redesign.md) — canonical spec (reconciler loop §3, failure/retry §4)
- [PR #509](https://github.com/bluefa/pii-agent-demo/pull/509) — single-pipeline-tick mechanism + active-active upgrade path (§8.1)

## Glossary

- **Reconciler / scan** — the periodic pass that advances each running pipeline's current task.
- **Dispatch / poll** — start an external job / check its status.
- **Due pipeline** — one whose current task is READY, or IN_PROGRESS past its next check time.
- **In-flight guard** — an in-memory set of pipeline ids currently held by a worker, so the
  scan never double-hands one within a single instance.

## Revision history

- 2026-06-27: created by splitting ADR-016; execution model (single dedicated server, bounded
  worker pool, no leader/lease) extracted here so it can be superseded independently of the
  domain model.
