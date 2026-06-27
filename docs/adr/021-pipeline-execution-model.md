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

**Execution schema note.** This model adds four execution-coordination columns to the
`pipeline` table — `next_due_at`, `claimed_by`, `claimed_until`, and `cancel_requested`
(boolean) — which are execution metadata owned by this ADR, distinct from ADR-016's domain
state columns.

### 3. Two-transaction split

```
tx1: claim     →     external call (OUTSIDE any transaction)     →     tx2: report
```

External calls (InfraManager, condition checks) run 200 ms–60 s. Holding a row lock across
that window would block every other worker that wants to scan the same row. The two-transaction
split avoids this: tx1 claims the pipeline and commits immediately; the external call runs
unlocked; tx2 commits the result.

### 4. Guarded write-back (ownership-guarded)

The report transaction (tx2) transitions the task and pipeline with:

```sql
UPDATE pipeline
   SET status = :new_status, ...
 WHERE id = :pipeline_id
   AND claimed_by = :claim_token;
```

One guard defends correctness:

- **`claimed_by` guard** — a lease-expired straggler that resumes after its pipeline was
  reclaimed by another worker will find `claimed_by` no longer matches and its update
  no-ops. No clobbering.

A `status = :expected_status` guard is **not required** for cancel-safety. Cancel writes
`status` only on the immediate path (Decision 6), and that path fires solely when the claim is
null or expired **and clears `claimed_by` as it terminalizes** — so it can never share a live
claim token with a worker's tx2. For a live-lease pipeline, cancel only sets a flag and the
claim holder is the sole `status` writer. Either way the `claimed_by` guard alone fences every
straggler; no concurrent writer holds a matching token while the row is being terminalized.

**Ownership verification in tx2 is pipeline-level, not per-row.** In tx2 the worker
verifies pipeline ownership once (the `claimed_by = :claim_token` check on the locked
pipeline row); the task and pipeline status writes then happen under that verified,
single-writer claim, so they need no additional per-row claim guard. The `task` table
carries no `claimed_by` column.

**tx2 executes in a fixed order** inside the single transaction: (1) `SELECT ... FOR UPDATE`
the pipeline row; (2) verify `claimed_by = :claim_token` — no-op the whole report if it fails;
(3) read `cancel_requested`; (4) write the task and pipeline `status` (to `CANCELLED` if the
flag is set, otherwise the normal transition); (5) write the next `next_due_at` and release the
claim. Reading `cancel_requested` under the same row lock that the write takes is what makes the
cooperative cancel (Decision 6) race-free — a cancel committing just before step 3 is observed,
and one committing just after blocks until tx2 commits, then lands on the next claim.

**On success, tx2 releases the claim and advances `next_due_at` atomically.** The same
transaction that advances task/pipeline state also clears `claimed_by`/`claimed_until` and
writes the new `next_due_at`. Without this release a pipeline that finishes a step but remains
`RUNNING` stays locked until `claimed_until` passes, blocking all other workers from picking it
up. `next_due_at` is always written by tx2 on a successful report; it is seeded at pipeline
creation by the trigger endpoint. When the current task reaches `DONE`, the same tx2 flips the
next task `BLOCKED → READY`. tx2 also records the call's `last_http_status` and
`last_response_raw` on the task (a last-write observability snapshot); all of these writes
happen under the verified pipeline claim, so **no task-level claim is needed** — the pipeline
claim already serializes every write to that pipeline's task rows.

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

### 6. Cancel as a cooperative request (flag)

How cancel is applied depends on whether a worker currently holds the pipeline. The cancel
request **first attempts an immediate terminate by CAS**, and falls back to the cooperative
flag only if a live worker owns the claim:

```sql
-- (1) unclaimed OR expired → terminate immediately AND clear the claim, so an expired-lease
--     straggler's tx2 fails its claimed_by guard (also CANCEL its non-terminal tasks in this tx)
UPDATE pipeline SET status = 'CANCELLED', claimed_by = NULL, claimed_until = NULL
 WHERE id = :pid AND status = 'RUNNING'
   AND (claimed_by IS NULL OR claimed_until < now());
-- (2) if 0 rows (a live worker holds the claim) → cooperative flag
UPDATE pipeline SET cancel_requested = true, next_due_at = now()
 WHERE id = :pid AND status = 'RUNNING';
```

An **unclaimed** pipeline — the common "waiting / not yet picked up" case — is cancelled
**immediately**, no worker round-trip. Two races are closed by construction:
- **vs a concurrent claim**: both contend on the pipeline row, so whichever commits first wins
  (a claim no longer sees `RUNNING` once cancelled; the immediate-terminate no longer sees a
  free claim once claimed).
- **vs an expired-lease straggler**: path (1) fires only when the claim is null or expired, and
  it **clears `claimed_by`/`claimed_until`** in the same statement. A GC-paused straggler that
  resumes finds its token gone, so its tx2 `claimed_by` guard no-ops — no resurrection. This is
  why the immediate path is safe *without* re-introducing a `status` guard.

For a **claimed** (live-lease) pipeline, path (2) sets the flag and the worker applies it:

The **claim-holding worker is the sole writer of task/pipeline status.** It reads
`cancel_requested` at its safe points — right after claiming, before dispatch, and inside
the report transaction (tx2) — and if set, transitions the current task and the pipeline to
`CANCELLED` itself, then releases the claim.

`next_due_at = now()` wakes a sleeping pipeline (e.g. one in a long poll/condition wait)
so the next scan claims it promptly; cancel latency for an in-flight pipeline is at most the
remaining per-call timeout (the worker honors the flag at report). An already-dispatched
external job is left to complete (idempotent infra); issuing an InfraManager-side cancel is
a separate follow-up concern, not required for correctness.

Two latency edges are accepted: (i) work that is **claimed but still queued** in the worker
pool observes the flag only when its tx2 runs, so its cancel latency is the queue wait —
bounded by the lease, not just the per-call timeout; (ii) a cancel that arrives **after the
worker's final pre-dispatch flag check** but before the dispatch still lets **one** external
call fire — harmless by idempotency, and recorded as `CANCELLED` at tx2.

Because cancel writes only `cancel_requested` (a different column) and the claim holder is
the only `status` writer, **no per-write `status` guard is required** to prevent terminal
resurrection.

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
- **Terraform-job concurrency cap (`slotCap`)** — the soft gate behavior is defined in
  Decision 7; hard-cap enforcement (counter-CAS) remains deferred. InfraManager's fixed pool
  is the real ceiling; over-submission only deepens its idempotent queue.
- **DB polling load control** — workers self-poll, so the claim loop needs explicit load
  controls to avoid hammering the DB during quiet periods: no immediate retry after an empty
  claim result; adaptive backoff with jitter (e.g. 200 ms → 500 ms → 1 s → 2–5 s, reset on
  work found); when the nearest due pipeline time is known,
  `sleep = min(nextDueAt − now(), maxIdleSleep)` to avoid over-polling; jitter spread across
  the sleep to prevent synchronized wakeups across workers. (The claim-predicate partial index
  already limits per-scan cost; this complements it.)

### 7. Admission control and TF slot gate (soft caps)

**`runningPipelineCap`** is a **soft pickup target**, not a hard invariant, and it gates
**claiming, not creation.** Pipeline creation enforces only per-target uniqueness (ADR-016) —
a created pipeline enters `RUNNING` immediately. The cap limits how many `RUNNING` pipelines
are **concurrently claimed for work**: before claiming beyond the cap, a worker checks the
count of actively-claimed pipelines. Pipelines over the cap simply stay **unclaimed in
`RUNNING`** and are picked up later via `next_due_at` ordering as slots free — there is **no
`QUEUED` or `WAITING_SLOT` state**. The check is a count-read, so it can **overshoot**: for cap
`M` and `C` concurrent claiming workers, worst-case concurrently-claimed is `M + C − 1`. This
bounded overshoot is **accepted in V1**. A hard cap would require atomic admission (e.g.
`UPDATE pipeline_admission_counter SET used = used + 1 WHERE used < cap`, released on
terminal) — **deferred**.

**TF slot gate.** A TF *slot* is Terraform-job execution occupancy (minutes), a different
resource from API-call concurrency (milliseconds to seconds). `slotCap` is a **soft admission
target** that slows TF dispatch to relieve InfraManager/Terraform pressure. Soft gate behavior
in the worker loop: before a TF dispatch, the worker checks slot availability; if available,
it dispatches; if not, it keeps the task `READY`, sets `next_due_at = now() + slotRetry`, and
**releases the claim** (so the worker frees itself to pick up other pipelines). Bounded
overshoot is accepted for the same reason as `runningPipelineCap`; here the racing actors `C`
are the concurrent **workers** checking the slot (bounded by `totalWorkerCount`), not pods. A
hard cap would use a `tf_slot_counter` CAS or an InfraManager-side admission limit — **deferred**.

**Multi-pod note.** `totalWorkerCount = activePodCount × workerPerPod`, so adding replicas
raises global worker count and admission overshoot scales with the number of
concurrent admission actors `C` — admission transactions for `runningPipelineCap`, workers for
the slot gate — not pod count alone. `replicas = 1` is **not required** for correctness (the claim
mechanism is multi-pod safe by construction) — it is only an operational simplification that
eliminates overshoot.

**Worker-loop pseudocode (illustrative; slot gate step shown):**

```
loop:
  row = claim_one_due_pipeline()          // tx1: SKIP LOCKED + lease stamp
  if row is None:
    sleep(backoff_with_jitter())
    continue

  if row.cancel_requested:
    cancel_pipeline(row)                  // tx2: set CANCELLED, release claim
    continue

  if is_tf_dispatch_step(row) and not slot_available():
    reschedule(row, delay=slotRetry)      // tx2: release claim, push next_due_at
    continue

  result = execute_step(row)              // external call, outside any transaction

  report_result(row, result)              // tx2: guarded write-back, release claim
```

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
- **Cancel-safe**: single status writer + cooperative flag (`cancel_requested`); the claim-holding worker applies `CANCELLED` itself. No per-write status guard required; no resurrection possible.
- **Crash recovery** is automatic via lease expiry — no recovery journal, no manual step.

### Costs we accept

- **Lease tuning**: `lease_seconds` must exceed max call time; a too-short lease causes
  redundant (safe) work; a too-long lease delays recovery after a crash.
- **Two-transaction split** is more moving parts than a single in-process write: claim tx,
  external call, report tx must all be reasoned about separately.
- **Lease-expiry window**: a crashed worker's pipeline pauses up to one lease period before
  reclaim.
- **Soft admission targets** — both `runningPipelineCap` and `slotCap` are soft gates;
  concurrent admission reads can overshoot by up to `C − 1` (where `C` = number of concurrent
  admission actors: admission transactions for `runningPipelineCap`, workers for the slot gate).
  Hard caps require explicit counter-CAS admission — deferred.

## Operational reference (knobs & metrics)

This section is a reference catalog only. Values live in operational config, not in this ADR.

### Knobs

| Knob | Meaning |
|---|---|
| `workerPerPod` | Thread-pool size per pod; caps concurrent external calls per replica |
| `activePodCount` | Number of running pods/replicas |
| `maxReplicas` | Upper bound for autoscaler |
| `runningPipelineCap` | Soft admission target for concurrent `RUNNING` pipelines |
| `slotCap` | Soft admission target for concurrent TF-dispatch slots |
| `slotRetry` | Delay before re-checking slot availability when slot is full |
| `leaseDuration` | Claim lease window; see required relationship below |
| `apiCallTimeout` | Per-call timeout for InfraManager / condition-check calls |
| `maxIdleSleep` | Upper bound on idle sleep between claim polls |
| `backoffBase` | Initial backoff interval after an empty-claim result |
| `backoffMax` | Maximum backoff interval (before jitter) |
| `jitterRatio` | Fraction of the sleep interval to randomize (e.g. ±20 %) |

Required relationship: `leaseDuration > maxApiCallTimeout + poolQueueWait + safetyMargin`
(same bound as Decision 5).

### Key metrics

- **active workers** — worker threads currently executing a step
- **total worker count** — `activePodCount × workerPerPod`
- **concurrent API calls** — in-flight external calls to InfraManager / condition checks
- **RUNNING pipeline count** — current `status = 'RUNNING'` row count
- **pipeline-cap overshoot count** — admissions above `runningPipelineCap`
- **empty-claim rate** — fraction of claim polls that returned no row
- **claim QPS** — claim-poll throughput
- **claim latency** — p50/p99 duration of the tx1 claim query
- **due-pipeline lag** — `now() − min(next_due_at)` for unclaimed due rows
- **stale-report discard count** — tx2 no-ops where `claimed_by` guard failed
- **lease-expired reclaim count** — pipelines reclaimed after lease timeout
- **slot-full retry count** — TF dispatch deferred due to slot gate
- **TF-slot overshoot count** — TF dispatches above `slotCap`
- **429/503 count** — back-pressure responses from InfraManager
- **API latency** — p50/p99 of external call durations
- **DB lock wait** — time waiting for row lock during claim scan
- **pipeline completion latency** — wall-clock time from pipeline creation to terminal state

## Links

- [ADR-016](016-install-delete-pipeline-domain-model.md) — the durable domain model this drives
- [minimal-redesign.md](../../design/pipeline/minimal-redesign.md) — canonical spec (reconciler loop §3, failure/retry §4)
- [PR #509](https://github.com/bluefa/pii-agent-demo/pull/509) — single-pipeline-tick mechanism detail

## Glossary

- **Claim** — the act of stamping a per-claim fencing token (a fresh UUID minted at claim time) into `claimed_by`, plus a deadline into `claimed_until`, in a short committed transaction (tx1). Each claim generates a new unique token; the same worker re-claiming the same pipeline after lease expiry receives a different token, ensuring any in-flight tx2 from the prior claim is rejected by the ownership guard. On claim, the worker also checks `cancel_requested` before proceeding.
- **Cooperative cancel** — the cancel model in which the Admin/API path writes only `cancel_requested = true` (and sets `next_due_at = now()` to wake a sleeping pipeline); the claim-holding worker reads this flag at its safe points and applies the terminal `CANCELLED` transition itself. The sole `status` writer remains the worker; no per-write status guard is needed to prevent terminal resurrection.
- **Due pipeline** — one whose `next_due_at <= now()` and whose lease has expired (or was never set).
- **Guarded write-back** — an `UPDATE ... WHERE id = :id AND claimed_by = :token` that no-ops if the ownership guard fails. Defends against lease-expired straggler clobber; a `status` guard is not required because cancel is cooperative and `status` has a single writer (Decision 6).
- **Lease** — the `claimed_until` timestamp; expiry automatically releases the claim for reclaim by any worker.
- **Two-transaction split** — tx1 (claim) and tx2 (report) are separate committed transactions; the external call runs between them, outside any transaction.

## Revision history

- 2026-06-27: created by splitting ADR-016; execution model extracted here so it can be
  superseded independently of the domain model.
- 2026-06-27: replaced the single-server/in-memory model with multi-worker claim-pull after
  the single-writer premise was found to break under concurrent cancel and multi-session.
