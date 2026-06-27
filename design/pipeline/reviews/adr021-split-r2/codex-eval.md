## Correctness

- 1(a) `status` guard: yes for cancel-vs-worker terminal resurrection if every task and pipeline transition is guarded on the row's expected pre-state; ADR-021's sample only shows `pipeline`, so the task-row guard is implied by ADR-016 rather than explicit here.
- 1(b) `claimed_by` guard: conditionally yes; it genuinely fences lease-expired stragglers only if `:worker_token` is a non-reused per-claim fencing token, or tx2 also matches an exact lease/version. A stable pod/thread token can be reused after lease expiry and let an old report pass.
- 1(c) lease sizing: `lease_seconds > max_call_timeout + margin` bounds normal overlap only when the call timeout is a real wall-clock bound. Double dispatch still exists on remote-accepted/client-timeout, crash after dispatch before tx2, and lease expiry during process pause; the ADR names too-short-lease double-work but understates it as DB no-op rather than external duplicate work.
- 1(d) tx1/tx2 crash: mostly handled by lease expiry plus ADR-016 idempotent re-dispatch. ADR-021 should still enumerate the subcases: crash after tx1 before call, after external dispatch before storing `job_id`, and after poll before report.
- Additional correctness gap: tx2 does not say whether a successful guarded report clears or replaces `claimed_by`/`claimed_until`; without that, a still-`RUNNING` pipeline may wait until lease expiry before the next tick can claim it.

## Split quality

- Boundary: mostly clean; ADR-021 owns worker topology, claim, lease, guarded report, and runtime tuning while ADR-016 owns durable state, idempotency, uniqueness, lifecycle, and the no-resurrection invariant.
- Wrong-side decisions: no major domain re-decision; `next_due_at`/`claimed_by`/`claimed_until` are execution metadata and match the canonical spec's §6 note.
- Missing execution decisions: claim-token fencing semantics, claim release/renewal in tx2, and explicit duplicate-dispatch failure windows.
- Duplication: acceptable short restatement of idempotency/cancel; not a problematic restatement of ADR-016.
- Dangling refs: in this ADR-021 worktree, `docs/adr/016-install-delete-pipeline-domain-model.md` and `design/pipeline/minimal-redesign.md` do not exist, so the relative links are dangling unless ADR-016/spec land before or with ADR-021.
- Stale wording: ADR-021 itself no longer has stale single-server/in-memory chosen-model wording; sibling ADR-016 still says "single-server today, active-active later", which conflicts with the rewritten ADR-021.
- Over-engineering: no; claim-pull with DB leases is the minimal credible multi-process execution model here.

## Score

- Overall: 78/100 — right architecture, but not merge-ready until the fencing-token, claim-release, and duplicate-dispatch wording are made unambiguous.
- Correctness & internal consistency: 7/10 — core guards are correct, but `claimed_by` is not a complete fence unless token semantics are tightened, and tx2 claim handling is underspecified.
- Completeness as an execution ADR: 7/10 — covers topology, claim, lease, report, and recovery; missing the key tx2 and crash-window details implementers need.
- Clarity: 8/10 — concise and readable, with one misleading phrase: duplicate work is not made safe by DB no-op alone; the external side effect is safe only by idempotency.
- Altitude: 8/10 — good one-decision split; leans on ADR-016 instead of re-owning domain, with only necessary cross-references.
- Simplicity: 8/10 — appropriately rejects leader election, workflow engines, and local guards; no visible bloat.
- ADR-format adherence: 8/10 — standard sections and consequences are present; current relative links are unresolved in this worktree.

## Remaining fixes

- P1: Define `claimed_by` as a per-claim fencing token, or add a `claim_id`/`claim_version`/exact-`claimed_until` guard in tx2. Do not rely on a reusable worker identity.
- P1: State that tx2 applies ownership and expected-status guards to all task and pipeline writes, not only the `pipeline` sample.
- P1: Specify tx2 claim cleanup/renewal: after a successful report, atomically set the next `next_due_at` and clear or replace `claimed_by`/`claimed_until` so `RUNNING` pipelines do not idle until lease expiry.
- P2: Document accepted duplicate-dispatch windows: client timeout after remote accept, crash after dispatch before tx2, and lease expiry during a stalled worker. Tie safety to ADR-016 idempotency, not to guarded DB writes.
- P2: Fix or sequence the dangling relative links so ADR-021 does not merge with broken ADR/spec references.
- P3: Correct the sibling ADR-016 stale phrase "single-server today, active-active later" to match claim-pull as the current execution model.

## Verdict

No — merge direction is correct, but as Proposed it still leaves implementer-visible correctness gaps around lease fencing, tx2 claim lifecycle, and the real at-least-once duplicate-dispatch windows.
