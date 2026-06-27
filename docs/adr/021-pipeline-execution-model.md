# ADR-021: Install/Delete Pipeline — Claim-Pull Execution Model

## Status

Proposed — 2026-06-27.

This is the **execution half** of the install/delete pipeline design: how the durable state
machine of [ADR-016](016-install-delete-pipeline-domain-model.md) is actually driven forward.
The domain model (tables, states, uniqueness, lifecycle, idempotency contract) lives in
ADR-016 and does not change when this decision changes. Keeping the runtime model in its own
ADR means a future change supersedes **only this ADR**, leaving the domain model intact.

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

Two concurrent-writer facts that shape the choice:

- **Cancel is issued by the Admin/API path** — a separate process, in its own short
  transaction — at any time while a worker is mid-tick. Any model that assumes "a single
  process is the only writer" is broken by construction.
- **Process overlap is routine**: rolling deploys, scale events, and restarts create windows
  where more than one instance is live. An in-memory in-flight guard is per-process and
  provides no protection across these boundaries.

Operational facts:

- InfraManager has its **own fixed worker pool** — that is the real ceiling on concurrent
  Terraform jobs. The orchestrator does not need its own hard cap in V1.
- Over-submitting to InfraManager is harmless (idempotent; it only deepens InfraManager's
  queue).
- Scale is small: ~2,000 targets, minute-scale jobs.

## Decision

### 1. Workers pull work from the DB; no single-instance constraint, no leader election

The orchestrator runs as its **own deployable server**. N worker threads — optionally across
multiple pods/replicas — each pull due pipelines from the database. There is no replica count
constraint, no in-memory in-flight guard, no leader election. Horizontal scale and HA are
inherent in the design.

### 2. Pipeline-level claim via `FOR UPDATE SKIP LOCKED` + lease

A worker claims **one** due pipeline by running a short, dedicated transaction (tx1) before
touching any external system:

```sql
BEGIN;
SELECT id FROM pipeline
 WHERE status = 'RUNNING'
   AND next_due_at <= now()
   AND (claimed_until IS NULL OR claimed_until < now())
 ORDER BY next_due_at
 LIMIT 1
 FOR UPDATE SKIP LOCKED;
UPDATE pipeline
   SET claimed_by = :claim_token,
       claimed_until = now() + (:lease_seconds * interval '1 second')
 WHERE id = :pipeline_id;
COMMIT;
```

`SKIP LOCKED` ensures two workers racing the same scan claim different pipelines without
blocking each other. The `claimed_by` / `claimed_until` stamp — not a process count — is what
guarantees one pipeline is owned by one worker at a time, **across processes and pods**.

**`claimed_by` is a per-claim fencing token** — a fresh UUID minted at the moment of each
claim (`:claim_token` in the SQL above), not a reused pod id or thread name. This matters for
stale-straggler rejection: if a worker's lease expires and the same pod later re-claims the
same pipeline, it receives a *different* token. Any in-flight tx2 from the prior claim holds
the old token and therefore no-ops on the `claimed_by = :claim_token` guard. A reused stable
identity would pass that guard and allow the stale write through.

**`ORDER BY next_due_at` + `SKIP LOCKED` yields approximate/fair FIFO, not strict ordering.**
Rows currently held by other workers are skipped, so different concurrent workers may observe
different relative ordering. This is acceptable because pipelines are independent of each other.

**An empty claim result does NOT mean the backlog is empty.** `SKIP LOCKED` silently omits rows
whose leases are held by other workers. The scan loop must not treat a zero-row result as an
idle signal; it should proceed to the next poll iteration normally.

**Execution schema note.** This model adds three execution-coordination columns to the
`pipeline` table — `next_due_at`, `claimed_by`, `claimed_until` — which are execution
metadata owned by this ADR, distinct from ADR-016's domain state columns.

### 3. Two-transaction split

```
tx1: claim     →     external call (OUTSIDE any transaction)     →     tx2: report
```

External calls (InfraManager, condition checks) run 200 ms–60 s. Holding a row lock across
that window would block every other worker that wants to scan the same row. The two-transaction
split avoids this: tx1 claims the pipeline and commits immediately; the external call runs
unlocked; tx2 commits the result.

### 4. Guarded write-back (state-guarded + ownership-guarded)

The report transaction (tx2) transitions the task and pipeline with:

```sql
UPDATE pipeline
   SET status = :new_status, ...
 WHERE id = :pipeline_id
   AND status = :expected_status
   AND claimed_by = :claim_token;
```

Two guards operate independently:

- **`claimed_by` guard** — a lease-expired straggler that resumes after its pipeline was
  reclaimed by another worker will find `claimed_by` no longer matches and its update
  no-ops. No clobbering.
- **`status` guard** — if the Admin/API path issued a CANCEL while the worker was
  mid-tick, the task/pipeline is already in a terminal state. The worker's `AND status =
  :expected_status` condition is false; the update no-ops instead of resurrecting a
  terminal task. This directly enforces ADR-016's **no-terminal-resurrection** invariant.

**Per-task writes use the same guard form.** Each task-level transition within tx2 uses the
identical double-guarded form (`UPDATE task SET ... WHERE id = :task_id AND status =
:expected_status AND claimed_by = :claim_token` on the owning pipeline). Both the task and
pipeline writes in tx2 are state-guarded **and** ownership-guarded.

**On success, tx2 releases the claim and advances `next_due_at` atomically.** The same
transaction that advances task/pipeline state also clears `claimed_by`/`claimed_until` and
writes the new `next_due_at`. Without this release a pipeline that finishes a step but remains
`RUNNING` stays locked until `claimed_until` passes, blocking all other workers from picking it
up. `next_due_at` is always written by tx2 on a successful report; it is seeded at pipeline
creation by the trigger endpoint.

**Duplicate external-call windows.** The two-transaction split creates several bounded windows
where a duplicate call to InfraManager may occur:

- **(a) Client timeout** — the caller times out but InfraManager already accepted the job.
- **(b) Crash after dispatch** — the worker dispatches and crashes before tx2 records the
  returned `job_id`.
- **(c) Lease expiry while stalled** — a worker thread-pool queue wait or GC pause exceeds the
  lease; another worker re-claims and dispatches the same pipeline.

In all three cases the duplicate **external call** is made safe by **idempotency (ADR-016)** —
InfraManager's contract ensures a repeated call for the same logical operation produces no
additional side-effect. The guarded DB write addresses a separate concern: it prevents a stale
straggler from clobbering DB state once its ownership has expired. The two safety knobs are
complementary, not interchangeable.

### 5. Crash recovery via lease expiry

A crashed worker's claimed pipeline becomes due again once `claimed_until < now()`. No leader,
no human intervention — the next scan reclaims it. Hard constraint:

```
lease_seconds > max_single_call_timeout + pool_queue_wait + scheduling_margin
```

A claimed pipeline can sit in the worker thread-pool queue before its external call even
starts; that queue wait consumes lease time just as the call itself does. The lease must cover
the full elapsed wall-clock time from claim to tx2 commit, including any queuing delay.

### 6. Cancel as a concurrent writer

Cancel is issued by the Admin/API path in its own short transaction (sets pipeline + tasks to
`CANCELLED`). Correctness is guaranteed by the guarded writes in Decision 4, not by any
single-writer assumption.

### Safety mechanisms & tuning knobs (not architectural decisions)

Their exact values live in operational config, not in this ADR:

- **Worker count `N`** caps *concurrent external calls* (`≤ min(N, due pipelines)`). It is
  **not** a requests-per-second guarantee — `429`/`503` back off by pushing `next_due_at`
  forward.
- **Lease duration** (`lease_seconds`) must exceed max single-call timeout plus pool queue-wait
  plus a scheduling margin (see Decision 5). Tune conservatively; a too-short lease has two
  distinct effects: (1) the **guarded write** prevents the stale straggler from clobbering DB
  state; (2) **idempotency (ADR-016)** makes the duplicate *external call* to InfraManager
  harmless. Neither causes corruption, but redundant InfraManager calls consume quota.
- **Claim-predicate index** — the claim predicate (`status='RUNNING' AND next_due_at <= now()
  AND (claimed_until IS NULL OR claimed_until < now())`) needs a supporting index; without one,
  every claim degrades to a full sequential scan + sort under concurrent multi-worker polling.
  A partial btree index on `(next_due_at) WHERE status = 'RUNNING'` covers the hot path.
- **Terraform-job concurrency cap (`slotCap`)** is **deferred**. InfraManager's fixed pool is
  the real ceiling; over-submission only deepens its idempotent queue. Add a client-side cap
  only if a concrete need appears.

## Considered Options

| Option | Verdict | Why |
|---|---|---|
| A. Multi-worker claim-pull (SKIP LOCKED + lease + guarded writes) | **Chosen** | Multi-process safe by construction; HA + horizontal scale inherent; survives cancel-vs-worker and deploy-overlap races; crash recovery via lease expiry. |
| B. Single server (replicas=1) + in-memory in-flight guard | **Rejected** | Fails the moment there is a second writer: cancel races a worker into terminal resurrection, and any process overlap (rolling deploy / scale / restart) double-transitions status. Idempotency covers double-dispatch but not status-transition races. |
| C. Workflow engine (Temporal / Airflow / broker) | Rejected | A 2–4 step linear chain of minute-scale polls does not justify the operational cost. |
| D. In-memory async chain (no scan) | Rejected | Loses runs on restart/deploy; cannot durably express multi-day waits. ADR-016 already requires the DB to be the only state. |

## Consequences

### Good

- **Multi-process safe by construction**: the DB claim is the coordination primitive, not a
  process count.
- **HA and horizontal scale** with no leader to operate or debug.
- **Cancel-safe**: concurrent CANCEL wins via the `status` guard; no resurrection possible.
- **Crash recovery** is automatic via lease expiry — no recovery journal, no manual step.

### Costs we accept

- **Lease tuning**: `lease_seconds` must exceed max call time; a too-short lease causes
  redundant (safe) work; a too-long lease delays recovery after a crash.
- **Two-transaction split** is more moving parts than a single in-process write: claim tx,
  external call, report tx must all be reasoned about separately.
- **Lease-expiry window**: a crashed worker's pipeline pauses up to one lease period before
  reclaim.

## Links

- [ADR-016](016-install-delete-pipeline-domain-model.md) — the durable domain model this drives
- [minimal-redesign.md](../../design/pipeline/minimal-redesign.md) — canonical spec (reconciler loop §3, failure/retry §4)
- [PR #509](https://github.com/bluefa/pii-agent-demo/pull/509) — single-pipeline-tick mechanism detail

## Glossary

- **Claim** — the act of stamping a per-claim fencing token (a fresh UUID minted at claim time) into `claimed_by`, plus a deadline into `claimed_until`, in a short committed transaction (tx1). Each claim generates a new unique token; the same worker re-claiming the same pipeline after lease expiry receives a different token, ensuring any in-flight tx2 from the prior claim is rejected by the ownership guard.
- **Due pipeline** — one whose `next_due_at <= now()` and whose lease has expired (or was never set).
- **Guarded write-back** — an `UPDATE ... WHERE id = :id AND status = :expected AND claimed_by = :token` that no-ops if either guard fails.
- **Lease** — the `claimed_until` timestamp; expiry automatically releases the claim for reclaim by any worker.
- **Two-transaction split** — tx1 (claim) and tx2 (report) are separate committed transactions; the external call runs between them, outside any transaction.

## Revision history

- 2026-06-27: created by splitting ADR-016; execution model extracted here so it can be
  superseded independently of the domain model.
- 2026-06-27: replaced the single-server/in-memory model with multi-worker claim-pull after
  the single-writer premise was found to break under concurrent cancel and multi-session.
