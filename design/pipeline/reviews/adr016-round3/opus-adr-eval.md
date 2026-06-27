# ADR-016 — Round 3 Re-Score (Opus)

Re-evaluated independently against the current files. Prior round: **82/100**.

- ADR: `docs/adr/ADR-016-install-delete-pipeline-orchestration.md`
- Spec: `design/pipeline/minimal-redesign.md`
- Execution model: `design/pipeline/single-pipeline-tick-proposal.md`

## What changed

For each of the 7 prior fixes:

1. **Short sync calls vs minutes-long TF job** — **RESOLVED.** Decision 4 ("Each external API call is short — it returns a job id or a status, not the job's result; a Terraform job runs for minutes but is **polled across scans, never blocked on**"), Context L29, and Consequences all say the same thing consistently.
2. **`pipeline.status` = stored transactional projection** — **RESOLVED.** Decision 2: "Pipeline status is a stored projection, updated in the **same transaction** as the task transition that changes it." The "derived" framing is now correctly scoped to *current task* only ("blocked by a predecessor is derived, not stored"). Minor residue: the Decision-2 *heading* still reads "small, **derived** state machine," which slightly undercuts the fix (see Remaining P3).
3. **Decision-4 heading → "a bounded worker pool"** — **RESOLVED.** Heading is now "Execution model: a single server with a bounded worker pool."
4. **Audit = logs/metrics; `last_requested_at` optional / not-in-V1-schema** — **RESOLVED.** Consequences: "V1's audit answer is the dedicated server's **logs and metrics** ... an optional `last_requested_at` task column can be added (**it is not in the V1 schema**)." Cross-checked: `minimal-redesign.md` §6 task columns do **not** include `last_requested_at`; the proposal §3/§7 mark it optional. Consistent across all three.
5. **Duplicate-dispatch wording (final infra state correct, may add downstream work)** — **RESOLVED.** Decision 5: "a duplicate submit leaves the **final infrastructure state correct** — it **may create extra downstream work, which V1 accepts**." Constraint 3 aligns.
6. **ErrorCode pinned to canonical 5-value set; §2 vs §7 contradiction fixed** — **RESOLVED.** §7 and §2 now carry the identical set `JOB_FAILED | EXECUTION_TIMEOUT | TTL_EXPIRED | CHECK_ERROR | CALL_TIMEOUT`; the ADR points to "the spec's §7 table is the canonical value list" rather than re-listing (single source). Residual nit: §3 reconciler still uses informal arrow labels `TIMEOUT`/`EXPIRED` (transition labels, not enum values) — not a contradiction, but loose (P3).
7. **`minimal-redesign.md` status DRAFT/pending → adopted** — **RESOLVED (with residual).** Status line now "Adopted minimal direction (owner-approved, 2026-06) ... Still pre-merge (PR #494)." But the H1 title still reads "Redesign **Draft**" — a leftover that contradicts the adopted status (P2).

### New inconsistency introduced by the fixes?

No new *internal* contradiction inside the ADR. One **cross-document status tension** stands out (pre-existing, not newly introduced, but worth flagging): the execution-model proposal still self-labels **"제안 (논의 산물, 미채택)" / not-adopted**, while both the ADR (Decision 4) and `minimal-redesign.md` ("Execution model: a single dedicated server (see PR #509)") treat single-server execution as the chosen path. Since the ADR itself is status "Proposed," this is tolerable, but the proposal doc's "미채택" label should be reconciled.

## New score

**Overall: 88/100 (delta +6 vs prior 82).**

| Dimension | Score | Justification |
|---|---|---|
| Correctness & internal consistency | 8/10 | All 7 fixes landed and the ADR is internally consistent; held back only by doc-hygiene cross-references — title "Draft" vs status "Adopted", proposal "미채택" vs ADR adopting it, informal §3 timeout labels. |
| Completeness | 9/10 | Context, Decision (6 + safety knobs), Considered Options w/ verdicts, Consequences (good + costs accepted), product value, background, links, glossary, revision history. Defers are named explicitly. |
| Clarity | 9/10 | Clean prose, load-bearing-first ordering, good signposting; Decision 4 is the densest paragraph but readable. |
| Altitude | 9/10 | Strong discipline — tuning/sizing knobs demoted to "Safety mechanisms," mechanism detail pushed to PR #509; decisions stay architectural. |
| Simplicity | 9/10 | The ADR mirrors a genuinely minimal design (2 tables, 5 enums, 2 task kinds, retry=fresh run) and resists re-adding the maximal surface. |
| ADR-format adherence | 9/10 | Status/Context/Decision/Options/Consequences/Links/Revision history all present; "Proposed" status correct; supersedes note and rationale included. |

Per-dimension sum 53/60 ≈ 88. The +6 reflects that the prior round's substantive ambiguities (status projection, audit story, ErrorCode contradiction, dispatch semantics) are now closed; what remains is documentation hygiene, not architecture.

## Remaining fixes

- **[P2]** `minimal-redesign.md` H1 still titled "Redesign **Draft**" while the status block says "Adopted." Rename the title (e.g., "Minimal Installation Pipeline — Spec") or align wording.
- **[P2]** `single-pipeline-tick-proposal.md` self-labels "미채택 / not adopted," but the ADR (Decision 4) and spec adopt single-server execution. Reconcile — mark the proposal adopted-for-V1, or have the ADR phrase Decision 4 as "the proposed execution model (PR #509)."
- **[P3]** ADR Decision-2 heading "small, **derived** state machine" slightly contradicts the stored-projection fix in its own body; consider "small state machine (2 tables)."
- **[P3]** `minimal-redesign.md` §3 uses informal `TIMEOUT`/`EXPIRED` arrow labels that differ from canonical `EXECUTION_TIMEOUT`/`TTL_EXPIRED`; add a one-word note that these are transition labels, or align them.
- **[P3]** `minimal-redesign.md` §8 "single-reconciler **leader** (always-true single-node)" wording grates against the ADR's "no leader election"; soften to "single writer."

No P0/P1 items. These are all hygiene, not correctness.

## Verdict

**Yes — merge-ready as a "Proposed" ADR.** All 7 round-2 fixes landed and are internally consistent within the ADR; only P2/P3 documentation-hygiene nits remain (title-vs-status and proposal-adoption labels), none of which block a Proposed-status merge.
