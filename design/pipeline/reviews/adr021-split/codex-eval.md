## Split quality

- Boundary clean: Yes; ADR-021 makes execution/runtime choices (dedicated server, replicas=1, scan, worker pool, polling, recovery) while ADR-016 owns durable rows, uniqueness, idempotency, lifecycle, and retry semantics.
- Wrong-side decisions: None material; ADR-021's crash/retry text relies on ADR-016 rather than redefining the domain, though the "no circuit breaker" line lightly repeats ADR-016.
- Duplication: Acceptable; idempotency, per-call timeout, and re-dispatch are repeated only enough to explain execution safety.
- Dangling/circular references: Circular ADR-016 <-> ADR-021 reference is intentional, but ADR-021's local links to `016-install-delete-pipeline-domain-model.md` and `../../design/pipeline/minimal-redesign.md` are dangling in this worktree.
- Single instance reasoning: Correct for runner-runner coordination if deployment truly enforces replicas=1 and the in-memory in-flight guard is authoritative; no leader election, row lease, claim CAS, or `SKIP LOCKED` is needed for work claiming.
- Active-active upgrade path: Mostly sound; claim-pull would replace the execution/coordination model while preserving ADR-016's domain semantics, but the successor ADR must be allowed to add execution-only lease/claim metadata if needed.

## Score

- Overall: 88/100 — strong split and internally coherent execution model, held back mainly by unresolved local references and one upgrade-path/schema caveat.
- Correctness & internal consistency: 8/10 — the single-writer argument is valid on its assumptions; make sure non-runner lifecycle writes such as cancel do not violate that assumption.
- Completeness as an execution ADR: 8/10 — covers topology, scan, worker pool, timeout posture, recovery, and alternatives; API/cancel writer ownership could be made explicit.
- Clarity: 9/10 — concise, concrete, and easy to compare against the canonical reconciler loop.
- Altitude: 9/10 — stays at execution altitude and does not reopen ADR-016's domain model; minor failure/retry repetition is justified context.
- Simplicity: 10/10 — deliberately avoids leases, leader election, broker/workflow machinery, and premature client-side slot accounting.
- ADR-format adherence: 8/10 — has status, context, decision, options, consequences, links, glossary, and history; current relative links are not merge-safe.

## Remaining fixes

- [P1] Fix or gate the dangling links before merging ADR-021 alone: `docs/adr/021-pipeline-execution-model.md:8`, `:122`, and `:123` reference files absent from this worktree.
- [P2] Clarify the writer boundary for lifecycle mutations, especially cancel: if anything outside the single orchestrator process can update task/pipeline rows while a worker is committing, the "single writer" claim needs a conditional-write rule or an explicit routing guarantee.
- [P3] In the active-active option, state that future lease/claim fields are execution metadata, not domain state, so "supersedes only this ADR" remains precise even if a migration adds columns.

## Verdict

No, not as this isolated branch: the execution/domain split is sound, but the foundational ADR/spec links are dangling and must be fixed or co-merged first.
