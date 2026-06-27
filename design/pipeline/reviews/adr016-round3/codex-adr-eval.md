## What changed

1. RESOLVED - ADR now separates short synchronous external calls from minute-scale Terraform execution: a worker call returns a job id/status, while the Terraform job is polled across scans and not blocked on (`ADR-016:87-94`, `ADR-016:145-146`).
2. RESOLVED - `pipeline.status` is now a stored transactional projection, not read-derived state (`ADR-016:62-65`), consistent with the two-table schema carrying `pipeline.status` (`minimal-redesign:84`).
3. RESOLVED - Decision 4 is now explicitly "a single server with a bounded worker pool" (`ADR-016:84`).
4. PARTIAL - The main text now makes V1 audit logs/metrics and demotes `last_requested_at` to optional/not-in-schema (`ADR-016:155-160`, `minimal-redesign:84-87`), but revision history still says audit moved to "logs/metrics + an attempt marker" (`ADR-016:208`), implying the marker is part of V1.
5. RESOLVED - Duplicate dispatch wording now states the final infrastructure state remains correct while extra downstream work is accepted (`ADR-016:98-103`), consistent with the spec's idempotent re-dispatch model (`minimal-redesign:67-70`).
6. PARTIAL - The canonical `ErrorCode` set is now aligned in §2 and §7 (`minimal-redesign:37-39`, `minimal-redesign:104-110`) and ADR points to §7 (`ADR-016:72-73`), but §3 still uses stale backticked `TIMEOUT` and `EXPIRED` names (`minimal-redesign:51-54`). New/remaining inconsistency: implementers can infer noncanonical error values.
7. PARTIAL - The status block now says "Adopted minimal direction" (`minimal-redesign:3-5`), but the H1 still says "Redesign Draft" (`minimal-redesign:1`). Low-risk, but still mixed status language.

## New score

Overall: **88/100** (**+8** vs prior 80). Most architectural consistency issues are fixed; score is held down by the canonical spec's stale timeout/expiry identifiers and residual audit/status wording.

- Correctness & internal consistency: **8/10** - Dedicated-server execution, stored `pipeline.status`, and idempotent at-least-once dispatch are coherent; stale `TIMEOUT`/`EXPIRED` identifiers still conflict with the canonical enum set.
- Completeness: **9/10** - Covers state model, uniqueness, execution, retry/cancel, deferred HA/QPS/TF caps, and audit tradeoffs.
- Clarity: **8/10** - The ADR is much clearer, but the attempt-marker revision-history wording and mixed draft/adopted labels can still mislead readers.
- Altitude: **9/10** - Architecture decisions are separated from operational sizing/tuning, with worker-pool details included only where they affect correctness.
- Simplicity: **9/10** - The two-table, five-enum, single-server design is appropriately small and defers HA/QPS/ledger complexity.
- ADR-format adherence: **9/10** - Status, context, decisions, options, consequences, links, glossary, and revision history are present; remaining issues are consistency cleanup, not format gaps.

## Remaining fixes

- P0: None.
- P1: None.
- P2: Replace or explain `TIMEOUT` and `EXPIRED` in `minimal-redesign.md` §3 so they cannot be read as enum values. Preferred: use canonical `EXECUTION_TIMEOUT` and `TTL_EXPIRED`, or rewrite as prose outcomes that map to those values.
- P3: Update `ADR-016` revision history to remove or qualify "attempt marker"; the body and schema say `last_requested_at` is optional and not in V1.
- P3: Rename `minimal-redesign.md` H1 or otherwise align the title with the adopted status block.

## Verdict

**No** - close, but not merge-ready as a Proposed ADR until the canonical spec stops implying noncanonical timeout error values and the residual audit/status wording is aligned.
