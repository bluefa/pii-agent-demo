## Split quality

- Wrong-side decisions: none material; ADR-016 keeps durable state, uniqueness, lifecycle, idempotency, and failure semantics, while ADR-021 owns dedicated server, worker pool, scan loop, concurrency, and lease/leader choices.
- Borderline but acceptable: ADR-016 mentions at-least-once recovery, per-call timeout, and no circuit breaker only as consequences of the domain contract; exact runtime mechanics remain in ADR-021.
- Duplication: minor explanatory overlap on idempotent re-dispatch, no circuit breaker, and active-active upgrade path; no conflicting ownership found.
- Dangling/circular reference: no circular decision dependency; ADR-016 depends on ADR-021 only for execution, ADR-021 depends on ADR-016 only for stable domain state. The relative links are coherent once both ADRs land under the same `docs/adr/` directory.
- Missing domain at boundary: ADR-016 delegates the exact `pipeline`/`task` columns and `ErrorCode` values to `minimal-redesign.md` instead of recording them directly in the ADR body.

## Score

- Overall: 86/100 - clean split and simple stable model, with one self-containment gap for core domain schema/enums.
- Correctness & internal consistency: 9/10 - matches the spec state machine, uniqueness rule, retry model, and ADR-021 runtime assumptions.
- Completeness as a domain ADR: 7/10 - covers the decisions, but the field-level schema and exact enum values are externalized.
- Clarity: 9/10 - concise, readable, and explicit about what moved out of the old maximal design.
- Altitude: 9/10 - stays at the domain decision level; execution references are mostly explanatory.
- Simplicity: 9/10 - two tables, five enums, two task kinds, and fresh-run retry are appropriately small.
- ADR-format adherence: 8/10 - status, context, decision, options, consequences, links, glossary, and history are present; reliance on the spec weakens standalone ADR quality.

## Remaining fixes

- [P2] Make the stable domain contract self-contained: inline the §6 table columns and §7 enum values, especially `ErrorCode` = `JOB_FAILED`, `EXECUTION_TIMEOUT`, `TTL_EXPIRED`, `CHECK_ERROR`, `CALL_TIMEOUT`, while keeping `minimal-redesign.md` as supporting detail.

## Verdict

Yes - merge-ready as a Proposed ADR; the domain/execution split is clean, and the remaining fix is self-containment rather than a boundary blocker.
