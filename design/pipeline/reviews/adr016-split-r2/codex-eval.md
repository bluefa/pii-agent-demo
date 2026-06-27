## Consistency

- Single-server/process assumption: yes, stale normative wording remains at ADR-016:128-129: "single-server today, active-active later (ADR-021) reuses these exact tables and states."
- Stale framing, non-normative: ADR-016:11-12 still uses "single-server -> active-active" as the split example; not a design rule, but now misleading because ADR-021 is already active-active claim-pull.
- State-guarded invariant: correct at ADR-016:104-110; it treats cancel as a concurrent writer and requires expected-state transitions so late worker reports no-op instead of resurrecting terminal rows.
- Cross-reference to new ADR-021 model: claim/lease references at ADR-016:74-76 and 109-110 match ADR-021's `FOR UPDATE SKIP LOCKED` + lease + ownership-guarded write model.

## Split quality

- Boundary: clean; ADR-016 owns domain state, schema, enums, uniqueness, idempotency, retry/cancel lifecycle; ADR-021 owns workers, claim, lease, two-transaction execution, and ownership guards.
- Wrong-side decisions: none material; `UPDATE ... WHERE status = :expected` is acceptable as the concrete expression of a domain invariant, not a worker-topology decision.
- Duplication: low and intentional; ADR-016 repeats only enough ADR-021 claim/lease language to bind the domain invariant.
- Dangling/circular refs: no circular dependency, but ADR-016 links to `021-pipeline-execution-model.md` at lines 11, 28, and 143 while that file is absent from this checkout; merge order or co-merge must make the links resolve.

## Score

- Overall: 86/100 — the domain ADR is substantially correct and well split, but stale single-server wording is a real consistency defect and ADR-021 links must resolve.
- Correctness & internal consistency: 8/10 — state machine, uniqueness, ErrorCode set, retry, and cancel semantics match the spec; ADR-016:128 contradicts the current ADR-021 runtime.
- Completeness as a domain ADR: 9/10 — covers durable rows, schema, enums, uniqueness, failure semantics, lifecycle, and state-guarded terminal safety; execution columns/mechanics are delegated.
- Clarity: 8/10 — concise and readable, but "single-server today" muddies the current execution assumption.
- Altitude: 9/10 — keeps runtime mechanics in ADR-021 while retaining the domain invariants ADR-021 must enforce.
- Simplicity: 9/10 — preserves the minimal 2-table/5-enum model without reintroducing the maximal design.
- ADR-format adherence: 9/10 — status, context, decision, options, consequences, links, glossary, and revision history are present.

## Remaining fixes

- [P1] Replace ADR-016:128-129 so it says ADR-021 is already multi-worker claim-pull; do not say "single-server today."
- [P2] Reword ADR-016:11-12 to avoid framing active-active as only a future evolution; a generic "execution strategy can change" example is enough.
- [P2] Ensure `docs/adr/021-pipeline-execution-model.md` lands before or together with ADR-016, otherwise the ADR-021 links are broken at merge.

## Verdict

No — not merge-ready as Proposed until the stale single-server wording is removed and ADR-021 links are guaranteed to resolve; after that, the domain/execution split is sound.
