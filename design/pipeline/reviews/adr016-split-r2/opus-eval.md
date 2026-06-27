# ADR-016 Split R2 — Opus Evaluation

## Consistency

- **Stale (P1):** Consequences › Good, line 129: *"single-server today, active-active later (ADR-021) reuses these exact tables and states."* — ADR-021 is **now multi-worker claim-pull**, not single-server. "single-server today" is factually wrong post-split and contradicts the sibling (ADR-021 Decision 1: "no single-instance constraint"). Drop "single-server today" → e.g. "multi-worker today, reshaped later".
- **Borderline:** Status, line 12: *"single-server → active-active"* used as the illustrative example of execution evolving. Reads as a hypothetical trajectory, but it now describes a past-tense already-superseded model; safer to neutralize ("e.g. single-pod → multi-worker, both already realized in ADR-021") or generalize. Not a correctness bug, but stale-adjacent.
- **State-guarded invariant — correctly framed.** Decision 6 (lines 104–110) names cancel as a concurrent out-of-band writer, states the `UPDATE ... WHERE status = :expected` guard, derives the no-terminal-resurrection invariant, and explicitly delegates the *mechanism* to ADR-021 ("this is the **domain invariant** those mechanics implement"). This is the right altitude: domain states the invariant, execution states the enforcement. Matches spec §2 last bullet and ADR-021 Decision 4 `status` guard.
- Decision 3 reframe is clean: "one active owner per pipeline … enforced via a claim/lease" with the uniqueness rule scoped to "only one pipeline exists to own." No residual single-writer language.

## Split quality

- **Boundary clean.** Domain keeps state/schema/uniqueness/idempotency/lifecycle; execution (workers, claim, lease, two-tx, crash recovery) is fully in ADR-021. No execution decision smuggled into 016 — Decision 6 references the SQL guard only as the *expression* of a domain invariant, not as an execution mechanism.
- **No wrong-side decisions.** Coordination columns (`next_due_at`, `claimed_by`, `claimed_until`) are correctly attributed to ADR-021 in spec §6; ADR-016 schema (Decision 2 / spec §6) carries only domain state. Consistent both ways.
- **Cross-refs symmetric & non-circular.** 016→021 (Status, Context, Decisions 3/4/6, Links) and 021→016 (Status, Context, Decision 4, Links) align; both point at minimal-redesign.md as canonical. No dangling refs.
- **No duplication of substance.** The shared idempotency/at-least-once contract is owned by 016 and *cited* (not restated) by 021. Good.
- Minor: ADR-016 Decision 6 states only the `status` guard; ADR-021 adds the independent `claimed_by` guard. Correct division (ownership is execution), but a one-clause "(execution adds an ownership guard — ADR-021)" would preempt a reader thinking the invariant is under-specified. Optional.

## Score

**Overall: 89 / 100**

- Correctness & internal consistency — **8/10**: invariant and reframes are right; one stale "single-server today" line contradicts the sibling.
- Completeness as a domain ADR — **9/10**: states, schema, uniqueness, idempotency, retry/timeout, lifecycle, cancel invariant all present; deferrals named.
- Clarity — **9/10**: tight, well-sectioned, the "row *is* the state" thesis lands.
- Altitude — **9/10**: delegates execution cleanly; states invariant without leaking mechanism.
- Simplicity — **10/10**: 2 tables, 5 enums, 2 task kinds; maximal alternative explicitly rejected with rationale.
- ADR-format adherence — **9/10**: Status/Context/Decision/Options/Consequences/Links/Glossary/Revision all present and well-formed.

## Remaining fixes

- **[P1]** Fix line 129: remove "single-server today" — it asserts an execution mode ADR-021 no longer uses and contradicts the sibling. This is the only real consistency defect.
- **[P2]** Neutralize line 12's "single-server → active-active" illustration so it doesn't read as the current trajectory.
- **[P3]** Optional one-clause nod in Decision 6 that execution also applies an ownership (`claimed_by`) guard, to pre-answer "is status-only enough?".

## Verdict

**Merge-ready as Proposed: yes**, after the one-line P1 edit. The domain/execution boundary is clean, cross-refs are symmetric and non-circular, and the state-guarded invariant is framed at the correct altitude. The lone substantive issue is the residual "single-server today" phrasing in Consequences, which directly contradicts the now-multi-worker ADR-021 and should not ship as-is; it is a trivial wording fix, not a structural one.
