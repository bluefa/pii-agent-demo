# PR #509 — Doc Error Review (06-doc-errors)

Reviewer: doc-error pass  
Scope: factual and consistency errors only (not style/architecture)  
Files reviewed:
- `PROPOSAL` = `design/pipeline/single-pipeline-tick-proposal.md`
- `ADR` = `docs/adr/ADR-016-install-delete-pipeline-orchestration.md`

---

## Class 1 — Math / Formula

No errors found. All three formulas check out:

- `maxConcurrentApiCalls ≤ min(totalWorkerCount, runningPipelineCount)`: correct — each worker holds at most 1 call, each RUNNING pipeline has at most 1 active task.
- `M+N-1` worst-case: correct — starting from `M-1` RUNNING, `N` pods each admit 1 more in the same race window → `(M-1)+N = M+N-1`.
- `overshoot ≤ N-1`: correct — `(M+N-1) - M = N-1`.
- `leaseDuration > maxApiCallTimeout + safetyMargin`: correct direction and premises.

---

## Class 2 — Logical Contradictions

1. [BLOCKER] ADR:line 92 vs NEW DECISION — ADR `Considered Options` states "별도 워커 분리도 같은 이유로 배제한다" (separate worker extraction is rejected for the same reason as Option B). But the new implementation decision IS a separate dedicated Server. This rationale now directly contradicts the adopted topology. The text must be updated or a note added that this rationale was superseded.

2. [BLOCKER] ADR:line 125 vs PROPOSAL:§8 — ADR `Requirements Satisfied` lists `FR-3: task별 attempt/check audit trail — task_attempt · task_check`. The proposal (§8 "삭제" list) explicitly removes both `task_check` and `task_attempt`. After adoption of PR #509, the ADR's FR-3 satisfaction is unfulfilled by deleted tables. No replacement mechanism for FR-3 is stated in the ADR.

3. [MINOR] PROPOSAL:line 133 — "`slotCap`은 V1에서 **BFF-side** soft admission target이다" internally contradicts the deployment topology change (see Class 3). Within the proposal itself the term "BFF-side" appears only once but it incorrectly locates slotCap ownership.

---

## Class 3 — Stale / Incorrect References (BFF claims)

The new decision places the implementation in a **separate dedicated Server**, not the BFF. The following "BFF" claims are now stale and must be updated or annotated before the ADR is revised.

4. [BLOCKER] ADR:title — "Install/Delete Pipeline Orchestration **in BFF**": the title itself locates the orchestration in the BFF, which is no longer correct.

5. [BLOCKER] ADR:line 16 — "**BFF**(파이프라인 오케스트레이션이 여기 산다)": this parenthetical asserts the orchestration lives in the BFF.

6. [BLOCKER] ADR:line 23 — "오케스트레이션 주체는 **BFF**(사용자 결정)": cites this as a user decision locked constraint.

7. [BLOCKER] ADR:line 41 — "**BFF 내부** durable state machine + reconciler tick을 둔다": Decision section leads with BFF placement.

8. [BLOCKER] ADR:line 109 — "**BFF**가 DB·백그라운드 루프를 갖는다 ... 다중 replica엔 리더 선출 필요": Consequences Negative section describes BFF carrying the background loop and requiring leader election. Both are wrong under the new model (separate Server; leader election also removed by Claim-Pull).

9. [MINOR] ADR:line 127 — "FR-8 **BFF**-visible active Terraform task 제한 — slotCap admission": the label "BFF-visible" is stale; visibility is now from the separate Server.

10. [MINOR] ADR:line 84 — Considered Options table row A: "**BFF 내부** durable reconciler (DB row + tick) | **채택**": the adopted option is now labeled as a BFF-internal reconciler, which is the old framing.

11. [MINOR] PROPOSAL:line 133 — "`slotCap`은 V1에서 **BFF-side** soft admission target이다": within the proposal document itself, slotCap is still labeled "BFF-side". Correct label is "orchestration Server-side" (or equivalent).

12. [MINOR] PROPOSAL:line 135 — "ADR도 IM-side 제한은 보류 — **BFF**가 유일 caller·다운스트림 멱등이라 V1은 soft로 충분": "BFF가 유일 caller" should read "orchestration Server가 유일 caller".

---

## Class 4 — SQL vs Prose Mismatch

13. [MINOR] PROPOSAL:lines 80, 193 — The component table (line 80) and §7 prose (line 193) both use the term "**ownership CAS 가드**" / "**lease 토큰 CAS**". The tx2 SQL (lines 183-191) implements this as `SELECT claimed_by ... FOR UPDATE` followed by a conditional UPDATE inside a transaction — this is a SELECT-then-UPDATE serialized by row lock, not a CAS (Compare-And-Swap, which is a single atomic statement). The implementation is correct, but the term "CAS" is imprecise and misleading. Suggest "ownership check" or "lease token guard" to match the actual SQL pattern.

No other SQL vs prose mismatches found:
- The claim query (§5) correctly uses `FOR UPDATE SKIP LOCKED` as described in prose (§2.1 step ①).
- The tf_slot_counter `UPDATE ... WHERE used < cap` (§4.3) is correctly labeled in its comment as the hard-cap CAS upgrade path (not the V1 soft path), consistent with prose.
- The tx2 task UPDATE and pipeline release are within the same `BEGIN/COMMIT` block as described.

---

## Class 5 — Terminology Drift

14. [MINOR] PROPOSAL: variable `N` is used for two different concepts in the same document:
    - §4.2 (lines 118-120, 237): `N` = **pod count** ("`N`개가 동시에 신규 pipeline을 RUNNING으로 올리면"; overshoot ≤ `N-1`).
    - §9 (line 243): `N` = **worker count** ("워커 수 N(API 동시성)"). In §4.1, `totalWorkerCount = activePodCount × workerPerPod`, so worker count ≠ pod count.
    - Impact: a reader combining the overshoot bound ("`N-1` pods overshoot") with the tuning note ("worker count N") will misread the overshoot magnitude. The overshoot is bounded by pod count, not total worker count. Recommend distinguishing `N_pods` (pod count) from `N_workers` (total worker count).

No other terminology drift found. `D-T4`, `slotCap`, `runningPipelineCap`, `leaseDuration`, `maxApiCallTimeout`, `claimed_by`, `claimed_until` are used consistently throughout. `task_check` and `task_attempt` are consistently named.

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | 7     |
| MINOR    | 6     |
| NIT      | 0     |
| Total    | 13    |

The dominant finding is that **all BFF location claims in the ADR are stale** (items 4–8 are all BLOCKERs), and two logical contradictions exist: the ADR's rejection of a separate worker server is now directly wrong (item 1), and FR-3's satisfaction mechanism (`task_attempt`/`task_check`) is deleted by the proposal without a documented replacement (item 2). Math and SQL correctness are clean.
