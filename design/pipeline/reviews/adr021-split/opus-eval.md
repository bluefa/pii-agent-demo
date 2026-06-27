# ADR-021 Split Evaluation (Opus)

Reviewed as an **execution ADR** against ADR-016 (domain) and minimal-redesign.md (spec).

## Split quality

- **Boundary clean:** Yes. ADR-021 decides only runtime (where it runs, replicas, due-scan, pool, crash-recovery) and leans on ADR-016 for durable rows (D1/D2), idempotency (D4), and per-target uniqueness (D3) instead of restating them.
- **No domain decision re-decided:** Correct — `fail_count`/`maxFailCount`/timeouts stay in ADR-016 D5; ADR-021 only references them. The 429/503 "push next check time" is an execution mechanism, not a new domain rule.
- **No execution decision missing:** Covers instance count, work discovery, concurrency bound, per-call timeout, backoff, restart recovery, and 5 rejected options. Tuning knobs correctly pushed to config.
- **Duplication / dangling / circular:** None material. ADR-016↔021 cross-links are reciprocal and consistent. PR #509 is the live mechanism reference (fine for Proposed).
- **"Single instance ⇒ no leader/lease/CAS":** Correct in steady state — one process + in-memory in-flight guard = one writer per pipeline, so lease columns / ownership CAS / `FOR UPDATE SKIP LOCKED` are genuinely unnecessary. Caveat below re: rolling-deploy overlap.
- **Active-active "supersedes only this ADR":** Sound. Option C explicitly "reuses ADR-016 unchanged"; domain tables/states/uniqueness are invariant under the runtime swap, so the supersede scope is correctly bounded to ADR-021.

## Score

**Overall: 92 / 100**

| Dimension | Score | Justification |
|---|---|---|
| Correctness & internal consistency | 9 | Reasoning holds; only the "single writer" claim is slightly overstated vs. deploy overlap (idempotency is the real backstop). |
| Completeness as execution ADR | 9 | All runtime facets present; defers QPS cap/cadence to config with stated rationale. |
| Clarity | 9 | Crisp; the "entire payoff of one instance" framing makes the lease/CAS removal legible. |
| Altitude (one-decision discipline) | 8 | One coherent decision split into 4 tightly-coupled facets; D1 (dedicated server) + D2 (replicas=1) read as near-one decision — acceptable cohesion. |
| Simplicity | 10 | Deliberately minimal; cheapest correct runtime, no speculative machinery. |
| ADR-format adherence | 10 | Full Status/Context/Decision/Options-table/Consequences/Links/Glossary/Revision-history. |

## Remaining fixes

- **[P2]** Rolling-deploy overlap: `replicas=1` does not guarantee a single writer during a K8s rolling update (old + new pod briefly coexist), and the in-flight guard is per-instance. Correctness still holds via ADR-016 idempotency (at-least-once), but the ADR should either pin the deploy strategy (`Recreate` / `maxSurge=0`) or explicitly state that correctness during deploys rests on idempotency, not on single-writer.
- **[P3]** "the single writer is in-process" is the steady-state property only; name idempotency (ADR-016 D4) as the actual correctness backstop so the no-CAS claim isn't read as load-bearing on deployment config alone.
- **[P3]** "Detailed mechanism: PR #509" in the Status block is unusual placement; it already appears in Links — consider keeping it there only.

## Verdict

**Yes — merge-ready as Proposed.** Boundary is clean, the no-leader/lease/CAS reasoning is correct, and the supersede-scope claim is sound; the deploy-overlap note is a clarification, not a blocker.
