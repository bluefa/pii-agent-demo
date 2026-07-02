# ADR-023: ProcessStatus — Installation-Signal Snapshot with Live Derivation

## Status

Proposed — 2026-07-02.

This ADR decides **how the SIT BFF computes and serves ProcessStatus at acceptable cost**,
without changing what ProcessStatus *means*. The seven-stage model and its derivation rules
(`IDLE → PENDING → CONFIRMING → CONFIRMED → INSTALLED → CONNECTED → COMPLETED`) are a
StoryBoard specification and are frozen; the terminology and FE mapping are fixed by
[ADR-009](009-process-status-terminology.md). Everything here is about **when the rules run,
which input is cached, and how stale that input may be**.

The single load-bearing choice: **the cache unit is the expensive input — the
InstallationStatus signal — never the derived ProcessStatus.** The derivation rules run
live on every read; only the one input that crosses an SDK boundary is memoized.

## Context

### The computation today

ProcessStatus is derived per read. Its inputs split sharply into two classes:

- **Everything except installation is already fast.** All other derivation inputs are
  local DB reads — instantaneous by comparison, with no optimization needed.
- **InstallationStatus is an SDK call with a hard floor.** When
  `ConfirmStatus == CONFIRMED`, the derivation needs InstallationStatus, and that is a
  **live CSP SDK call on every read, with no persistence**. The SDK is the latency; it
  cannot be optimized away, only avoided:

| CSP | Live call | Signal consumed |
|---|---|---|
| AWS | `ServiceTerraformCheckService.checkTerraformDone` — per-region EC2/Glue/IAM enumeration | `lastCheck.status == COMPLETED` |
| GCP | `SubnetworksClient.aggregatedList` (Compute API) | `lastCheck.status == COMPLETED` |
| Azure | `privateEndpoints().list()` (ResourceManager) | `healthCheckStatus == HEALTHY` |

Two more facts sharpen the target:

- **Only one bit is read.** The heavy SDK response feeds a single boolean signal.
- **It is only needed in one stage band.** Before CONFIRMED the derivation never consults
  InstallationStatus; every earlier stage is computable from local data alone.

Together these dictate the shape of the fix: cache exactly that one boolean, per target,
and let everything else stay live.

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
logically forces some component to **periodically refresh the expensive signal for every
CONFIRMED target**, whether or not anyone is looking.

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
  ([ADR-021](021-pipeline-execution-model.md) context), of which only targets at
  CONFIRMED or beyond need SDK calls.

### Relation to ADR-001 / ADR-004 ("computed, not stored")

ADR-004 (discarded, superseded by ADR-009) rejected `processStatus` as a **writable stored
field** mutated by APIs, because a stored field can drift from the facts. This ADR keeps
the invariant in its strongest form: **the derived ProcessStatus is never served from
storage at all.** The rules run live on every read; what is stored is one *input* (the
installation signal) as a derived cache with provenance — written only by re-executing the
SDK check, stamped with *when* and *against which confirm epoch* it was obtained, never
mutated by any API. The rules remain the single computation authority.

## Problem

1. **Interactive latency.** Single-target reads are p95 ≈ 8.7s, p99 ≈ 26.7s — entirely the
   SDK call. This is the service owner's primary workflow.
2. **Fleet tracking is impossible.** The Admin requirement (continuous change detection
   over all targets) cannot be met by on-demand live computation — a cold full-list read is
   *N × ~5s* of SDK calls — and cannot be met by lazy caching either, because a lazy cache
   only computes what someone happens to view.
3. **Correctness at the confirm boundary.** Any cached signal obtained *before* a
   CONFIRMED transition is not merely stale — it is **semantically invalid**: it answered a
   question about a different confirm epoch. Consuming it after confirmation can mask the
   true installation stage exactly when the service owner is watching most closely.
4. **No observability.** Because nothing is persisted, there is no record of check
   failures, staleness, or change history — the operator persona has nothing to monitor.

## Decision Drivers

- Warm reads must make no SDK call; worst case no worse than today.
- Non-installation status transitions must never be staled by the cache.
- Every CONFIRMED target's signal must be recomputed on a bounded cadence regardless of
  viewers.
- A post-confirm read must never consume a pre-confirm signal.
- Safe with 3 concurrent pods; no Redis; MySQL only; `ddl-auto: update` compatible.
- CSP API quotas must be respected (AWS enumeration is heavy).
- Minimum new machinery — no new infrastructure component if a table and a scheduler do it.

## Considered Options

### Option A — Status quo (live SDK call per read)

Fails drivers 1 and 3 outright. Listed for the record.

### Option B — Pure lazy TTL cache: 30s (single) / 1h (list)

The initial proposal for this ADR: cache per read path, with a short TTL for single-target
reads and a long TTL for the list.

Rejected as a *complete* answer, for three reasons:

1. **Lazy caching cannot satisfy continuous detection.** A TTL cache computes on miss —
   i.e., only what someone views. Targets nobody opens are never computed; the Admin
   requirement is precisely about targets nobody is watching. The 1h number is fine; the
   *lazy* trigger is what fails.
2. **The list's cache miss is catastrophic.** On cold start or TTL expiry, one unlucky
   admin request pays *N × ~5s* of live SDK calls (minutes), and concurrent requests
   stampede the same misses.
3. **Where would it live?** No Redis; per-pod memory gives 3 inconsistent views and dies on
   restart; which leads to a DB-backed cache — at which point Option C is the same table
   with a better refresh policy.

The **30-second single-target tier survives** into the chosen design as the read-through
path. Only the list tier changes shape: from "lazy 1h TTL" to "background refresh with a
1h staleness SLO".

### Option C — Cache the derived ProcessStatus per target

Persist the derived seven-state value and serve reads from it. Rejected in review
(2026-07-02): it stales the wrong thing. Every non-installation input is a fast local DB
read, so caching the derived value gratuitously delays transitions that could be exact —
a target moving `IDLE → PENDING` would keep showing `IDLE` for up to a sweep cycle even
though no expensive input is involved. It also stores a derived status, which sits
uncomfortably against ADR-001/004. Only the SDK-bounded input deserves caching.

### Option D — Signal-only snapshot + background sweeper + read-through *(chosen)*

Persist **only the installation signal** (one row per CONFIRMED target) in MySQL. Every
read derives ProcessStatus live from local DB inputs plus the cached signal. Two freshness
mechanisms for the signal: a **sweeper** keeps every row within a staleness SLO (default
1 hour), and single-target reads **read through** (synchronous SDK call) when their
stricter 30s freshness is not met. Detailed below.

### Option E — Event-driven invalidation via Pub/Sub (+ snapshot)

`terraform-worker-event → Pub/Sub → mark signal stale → immediate refresh`. Deferred, not
rejected: local terraform runs emit no events, so the sweep must exist anyway — events only
shorten detection latency for the server-run subset. That is a v2 accelerator bolted onto
Option D's table (`next_check_at = NOW()` on event), not an alternative to it. Adding a
message pipeline for a latency improvement on a subset is not justified in v1.

### Option F — Per-pod in-memory cache (Caffeine)

Three pods → three divergent views of the same target; nothing persists for change
detection or operator observability; cold after every deploy. Rejected. (A tiny per-pod
micro-cache of a few seconds may later be layered on top of Option D if read QPS ever
matters; it changes nothing decided here.)

## Decision

**Option D.** Guarantees at a glance:

| Guarantee | Secured by | Where |
|---|---|---|
| Only the SDK-bounded input is cached; every other input is read live | signal-only snapshot; rules run per read | D1, D2 |
| Non-installation transitions are exact on every read | live derivation over live DB inputs | D2 |
| Warm reads make no SDK call | cached signal | D2, D3 |
| Single-target signal freshness ≤ 30s | read-through on age or epoch miss | D2 |
| Every CONFIRMED target's signal recomputed ≤ 1h, viewers or not | sweeper over `next_check_at` + enrollment | D3 |
| No pre-confirm signal consumed post-confirm | confirm-epoch validity + CAS write-back | D4 |
| No duplicate SDK calls under concurrent readers/pods | row claim (`FOR UPDATE SKIP LOCKED` + lease), single-flight | D5 |
| Operators can see failures and staleness | attempt/success/error columns + signal age in responses | D6 |
| "How long has it been stuck?" answerable | `status_changed_at` (observability metadata) | D6 |

### D1. Signal snapshot table — cache the input, not the derivation

One row per target source **that has reached CONFIRMED** (earlier targets never need the
signal, so they have no row). Written only by executing the SDK check.

```sql
CREATE TABLE installation_signal_snapshot (
  target_source_id   VARCHAR(...) PRIMARY KEY,
  csp                VARCHAR(16)  NOT NULL,
  installation_done  BOOLEAN      NOT NULL,            -- the one signal the rules consume
  confirm_epoch      DATETIME(6)  NOT NULL,            -- target's confirmedAt at check time (opaque token)
  computed_at        DATETIME     NOT NULL,            -- DB clock, last successful check
  process_status     VARCHAR(32)  NOT NULL,            -- observability ONLY (D6); never served to clients
  status_changed_at  DATETIME     NOT NULL,            -- observability ONLY: last observed value change
  next_check_at      DATETIME     NOT NULL,            -- sweeper schedule
  claimed_by         VARCHAR(64)  NULL,                -- lease (sweeper + read-through single-flight)
  claimed_until      DATETIME     NULL,
  last_attempt_at    DATETIME     NULL,
  last_success_at    DATETIME     NULL,
  fail_count         INT          NOT NULL DEFAULT 0,  -- consecutive failures
  last_error         VARCHAR(512) NULL,
  INDEX idx_next_check (next_check_at)
);
```

Notes:

- All timestamps use **DB time** (`NOW()` / JPA with DB-sourced clock) — three pods must
  never compare wall clocks against each other. (`confirm_epoch` is the exception: an
  opaque Infra-Manager-issued token, D4.)
- `ddl-auto: update` creates this table and adds columns, but does **not** reliably
  retrofit indexes or constraints onto existing tables — the entity must carry the index
  and PK definitions from its first deploy.
- Only the one consumed boolean is stored. The heavy SDK payloads are not persisted —
  per the frozen rules nothing else is ever read from them.
- `process_status` / `status_changed_at` here are **operator metadata** maintained as a
  byproduct of recomputes (D6). No read path ever serves them; clients always get the
  live derivation of D2/D3.

### D2. Single-target read: live derivation + 30s read-through on the signal

For `GET .../process-status` (service-owner path), the derivation rules run **on every
read** over live local inputs; only the signal comes from the snapshot:

```
inputs  ← local DB reads                          (always live — zero staleness)
rules don't need the signal (pre-CONFIRMED)?      → answer immediately; no snapshot, no SDK
signal valid ⇔ confirm_epoch matches AND age(computed_at) ≤ 30s
signal valid                                      → derive with cached signal (warm path)
signal invalid/missing                            → blocking SDK check (single-flight, D5),
                                                    CAS write-back (D4), derive with fresh signal
```

Two properties fall out:

- **Everything except the installation dimension is exact.** A target moving
  `IDLE → PENDING → CONFIRMING → CONFIRMED`, or any other cheap-input change, is visible
  on the very next read — the cache cannot stale it, because it is not cached.
- The blocking SDK check is **no worse than the status quo** — today *every* read pays it;
  here only the first read after signal expiry or a confirm-epoch change pays it.
  Responses include the signal's `computed_at` so the client can display data age.

Deliberate simplification: no "serve stale while refreshing in the background" on the
single-target path in v1. The service owner is actively working the installation; a fresh
answer is worth the occasional wait they already tolerate today. Upgrade path: bounded wait
(e.g., 10s) then derive with the stale signal flagged `refreshing: true` — add only if the
tail wait proves painful in practice.

### D3. Full list: live derivation over cached signals; sweeper maintains a 1h SLO

The list endpoint (Admin page) **never triggers SDK calls**. It is one query over the
domain tables `LEFT JOIN installation_signal_snapshot`, with the derivation rules applied
in-process per row — cheap, since every input is now local. Rows whose rules need a signal
that is missing or epoch-invalid render as *refreshing* rather than blocking the list.
Cheap-input transitions appear in the list **immediately**; only the installation
dimension carries the snapshot's age, which each row exposes honestly.

Signal freshness is maintained **proactively** by a sweeper:

- **Enrollment:** a cheap periodic query inserts a row (`next_check_at = NOW()`) for any
  target that has reached CONFIRMED and has no row yet (`INSERT IGNORE`; the PK makes it
  race-safe across pods).
- Each pod runs a scheduled loop that claims due rows (`next_check_at <= NOW()`, D5),
  re-runs the SDK check, and reschedules `next_check_at = NOW() + 1h ± jitter`.
- Rescheduling per row (rather than a cron-style full-fleet burst) spreads SDK load evenly
  across the hour and lets individual rows be prioritized (D4 sets `next_check_at = NOW()`
  on epoch invalidation; a Pub/Sub event would do the same in v2).
- **The 1h is a staleness SLO, not a cache TTL.** The distinction is the heart of this
  ADR: a TTL waits for a viewer; the SLO is enforced by the sweeper for every CONFIRMED
  target, continuously — which is what "detect Process changes across all targets"
  actually requires. Installation-driven changes are detected within the SLO;
  cheap-input-driven changes are exact at any read, with no sweep involved.

Capacity check: ~2,000 targets, worst case all CONFIRMED and needing SDK calls at avg ≈ 5s
(AWS-dominant) → ≈ 2.8 worker-hours per sweep cycle. Three pods × one sweep worker sustain
the 1h SLO at ~93% utilization in that worst case — and the worst case is the operative
sizing, because **ProcessStatus can regress at any stage, including from COMPLETED
(Step 7)** (stakeholder-confirmed 2026-07-02): the sweeper has no terminal state to retire
targets into, so every enrolled row stays in the sweep permanently. Targets not yet
CONFIRMED cost nothing — they have no row. If the fleet grows: two workers per pod, or
tiered cadence (active installs every 10 min, others hourly) — both are parameter changes,
not design changes.

### D4. Confirm-epoch invalidation

Infra Manager knows when confirmation happened, and exposes it **only as a timestamp**
(`confirmedAt`) — no version counter exists (stakeholder-confirmed 2026-07-02). The confirm
epoch is therefore that timestamp **treated as an opaque token**: the snapshot stores the
target's `confirmedAt` verbatim (`DATETIME(6)`), and the token is compared only against
other values of the same token — equality for validity, ordering for the CAS guard. Both
operands always originate from Infra Manager, and the token is **never compared against DB
or pod clocks**, so clock skew cannot corrupt epoch decisions. Residual risk: two
re-confirmations within one representable instant are indistinguishable — accepted; the
window is at worst the source precision, and the next sweep re-syncs the row regardless.

Rules:

- **Validity, not just age.** A cached signal is valid only if its `confirm_epoch` equals
  the target's current epoch. An epoch mismatch invalidates the signal *regardless of
  age* — a signal obtained before confirmation answered a different world.
- **Single-target read on mismatch → blocking SDK check** (D2's invalid branch). The
  moment after confirmation is exactly when a stale signal is most misleading.
- **List on mismatch → serve honestly, refresh urgently.** The row is rendered with a
  *refreshing* marker (the UI decides presentation), and `next_check_at` is set to `NOW()`
  so the sweeper picks it up immediately. The list never blocks on one target's SDK call.
- **CAS write-back.** A check that started under epoch *E* writes back
  `... WHERE target_source_id = :id AND confirm_epoch <= :E`-style guarded, stamping the
  epoch it checked under. If a re-confirmation raced a long-running SDK call, the stale
  result loses the write and the row stays due for refresh. (Same
  ownership-guarded-write-back discipline as ADR-021 Decision 4.)

### D5. Three-pod coordination: claim-pull, same pattern as ADR-021

Both the sweeper and the read-through path serialize per-row work with the mechanism
already proven in [ADR-021](021-pipeline-execution-model.md): a short claiming transaction
using `SELECT ... FOR UPDATE SKIP LOCKED` plus a lease (`claimed_by`, `claimed_until`),
external calls strictly outside the transaction, ownership-guarded write-back.

- **Sweeper:** claim up to *k* due, unclaimed rows; run the SDK check; write back; release.
  `SKIP LOCKED` makes three pods drain the due set without contention or leader election.
- **Read-through single-flight:** the reader claims the row before checking. If the row
  is already claimed (another reader or the sweeper is mid-check), the reader does
  **not** duplicate the SDK call — it polls the snapshot briefly for the in-flight result.
  This is the anti-stampede property Option B lacked.
- No MySQL named locks (`GET_LOCK`): not portable to H2 `MODE=MYSQL`, and row leases
  already do the job. H2 2.x supports `FOR UPDATE SKIP LOCKED`, keeping tests faithful.

**Why not reuse the ADR-016/021 pipeline itself:** its `CONDITION_CHECK` tasks are
count-bounded with terminal states — a poll that eventually *ends*. Signal refresh is a
**perpetual, per-target recurring job with no terminal state**. Forcing it into the
pipeline's lifecycle (attempts, fail-caps, DONE) would distort both. We reuse the
*claim-pull pattern*, not the pipeline tables.

### D6. Failure handling and observability (the operator persona)

- A failed SDK check (error, timeout) updates `last_attempt_at`, increments `fail_count`,
  records `last_error` — and **leaves the last good `installation_done` and `computed_at`
  untouched**. Readers derive with the last known good signal and its visible age; they
  are never handed an error page because a background refresh failed.
- Failed rows are retried with backoff: `next_check_at = NOW() + min(base × 2^fail_count,
  cap)`, with per-CSP concurrency caps so an AWS brownout cannot monopolize sweep workers.
- On every recompute (sweep or read-through), the worker also derives ProcessStatus and
  maintains the **operator metadata** columns: `status_changed_at` updates only when the
  derived **value** differs from the stored `process_status`. This single column answers
  the Admin's stall question — "CONFIRMED for 3 days" — by sorting, without a history
  table. Granularity is the sweep cadence, which is sufficient for stall detection;
  clients never read these columns.
- Metrics/alerts: signal-staleness distribution (`NOW() − computed_at`), alert when any
  row exceeds 2× SLO; consecutive-failure alert on `fail_count ≥ N`; per-CSP check
  latency and error rate.

## Consequences

### Positive

- Warm single-target reads collapse from seconds to DB reads + an in-process derivation;
  the 27s tail survives only as the *first* read after signal expiry or confirmation.
- **Staleness is confined to the installation dimension.** All other transitions — the
  entire pre-CONFIRMED band and every cheap-input change — are exact on every read,
  because only the SDK-bounded input is cached.
- The Admin fleet view becomes buildable at all: one query, live derivation, uniformly
  bounded signal staleness, honest per-row age, and a sortable "stuck since" signal.
- SDK call volume becomes **bounded and scheduled** (≤ enrolled fleet per hour +
  read-through misses) instead of proportional to page views — jittered, not bursty.
- Operators gain a monitorable surface (staleness, failures, error causes) where today
  there is none.
- No new infrastructure: one table, one scheduled loop, mechanisms already proven in
  ADR-021.

### Negative / accepted costs

- The installation signal is stale by design: up to 30s (single read) / 1h (list).
  Accepted per persona analysis; both bounds are tunable parameters.
- The unlucky first reader after signal expiry or confirmation still waits for a live SDK
  call (up to ~28s worst observed). Accepted in v1: strictly rarer than today, with a
  defined upgrade path (D2).
- Every read now runs the derivation rules in-process. Negligible: the rules are pure
  logic over local reads; this is what the BFF did before, minus the SDK call.
- A new background responsibility (sweeper + enrollment) in Infra Manager pods — more
  moving parts to operate, mitigated by D6 being designed in from the start.
- Detection granularity for *installation-driven* changes on unwatched targets is the
  sweep cadence (1h). If Admin ever needs minutes-level detection fleet-wide, that is the
  D3 tiered-cadence knob or the Option E accelerator — both anticipated, neither built now.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| CSP quota/throttling from sweeping (AWS enumeration is heavy) | per-CSP concurrency caps; per-row jittered scheduling (no fleet-wide burst); backoff on 429/503 |
| Re-confirmation racing a long SDK check writes a stale-epoch signal | CAS write-back guarded on `confirm_epoch` (D4) |
| Pod clock skew corrupting age/epoch comparisons | DB clock for signal ages; the confirm epoch is an opaque Infra-Manager-issued token compared only against itself |
| `ddl-auto: update` won't retrofit indexes | full index/PK definitions on the entity from first deploy |
| H2/MySQL divergence in tests | row leases + `SKIP LOCKED` only (H2 2.x-compatible); no `GET_LOCK` |
| Deleted/offboarded target sources leave orphan snapshot rows | sweeper prunes rows whose target no longer exists |
| Reintroducing ADR-004's stored-field drift | the derived status is never served from storage at all; only an input is cached, written solely by the SDK check, with provenance columns |

## Open Questions

Two of the original questions were answered by the stakeholder on 2026-07-02 and are
folded into the decisions above:

- ~~Can ProcessStatus regress after COMPLETED?~~ **Yes — any stage can regress at any
  time, including COMPLETED (Step 7).** Consequence: the sweeper has no terminal state;
  every enrolled target stays in the perpetual sweep, and D3's worst-case capacity math is
  the operative sizing.
- ~~Does Infra Manager expose a confirm version?~~ **No — only `confirmedAt`.**
  Consequence: D4 uses the timestamp-as-opaque-token form.

A third review round (2026-07-02) redefined the cache unit from the derived ProcessStatus
to the installation signal (Option C → Option D); non-installation inputs are all fast DB
reads and must never be staled by the cache.

Remaining:

1. Should the Admin page eventually need a **status transition log** (who changed when,
   full history) beyond `status_changed_at`? Out of scope for v1; the sweeper is the
   natural place to append such a log later since it observes every transition.

## Related

- [ADR-001](001-process-state-architecture.md) — Data-driven status (computed, not
  stored); this ADR keeps that invariant in its strongest form — the derived status is
  never served from storage.
- [ADR-004](004-process-status-refactoring.md) — discarded stored-field approach; see
  Context for why this is not that.
- [ADR-009](009-process-status-terminology.md) — the seven-state model and FE mapping this
  ADR serves faster, unchanged.
- [ADR-016](016-install-delete-pipeline-domain-model.md) /
  [ADR-021](021-pipeline-execution-model.md) — the claim-pull machinery pattern reused in
  D5, and why the pipeline itself is not reused.
