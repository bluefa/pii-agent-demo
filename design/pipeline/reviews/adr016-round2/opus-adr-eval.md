# ADR-016 — Round 2 Evaluation (Opus)

Reviewer: Claude Opus 4.8 · Date: 2026-06-27
Under review: `docs/adr/ADR-016-install-delete-pipeline-orchestration.md`
Cross-checked against: `design/pipeline/minimal-redesign.md` (canonical spec),
`single-pipeline-tick-proposal.md` (execution-model proposal).

## Assessment

This is now a good ADR — a large improvement over the maximal draft and close to
publishable. Its biggest strength is **altitude discipline**: it cleanly separates
six load-bearing architectural decisions from the throttle/sizing knobs (worker-pool
size, TF-concurrency cap, timeouts), which it correctly demotes to a "Safety
mechanisms" subsection and labels as non-architectural. The "Background & rationale"
and the Considered-Options table make the *why* legible, and the design it describes
is genuinely close to as-simple-as-the-problem-allows for ~2,000 targets and minute-
scale jobs. Its biggest weakness is **a leak of unresolved status**: the ADR presents
a committed posture ("decided", "fixed constraints", a single chosen option) while
resting entirely on two documents that are themselves explicitly *unmerged and
undecided* (`minimal-redesign.md` = "DRAFT… Owner decision pending"; the proposal =
"제안(미채택)"), and it inherits a concrete enum contradiction (`ErrorCode`) that lives
unreconciled in the spec. A secondary weakness is one **misleading load-bearing
heading** ("one worker per pipeline") that the body silently contradicts.

## Score

**Overall: 82 / 100**

Weighting (what I weighted most, and why): for an ADR that has *just been rewritten
to kill over-engineering*, the load-bearing dimensions are **Altitude**,
**Simplicity**, and **Correctness/consistency** — those are the whole point of the
rewrite and the thing most likely to regress. I weighted them ~2× the others.
Completeness, Clarity, and Format adherence are necessary but the ADR is already
strong there, so they move the needle less.

Weights: Correctness 0.22 · Completeness 0.13 · Clarity 0.13 · Altitude 0.22 ·
Simplicity 0.20 · Format 0.10.

| Dimension | Score /10 | One-line justification |
|---|---|---|
| Correctness & internal consistency | **7** | Self-consistent in prose, but inherits the spec's unresolved `ErrorCode` contradiction (4 values vs 5, names don't map) and one heading ("one worker per pipeline") that the body refutes; rests on docs marked undecided while asserting "decided". |
| Completeness | **9** | Status, Context, Decision, Considered Options, Consequences (good + costs), product impact, rationale, glossary, revision history — all present; alternatives have verdicts and reasons. Only gap: no testable acceptance bullets for the consequences. |
| Clarity / readability | **9** | Plain language, jargon defined in a glossary, the central idea ("the DB row *is* the state") lands fast; a non-engineer can follow the narrative. Slightly long, and "at-least-once dispatch" is used before it is explained. |
| Altitude | **9** | Exemplary: architecture (1–6) vs tuning knobs cleanly split; knobs explicitly declared non-architectural; deferrals (TF cap, QPS limiter) named with the condition to revisit. One notch off because lifecycle/retry (item 6) is partly mechanism. |
| Simplicity | **9** | The described design is near-minimal for the stated scale; every dropped mechanism (ledger, lease, leader, outbox) is justified by an explicit lost-capability. Resisting further cuts is correct here. |
| ADR-format adherence (Nygard) | **8** | Title states the decision; Status honest; reversibility/upgrade path explicit. Two deductions: (a) "one decision per ADR" is stretched — it bundles placement + state model + uniqueness + execution model + idempotency + lifecycle, and the source proposal itself suggests the execution model could be its own ADR; (b) consequences are described, not phrased as testable assertions. |

Weighted overall = 0.22·7 + 0.13·9 + 0.13·9 + 0.22·9 + 0.20·9 + 0.10·8
= 1.54 + 1.17 + 1.17 + 1.98 + 1.80 + 0.80 = **8.46 → 82/100** (rounding the
correctness drag and the format/one-decision stretch down from the raw 84.6, because
the ErrorCode contradiction is a factual defect a reader could ship against).

## Fix items

- **[P0]** `minimal-redesign.md` §2 (line 37) vs §7 (line 108), inherited by ADR §2 (line 71) — **`ErrorCode` is defined two incompatible ways.** §2 says `JOB_FAILED | TIMEOUT | CHECK_FAILED | EXPIRED` (4 values); §7 says `JOB_FAILED, EXECUTION_TIMEOUT, TTL_EXPIRED, CHECK_ERROR, CALL_TIMEOUT` (5 values). The names don't even map 1:1 (one `TIMEOUT` vs two timeout causes; `EXPIRED` vs `TTL_EXPIRED`; `CHECK_FAILED` vs `CHECK_ERROR`). The ADR claims "Five enums total" but never pins the values, so it silently endorses both. **Fix:** pick one canonical `ErrorCode` set (the §7 five-value set is the better-reasoned one — it keeps call-timeout and execution-timeout distinct), update §2 to match, and have the ADR either state the canonical values or point at exactly one §.

- **[P0]** ADR §4 heading (line 83): "**a single server with one worker per pipeline**" — **factually misleading and contradicted by its own body.** There is not one worker per pipeline (that implies ~2,000 workers); the next sentences say "bounded worker pool" and "the pool size is the limit on concurrent calls." A reader skimming headings takes away the wrong concurrency model. **Fix:** retitle to "a single server with a bounded worker pool (one worker per *in-flight* pipeline)" or "…one pipeline per worker at a time."

- **[P1]** ADR Status (line 5) + Fixed constraints (line 33) — **"decided"/"fixed" posture on undecided foundations.** Status is "Proposed", yet constraint 1 says the dedicated-server placement is "(decided)", while both referenced docs are explicitly *not* decided (`minimal-redesign.md`: "DRAFT proposal… Owner decision pending"; proposal: "제안(미채택)… PR #494, 미머지"). **Fix:** either (a) downgrade the in-text "decided"/"fixed constraints" language to "proposed constraints (pending sign-off)", or (b) if placement truly is decided out-of-band, say so and stop calling the spec "pending". Pick one stance; don't assert both.

- **[P1]** ADR links — **PR-number cross-reference is unverified / possibly split.** The ADR cites **PR #509** for the Single Pipeline Tick proposal (×4, incl. "#509 §8.1" for the active-active path), but the proposal file itself names **PR #494** as the home of `minimal-redesign.md`. These may legitimately be two PRs (#494 = spec, #509 = execution model), but the ADR never says so, and "#509 §8.1" only resolves if #509 *is* the proposal doc. **Fix:** add a one-line note disambiguating #494 (spec) vs #509 (execution model), and confirm the §8.1 reference points at the doc that actually contains §8.1 (the proposal).

- **[P2]** ADR — **one-decision-per-ADR is stretched.** The Decision bundles six sub-decisions; the proposal doc (§9) itself flags "별도 실행-모델 ADR로 승격 가능(one-decision-per-ADR)". This is defensible as one cohesive "how to orchestrate" decision, but it is at the upper bound. **Fix:** either add one sentence justifying why these six are one decision (they all fall out of "single durable writer"), or split the execution model (item 4 + Safety mechanisms) into a sibling ADR and reference it. A sentence is enough; a split is optional.

- **[P2]** ADR Consequences (lines 135–154) — **consequences are narrated, not testable.** Nygard's value is consequences a future reader can *check*. "Self-heals across crashes" and "no data loss" are assertions, not acceptance criteria. **Fix:** add 3–4 verifiable bullets, e.g. "Kill the server mid-dispatch → on restart the in-progress task is re-dispatched and converges (no duplicate infra effect)"; "Two concurrent creates for one target → second returns the existing run, not a 409 or a second pipeline."

- **[P3]** ADR §5 (line 95) — **"at-least-once dispatch" used before defined.** The heading uses the term; the explanation ("a duplicate submit is harmless…") comes after, and the phrase never appears in the glossary. **Fix:** add "at-least-once / idempotent dispatch" to the glossary, or lead the section with the one-line definition.

- **[P3]** ADR Context (line 30) vs Option C (line 130) — **"~12 pipeline shapes" vs "2–4 step linear chain".** Both are true (12 shapes, each a short chain) but a reader can trip on the apparent mismatch. **Fix:** in Option C say "each of the ~12 shapes is a 2–4 step linear chain", so the numbers are obviously consistent.

## Complexity hotspots

The design as described is already close to minimal; most of the heavy machinery was
correctly removed in the rewrite. The honest answer is "not much left to cut." Below
are the only places where the *described* design carries more than the problem
strictly needs, each with what the cut would cost.

1. **`last_requested_at` attempt marker** → mechanism: a per-task column written just
   before dispatch, to distinguish "attempted but no response" from "never attempted."
   → simpler alternative: drop the column and rely solely on server logs/metrics for
   the same signal (the ADR already routes the audit trail there). → what's lost: a
   *durable, queryable-in-SQL* attempt flag that survives a logs/metrics outage and is
   joinable with task rows. **Verdict: keep it.** It is one nullable column and it is
   the entire concrete answer to the old audit requirement (FR-3); cutting it to save
   a column is a false economy. Flagging only because the prompt asks where the design
   exceeds the minimum — this is the closest thing, and it is justified.

2. **In-memory in-flight guard *in addition to* a single server** → mechanism: an
   in-process set that prevents re-dispatching a pipeline already in flight. →
   simpler alternative: with replicas=1, `next_check_at` only being advanced *after*
   the call returns *almost* prevents double-dispatch on its own; one could argue the
   set is redundant. → what's lost: protection against the scanner lapping itself
   within one tick window (a due pipeline still has its old `next_check_at` until the
   worker commits, so a second scan *could* re-submit it before the transition lands).
   **Verdict: keep it.** The set is exactly what closes that window cheaply; removing
   it would force a DB-side "claimed" flag, which is *more* complex. This is minimal.

3. **Two deadlines (per-call timeout + per-task execution-timeout/TTL)** → mechanism:
   two distinct timeout knobs per task. → simpler alternative: a single per-task TTL
   that also bounds individual calls. → what's lost: the ability to abandon one slow
   IM call (free its worker) *without* failing the whole task — collapsing them means
   a 60s hung call either ties up a worker for the full multi-day TTL or fails a task
   that was actually fine. **Verdict: keep both.** They solve different problems
   (worker liveness vs task liveness); this is not redundancy.

4. **Six-item Decision block** (organizational, not runtime) → mechanism: the Decision
   enumerates six points where two are arguably one ("DB is the only state" and "DB is
   a 2-table state machine" are the same decision viewed twice; lines 54–69). → simpler
   alternative: fold items 1 and 2 into a single "the database is the only state, as a
   2-table derived state machine." → what's lost: the rhetorical emphasis that "DB is
   the only authority" is *the* root decision. **Verdict: optional merge.** This is the
   one place the *document* (not the design) could shed a concept; see P2 fix item. Low
   stakes.

**Net:** the runtime design has no genuine over-engineering left to remove — the
rewrite did its job. Resisting further cuts is the correct call; the only real
reductions available are documentary (merge items 1–2 of the Decision), not
architectural.
