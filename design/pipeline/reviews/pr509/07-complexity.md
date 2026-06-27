# PR #509 / ADR-016 Review — Dimension 7: Complexity Hunt

**Spirit of the hunt:** the proposal's own best move was "30s tick scanning N pipelines → one worker owns one pipeline." That collapse deleted D-T4, the observation ledger, and leader election. This review applies the *same blade* to what remains in the proposal — because a rewrite that simplifies is exactly when leftover scaffolding from the old model survives unexamined.

Two buckets:
- **§A — Removable outright** (made dead by the SEPARATE SERVER + claim model; keeping them is pure cost).
- **§B — Candidates to simplify** (mechanism present that the problem may not require; for each: current → simpler → what's lost).

---

## §A — Removable outright (dead given separate-server + claim)

These are not "simplify" — they are "delete". The new model already obsoleted them; the docs still mention them.

| # | Mechanism | Why it is now dead | Action |
|---|---|---|---|
| **A1** | **Leader election** | claim = `FOR UPDATE SKIP LOCKED` is multi-pod safe by construction (§8.1). The proposal already states this. | DELETE. Remove the ADR Negative line "(다중 replica엔 리더 선출 필요)" and NFR-4 "advisory lock + CAS" → replace with "SKIP LOCKED claim". |
| **A2** | **Advisory-lock leader / `replicas=1` constraint** | Same root as A1. The proposal calls both "둘 다 불필요". | DELETE from deployment topology. Horizontal scale = add pods/workers, full stop. |
| **A3** | **All "BFF" coupling / framing** | Implementation runs in a **separate dedicated Server**, not the BFF. So: "BFF가 더 이상 stateless proxy가 아니다", "오케스트레이션 주체는 BFF" (constraint 1), title "in BFF", and `slotCap` = "BFF-side admission". | RE-FRAME to "dedicated pipeline Server". The "BFF gets a DB + background loop" Negative — sold as the single most expensive line — **evaporates**: the BFF stays a stateless proxy; the *Server* owns the loop. This is a net deletion of a stated cost, not a relocation of it. |
| **A4** | **`task_check` observation ledger + RLE + retention pruner** | Already cut by minimal-redesign §6/§8 and proposal §8. Single-writer-by-lock means the worker transitions `status` directly; there is no separate-thread observation to reconcile. | Confirm DELETED (proposal lists it under "삭제"). No residual `poll_count`/RLE machinery. |
| **A5** | **`task_attempt` table + outbox/`pipeline_event`** | Cut by both minimal §6 and proposal §8. | Confirm DELETED. |
| **A6** | **`max_external_calls_per_tick` / poll-burst budget** | This existed to stop one 30s tick from firing a burst of N polls. There is no tick now — each worker makes exactly one call per loop, so per-call pacing is intrinsic. | DELETE. It is a tick-era concept with no referent in the worker loop. (Still mentioned in ADR Decision bullet 5 / Consequences.) |
| **A7** | **Option B rejection rationale ("module-sized logic, service-sized overhead")** | The decision now *is* a separate server. Option B was "별도 오케스트레이터 마이크로서비스 → 보류". That option effectively won. | REVISIT: the Considered-Options table is now internally contradictory (rejects the separate service while the new decision adopts a separate server). At minimum re-label; the cost argument that justified "보류" no longer applies once you've paid for a dedicated server anyway. |

**A6 and A7 are the easy wins reviewers miss:** they read as harmless legacy lines but they actively mislead — A6 implies a tick still exists, A7 implies the orchestrator is co-located. Both contradict the new model.

---

## §B — Candidates to simplify (the real hunt)

Each: **current mechanism → simpler replacement → what is lost.** Ordered roughly by payoff.

### B1. `next_due_at` denormalization onto `pipeline` — *justified, keep, but tighten the contract*

- **Current:** `next_due_at` is lifted from the task's cadence up onto the `pipeline` row (§3.2, §3.3 note), so the claim query can hit a single table.
- **Simpler alternative considered:** keep cadence on `task` only; claim by joining pipeline→current-task.
- **Verdict: keep the denormalization — but it is the design's sharpest correctness hazard, so name the invariant.** The single-table claim is genuinely worth it (the hot dequeue query is `WHERE status=RUNNING AND next_due_at<=now()` with an index; a join-to-current-task on 2000 targets every claim is the kind of thing that *does* bite). The cost is a **derived field that must be re-synced on every task transition** — when the current task advances (seq N done → seq N+1 current), `report()` MUST overwrite `pipeline.next_due_at` from the new current task's cadence in the *same* tx2. If that write is ever missed, a pipeline either spins hot (next_due_at stale-early) or stalls forever (stale-late). 
  - **What's lost / what to add:** nothing is lost by keeping it, but the proposal under-specifies it. **Add to §7 report(tx2): "tx2 always recomputes pipeline.next_due_at from the new current task; a pipeline with a non-terminal task and NULL/past next_due_at and no live lease is a bug, assert it."** This is the single denormalization in the design and it earns its place — but only with that invariant stated. (This is *more* discipline than minimal-redesign, which kept `next_check_at` on the task; the proposal folded it up for the claim query and must pay the sync tax explicitly.)

### B2. The lease (`claimed_by` + `claimed_until`) + ownership-CAS on report — *keep both columns, but `claimed_by` is doing two jobs; one is removable*

- **Current:** three-part lease: `claimed_by` (owner token), `claimed_until` (expiry), plus a `SELECT claimed_by … FOR UPDATE` re-check in tx2 to reject stale reports (§7).
- **The genuine question:** is the `claimed_by` *token* (the CAS guard) actually needed, or does `claimed_until` alone suffice?
- **Analysis — token is needed, here's the failure it stops:** worker A claims, lease length < call time, lease *expires mid-call*, worker B re-claims (sets `claimed_by=B, claimed_until=future`), B starts its own call. Now A returns and tries to report. With only `claimed_until`, A would see a live (future) lease and could write A's stale result over B's task. The `claimed_by != myToken → rollback` check (§7) is precisely what stops A's late write from clobbering B. So the token earns its keep.
- **But: the proposal *admits* this same window still produces a duplicate external call** (§7.1: "lease가 API 호출 중 만료되면 duplicate external call이 발생할 수 있다"), and defends *against the side-effect* with a separate mechanism: the hard invariant `leaseDuration > maxApiCallTimeout + safetyMargin` (§7.1.1) + idempotency keys. 
  - **Simplification insight: if `leaseDuration > maxApiCallTimeout + safetyMargin` truly holds (it is declared a *required* invariant), then the lease CANNOT expire mid-call, the B-re-claim race CANNOT happen, and the ownership-CAS token guards a window that the invariant has already closed.** The token then protects only against pathological clock skew / GC pause exceeding the safety margin.
  - **So the real choice is: pick ONE defense as primary.** Either (a) trust the time invariant and treat the ownership-CAS as a cheap belt-and-suspenders (then *say so* — "the CAS is defense-in-depth for clock skew beyond safetyMargin, not the primary guard"), or (b) treat the CAS as primary and stop over-selling the time invariant. Right now the doc presents **two independent full defenses for the same single window** (time invariant *and* token CAS *and* idempotency key — three layers) without ranking them, which reads as belt + suspenders + a second belt.
  - **Recommendation:** keep `claimed_until` (needed for reaper — A4-style crash recovery). Keep `claimed_by` CAS but **demote it explicitly to "skew/pause backstop"** and make `leaseDuration > maxCallTimeout + margin` the *named primary* mechanism. **What's lost:** nothing structural; you remove a layer of *reasoning*, not a layer of code. The win is conceptual: one primary invariant instead of three co-equal guards a reader must hold simultaneously.

### B3. `slotRetry` poll (busy-wait for a free TF slot) — *simplify the wakeup, or accept it's a non-issue and stop discussing it*

- **Current:** TF task finds slot full → `reschedule(pipeline, now + slotRetry)` → release claim → it gets re-claimed every `slotRetry` (2–5s) until it "happens to meet a free slot" (§2.1, §6). Pure polling; "아무도 안 깨운다".
- **Simpler alternative A (do less):** since TF jobs run for **minutes** and the proposal itself says "빈 slot이 채워지는 지연 = slotRetry — TF는 분 단위라 무의미", the honest move is to **fold `slotRetry` into the ordinary `next_due_at` cadence** — a slot-blocked TF task is just a task that isn't due yet; reschedule it on the *same* next_due_at machinery you already have (B1), with a modest delay. No separate `slotRetry` knob, no separate concept.
  - **What's lost:** a dedicated tuning knob for "how fast do we retry a slot specifically". Given the author's own "분 단위라 무의미", that knob has no use; deleting it removes a concept (§9 lists slotRetry as one of four tuning knobs — this cuts it to three).
- **Simpler alternative B (do even less):** question whether the **whole BFF/Server-side slot gate** needs to be in V1 at all. The real hard cap is `workerPoolSize` **in Infra Manager** (Context constraint 5). IM is async (returns job_id, pubsub queue absorbs submissions) and *all execution APIs are idempotent*. So an over-submission doesn't corrupt — it just deepens the pubsub queue and IM drains at pool rate.
  - **current → simpler:** `tf_slot_counter` + `tryAcquireSlot` + `slotRetry` poll + reschedule  →  **nothing in V1; let IM's pool + pubsub be the throttle**, add the Server-side counter only if queue depth becomes an observed problem.
  - **What's lost:** a shallow pubsub queue (submissions could pile up to "all RUNNING TF tasks at once" before IM throttles). Given ~2000 targets but per-target uniqueness + the worker-count concurrency bound already limit concurrent dispatch to `min(workerCount, runningPipelineCount)`, the burst is already bounded by worker count without `slotCap` at all. **This is the single biggest available deletion** and directly mirrors the ADR's own Option F ("IM-side concurrency limit → 보류, BFF가 유일 caller라 불필요"): if IM-side is deferred *and* the BFF-side is soft *and* worker count already bounds concurrency, the slot gate may be solving a problem the worker pool already solved. Recommend: **make `slotCap` a V1.1 follow-up, ship V1 with worker-count as the only TF concurrency bound**, and measure.

### B4. `tf_slot_counter` (1-row semaphore table) — *contingent on B3; if kept, the CAS is the simple form, the count-read soft form is the trap*

- **Current:** a 1-row table `(used, cap)`. V1 = "count-read soft admit" (read count, decide), with a noted **drift-reconcile** requirement ("주기적 used = 실제 in-flight count로 reconcile") and an *escalation path* to single-statement CAS (`UPDATE … SET used=used+1 WHERE used<cap`).
- **The complexity smell:** the proposal offers **two** implementations of the same counter (soft count-read *and* hard CAS) plus a **drift reconciler** for the soft one. That's three pieces of machinery for one semaphore.
- **current → simpler:** if you keep a slot gate at all (B3 may delete it), **use the single-statement CAS form as the only form** — `UPDATE tf_slot_counter SET used=used+1 WHERE used<cap` returning rowcount. It is *one line*, atomic, multi-pod-correct, and **has no drift** (increment and decrement are the same authority), so it deletes the entire "periodic reconcile used = real in-flight count" subsystem.
  - **What's lost:** the "bounded overshoot" soft semantics — but those semantics were never a feature, they were a *concession* the soft form forced. The CAS form is strictly simpler *and* strictly more correct. The only reason to prefer count-read is to avoid a row-level hotspot on one counter row; at this scale (TF jobs = minutes, dispatch rate = low) that contention is negligible. **Drop the soft count-read form and its reconciler entirely; if a slot gate exists, it is the one-line CAS.** This removes: the count-read code path, the drift-reconcile job, and the §4.2/§4.3 "bounded overshoot ≤ N−1" prose that exists only to excuse the soft form.

### B5. `runningPipelineCap` (M) — *cut from V1; it is an optional soft cap on a thing already bounded*

- **Current:** optional cap M on concurrent RUNNING pipelines, soft, with worst-case `M+N−1` overshoot, plus an escalation path to `pipeline_admission_counter` CAS / DB-constraint admission (§4.2).
- **current → simpler:** **delete from V1.** It is explicitly optional ("선택적"), it is soft (overshoot ≤ N−1), and concurrent *execution* is already bounded by `min(workerCount, runningPipelineCount)` — i.e. worker count *is* the de-facto concurrency cap. A cap on *RUNNING count* (not execution count) only limits how many pipelines exist in RUNNING state, which at 2000 targets with per-target uniqueness is naturally bounded by demand, not by this knob.
  - **What's lost:** an admission throttle on pipeline *creation* rate. If that's ever needed, the escalation path (admission counter) is the real answer; the soft V1 version buys little. Recommend: **remove §4.2 from V1 entirely**; mention "if RUNNING fan-out needs capping, see admission-counter follow-up." This deletes an entire subsection (§4.2) and the `M+N−1` analysis.

### B6. The two-transaction (claim tx1 / report tx2) split — *keep; this one is essential, not excess*

- **Current:** tx1 claims (sets lease, commits), the external call happens **outside any transaction**, tx2 reports (transition + release).
- **Tempting "simplification":** one transaction spanning claim → call → report.
- **Verdict: REJECT the simplification — the two-tx split is load-bearing and correct.** You *must not* hold a DB transaction open across a synchronous external call that can take 60s+ (Context: 200ms–60s+). A 60s-held row lock / open transaction is exactly the connection-pool-and-lock catastrophe the whole "don't let slow calls hold the system hostage" thesis is trying to avoid. The split is the *opposite* of excess complexity — it is the minimum correct structure. 
  - **What would be lost by collapsing to one tx:** correctness and availability (held locks across slow I/O). So this is the rare case where the answer is "the two-step is already the simplest thing that works." **Flag it as load-bearing in the doc so a future simplifier doesn't naively merge it.**

### B7. `errorCode` flavor proliferation — *minor; confirm the fold already done*

- minimal-redesign §2 already folded TIMEOUT/EXPIRY into FAILED + an `errorCode` enum (5 values) rather than separate states. The proposal inherits this. **No action** beyond confirming the proposal doesn't re-introduce per-flavor task states. (Listed only for completeness; this fold is the right level.)

---

## Summary table — what to delete vs. simplify vs. keep

| Item | Disposition | Net effect |
|---|---|---|
| Leader election / advisory-lock leader / replicas=1 (A1,A2) | **DELETE** | removes a whole coordination subsystem |
| BFF coupling / framing (A3) | **RE-FRAME → dedicated Server** | deletes the "most expensive line" Negative |
| `max_external_calls_per_tick` (A6) | **DELETE** | tick-era concept, no referent |
| Option B rejection rationale (A7) | **REVISIT** | now self-contradictory |
| `runningPipelineCap` §4.2 (B5) | **DELETE from V1** | removes a subsection + soft-cap analysis |
| `slotCap` slot gate (B3) | **DEFER to V1.1, measure** | worker count already bounds concurrency |
| `tf_slot_counter` soft form + drift reconciler (B4) | **DELETE soft form;** if kept, one-line CAS only | removes reconcile job + overshoot prose |
| `slotRetry` knob (B3-A) | **FOLD into next_due_at** | one fewer tuning concept |
| ownership-CAS token as co-equal guard (B2) | **DEMOTE to skew backstop;** name time-invariant primary | removes a reasoning layer, not code |
| `next_due_at` denormalization (B1) | **KEEP + state the re-sync invariant** | justified; tighten contract |
| two-tx claim/report split (B6) | **KEEP — load-bearing** | do NOT merge |

**Headline:** after §A deletions and §B5/B3/B4 cuts, the proposal's largest section (§4, three subsections of concurrency caps) shrinks to roughly one paragraph, and the "tuning knobs" list (§9) drops from four knobs to two (worker count N, lease length). The execution core (claim → call → report under lease) is already at the right altitude and should be left alone.
