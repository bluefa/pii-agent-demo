# ADR-016 — Design History & Rationale

Companion to [ADR-016](../../docs/adr/016-install-delete-pipeline-domain-model.md). The ADR
records the *current* decision; this file records how it got there. Reading it is optional —
the ADR stands alone.

## The maximal phase (2026-06-11 → 06-21)

ADR-016 first maximized every axis at once: an asynchronous single-writer split, an
observation ledger (`task_check`), an attempt log (`task_attempt`), an event outbox,
multi-replica leadership, definition snapshots, and per-task knob freezing — about
**9 task states, 14 enums (68 values), 6 tables, ~3,766 lines**. For a tool whose job is
"run an ordered chain of two task kinds for one target," that surface did not fit in one
engineer's head.

## Re-scope to minimal + split (2026-06-27)

We cut to the essential job: two domain tables, a 6-value `TaskStatus`, five core enums, retry
= fresh run — each removal naming what was lost. Separately, orchestration moved out of the BFF
to a dedicated runner, and the design split into two ADRs:

- **ADR-016** (the domain model) — the durable state that does **not** change when the
  execution strategy changes.
- **ADR-021** — the execution model (multi-worker claim-pull), revisable independently.

## Bounded reintroduction of the observation tables (2026-06-28)

The 2-table model could not answer basic failure-debug questions (which job per retry; was a
TTL-expired condition NOT_MET vs API-failed; how many polls; last response). So `task_attempt`
and `task_check` were **deliberately reintroduced in a bounded form** — and they are **not** the
maximal versions:

- `task_check` is a **per-attempt summary updated in place** (1:0..1, counters + last response),
  not the rejected per-poll ledger. Row count grows with attempts, not polls. No RLE, no pruner,
  no outbox.
- They are **write-only observation**: the reconciler never reads them; losing them costs only
  debuggability, never correctness.

This walks back the earlier "logs/metrics alone serve audit" stance by exactly the minimum
needed for first-cause diagnosis — and no more.

## Idempotency: Model X

InfraManager does not de-duplicate; the TF apply APIs are duplicate-harmless (infra converges).
`(task_id, attempt_no)` is a logical attempt identity for our records, **not** an InfraManager
dedup key. A re-dispatch may create a harmless duplicate job; we record the latest `job_id`.
There is no "reclaim" / "get-or-create" and no `DISPATCHING` state.

## Revision timeline

- **2026-06-11 → 06-21** — maximal drafts (durable state machine, async ledger, slot admission,
  snapshots). Detail in git history.
- **2026-06-27** — re-scoped to the minimal model; split into ADR-016 (domain) + ADR-021
  (execution); orchestration moved BFF → dedicated runner.
- **2026-06-27** — execution model hardened: multi-worker claim-pull (`SKIP LOCKED` + lease +
  per-claim fencing token), cooperative/CAS cancel, admission as soft pickup-gating.
- **2026-06-28** — added explicit `BLOCKED` task state; reintroduced `task_attempt` /
  `task_check` as bounded observation tables; pinned idempotency to Model X.
