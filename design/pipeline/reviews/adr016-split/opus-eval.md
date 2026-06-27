# ADR-016 (domain half) — split evaluation

Reviewed against sibling ADR-021 (execution) and canonical spec `minimal-redesign.md`.

## Split quality

- Boundary is clean: ADR-016 keeps state/data/uniqueness/failure-semantics/lifecycle; ADR-021 keeps server count, worker pool, lease/CAS/leader. No runtime decision is decided in 016.
- No execution decision smuggled in: 016 never sizes a worker pool, picks an instance count, or decides lease/CAS — it only *names* those as ADR-021's territory.
- One leak of altitude (not a decision): Decision 3/4 justify domain rules by ADR-021's "single-writer reasoning" / "at-least-once"; defensible as motivation but couples the domain rationale to the runtime premise.
- Minor vocabulary leak: Decision 2 "so a scan can filter on it cheaply" reaches for execution wording to justify a data-model choice (status as stored projection). Harmless but execution-flavored.
- No domain decision missing: idempotency contract, per-target uniqueness, recipe-as-code-default, 5 enums, 2 tables, retry=fresh-run, no CANCELLING/DISPATCHING — all present.
- Cross-reference coherent, non-circular: 016→021 (execution) and 021→016 (domain guarantees) is mutual reference, not a decision cycle; 021 *depends on* 016, 016 only *points forward*. No dangling link.
- Spec consistency: ErrorCode §7 set (JOB_FAILED, EXECUTION_TIMEOUT, TTL_EXPIRED, CHECK_ERROR, CALL_TIMEOUT) matches Decision 5; uniqueness §5 matches Decision 3; task/pipeline §6 delegated cleanly. `last_requested_at` (016 Consequences) is a *proposed* optional column, not a conflict with spec's `last_activity_at`.

## Score

Overall: 91/100

- Correctness & internal consistency — 9: ErrorCode/uniqueness/lifecycle all align with spec; all 5 enums consumed; no contradictions.
- Completeness as a domain ADR — 9: every domain facet covered; schema/recipe delegated to spec without losing the decision.
- Clarity — 9: crisp prose, state diagram, options table, glossary, explicit "costs we accept".
- Altitude (one-decision-per-ADR) — 8: six cohesive domain sub-decisions, but two justifications (single-writer, scan-filter) lean into ADR-021's runtime.
- Simplicity — 9: actively embodies the minimal direction; rejected options (B/C) sharply argued.
- ADR-format adherence — 9: full sections incl. Background/supersession and revision history; clean cross-links.

## Remaining fixes

- [P3] Decision 3/4: phrase the ADR-021 dependency as "the execution model relies on this" rather than importing "single-writer reasoning" / "at-least-once" into the domain rationale — keeps the domain ADR self-justifying.
- [P3] Decision 2: drop or soften "so a scan can filter on it cheaply"; justify status-as-stored-projection on transactional/consistency grounds (domain), not scan cost (execution).
- [P3] Links: 016 references ADR-006/009 but ADR-021 link block omits them; harmless asymmetry, optional to mirror.

## Verdict

Yes — merge-ready as Proposed: the domain/execution split is clean, spec-consistent, and self-contained; the only standing items are P3 wording nits, not blockers.
