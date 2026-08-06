# PR #509 Review — 05: Can `task_check` collapse to columns on `task`?

> Scope: evaluate whether the OLD `task_check` observation ledger survives the Claim-Pull
> Worker model, and if so in what shape. Verdict up front, evidence below.

## TL;DR

**There is nothing to collapse.** `task_check` was already dropped in the current canonical
baseline (`minimal-redesign.md` + the `test-spring-min/` reference impl). The Claim-Pull
proposal independently re-confirms the drop. The real question is therefore *not* "collapse
the existing ledger" but "should PR #509 re-introduce any per-check observation surface at
all" — and for **correctness the answer is no**. For **observability**, a tiny set of columns
on `task` is the right amount, only if a concrete consumer asks for it. Recommendation:
**drop the ledger entirely; add at most 4 thin observability columns on `task`, deferred until
a real reader exists.** Do NOT re-add a separate table.

---

## (a) Does the minimal impl / Claim-Pull model still HAVE a `task_check` ledger?

**No. It is already gone — in two independent places — and was never present in the running code.**

1. **Reference impl (`test-spring-min/`) — verified by grep, zero hits.**
   - `grep -ril "task_check"` over the whole module → **no matches**.
   - `grep -rn "request_count|last_checked|poll_count|attempt|requestCount"` over `src/` →
     **no matches**. There is not even a vestigial observability column.
   - The full data model is **2 tables** (`pipeline`, `task`) across 24 files. `Task.java`
     (`domain/Task.java`) holds the entire per-task state inline: `status`, `jobId`,
     `failCount`, `errorCode`, `startedAt`, `readyAt`, `finishedAt`, `nextCheckAt`, the four
     optional knob overrides, and a `@Version`. No check/attempt rows anywhere.

2. **Canonical spec (`minimal-redesign.md`) — drops it explicitly.**
   - §6 "Data model (2 tables)": *"Dropped vs ADR-016: `task_check` (observation ledger),
     `task_attempt` (attempt history), `pipeline_event` (outbox), `pipeline_def_snapshot`."*
   - §8 cut table: *"Observation ledger (`task_check` / RLE / attempt correlation / pruner)
     → `status` + `error_code` on the task → Lost: full observation/audit history."*

3. **Claim-Pull proposal (`single-pipeline-tick-proposal.md`) — re-confirms the drop.**
   - §1.2 / §3 (component 5/7) / §8 all list `task_check` under **삭제 (deleted)**: *"task_check
     관측 원장 + RLE 압축 + retention pruner"* and *"Report (tx2): task_check 적재 → 직접 전이로 대체"*.

4. **The ADR itself is stale on this point.** `ADR-016` still describes the *maximal* design
   (`task_check`, RLE `poll_count`, `task_attempt`, 90-day retention) and its own header warns:
   *"아래 Decision/Consequences는 maximal 설계를 기술한다 … 현행 정본 스펙은 minimal-redesign.md."*
   So any reading of "we have a `task_check` ledger today" comes only from the superseded ADR,
   not from the code or the canonical spec.

**Current reality:** the ledger does not exist. PR #509 is not removing it — it inherits an
already-ledger-free baseline. The decision in front of us is purely *whether to add back* a
thin observability surface, and in what form.

---

## (b) Can it collapse to columns on `task`? Proposed exact column set

Yes — and this is strictly *additive observability*, not a structural change. If a consumer
needs "how often / when / with what outcome did we last touch this task externally", the
minimal honest column set is **four** columns (plus `fail_count`, which already exists):

```sql
ALTER TABLE task ADD COLUMN last_requested_at  timestamptz NULL;  -- last time we DISPATCHED an external mutation (TF run submit)
ALTER TABLE task ADD COLUMN last_checked_at    timestamptz NULL;  -- last time we POLLED/CHECKED status (read-only probe)
ALTER TABLE task ADD COLUMN last_result        text        NULL;  -- coarse outcome of the most recent external call
ALTER TABLE task ADD COLUMN request_count      int  NOT NULL DEFAULT 0; -- # of external CALLS attempted for this task (dispatch + poll)
-- fail_count already on task (Task.java) — reuse it; do NOT add a second failure counter.
```

Column-by-column justification (each must earn its place):

| column | what it answers | why a column, not derivable | keep? |
|---|---|---|---|
| `last_requested_at` | "when did we last fire the side-effecting dispatch?" | not derivable: `startedAt` is set on the *successful* transition to IN_PROGRESS; a dispatch that timed out and retried leaves no timestamp today | **keep** — the one genuinely lost signal (attempted-vs-not, §c) |
| `last_checked_at` | "is the poller alive / last probe time" | `nextCheckAt` is the *future* due time, not the last *actual* probe | **keep** — cheap liveness |
| `last_result` | "outcome of the most recent call" (e.g. `STILL_RUNNING` / `429` / `OK` / `TIMEOUT`) | the row only keeps the *terminal* `errorCode`; mid-flight outcomes vanish | **keep, but coarse** — a short enum-ish string, not a response blob |
| `request_count` | "how many external calls have we made" (incl. polls) | `failCount` counts *failures* only; total attempts is unrecoverable from it | **keep if** ops wants call-volume per task; otherwise droppable |
| `fail_count` | retry budget + failure volume | already exists, load-bearing for `retryOrFail` | **already present** |

Notes that keep this honest:
- These columns are **last-value (degenerate RLE with n=1)**. They are the natural limit of the
  OLD "run-length-encoded rows + poll_count" idea once you accept you only ever need the *latest*
  observation per task — which the single-writer model makes true (see §d).
- `request_count` is the surviving shadow of the old `poll_count`, but **per-task aggregate**
  instead of a separate row. If nobody reads call-volume, drop it and keep three.
- **No `last_response_body` / no per-attempt JSON.** That is the maximal `task_attempt.response`
  resurfacing; it belongs in logs/traces, not the hot OLTP row (see §c-1).

---

## (c) What is LOST by dropping the per-check ledger — and is each loss acceptable?

The OLD ledger bought three things. Judge each against (i) the synchronous single-writer model
and (ii) the **separate dedicated Server** deployment (NEW decision: pipeline runner is its own
Server, not the BFF).

### Loss 1 — Full audit trail of *every* external call

- **What's gone:** one durable DB row per IM call (dispatch per-call, check per-run), queryable
  for 90 days, "log archaeology-free".
- **(i) single-writer angle:** the *reason* the ledger had to be in the DB is gone. In the OLD
  async two-writer split, the call result returned on a foreign thread at an arbitrary time, so
  the only safe rendezvous was a durable row the tick could later read. In Claim-Pull the *same
  worker* makes the call and writes the transition in one flow — the call result is in-hand local
  data. There is no cross-thread handoff that *forces* a DB row. So persistence of the call is now
  a free *choice*, properly satisfied by **structured logs / traces** at the call site.
- **(ii) separate-Server angle:** this *strengthens* the "logs not table" answer. A dedicated
  runner Server has its own log pipeline and is the sole caller of the IM API; emitting one
  structured log line per external call (`{pipelineId, taskId, op, result, latencyMs, attempt}`)
  gives the same audit trail with **better** tooling (full-text search, retention, sampling) and
  **zero** OLTP write amplification — which the ADR itself flags as a cost
  (*"관측 로그(task_check)는 … DB 트래픽"*). It also removes the 90-day **retention pruner** entirely.
- **Verdict: ACCEPTABLE.** Audit-of-every-call moves from a DB ledger to the runner's log/trace
  stream. The only thing the *row* still needs to carry is the *latest* outcome (`last_result`)
  for at-a-glance UI/debug without a log query. Full history = logs.

### Loss 2 — "Attempted vs not attempted" distinction

- **What's gone:** the ability to tell "we fired the dispatch but it failed/timed out" apart from
  "we never got to fire it". The OLD model recorded the attempt *before* the outcome (the D-T5
  dispatch-before marker), so a crashed/timed-out dispatch still left a footprint.
- **(i) single-writer angle:** this is the **one loss that touches the task row**, and it's real.
  Today `startedAt` is only set on the *successful* hop to IN_PROGRESS (see `TaskMachine.dispatch`),
  so a dispatch that timed out and went back to READY via `retryOrFail` leaves **no timestamp** —
  you cannot distinguish "attempted-and-failed" from "never attempted" from the row alone. The
  proposal already calls this out (§7: *"dispatch만 외부 side-effect라 '시도했음' 이력이 필요하면 그때만
  D-T5식 선기록"*). `last_requested_at` (set right before the dispatch call) restores exactly this
  distinction with **one column**, no ledger.
- **(ii) separate-Server angle:** orthogonal to deployment; the column lives on the task row
  regardless of which Server writes it. (The log line from Loss 1 also captures it, but a column
  makes it queryable without log correlation and is the natural home for the dispatch-before marker.)
- **Verdict: ACCEPTABLE *with* `last_requested_at`.** This is the column that earns its keep on
  more than convenience — it's the dispatch-before marker the proposal itself reserves the right to
  add. Without it, dropping the ledger genuinely loses a signal; with it, recovered for ~8 bytes.

### Loss 3 — Backpressure history (429/503 / Retry-After series)

- **What's gone:** a time series of throttle responses per task — "how hard is IM pushing back over
  time", reconstructable from the ledger.
- **(i) single-writer angle:** backpressure in Claim-Pull is **reactive and stateless by design**:
  a 429/503 pushes `next_due_at` out by `Retry-After` and releases the claim (§4.1/§6). The control
  loop needs *no* history — only the next due time, which lives on the pipeline row. So the history
  was never a correctness input; it was pure observability of rate-limit pressure.
- **(ii) separate-Server angle:** rate-limit pressure is a **fleet-level** signal (all workers vs
  the IM API), not a per-task one. The right home is the runner Server's **metrics** (a counter
  `im_throttle_total{code=429}`, a histogram of `Retry-After`), not rows fanned across thousands of
  task records. A dedicated Server already owns a metrics endpoint; this is a 2-line counter.
- **Verdict: ACCEPTABLE.** Per-task 429 history is the weakest of the three losses. It belongs in
  metrics, not the DB. `last_result` optionally capturing the *most recent* `429` is enough for
  "why is this one task stuck" debugging; the *series* is a Prometheus counter.

**Summary of losses:** 2 of 3 (full audit, backpressure history) move cleanly to logs/metrics on
the dedicated Server — strictly better tooling, and they *shrink* OLTP load. Only the
attempted-vs-not distinction touches the row, and a single `last_requested_at` column fully
restores it.

---

## (d) Does Claim-Pull need `task_check` at all for CORRECTNESS (vs observability)?

**No — zero correctness dependency. Proven, not argued.** The two concerns separate cleanly:

**Correctness — needs nothing from a check ledger.** Every decision the engine makes is derived
from the *task row's own current fields*, never from check history:

| engine decision | input it reads | source |
|---|---|---|
| which task is current | lowest-seq non-terminal `status` | `PipelineReconciliation.currentTask` |
| is it due to act | `nextCheckAt` vs now | `PipelineReconciliation.isDue` |
| dispatch vs poll | `status` (READY/IN_PROGRESS) | `TaskMachine.advance` |
| retry or fail | `failCount` vs `maxFailCount` | `TaskMachine.retryOrFail` |
| timeout/expiry | `startedAt` + `executionTimeout`/`ttl` | `TaskMachine.pastDeadline` |
| crash recovery | re-poll by `jobId` / idempotent re-dispatch | `minimal-redesign.md §5` |
| stale-write / cancel race | `@Version` (→ lease-token CAS in #509) | `PipelineReconciliation` |

The existence proof is decisive: `test-spring-min/` reconciles, retries, times out, recovers from
crash, and guards the cancel race with **110 green tests and no `task_check` whatsoever**. Adding
Claim-Pull does not add a correctness need — it *removes* the only structural reason a separate
observation table ever existed (the async two-writer handoff). Idempotent dispatch + re-poll by
`jobId` means a *re-read* of external state is always safe and authoritative, so a *stored* history
of past reads is never consulted to decide anything.

**Observability — wants the latest outcome, optionally call-volume.** Operators/UI want: last time
we touched it, the last outcome, did we attempt the dispatch, how many calls. All of that is
**last-value-per-task**, satisfied by the §b columns. None of it is *history* in the DB; the history
belongs in logs/metrics (§c).

**Conclusion:** correctness ⟂ check-ledger. The ledger is 100% observability. Therefore the only
question is "how much observability on the hot row vs in logs", and the answer is "the latest
values, not a series."

---

## (e) Final recommendation

**Drop the per-check ledger entirely (it is already gone — keep it gone). Do NOT re-introduce a
`task_check` table. Add at most a thin observability strip on `task`, and defer even that until a
concrete reader exists.**

Concrete shape, in priority order:

1. **Already true — no action:** `task_check` / `task_attempt` / RLE / `poll_count` / retention
   pruner stay deleted. PR #509 inherits the ledger-free 2-table model and the
   reactive-backpressure design; nothing to remove.

2. **Add now (one column, earns correctness-adjacent keep):**
   ```sql
   ALTER TABLE task ADD COLUMN last_requested_at timestamptz NULL;
   ```
   Set it immediately *before* a TF dispatch call. This is the proposal's own reserved
   "dispatch-before marker" (§7) and the sole fix for the attempted-vs-not loss (§c-2). Cheap,
   and it closes the one gap that dropping the ledger genuinely opens.

3. **Add when a UI/ops reader asks (thin strip, still on `task`, still last-value):**
   ```sql
   ALTER TABLE task ADD COLUMN last_checked_at timestamptz NULL;
   ALTER TABLE task ADD COLUMN last_result     text        NULL;
   -- request_count int NOT NULL DEFAULT 0  ← only if call-volume per task is actually consumed
   ```
   Reuse the existing `fail_count`; do **not** add a second failure counter.

4. **Send everything else to the dedicated Server's logs/metrics (NOT the DB):**
   - full per-call audit trail → one structured log line per IM call
     (`{pipelineId, taskId, op, attempt, result, latencyMs}`);
   - backpressure 429/503/Retry-After → metrics counters + histogram;
   - this exploits the separate-Server deployment (own log/metric pipeline) and removes OLTP write
     amplification + the retention pruner the ADR flags as a cost.

**Net:** the ledger collapses past "a few columns" all the way to **one column required now
(`last_requested_at`) + an optional 2–3 column last-value strip later**, with full history living
in the runner Server's logs/metrics. The maximal ledger, RLE, attempt table, and pruner are
correctly eliminated as concept-removal (per `minimal-redesign.md §7`'s rule: cut the feature, the
table goes with it), not re-encoded.

> One-line model: **the task row already tells the whole story; observability needs the latest
> brushstroke (`last_*`), not the whole RLE film reel — and the film reel, if anyone wants it,
> rolls in the runner's log stream, not in Postgres.**
