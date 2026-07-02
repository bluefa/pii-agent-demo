# ADR-023: ProcessStatus — Installation-Signal Snapshot with Live Derivation

## Status

Proposed — 2026-07-02 (simplified + constraints made explicit 2026-07-03).

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

Cloud status reads — 661 calls, all successful (failure accounting covers the cloud
segment only):

| Segment | n | median | avg | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| ALL (cloud) | 661 | 3.98s | 4.79s | 8.09s | 8.74s | 26.74s | 28.14s |
| AWS | 539 | 4.59s | 5.32s | 8.30s | 8.97s | 27.31s | 28.14s |
| Azure | 84 | 3.04s | 3.19s | 3.92s | 4.24s | 8.32s | 13.49s |
| GCP | 38 | 0.50s | 0.77s | 1.48s | 1.98s | 2.27s | 2.31s |
| IDC (tracked separately) | 628 | 1.01s | 2.45s | — | — | — | 7.79s |

AWS dominates the cloud tail. An interactive read that can take 27 seconds is the problem;
a *list* of such reads is not implementable at all with live computation.

**IDC scope note.** The stated bottleneck ("three CSPs make live SDK calls") covers
AWS/GCP/Azure, yet IDC accounts for roughly half of all status-read volume at multi-second
latency (avg 2.45s, max 7.8s). Whether IDC's installation check is also an external call
(→ it needs a snapshot row like any CSP) or its latency has another cause (→ explicitly
out of scope) is **not decidable from the provided facts** — carried as Open Question 2.
Nothing in the design below is CSP-count-specific; adding IDC is one more `csp` value.

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

### Constraints as provided (stakeholder, 2026-07-02)

Verbatim inputs this ADR must satisfy — kept separate from assumptions so each can be
re-checked independently:

| # | Constraint | Where it binds |
|---|---|---|
| C1 | ProcessStatus derivation rules are a StoryBoard spec and **must not change** | Status; D2/D3 run the rules unmodified |
| C2 | InstallationStatus is the bottleneck; needed **only when `ConfirmStatus == CONFIRMED`**; only **one signal** is read from the heavy response | D1 (cache unit), D3 (enrollment scope) |
| C3 | AWS/GCP/Azure checks are live SDK calls at read time, **no persistence, recomputed every read** | Problem 1; D1 introduces the only persistence |
| C4 | **No Redis**; GCP Pub/Sub is available | D1 (MySQL table); Option E (Pub/Sub deferred) |
| C5 | **Infra Manager runs as 3 pods** in production | D5 (any owner must be N-replica-safe); see placement assumption A2 |
| C6 | DB is **MySQL** (prod) / **H2 `MODE=MYSQL`** (test), **`ddl-auto: update`** | D1 schema notes; D5 (no `GET_LOCK`) |
| C7 | Local terraform runs exist (AWS/Azure) → **events cannot capture all changes** | Option E deferred; sweep is mandatory |
| C8 | Freshness targets: **30s single-target / 1h fleet-wide** (stakeholder-proposed) | D2/D3 — adopted as the freshness contract |
| C9 | `confirmedAt` is obtainable from Infra Manager; **no version counter exists** | D4 (epoch = timestamp as opaque token) |
| C10 | ProcessStatus can **regress at any stage, including COMPLETED** | D3 (no terminal state; perpetual sweep) |
| C11 | Confirmation records are **create/delete only — never updated** (stakeholder, 2026-07-03). "Re-confirmation" = delete → create; a target can dwell with no confirmation, and installation-status queries are meaningless in that state | D4 (epoch lifecycle), D7 (deleted-confirm case) |

Assumptions this ADR **adds** (not stakeholder-provided — each must be verified before
implementation):

- **A1 — Fleet size ~2,000 target sources.** Imported from ADR-021's context, not from
  this ADR's inputs. The D3 capacity math scales linearly in it.
- **A2 — Component placement is undecided.** ProcessStatus is computed/served by the SIT
  BFF, while `confirmedAt` and the 3-pod fact belong to Infra Manager. This ADR specifies
  the *mechanism* (which is safe at any replica count, D5) but deliberately does not
  decide which deployable owns the snapshot table and the sweeper — carried as Open
  Question 3. The capacity math assumes 3 sweep workers total, whichever component hosts
  them.
- **A3 — The SDK check is an idempotent read.** Running it twice concurrently for the
  same target is harmless (wasted quota only). This underwrites the simplified read path
  (D5).

### Operational constraint recap

No Redis (C4) · 3 pods (C5) · MySQL/H2 `ddl-auto: update` (C6) · frozen rules (C1) ·
events incomplete (C7).

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
- Safe at any replica count; no Redis; MySQL only; `ddl-auto: update` compatible.
- Minimum machinery — every mechanism must justify itself against a simpler alternative.

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
3. **Where would it live?** No Redis (C4); per-pod memory gives divergent views and dies
   on restart; which leads to a DB-backed cache — at which point Option D is the same
   table with a better refresh policy.

The **30-second single-target tier survives** into the chosen design as the read-through
path. Only the list tier changes shape: from "lazy 1h TTL" to "background refresh with a
1h staleness SLO".

### Option C — Cache the derived ProcessStatus per target

Persist the derived seven-state value and serve reads from it. Rejected in review
(2026-07-02): it stales the wrong thing. Every non-installation input is a fast local DB
read (C2), so caching the derived value gratuitously delays transitions that could be
exact — a target moving `IDLE → PENDING` would keep showing `IDLE` for up to a sweep cycle
even though no expensive input is involved. It also stores a derived status, which sits
uncomfortably against ADR-001/004. Only the SDK-bounded input deserves caching.

### Option D — Signal-only snapshot + background sweeper + read-through *(chosen)*

Persist **only the installation signal** (one row per CONFIRMED target) in MySQL. Every
read derives ProcessStatus live from local DB inputs plus the cached signal. Two freshness
mechanisms for the signal: a **sweeper** keeps every row within a staleness SLO (default
1 hour), and single-target reads **read through** (synchronous SDK call) when their
stricter 30s freshness is not met. Detailed below.

### Option E — Event-driven invalidation via Pub/Sub (+ snapshot)

`terraform-worker-event → Pub/Sub → mark signal stale → immediate refresh`. Deferred, not
rejected: local terraform runs emit no events (C7), so the sweep must exist anyway —
events only shorten detection latency for the server-run subset. That is a v2 accelerator
bolted onto Option D's table (`next_check_at = NOW()` on event), not an alternative to it.
Adding a message pipeline for a latency improvement on a subset is not justified in v1.

### Option F — Per-pod in-memory cache (Caffeine)

Multiple pods → divergent views of the same target; nothing persists for change detection
or operator observability; cold after every deploy. Rejected. (A tiny per-pod micro-cache
of a few seconds may later be layered on top of Option D if read QPS ever matters; it
changes nothing decided here.)

## Decision

**Option D.** Guarantees at a glance:

| Guarantee | Secured by | Where |
|---|---|---|
| Only the SDK-bounded input is cached; every other input is read live | signal-only snapshot; rules run per read | D1, D2 |
| Non-installation transitions are exact on every read | live derivation over live DB inputs | D2 |
| Warm reads make no SDK call | cached signal | D2, D3 |
| Single-target signal freshness ≤ 30s | read-through on age or epoch miss | D2 |
| Every CONFIRMED target's signal recomputed ≤ 1h, viewers or not | sweeper over one due-query | D3 |
| No pre-confirm signal consumed post-confirm | confirm-epoch validity + epoch-guarded write-back | D4 |
| No two sweep workers check the same row; crash recovery without leases | claim-by-rescheduling (`SKIP LOCKED` + due-bump) | D5 |
| Operators can see failures and staleness | attempt/success/error columns + signal age in responses | D6 |
| "How long has it been stuck?" answerable | `status_changed_at` (observability metadata) | D6 |
| A deleted confirmation is honored with zero staleness, no special-case code | live derivation stops consulting the signal; sweep filter drops the row | D4, D7 |
| A cross-epoch signal is never consumed; a read never fails because the SDK failed | exception matrix: floor stage + `signalUnavailable` | D7 |

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
  next_check_at      DATETIME     NOT NULL,            -- sweeper schedule; doubles as the in-flight guard (D5)
  last_attempt_at    DATETIME     NULL,
  last_success_at    DATETIME     NULL,
  fail_count         INT          NOT NULL DEFAULT 0,  -- consecutive failures
  last_error         VARCHAR(512) NULL,
  INDEX idx_next_check (next_check_at)
);
```

Notes:

- All timestamps use **DB time** (`NOW()` / JPA with DB-sourced clock) — pods must never
  compare wall clocks against each other. (`confirm_epoch` is the exception: an opaque
  Infra-Manager-issued token, D4.)
- `ddl-auto: update` (C6) creates this table and adds columns, but does **not** reliably
  retrofit indexes or constraints onto existing tables — the entity must carry the index
  and PK definitions from its first deploy.
- Only the one consumed boolean is stored (C2). The heavy SDK payloads are not persisted —
  per the frozen rules nothing else is ever read from them.
- `process_status` / `status_changed_at` here are **operator metadata** maintained as a
  byproduct of recomputes (D6). No read path ever serves them; clients always get the
  live derivation of D2/D3.
- There are no lease/claim columns: sweeper mutual exclusion rides on `next_check_at`
  itself (D5).

### D2. Single-target read: live derivation + 30s read-through on the signal

For `GET .../process-status` (service-owner path), the derivation rules run **on every
read** over live local inputs; only the signal comes from the snapshot:

```
inputs  ← local DB reads                          (always live — zero staleness)
rules don't need the signal (pre-CONFIRMED)?      → answer immediately; no snapshot, no SDK
signal valid ⇔ confirm_epoch matches AND age(computed_at) ≤ 30s
signal valid                                      → derive with cached signal (warm path)
signal invalid/missing                            → blocking SDK check, epoch-guarded
                                                    write-back (D4), derive with fresh signal
```

Two properties fall out:

- **Everything except the installation dimension is exact.** A target moving
  `IDLE → PENDING → CONFIRMING → CONFIRMED`, or any other cheap-input change, is visible
  on the very next read — the cache cannot stale it, because it is not cached.
- The blocking SDK check is **no worse than the status quo** — today *every* read pays it;
  here only the first read after signal expiry or a confirm-epoch change pays it — and
  D3's enrollment usually pays it first: a newly CONFIRMED target is picked up and checked
  by the sweeper within one loop tick, so the blocking first read happens only when a
  human beats the sweeper to it. Responses include the signal's `computed_at` so the
  client can display data age.

Two deliberate simplifications, each with a named ceiling:

- **No read-path single-flight.** Concurrent readers of the same expired target may
  duplicate the SDK check. The check is an idempotent read (A3), duplicates are bounded by
  per-target viewer count within one 30s window, and every result is epoch-guarded on
  write. Ceiling: SDK quota waste under FE polling of one target — add row-claim
  single-flight only if quota pressure materializes.
- **No "serve stale while refreshing".** The service owner is actively working the
  installation; a fresh answer is worth the occasional wait they already tolerate today.
  Ceiling: the ~28s AWS tail — upgrade path is a bounded wait (e.g., 10s) then derive
  with the stale signal flagged `refreshing: true`.

### D3. Full list: live derivation over cached signals; sweeper maintains a 1h SLO

The list endpoint (Admin page) **never triggers SDK calls**. It is one query over the
domain tables `LEFT JOIN installation_signal_snapshot`, with the derivation rules applied
in-process per row — cheap, since every input is now local. Rows whose rules need a signal
that is missing or epoch-invalid render as *refreshing* rather than blocking the list.
Cheap-input transitions appear in the list **immediately**; only the installation
dimension carries the snapshot's age, which each row exposes honestly.

Signal freshness is maintained **proactively** by a sweeper — one scheduled loop, one
query:

```sql
-- discovery and due-selection in a single scan (no separate enrollment mechanism):
SELECT ts.id FROM target_source ts
  LEFT JOIN installation_signal_snapshot s ON s.target_source_id = ts.id
 WHERE ts.confirm_status = 'CONFIRMED'
   AND (s.target_source_id IS NULL OR s.next_check_at <= NOW())
 LIMIT :k FOR UPDATE OF s SKIP LOCKED;
```

- Missing rows are inserted on first encounter (`INSERT IGNORE`; the PK makes the race
  across pods harmless). A target that reaches CONFIRMED is thus picked up within one
  loop tick, with **no separate enrollment job**.
- After each check the row is rescheduled: `next_check_at = NOW() + 1h` on success,
  backoff on failure (D6). Per-row rescheduling self-spreads the load across the hour
  after the first cycle — no cron-style fleet-wide burst, no explicit jitter needed.
- **The 1h is a staleness SLO, not a cache TTL.** The distinction is the heart of this
  ADR: a TTL waits for a viewer; the SLO is enforced by the sweeper for every CONFIRMED
  target, continuously — which is what "detect Process changes across all targets"
  actually requires (C8, admin persona). Installation-driven changes are detected within
  the SLO; cheap-input-driven changes are exact at any read, with no sweep involved.

Capacity check (under A1, fleet ≈ 2,000): worst case all CONFIRMED and needing SDK calls
at avg ≈ 5s (AWS-dominant) → ≈ 2.8 worker-hours per sweep cycle. Three sweep workers (one
per pod under C5) sustain the 1h SLO at ~93% utilization in that worst case — and the
worst case is the operative sizing, because **ProcessStatus can regress at any stage,
including from COMPLETED (Step 7)** (C10): the sweeper has no terminal state to retire
targets into, so every row stays in the sweep permanently. Targets not yet CONFIRMED cost
nothing — they have no row. If the fleet outgrows this: more workers per pod, or tiered
cadence (active installs every 10 min, others hourly) — parameter changes, not design
changes. **A1 must be verified**: the math is linear in fleet size.

### D4. Confirm-epoch invalidation

Infra Manager knows when confirmation happened, and exposes it **only as a timestamp**
(`confirmedAt`, C9) — no version counter exists. The confirm epoch is therefore that
timestamp **treated as an opaque token**: the snapshot stores the target's `confirmedAt`
verbatim (`DATETIME(6)`), and the token is compared only against other values of the same
token — equality for validity, ordering for the write guard. Both operands always
originate from Infra Manager, and the token is **never compared against DB or pod
clocks**, so clock skew cannot corrupt epoch decisions. Residual risk: two
re-confirmations within one representable instant are indistinguishable — accepted; the
window is at worst the source precision, and the next sweep re-syncs the row regardless.

**Confirmation lifecycle (C11): create/delete only, never updated.** "Re-confirmation" is
delete → create, so a new confirmation is always a *new record* with a fresh `confirmedAt`
token. Deletion without re-creation leaves the target unconfirmed, and that case needs
**no special-case code** — it falls out of the existing mechanisms:

- The very next read stops consulting the signal at all: `ConfirmStatus` is no longer
  CONFIRMED, so live derivation (D2) answers from DB facts alone. A deleted confirmation
  is honored with **zero staleness** — the snapshot cannot serve a meaningless
  installation answer, because the rules never ask for it.
- The sweeper's due-query no longer selects the row (`confirm_status = 'CONFIRMED'`
  filter), so no SDK quota is spent on unconfirmed targets. The row sits inert until
  pruned with the orphan sweep, or revived by a future confirmation — whose fresh token
  then fails the equality check and forces a new SDK check before the signal is ever
  consumed again.
- A confirmation deleted *mid-check* is equally harmless: the in-flight result writes
  back stamped with the old token, into a row nothing reads or sweeps; if a new
  confirmation appears, the equality check rejects that signal on first contact.

Rules:

- **Validity, not just age.** A cached signal is valid only if its `confirm_epoch` equals
  the target's current epoch. An epoch mismatch invalidates the signal *regardless of
  age* — a signal obtained before confirmation answered a different world.
- **Single-target read on mismatch → blocking SDK check** (D2's invalid branch). The
  moment after confirmation is exactly when a stale signal is most misleading.
- **List on mismatch → serve honestly, refresh urgently.** The row is rendered with a
  *refreshing* marker (the UI decides presentation), and `next_check_at` is set to `NOW()`
  so the sweeper picks it up immediately. The list never blocks on one target's SDK call.
- **Epoch-guarded write-back.** Every writer (sweeper or read-through) writes
  `... WHERE target_source_id = :id AND confirm_epoch <= :E`, stamping the epoch it
  checked under. If a re-confirmation raced a long-running SDK call, the stale result
  loses the write and the row stays due for refresh. Between two same-epoch writers,
  last-write-wins is acceptable — both wrote fresh results. (Same
  ownership-guarded-write-back discipline as ADR-021 Decision 4.)

Why not simply "invalidate on confirm" (hook the confirmation code path and delete the
row)? It was considered: if every (re-)confirmation demonstrably flows through one code
path in our own system, a synchronous row-delete there is simpler at read time. But
confirmation state is owned by Infra Manager (C9), and this ADR does not want correctness
to depend on hooking every present and future confirm path. Compare-on-read is hook-free
and self-healing. If placement (A2/OQ3) lands the mechanism *inside* Infra Manager next to
the confirm transition, this decision may be revisited in favor of the hook.

### D5. Multi-pod coordination: claim-by-rescheduling, no leases

Sweeper mutual exclusion needs no lease columns. A worker claims due rows in a short
transaction — `SELECT ... FOR UPDATE SKIP LOCKED` (D3's query), then immediately
`UPDATE next_check_at = NOW() + :inflight_window` (e.g., 5 min) and commit — before making
any SDK call. The bump **is** the claim:

- Concurrent workers skip locked rows (`SKIP LOCKED`), and a bumped row is no longer due —
  no two workers check the same target.
- If a pod dies mid-check, the row simply comes due again after the in-flight window —
  crash recovery with no lease-expiry bookkeeping, no reclaim scan, no leader election.
- The write-back after the SDK call sets the real `next_check_at` (+1h / backoff) and is
  epoch-guarded (D4).
- Works identically at any replica count — C5's "3 pods" is an instance of N, not a
  design input.
- No MySQL named locks (`GET_LOCK`): not portable to H2 `MODE=MYSQL` (C6). H2 2.x supports
  `FOR UPDATE SKIP LOCKED`, keeping tests faithful.

The read-through path does not participate in claiming at all (D2): it checks, writes
epoch-guarded, and tolerates bounded duplicates (A3).

**Why not reuse the ADR-016/021 pipeline itself:** its `CONDITION_CHECK` tasks are
count-bounded with terminal states — a poll that eventually *ends*. Signal refresh is a
**perpetual, per-target recurring job with no terminal state** (C10). Forcing it into the
pipeline's lifecycle (attempts, fail-caps, DONE) would distort both. We reuse the
*claim-pull idea*, not the pipeline tables.

### D6. Failure handling and observability (the operator persona)

- A failed SDK check (error, timeout) updates `last_attempt_at`, increments `fail_count`,
  records `last_error` — and **leaves the last good `installation_done` and `computed_at`
  untouched**. Readers derive with the last known good signal and its visible age; they
  are never handed an error page because a background refresh failed.
- Failed rows are retried with backoff: `next_check_at = NOW() + min(base × 2^fail_count,
  cap)`. Global SDK concurrency is naturally capped by the sweep worker count (3);
  per-CSP concurrency caps are **not** built in v1 — add only if a real quota incident
  shows one CSP's brownout starving the others.
- On every recompute (sweep or read-through), the worker also derives ProcessStatus and
  maintains the **operator metadata** columns: `status_changed_at` updates only when the
  derived **value** differs from the stored `process_status`. This single column answers
  the Admin's stall question — "CONFIRMED for 3 days" — by sorting, without a history
  table. Granularity is the sweep cadence, which is sufficient for stall detection;
  clients never read these columns.
- Metrics/alerts: signal-staleness distribution (`NOW() − computed_at`), alert when any
  row exceeds 2× SLO; consecutive-failure alert on `fail_count ≥ N`; per-CSP check
  latency and error rate.

### D7. Exception matrix — every lifecycle/failure case, decided

Two absolute rules govern every cell below:

1. **A cross-epoch signal is never consumed.** Same-epoch-but-old is *stale* (servable,
   with visible age); different-epoch is *invalid* (never servable, at any age).
2. **A status read never fails because the SDK failed.** When the rules need a signal and
   no valid one can be obtained, the response is the **floor stage** — the highest stage
   provable from DB facts alone (CONFIRMED) — plus an explicit `signalUnavailable` marker.
   Asserting `installation_done = false` would be a claim we cannot back; the floor +
   marker states exactly what is known and what is not.

| # | Case | Single-target read | List row | Sweeper |
|---|---|---|---|---|
| 1 | Signal fresh, epoch match | derive with signal (warm path) | same | not due |
| 2 | Signal stale (> 30s), same epoch | blocking SDK check → derive fresh | derive with stale signal + visible age (≤ 1h SLO) | due at `next_check_at` |
| 3 | Case 2 and the SDK check **fails** | derive with last-known-good same-epoch signal + age + `fail_count` visible (D6) | same | backoff retry; alert on threshold |
| 4 | **Epoch mismatch** (confirm deleted + recreated) | blocking SDK check → derive fresh | *refreshing* marker + floor stage; `next_check_at = NOW()` | picks up immediately |
| 5 | Case 4 and the SDK check **fails** | **floor stage (CONFIRMED) + `signalUnavailable`** — the old signal is never consumed | same | backoff retry from `NOW()` |
| 6 | **No row yet** (confirmation just created) | blocking SDK check (first read) — usually pre-empted by enrollment within one sweep tick (D2/D3) | *refreshing* marker + floor stage | enrolls + checks within one tick |
| 7 | **Confirmation deleted**, not recreated | rules never consult the signal → exact answer from DB facts, zero staleness (D4/C11) | same | row not selected (filter); inert until pruned or revived |
| 8 | Confirmation deleted **mid-check** | in-flight result lands in an inert row; harmless (D4) | — | next tick no longer selects the row |
| 9 | **Long SDK call right after confirmation** (the ~28s AWS tail) | bounded by the blocking path; mitigations: enrollment prefetch (case 6), bounded-wait + `refreshing: true` upgrade path (D2) | never blocks — *refreshing* marker until the check lands | in-flight window (5 min) guards against double-checking |
| 10 | Target source deleted | domain 404 path (unchanged) | absent | orphan prune |

The floor-stage-plus-marker contract (rule 2) is the API's honesty guarantee: the client
can always distinguish "installation not done" (`installation_done = false`, fresh) from
"installation unknown" (`signalUnavailable`), and the UI decides how to render each.

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
  read-through misses) instead of proportional to page views.
- Operators gain a monitorable surface (staleness, failures, error causes) where today
  there is none.
- Minimal machinery: **one table, one scheduled loop, one due-query**; no leases, no
  enrollment job, no read-path locking, no new infrastructure.

### Negative / accepted costs

- The installation signal is stale by design: up to 30s (single read) / 1h (list).
  Accepted per persona analysis (C8); both bounds are tunable parameters.
- The unlucky first reader after signal expiry or confirmation still waits for a live SDK
  call (up to ~28s worst observed). Accepted in v1: strictly rarer than today, with a
  defined upgrade path (D2).
- Concurrent readers of one expired target can duplicate an SDK check (A3). Bounded and
  harmless; single-flight is a known upgrade if quota pressure appears.
- Every read now runs the derivation rules in-process. Negligible: the rules are pure
  logic over local reads; this is what the BFF did before, minus the SDK call.
- A new background responsibility (the sweeper) — one more moving part, mitigated by D6
  being designed in from the start.
- Detection granularity for *installation-driven* changes on unwatched targets is the
  sweep cadence (1h). If Admin ever needs minutes-level detection fleet-wide, that is the
  D3 tiered-cadence knob or the Option E accelerator — both anticipated, neither built now.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| CSP quota/throttling from sweeping (AWS enumeration is heavy) | sweep worker count caps global concurrency; per-row rescheduling self-spreads load; backoff on failure; per-CSP caps as a known knob if an incident occurs |
| Re-confirmation racing a long SDK check writes a stale-epoch signal | epoch-guarded write-back (D4) |
| Pod clock skew corrupting age/epoch comparisons | DB clock for signal ages; the confirm epoch is an opaque Infra-Manager-issued token compared only against itself |
| `ddl-auto: update` won't retrofit indexes | full index/PK definitions on the entity from first deploy |
| H2/MySQL divergence in tests | `SKIP LOCKED` + due-bump only (H2 2.x-compatible); no `GET_LOCK`, no vendor-specific locks |
| Deleted/offboarded target sources leave orphan snapshot rows | sweeper prunes rows whose target no longer exists |
| Fleet size assumption (A1) wrong → SLO math off | verify count before implementation; math is linear, workers-per-pod is the dial |
| Reintroducing ADR-004's stored-field drift | the derived status is never served from storage at all; only an input is cached, written solely by the SDK check, with provenance columns |

## Open Questions

Resolved by stakeholder (2026-07-02), folded into the decisions above:

- ~~Can ProcessStatus regress after COMPLETED?~~ **Yes — any stage, any time** (C10) →
  perpetual sweep, worst-case sizing.
- ~~Does Infra Manager expose a confirm version?~~ **No — only `confirmedAt`** (C9) →
  timestamp-as-opaque-token (D4).
- A design-review round (2026-07-02) redefined the cache unit from the derived
  ProcessStatus to the installation signal (Option C → Option D). A simplification round
  (2026-07-03) removed lease columns (→ claim-by-rescheduling), the separate enrollment
  job (→ folded into the due-query), read-path single-flight (→ bounded duplicates under
  A3), and v1 per-CSP caps/jitter (→ worker count + self-spreading schedule). An
  exception round (2026-07-03) added C11 (confirmations are create/delete only) and the
  D7 matrix, closing a previously undefined case: epoch-invalid signal + SDK failure now
  yields floor stage + `signalUnavailable` — never a cross-epoch signal, never an error
  page.

Remaining:

1. Should the Admin page eventually need a **status transition log** (who changed when,
   full history) beyond `status_changed_at`? Out of scope for v1; the sweeper is the
   natural place to append such a log later since it observes every transition.
2. **Is IDC in scope?** IDC is ~half of status-read volume at avg 2.45s, but the stated
   SDK bottleneck covers AWS/GCP/Azure only. If IDC's installation check is also an
   external call, it enrolls like any CSP (one more `csp` value); if its latency has
   another cause, this ADR should state it out of scope explicitly.
3. **Which deployable owns the table and the sweeper** — SIT BFF (which serves the reads)
   or Infra Manager (which owns `confirmedAt` and runs 3 pods)? The mechanism is
   replica-count-agnostic (D5), but placement decides operational ownership, the replica
   count behind the capacity math, and whether D4's hook alternative becomes attractive.

## Related

- [ADR-001](001-process-state-architecture.md) — Data-driven status (computed, not
  stored); this ADR keeps that invariant in its strongest form — the derived status is
  never served from storage.
- [ADR-004](004-process-status-refactoring.md) — discarded stored-field approach; see
  Context for why this is not that.
- [ADR-009](009-process-status-terminology.md) — the seven-state model and FE mapping this
  ADR serves faster, unchanged.
- [ADR-016](016-install-delete-pipeline-domain-model.md) /
  [ADR-021](021-pipeline-execution-model.md) — the claim-pull idea reused in D5, and why
  the pipeline itself is not reused.
