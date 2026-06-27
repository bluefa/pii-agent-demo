# ADR-021 Split Re-Review (R2) — Opus

Claim-pull rewrite. Read against ADR-016 (boundary + invariant) and minimal-redesign §3/§4/§6.

## Correctness

- **1(a) `status` guard vs cancel resurrection — HOLDS.** tx2's `AND status=:expected_status` no-ops when CANCEL already drove the row terminal; first writer to a terminal state wins, the other is a no-op. This correctly *implements* (not re-decides) ADR-016 D6. **Caveat:** the worked SQL guards only `pipeline`; the invariant is *per-task* (ADR-016 D6, spec §2). The task transition's guarded write is asserted in prose but never shown — a reader could omit it. Show the `task` UPDATE with `WHERE status=:expected` too.
- **1(b) `claimed_by` guard vs lease-expired straggler — HOLDS.** Reclaim rotates the token; straggler's `AND claimed_by=:token` mismatches → no-op. No report clobber. Pre-reclaim stale reports (lease expired, not yet reclaimed) still commit but reflect work actually done and are guarded by status — harmless.
- **1(c) `lease > max_call_timeout + margin` — NECESSARY, NOT FULLY SUFFICIENT as stated.** The bound covers the external call only. The lease clock starts at tx1 commit, but a claimed pipeline then **waits in the bounded worker pool queue** before the call even begins; queue-wait + tx2 commit latency + GC pause all eat the lease. If `margin` doesn't absorb pool-queue-wait, the lease can expire mid-call → reclaim → genuine concurrent double-dispatch. Idempotency (ADR-016 D4) makes the *work* safe, so it's a liveness/cost issue not corruption — but the ADR names the window as "too-short lease" tuning and omits that **pool-queue-wait is a structural contributor to lease consumption**, not just a bad config value. Name it.
- **1(d) crash between tx1 and tx2 — HANDLED.** Claimed-but-unreported pipeline becomes due at `claimed_until < now()`; reclaimer re-polls/re-dispatches idempotently (ADR-016 D4). Cost (≤1 lease pause) is disclosed. Correct, but recovery leans entirely on D4 healing a possibly-lost `job_id` — fine, and referenced.

## Split quality

- **Boundary: clean.** No domain decision re-decided. Uniqueness (D3), idempotency/at-least-once (D4), no-terminal-resurrection invariant (D6) are cited as ADR-016's and only *mechanized* here (claim/lease/guarded write). Execution-only columns (`next_due_at`, `claimed_by`, `claimed_until`) are explicitly claimed by this ADR and disclaimed as non-domain in spec §6. Good seam.
- **Wrong-side decisions: none found.** Status-guard correctly framed as "implements ADR-016 invariant," not as its own invention.
- **Dangling execution detail (real gap):** ADR-021 introduces `next_due_at` but **never specifies who advances it.** tx2's shown SQL sets `status` only; poll-reschedule (spec §3 "reschedule `next_check_at`", §4 back-off "push `next_due_at` forward") is unwired. Without tx2 writing `next_due_at`, an IN_PROGRESS poll task stays `next_due_at <= now()` and is re-claimed every tick (lease-serialized busy-loop) — works, but the scheduling contract is undefined in the ADR that owns the column. The `429/503 → push next_due_at` back-off in Decision-5 notes is asserted with no writer either.
- **Stale wording: none inside ADR-021.** Single-server/in-memory survives only as rejected Option B and in revision history — correct. **Cross-doc staleness (sibling, not this file):** ADR-016 lines 12 & 129 still say "single-server today, active-active later (ADR-021)" — now false, since ADR-021 *is* multi-worker now. Undermines the split narrative; flag for the ADR-016 owner.
- **Over-engineering from going multi-worker: none.** SKIP LOCKED + lease + guarded write, no leader, no broker; `slotCap` deferred to InfraManager's pool. Appropriately minimal.

## Score

**Overall: 85 / 100**

- Correctness & internal consistency — **8/10**: core three races provably correct; loses points for pipeline-only guard SQL and the unnamed pool-queue lease-consumption window.
- Completeness as an execution ADR — **7/10**: claim/lease/recovery complete, but `next_due_at` write + poll/back-off rescheduling — the column it introduces — is unwired.
- Clarity — **9/10**: tx1/tx2 split, two independent guards, and the rejected options read cleanly.
- Altitude — **9/10**: stays at decisions; pushes `N`, `lease_seconds`, `slotCap` to config; resists re-deciding domain.
- Simplicity — **9/10**: no leader/broker, minimal columns, defers the cap correctly.
- ADR-format adherence — **10/10**: status, context, decision, options table, consequences, glossary, revision history all present and coherent.

## Remaining fixes

- **[P1]** Wire `next_due_at`: state that tx2 sets `next_due_at` (poll → `now()+polling_interval`; back-off `429/503` → push forward; terminal → irrelevant). Without it the column it adds has no writer.
- **[P1]** Show the **task-level** guarded write in Decision 4 (or state explicitly both `pipeline` and `task` transitions carry `WHERE status=:expected AND claimed_by=:token`); the per-task guard is the actual invariant.
- **[P2]** In Decision 5 / lease note, name **pool-queue-wait + tx2 latency** as lease consumers, so the bound reads `lease > queue_wait + max_call_timeout + report + margin`, not just call timeout.
- **[P3]** Flag sibling ADR-016 (lines 12, 129) "single-server today" as stale — should read "multi-worker (ADR-021)".

## Verdict

**Yes — merge-ready as Proposed.** The architecture is correct: the three target races (cancel resurrection, straggler clobber, crash-between-tx) are genuinely closed by the status + ownership guards and lease expiry, the boundary with ADR-016 is clean, and no over-engineering crept in with multi-worker. The standing gaps (P1 `next_due_at` writer, P1 task-level guard SQL, P2 lease-budget framing) are completeness/wording refinements appropriate to resolve under Proposed, not correctness defects that block the status.
