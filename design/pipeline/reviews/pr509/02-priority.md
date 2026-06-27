# PR #509 / ADR-016 Review — Dimension 2: Decision Priority

**Verdict line:** The thesis is **CONFIRMED**. `slotCap` and the API-call concurrency caps are stability/safety knobs that are written with the rhetorical weight of architectural decisions, and the document history proves they are a churn magnet. The load-bearing decision of this design is *"durable DB row is the only state, and a worker claims one pipeline and synchronously owns it end-to-end"* — everything else is a property of, or a tuning knob on, that.

---

## (a) Thesis: confirm or refute — with evidence

**Thesis (user):** slotCap (TF job admission) and API-call concurrency caps are STABILITY/SAFETY mechanisms, not core architectural decisions, yet they are over-emphasized and keep generating churn.

### CONFIRMED. Evidence:

**1. They are caps on a thing, not the thing.**
A safety cap presupposes the mechanism it limits already exists. `slotCap` only has meaning *because* TF jobs are dispatched by the claim-pull loop; the API concurrency bound `min(workerCount, runningPipelineCount)` is a *derived consequence* of "one worker = one in-flight call" — it is arithmetic on the execution model, not an independent decision. The proposal even says so explicitly:

> "maxConcurrentApiCalls ≤ min(totalWorkerCount, runningPipelineCount)" (§4.1)

That is a theorem, not a decision. You don't "decide" it; it falls out of the worker loop. Calling it a top-level concern inverts cause and effect.

**2. The text over-weights them — by raw allocation.**
- In the **ADR `Decision` section** the concurrency/slotCap bullet (decision 5) is one of the longest and most caveated bullets ("`slotCap × maxFailCount`는 동시 실행 상한이 아니라 worst-case 제출량 sizing 값", "poll burst는 `max_external_calls_per_tick`으로 완화"). Compare to `Retry는 새 run`, which is a single clean line. The knob gets more ink than the semantics.
- In the **proposal**, the single largest section is **§4 "동시성 한계 관리"** with three subsections (§4.1 API concurrency, §4.2 runningPipelineCap, §4.3 TF slot), each devoted to disclaiming *what the cap is not* (≠ QPS, soft ≠ hard, bounded overshoot). Then §9 (튜닝 노브) and §10 (V1 보장 범위) re-list the same three caps **a second and third time**. Three passes over tuning knobs; the actual claim/lease single-writer mechanism — the reason the whole rewrite exists — is §2, a half page.
- **Context §5** (확정 제약) *leads* the constraint list with `workerPoolSize` hard-cap + `slotCap` throttle. The first thing a reader meets is a sizing knob, before they learn the system is a DB state machine.

**3. They are demonstrably a churn magnet — the Revision History is the receipt.**
- `2026-06-13` — "slotCap soft target" introduced.
- `2026-06-14` — "slotCap 목표 명시".
- `2026-06-21` — "**settings slotCap 모순 해소**" (a *contradiction* about slotCap had to be resolved on review).
- `Considered Options` carries **two** slotCap-adjacent rows (E: remote slot accounting is racy; F: IM-side concurrency limit deferred) — i.e. design effort was repeatedly spent re-litigating *where the cap lives*.

Three of the dated revisions touch slotCap, including one that exists solely to fix a self-contradiction. By contrast, `retry=new-run`, `per-target uniqueness`, and `idempotency-by-construction` were stated once and never re-opened. **The decisions that are actually load-bearing have been stable; the knob that is over-emphasized is exactly the one generating edits.** That is the thesis, verbatim, in the file's own changelog.

**4. The proposal author already half-agrees.** §4.3 and §8.1 keep retreating the cap from "invariant" to "soft admission target with bounded overshoot ≤ N−1", and push the *hard* version downstream ("Infra Manager-side admission limit으로 승격"). A decision that the design keeps trying to hand to someone else, and keeps re-labelling as "soft", is behaving like a tuning knob, not a load-bearing architectural choice.

### One nuance (so the author doesn't over-correct)

There is a *genuine* hard constraint hiding in the noise: **the fixed TerraformWorker pool (`workerPoolSize`) is a real hard cap on the IM side** (Context §5, constraint 5). That is a true external invariant and must survive. But note: that cap lives *in Infra Manager*, not in the BFF/orchestrator. `slotCap` (the BFF-side counter) is only a *submission throttle* that keeps the pubsub queue shallow — admittedly useful, but operationally a knob, not a correctness invariant (the proposal itself: "soft admission target", overshoot tolerated). So the thesis holds with one sharpening: **the hard cap is real but belongs to IM; the BFF `slotCap` that the ADR over-emphasizes is the soft, knob-shaped half.**

---

## (b) True priority ordering — most load-bearing first

Ranked by: *if you got this wrong, how much of the system is incorrect (not just slower or less safe)?* The top tier are **correctness load-bearers** — wrong = data/infra corruption or violated invariants. The bottom tier are **safety/perf knobs** — wrong = degraded throughput, overshoot, or noise, but the system is still *correct*.

| Rank | Decision | Why it is load-bearing (what breaks if wrong) | Class |
|---|---|---|---|
| **1** | **Durable DB row IS the only state** (state machine in DB, pipeline status derived from tasks) | Everything else assumes restart = re-read row. Get this wrong and there is no crash-safety, no history, no recovery. This is the foundation the whole ADR is paying for. | Correctness / foundation |
| **2** | **Claim-pull execution: one worker owns one pipeline end-to-end (synchronous), single-writer is a lock property** | This is *the* change in PR #509. It is what deletes D-T4, the observation ledger, leader election. The entire simplification thesis rests here. | Correctness / foundation |
| **3** | **Per-target uniqueness (one active pipeline per target) + the 23505→return-existing create contract** | Foundational invariant: "one writer per target" underpins single-writer reasoning, slot accounting, *and* idempotency. The ADR itself flags that omitting the 23505 contract "breaks the target당 실행자 1 premise". Wrong here = duplicate concurrent pipelines on one target = real corruption. | Correctness / foundation |
| **4** | **Idempotency-by-construction (every dispatch idempotent; at-least-once is safe because of it)** | This is what *permits* dropping a DISPATCHING state, permits retry, permits duplicate submits to be harmless. Without it, claim/lease's admitted "duplicate external call can happen" (§7.1) becomes a corruption bug instead of a non-event. | Correctness / foundation |
| **5** | **Retry = new run, not resume (terminal is final)** | Keeps the state machine small (no terminal resurrection, no mid-run checkpoint state) and is safe *only because* of #4 (terraform convergence makes redo a no-op). Defines terminal semantics. | Correctness / semantics |
| **6** | **Bounded blocking via worker pool + per-call timeout + lease > maxCallTimeout invariant** | The reason sync calls don't hold the system hostage; the `leaseDuration > maxApiCallTimeout + margin` invariant is the one *hard* rule that keeps the duplicate-call window closed. Half-correctness, half-knob — but the invariant half is non-negotiable. | Correctness invariant + knob |
| **7** | **Multi-pod nativeness via SKIP LOCKED (⇒ no leader election, no replicas=1)** | A *property* of #2, not an independent decision — but worth stating because it deletes a whole subsystem (leader election). Listed here, not higher, because it is consequence-of-claim, not a separate axiom. | Consequence / scaling |
| **8** | **Queue is derived (ORDER BY next_due_at), no broker/queue table** | A simplification *choice* riding on #2; correct because jobs are independent (approx-FIFO is a fairness, not correctness, property). | Simplification |
| — | *cut line: below here is safety/tuning, not architecture* | | |
| **9** | **`slotCap` — TF submission throttle (soft admission target)** | Protects IM from submission bursts; bounded overshoot tolerated. Pure stability knob. The real hard cap is `workerPoolSize` **in IM**, not this. | Safety knob |
| **10** | **`runningPipelineCap` (M) — soft cap on concurrent RUNNING pipelines** | Optional, soft, overshoot ≤ N−1. Stability knob. | Safety knob |
| **11** | **API-call concurrency bound `min(workerCount, runningPipelineCount)`** | *Derived* arithmetic, not a decision. Document as a property, not a section. | Derived property |
| **12** | **Reactive backpressure (429/503 → next_due_at backoff); QPS limiter out of V1** | Rate cooperation, explicitly deferrable; hard QPS limiter is a named follow-up. | Safety knob |
| **13** | **Tuning constants: N (worker count), `slotRetry`, lease length, poll cadence** | Literally the "knobs" section (§9). | Tuning |

**The shape of the verdict:** ranks 1–6 are where correctness lives and where the design effort *should* concentrate. Ranks 9–13 are where the document *currently* concentrates its prose and its churn. That mismatch is the whole point.

---

## (c) Reordered Decision-section outline

Goal: high-priority correctness decisions on top; demote slotCap / API-cap / running-cap / cadence into one clearly-fenced **"Safety mechanisms & tuning knobs"** subsection so they stop reading as architecture and stop attracting churn.

```
## Decision

  Lead sentence (the one-line architecture):
  "A durable DB row is the only state. N worker threads each claim one pipeline
   (FOR UPDATE SKIP LOCKED + lease) and synchronously own it end-to-end: run the
   current task's one external call, then transition. Single-writer is a lock
   property, not a coordinated protocol."

### D1. State lives in the DB (durable state machine)        [load-bearing #1]
    - pipeline + task rows are the only state; pipeline status derived from tasks.
    - restart = re-read rows and resume; no in-memory run state.

### D2. Claim-pull execution & single-writer-by-lock          [load-bearing #2]
    - one worker owns one pipeline; sync call inside the claim; report under
      ownership CAS. No tick/call writer split, no observation ledger.
    - (subsumes the deleted D-T2 async fire and D-T4 two-writer split.)

### D3. One active pipeline per target (uniqueness contract)  [load-bearing #3]
    - partial unique on (target, non-terminal); create is
      "resolve → insert task+snapshot atomically → on 23505 return existing".
    - NORMATIVE: trigger endpoints MUST carry the 23505→return-existing
      integration test (foundation invariant lives in external endpoint code).

### D4. Idempotency-by-construction                           [load-bearing #4]
    - every dispatch idempotent; at-least-once is safe *because of* this.
    - "already in desired state" counts as success; this is what lets D-state
      machine omit a DISPATCHING state.

### D5. Retry = new run; terminal is final                    [semantics #5]
    - no resume, no terminal resurrection; completed work is a TF no-op on redo.

### D6. Bounded blocking + the lease invariant                [invariant #6]
    - per-call timeout; bounded worker pool.
    - HARD INVARIANT: leaseDuration > maxApiCallTimeout + safetyMargin
      (this is the one knob that is actually a correctness rule — keep it here,
       not in the tuning section, and flag it as an invariant).

### D7. Multi-pod native (consequence of D2)                  [scaling property]
    - SKIP LOCKED makes claim multi-pod safe ⇒ NO leader election,
      NO advisory-lock leader, NO replicas=1. State as a derived property of D2.

### D8. Derived queue (no broker)                             [simplification]
    - "queue" = ORDER BY next_due_at over due pipelines; approx-FIFO is a
      fairness property (jobs independent), not a correctness requirement.

---

### D9. Safety mechanisms & tuning knobs   ← DEMOTED, FENCED, EXPLICITLY "NOT CORE"
  > Preamble: "None of the following changes what the system *computes*. They
  >  bound resource pressure and rate. All are soft unless noted; the real hard
  >  cap on concurrent TF execution is workerPoolSize **in Infra Manager**, not
  >  here. Tune freely; do not let these re-open the decisions above."

    9.1  slotCap — BFF-side TF submission throttle (SOFT admission target,
         bounded overshoot ≤ N−1; hard version = IM-side admission, deferred).
    9.2  runningPipelineCap (M) — optional soft cap on RUNNING pipelines
         (worst case M+N−1).
    9.3  API-call concurrency — DERIVED property min(workerCount,
         runningPipelineCount); documented, not decided.
    9.4  Reactive backpressure — 429/503 → next_due_at backoff;
         hard QPS limiter is OUT of V1 (named follow-up).
    9.5  Tuning constants — N (workers), slotRetry, lease length, poll cadence.
```

### What this reordering buys

1. **A reader learns the architecture in D1–D2** (two paragraphs) before ever meeting a cap. Today they meet `workerPoolSize`/`slotCap` in Context §5 first.
2. **slotCap can churn inside §9 without touching the architecture.** The 06-21 "slotCap 모순 해소"-class edits land in a fenced subsection labelled "not core", so future tuning edits stop looking like architectural revisions and stop dragging reviewers back through the load-bearing decisions.
3. **The one real invariant in the knob family (lease > maxCallTimeout) is promoted out** of the tuning section into D6, so it isn't mistaken for a tunable.
4. **The `min(...)` bound is reframed as derived (9.3)**, killing the recurring confusion (concurrency vs QPS) that §4.1 currently spends a paragraph disclaiming.
5. **Requirements-Satisfied mapping** should mirror this: FR-8 (BFF-visible TF limit) maps to §9.1, *not* sit among the foundational FRs — so the requirements list stops elevating a knob to peer status with crash-safety (NFR-1) and at-least-once safety (NFR-2).
```

---

## Stale framing to fix while reordering (flagged per task brief)

- **"in BFF" is now stale.** ADR title, Context, constraint 1 ("오케스트레이션 주체는 BFF"), and the "BFF가 stateless proxy가 아니다 … 다중 replica엔 리더 선출 필요" Negative all assume the orchestrator lives in the BFF. Per the new decision it runs in a **separate dedicated Server**. The reordered Decision should open by naming that server; constraint 1 should read "orchestration主체 = dedicated pipeline Server" and the `slotCap` text should say "Server-side throttle" not "BFF-side".
- **Leader election is already dead** (D7), so the Negative bullet "(다중 replica엔 리더 선출 필요)" — currently sold as "본 ADR에서 가장 비싼 한 줄" — is no longer true. It should be *removed*, not demoted. SKIP LOCKED replaced it. That single deletion also weakens Option B's ("separate orchestrator service") rejection rationale, which the reorder should revisit since the implementation is now in fact a separate server.
