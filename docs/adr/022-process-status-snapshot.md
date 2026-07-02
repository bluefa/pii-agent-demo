# ADR-022: ProcessStatus Snapshot — Two-Tier Freshness and Confirm-Epoch Invalidation

## Status

Proposed — 2026-07-02.

This ADR decides **how the SIT BFF computes and serves ProcessStatus at acceptable cost**,
without changing what ProcessStatus *means*. The seven-stage model and its derivation rules
(`IDLE → PENDING → CONFIRMING → CONFIRMED → INSTALLED → CONNECTED → COMPLETED`) are a
StoryBoard specification and are frozen; the terminology and FE mapping are fixed by
[ADR-009](009-process-status-terminology.md). Everything here is about **when the rules run,
where the result is kept, and how stale a served value may be**.

## Context

### The computation today

ProcessStatus is derived per read. Most inputs are local, but one is not: when
`ConfirmStatus == CONFIRMED`, the derivation needs **InstallationStatus**, and
InstallationStatus is a **live CSP call on every read, with no persistence**:

| CSP | Live call | Signal consumed |
|---|---|---|
| AWS | `ServiceTerraformCheckService.checkTerraformDone` — per-region EC2/Glue/IAM enumeration | `lastCheck.status == COMPLETED` |
| GCP | `SubnetworksClient.aggregatedList` (Compute API) | `lastCheck.status == COMPLETED` |
| Azure | `privateEndpoints().list()` (ResourceManager) | `healthCheckStatus == HEALTHY` |

Two facts make this expensive computation *wasteful* in particular:

- **Only one bit is read.** The heavy response feeds a single boolean signal.
- **It is only needed in one stage.** Before CONFIRMED the derivation never consults
  InstallationStatus; every earlier stage is computable from local data alone.

### Measured cost (operations stats, pre-#8332)

661 successful status reads, 0 failures:

| Segment | n | median | avg | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| ALL | 661 | 3.98s | 4.79s | 8.09s | 8.74s | 26.74s | 28.14s |
| AWS | 539 | 4.59s | 5.32s | 8.30s | 8.97s | 27.31s | 28.14s |
| Azure | 84 | 3.04s | 3.19s | 3.92s | 4.24s | 8.32s | 13.49s |
| GCP | 38 | 0.50s | 0.77s | 1.48s | 1.98s | 2.27s | 2.31s |
| IDC | 628 | 1.01s | 2.45s | — | — | — | 7.79s |

AWS dominates both volume and tail. An interactive read that can take 27 seconds is the
problem; a *list* of such reads is not implementable at all with live computation.

### Who reads ProcessStatus, and what they actually need

| Persona | Access pattern | Real requirement |
|---|---|---|
| **Service owner** | Single target, on demand | See *their* target's current stage promptly while finishing installation. Freshness within ~30s is sufficient. |
| **Admin** | All targets | **Continuously detect Process changes / stalls across every target source** — the Admin page must track the whole fleet, not merely render a list when opened. |
| **Operator / developer** | Neither — meta | Monitor the health of the status computation itself: failures, staleness, error causes. |

The admin requirement is the pivotal one. "Render a full list on demand" would be a weak
requirement; **"detect changes across all targets, continuously"** is the actual one, and it
logically forces some component to **periodically compute and retain status for every
target**, whether or not anyone is looking.

### Why events cannot replace polling

Terraform is sometimes executed **locally** (AWS, Azure at minimum) rather than by the
server. Those runs emit no `terraform-worker-event`. Any design whose only refresh trigger
is an event stream will silently miss exactly the changes admins most need to see. Events
can *accelerate* detection; they cannot *bound* it. Polling must exist regardless.

### Operational constraints

- **No Redis.** GCP Pub/Sub is available.
- Infra Manager runs as **3 pods** in production — every mechanism must be safe under
  concurrent instances.
- Persistence is **MySQL** (production) / H2 `MODE=MYSQL` (tests), `ddl-auto: update`.
- ProcessStatus derivation rules are immutable (StoryBoard).
- Fleet size is small: on the order of ~2,000 target sources
  ([ADR-021](021-pipeline-execution-model.md) context), of which only the
  CONFIRMED-and-installing subset needs CSP calls.

### Relation to ADR-001 / ADR-004 ("computed, not stored")

ADR-004 (discarded, superseded by ADR-009) rejected `processStatus` as a **writable stored
field** mutated by APIs, because a stored field can drift from the facts. This ADR does
**not** reintroduce that. The snapshot below is a **derived cache with provenance**: it is
only ever written by re-running the frozen derivation rules against fresh inputs, it records
*when* and *against which confirm epoch* it was computed, and no API mutates it as state.
The rules remain the single computation authority; the snapshot is memoization, not truth.

## Problem

1. **Interactive latency.** Single-target reads are p95 ≈ 8.7s, p99 ≈ 26.7s. This is the
   service owner's primary workflow.
2. **Fleet tracking is impossible.** The Admin requirement (continuous change detection
   over all targets) cannot be met by on-demand live computation — a cold full-list read is
   *N × ~5s* of CSP calls — and cannot be met by lazy caching either, because a lazy cache
   only computes what someone happens to view.
3. **Correctness at the confirm boundary.** Any cached status computed *before* a
   CONFIRMED transition is not merely stale — it is **semantically invalid**: it answered a
   question ("how far along is this target?") under a different confirm epoch. Serving it
   after confirmation can mask the true installation stage exactly when the service owner
   is watching most closely.
4. **No observability.** Because nothing is persisted, there is no record of computation
   failures, staleness, or change history — the operator persona has nothing to monitor.

## Decision Drivers

- Single-target read latency must drop to snapshot-read speed for warm paths; worst case
  no worse than today.
- Every target's status must be recomputed on a bounded cadence regardless of viewers.
- A post-confirm read must never serve a pre-confirm value.
- Safe with 3 concurrent pods; no Redis; MySQL only; `ddl-auto: update` compatible.
- CSP API quotas must be respected (AWS enumeration is heavy).
- Minimum new machinery — no new infrastructure component if a table and a scheduler do it.

## Considered Options

### Option A — Status quo (live compute per read)

Fails drivers 1 and 2 outright. Listed for the record.

### Option B — Pure lazy TTL cache: 30s (single) / 1h (list)

The initial proposal for this ADR: cache per read path, with a short TTL for single-target
reads and a long TTL for the list.

Rejected as a *complete* answer, for three reasons:

1. **Lazy caching cannot satisfy continuous detection.** A TTL cache computes on miss —
   i.e., only what someone views. Targets nobody opens are never computed; the Admin
   requirement is precisely about targets nobody is watching. The 1h number is fine; the
   *lazy* trigger is what fails.
2. **The list's cache miss is catastrophic.** On cold start or TTL expiry, one unlucky
   admin request pays *N × ~5s* of live CSP calls (minutes), and concurrent requests
   stampede the same misses.
3. **Where would it live?** No Redis; per-pod memory gives 3 inconsistent views and dies on
   restart; which leads to a DB-backed cache — at which point Option C is the same table
   with a better refresh policy.

The **30-second single-target tier survives** into the chosen design as the read-through
path. Only the list tier changes shape: from "lazy 1h TTL" to "background refresh with a
1h staleness SLO".

### Option C — DB snapshot + background sweeper + single-target read-through *(chosen)*

Persist one snapshot row per target source in MySQL. All reads serve from the snapshot.
Two freshness mechanisms: a **sweeper** keeps every row within a staleness SLO (default
1 hour), and single-target reads **read through** (synchronously recompute) when their
stricter 30s freshness is not met. Detailed below.

### Option D — Event-driven invalidation via Pub/Sub (+ snapshot)

`terraform-worker-event → Pub/Sub → mark snapshot stale → immediate refresh`. Deferred, not
rejected: local terraform runs emit no events, so the sweep must exist anyway — events only
shorten detection latency for the server-run subset. That is a v2 accelerator bolted onto
Option C's table (`next_check_at = NOW()` on event), not an alternative to it. Adding a
message pipeline for a latency improvement on a subset is not justified in v1.

### Option E — Per-pod in-memory cache (Caffeine)

Three pods → three divergent views of the same target; nothing persists for change
detection or operator observability; cold after every deploy. Rejected. (A tiny per-pod
micro-cache of a few seconds may later be layered on top of Option C if snapshot-read QPS
ever matters; it changes nothing decided here.)

## Decision

**Option C.** Guarantees at a glance:

| Guarantee | Secured by | Where |
|---|---|---|
| Warm single-target read is a DB read | snapshot table | D1 |
| Single-target freshness ≤ 30s | read-through on age or epoch miss | D2 |
| Every target recomputed ≤ 1h, viewers or not | sweeper over `next_check_at` | D3 |
| No pre-confirm value served post-confirm | confirm-epoch validity + CAS write-back | D4 |
| No duplicate CSP calls under concurrent readers/pods | row claim (`FOR UPDATE SKIP LOCKED` + lease), single-flight | D5 |
| Operators can see failures and staleness | attempt/success/error columns + `computed_at` in responses | D6 |
| "How long has it been stuck?" answerable | `status_changed_at` | D6 |

### D1. Snapshot table

One row per target source; only written by executing the frozen derivation rules.

```sql
CREATE TABLE process_status_snapshot (
  target_source_id   VARCHAR(...) PRIMARY KEY,
  csp                VARCHAR(16)  NOT NULL,
  process_status     VARCHAR(32)  NOT NULL,          -- one of the 7 ADR-009 values
  confirm_epoch      BIGINT       NOT NULL,           -- epoch the computation was based on
  computed_at        DATETIME     NOT NULL,           -- DB clock, last successful compute
  status_changed_at  DATETIME     NOT NULL,           -- last time process_status VALUE changed
  next_check_at      DATETIME     NOT NULL,           -- sweeper schedule
  claimed_by         VARCHAR(64)  NULL,               -- lease (sweeper + read-through single-flight)
  claimed_until      DATETIME     NULL,
  last_attempt_at    DATETIME     NULL,
  last_success_at    DATETIME     NULL,
  fail_count         INT          NOT NULL DEFAULT 0, -- consecutive failures
  last_error         VARCHAR(512) NULL,
  INDEX idx_next_check (next_check_at)
);
```

Notes:

- All timestamps use **DB time** (`NOW()` / JPA with DB-sourced clock) — three pods must
  never compare wall clocks against each other.
- `ddl-auto: update` creates this table and adds columns, but does **not** reliably
  retrofit indexes or constraints onto existing tables — the entity must carry the index
  and PK definitions from its first deploy.
- The raw CSP signal is deliberately **not** stored beyond `process_status`; per the frozen
  rules only one boolean is consumed, and it is folded into the derived status. Storing
  heavy CSP payloads would be speculative.

### D2. Single-target read: read-through with 30s freshness

For `GET .../process-status` (service-owner path):

```
snapshot valid  ⇔  confirm_epoch matches current  AND  age(computed_at) ≤ 30s
valid   → serve snapshot                  (DB-read fast path, the common case)
invalid → recompute synchronously (single-flight, D5), write back, serve fresh value
```

The blocking recompute is **no worse than the status quo** — today *every* read pays the
live call; under this design only the first read after expiry or after a confirm-epoch
change pays it, and everyone else rides the snapshot. Responses include `computed_at` so
the client can display data age.

Deliberate simplification: no "serve stale while refreshing in the background" on the
single-target path in v1. The service owner is actively working the installation; a fresh
answer is worth the occasional wait they already tolerate today. Upgrade path: bounded wait
(e.g., 10s) then serve the stale value flagged `refreshing: true` — add only if the tail
wait proves painful in practice.

### D3. Full list: always snapshot; sweeper maintains a 1h staleness SLO

The list endpoint (Admin page) **never triggers CSP calls**. It is a single table read,
served instantly, whatever the snapshot ages are — each row carries `computed_at` and
`status_changed_at` so the UI can render staleness honestly.

Freshness is maintained **proactively** by a sweeper:

- Each pod runs a scheduled loop that claims due rows (`next_check_at <= NOW()`, D5),
  recomputes them, and reschedules `next_check_at = NOW() + 1h ± jitter`.
- Rescheduling per row (rather than a cron-style full-fleet burst) spreads CSP load evenly
  across the hour and lets individual rows be prioritized (D4 sets `next_check_at = NOW()`
  on epoch invalidation; a Pub/Sub event would do the same in v2).
- **The 1h is a staleness SLO, not a cache TTL.** The distinction is the heart of this ADR:
  a TTL waits for a viewer; the SLO is enforced by the sweeper for every target,
  continuously — which is what "detect Process changes across all targets" actually
  requires.
- Targets not yet CONFIRMED are swept too (their derivation is cheap and local — no CSP
  call), so the list is complete and uniformly fresh from one table.

Capacity check: ~2,000 targets, worst case all needing CSP calls at avg ≈ 5s (AWS-dominant)
→ ≈ 2.8 worker-hours per sweep cycle. Three pods × one sweep worker sustain the 1h SLO at
~93% utilization in that worst case; in reality only the CONFIRMED-but-not-COMPLETED subset
is expensive, leaving ample headroom. If the fleet grows: two workers per pod, or tiered
cadence (active installs every 10 min, COMPLETED hourly) — both are parameter changes, not
design changes.

### D4. Confirm-epoch invalidation

Infra Manager knows when confirmation happened. Each target carries a **`confirm_epoch`**
— preferably a monotonically increasing integer bumped on every (re-)confirmation;
`confirmed_at` compared under the DB clock is the fallback if only a timestamp exists
(integers are immune to clock questions and to two confirms in one second).

Rules:

- **Validity, not just age.** A snapshot is valid only if its `confirm_epoch` equals the
  target's current epoch. An epoch mismatch invalidates the snapshot *regardless of age* —
  a value computed before confirmation was computed against a different world.
- **Single-target read on mismatch → blocking recompute** (D2's invalid branch). The moment
  after confirmation is exactly when a stale answer is most misleading.
- **List on mismatch → serve honestly, refresh urgently.** The row is rendered with a
  *refreshing* marker (the UI decides presentation), and `next_check_at` is set to `NOW()`
  so the sweeper picks it up immediately. The list never blocks on one target's CSP call.
- **CAS write-back.** A recompute that started under epoch *E* writes back
  `... WHERE target_source_id = :id AND confirm_epoch <= :E`-style guarded, stamping the
  epoch it computed under. If a re-confirmation raced a long-running CSP call, the stale
  result loses the write and the row stays due for refresh. (Same
  ownership-guarded-write-back discipline as ADR-021 Decision 4.)

### D5. Three-pod coordination: claim-pull, same pattern as ADR-021

Both the sweeper and the read-through path serialize per-row work with the mechanism
already proven in [ADR-021](021-pipeline-execution-model.md): a short claiming transaction
using `SELECT ... FOR UPDATE SKIP LOCKED` plus a lease (`claimed_by`, `claimed_until`),
external calls strictly outside the transaction, ownership-guarded write-back.

- **Sweeper:** claim up to *k* due, unclaimed rows; recompute; write back; release.
  `SKIP LOCKED` makes three pods drain the due set without contention or leader election.
- **Read-through single-flight:** the reader claims the row before recomputing. If the row
  is already claimed (another reader or the sweeper is mid-recompute), the reader does
  **not** duplicate the CSP call — it polls the snapshot briefly for the in-flight result.
  This is the anti-stampede property Option B lacked.
- No MySQL named locks (`GET_LOCK`): not portable to H2 `MODE=MYSQL`, and row leases
  already do the job. H2 2.x supports `FOR UPDATE SKIP LOCKED`, keeping tests faithful.

**Why not reuse the ADR-016/021 pipeline itself:** its `CONDITION_CHECK` tasks are
count-bounded with terminal states — a poll that eventually *ends*. Snapshot refresh is a
**perpetual, per-target recurring job with no terminal state**. Forcing it into the
pipeline's lifecycle (attempts, fail-caps, DONE) would distort both. We reuse the
*claim-pull pattern*, not the pipeline tables.

### D6. Failure handling and observability (the operator persona)

- A failed recompute (CSP error, timeout) updates `last_attempt_at`, increments
  `fail_count`, records `last_error` — and **leaves the last good `process_status` and
  `computed_at` untouched**. Readers get the last known good value with visible age; they
  are never handed an error page because a background refresh failed.
- Failed rows are retried with backoff: `next_check_at = NOW() + min(base × 2^fail_count,
  cap)`, with per-CSP concurrency caps so an AWS brownout cannot monopolize sweep workers.
- `status_changed_at` updates only when the derived `process_status` **value** changes.
  This single column answers the Admin's stall question — "CONFIRMED for 3 days" — by
  sorting, without a history table.
- Metrics/alerts: staleness distribution (`NOW() − computed_at`), alert when any row
  exceeds 2× SLO; consecutive-failure alert on `fail_count ≥ N`; per-CSP recompute latency
  and error rate.

## Consequences

### Positive

- Warm single-target reads collapse from seconds to a DB read; the 27s tail survives only
  as the *first* read after expiry or confirmation.
- The Admin fleet view becomes buildable at all: one table scan, uniformly bounded
  staleness, honest per-row age, and a sortable "stuck since" signal.
- CSP call volume becomes **bounded and scheduled** (≤ fleet size per hour + read-through
  misses) instead of proportional to page views — and jittered instead of bursty.
- Operators gain a monitorable surface (staleness, failures, error causes) where today
  there is none.
- No new infrastructure: one table, one scheduled loop, mechanisms already proven in
  ADR-021.

### Negative / accepted costs

- Served data is stale by design: up to 30s (single) / 1h (list). Accepted per persona
  analysis; both bounds are tunable parameters.
- The unlucky first reader after expiry or confirmation still waits for a live CSP call
  (up to ~28s worst observed). Accepted in v1: strictly rarer than today, with a defined
  upgrade path (D2).
- A new background responsibility (sweeper) in Infra Manager pods — more moving parts to
  operate, mitigated by D6 being designed in from the start.
- Change *detection* granularity for unwatched targets is the sweep cadence (1h). If Admin
  ever needs minutes-level detection fleet-wide, that is the D3 tiered-cadence knob or the
  Option D accelerator — both anticipated, neither built now.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| CSP quota/throttling from sweeping (AWS enumeration is heavy) | per-CSP concurrency caps; per-row jittered scheduling (no fleet-wide burst); backoff on 429/503 |
| Re-confirmation racing a long recompute writes a stale-epoch result | CAS write-back guarded on `confirm_epoch` (D4) |
| Pod clock skew corrupting age/epoch comparisons | DB clock for all timestamps; integer `confirm_epoch` preferred over timestamps |
| `ddl-auto: update` won't retrofit indexes | full index/PK definitions on the entity from first deploy |
| H2/MySQL divergence in tests | row leases + `SKIP LOCKED` only (H2 2.x-compatible); no `GET_LOCK` |
| Deleted/offboarded target sources leave orphan snapshot rows | sweeper prunes rows whose target no longer exists |
| Reintroducing ADR-004's stored-field drift | snapshot written only by the derivation rules, never by APIs; provenance columns make every value auditable |

## Open Questions

1. **Can ProcessStatus regress after COMPLETED** (e.g., health check turns unhealthy)?
   If yes, COMPLETED targets stay in the hourly sweep (current default). If provably
   terminal, they can be excluded and the sweep budget shrinks substantially.
2. **What does Infra Manager actually expose for the confirm epoch** — a monotonic
   version, or only `confirmedAt`? Determines D4's preferred vs. fallback form.
3. Should the Admin page eventually need a **status transition log** (who changed when,
   full history) beyond `status_changed_at`? Out of scope for v1; the sweeper is the
   natural place to append such a log later since it observes every transition.

## Related

- [ADR-001](001-process-state-architecture.md) — Data-driven status (computed, not stored);
  this ADR keeps that invariant via a derived cache with provenance.
- [ADR-004](004-process-status-refactoring.md) — discarded stored-field approach; see
  Context for why this is not that.
- [ADR-009](009-process-status-terminology.md) — the seven-state model and FE mapping this
  ADR serves faster, unchanged.
- [ADR-016](016-install-delete-pipeline-domain-model.md) /
  [ADR-021](021-pipeline-execution-model.md) — the claim-pull machinery pattern reused in
  D5, and why the pipeline itself is not reused.
