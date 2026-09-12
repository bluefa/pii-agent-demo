# PR #509 Review — Dimension 3: Format & ADR Quality

**Target:** `docs/adr/ADR-016-install-delete-pipeline-orchestration.md`
**Verdict:** The ADR is structurally a few large run-on blocks, not a navigable document. The Decision is one ~35-line wall of bullets, each bullet a multi-clause sentence with nested parentheticals. It also breaks several standard ADR-quality conventions (Nygard format, one-decision-per-ADR, testable consequences, title-states-decision). Below: a concrete outline, plain-language rewrites of the `FR-/NFR-` jargon, and a rubric scorecard with fixes.

---

## A. The run-on problem and a concrete section outline

### What's wrong now
- **Decision (L39–78)** is a single list of 8 mega-bullets. Several bullets are 4–8 lines each, e.g. L58–66 (Pipeline Definition) is **one sentence** spanning 9 lines with five levels of parenthetical nesting `(... (... ) ...)`. The reader cannot find "what are the task kinds?" without reading the whole block.
- **Constraints (L22–37)** mixes hard external facts (IM is async) with design rationale (retention windows, RLE) in one numbered list.
- There is **no "at a glance"** anywhere — no diagram, no one-sentence summary of the runtime loop. The minimal-redesign doc *has* one (its closing block, L130–132); the ADR has none.

### Proposed outline

Keep Nygard's spine (Status / Context / Decision / Consequences) but break each into scannable sub-sections with headings, and add a summary up top:

```
# ADR-016: Run install/delete pipelines on a dedicated orchestration server   ← retitled (§C-rubric)

## Status            Proposed · 2026-06-27   (one line; the maximal-warning banner goes away)

## TL;DR             3–5 sentences: what runs, where, the core loop, the one trade-off.
                     (Borrow the style of minimal-redesign.md's closing paragraph.)

## Context
   ### System tiers        Frontend → orchestration server → Backend/Infra Manager (diagram)
   ### Problem             manual Terraform today; need durable, restartable, audited runs
   ### Scale               ~2000 targets, ~12 pipeline definitions
   ### Fixed constraints    (the genuinely-external ones only: IM async, no worker dedup,
                            idempotent execution APIs, fixed worker pool hard cap)

## Decision
   ### Execution model      Claim-Pull worker: N workers each claim ONE pipeline
                            (FOR UPDATE SKIP LOCKED + lease), run ONE sync call, report.
   ### Where it runs        a dedicated server (NOT the BFF)            ← the now-correct fact
   ### Task kinds           TERRAFORM_JOB, CONDITION_CHECK (2 only)
   ### Retry semantics      retry = new run, not resume
   ### Concurrency          worker count caps API concurrency; slotCap = soft TF throttle
   ### Uniqueness           one active pipeline per target (partial-unique; 23505 → return existing)
   ### Correctness          idempotency-by-construction; lease guards single-writer

## Considered Options    (table — keep, it's good)

## Consequences
   ### What we gain         (bullets, each one independently true & checkable)
   ### What we accept       (bullets; quantify each — see §C-rubric "testable")

## Requirements satisfied (rewrite in plain language — §B)

## Background & Rationale   ← NEW: all the "why", the v4/v5/v6 history prose, the D-Tx lineage
## Revision History          ← dated changelog only, one line each
## Links
```

This converts ~5 big blocks into ~20 short, individually-skimmable sections. A reader looking for one fact lands on one heading.

### Bullet-level fix (the worst run-on, L58–66)

**Before** (one sentence, 9 lines): "**Pipeline 구성(Definition)은 코드 default + 실행 시 불변 snapshot으로 정의**한다(결정 7) — recipe는 `(type,provider)`당 코드 default 1개이고, 실행 구성은 snapshot으로 박제해 재현한다(default release를 올려도 in-flight·과거 run의 recipe/config는 절연 … 코드=실행 권위, 결정 7.3). **snapshot(`pipeline_def_snapshot`, 1 pipeline:1행 …) …** …"

**After** (split, present-tense, parentheticals lifted out):
> **파이프라인 구성(Definition)**
> - recipe는 `(type, provider)` 조합당 코드 default 1개다.
> - 실행 시점에 recipe를 resolve해 `pipeline_def_snapshot`에 한 줄로 박제한다(생성 시 write-once).
> - default를 새로 배포해도 진행 중·과거 run의 구성은 snapshot으로 절연된다. (단, task 클래스의 **코드 동작**은 현재 배포본을 탄다 — 코드가 실행 권위다.)
>
> *(snapshot 컬럼 상세·결정 7 변천은 Background & Rationale 참조.)*

Same facts, now four readable lines plus a pointer for the deep detail.

---

## B. `FR-1` / `NFR-3` jargon → plain language

The "Requirements Satisfied" block (L119–130) and parts of Consequences are written for someone who already memorized the requirement IDs. A non-engineer (a PM, an ops lead, an approver) cannot read them. Two problems: (1) the `FR-N`/`NFR-N` codes are opaque, and (2) the satisfaction phrasing is terse implementation shorthand. The requirement *definitions* also no longer exist in the trimmed doc, so the claims float.

Fix: write each as **"Requirement (plain) → How this design meets it."** Three concrete rewrites:

### Rewrite 1 — FR-1
**Before**
> **FR-1** 브라우저 세션 없는 durable 설치/삭제 — DB durable state machine

**After**
> **설치·삭제가 사람의 브라우저 없이 끝까지 진행된다.**
> 관리자가 한 번 시작하면, 브라우저를 닫아도 서버가 작업을 이어간다. 진행 상태는 전부 DB에 저장돼 있어서, 서버가 재시작돼도 멈춘 지점부터 다시 이어간다.

### Rewrite 2 — NFR-3
**Before**
> **NFR-3** 무한 대기 방지 — execution timeout + WAIT_EXTERNAL TTL

**After**
> **어떤 작업도 영원히 매달려 있지 않는다.**
> 모든 외부 호출에는 제한 시간이 있다. 정해진 시간 안에 끝나거나 응답이 오지 않으면, 시스템은 그 작업을 "시간 초과"로 처리하고 재시도하거나 실패로 넘긴다. "영원히 기다리는" 상태는 만들지 않는다.

### Rewrite 3 — NFR-2 (idempotency / at-least-once)
**Before**
> **NFR-2** at-least-once dispatch 안전 — idempotency contract
> *(and Consequences L111–113: "at-least-once dispatch는 간헐적 중복/고아 job을 남길 수 있다 — 멱등 apply가…")*

**After**
> **같은 작업을 실수로 두 번 보내도 인프라가 망가지지 않는다.**
> 드물게 같은 Terraform 작업이 두 번 제출될 수 있다(워커가 죽고 다른 워커가 이어받는 경우 등). 하지만 모든 실행 API는 "이미 원하는 상태면 아무것도 안 한다"로 만들어져 있어서, 두 번 실행돼도 결과는 한 번 실행한 것과 같다. 중복은 손해가 아니라 무해한 재시도다.

**General rule for the author:** every requirement line should be readable by someone who has never seen the codebase. Lead with the user-facing guarantee in a full sentence; the column name (`pipeline.target_source_id`, `task_attempt`) is supporting evidence, not the headline.

---

## C. Additional ADR-quality rubrics (NOT in the original list)

Scored against standard ADR practice. Each: **score → fix.**

### Rubric 1 — Nygard format adherence (Status / Context / Decision / Consequences)
**Score: 6/10.** The four sections exist and are in order — good. But the boundaries leak: Context's "확정 제약" list contains *decisions* (retention = 2-tier, RLE) not just context; Decision contains *history*; Consequences restates Decision facts. Status carries a multi-line correctness disclaimer that Nygard's "Status" (a single word: Proposed/Accepted/Superseded) was never meant to hold.
**Fix:** Status = one line. Move retention/RLE design choices from Context into Decision. Strip restated facts from Consequences so it only lists *results*. (Outline in §A enforces this.)

### Rubric 2 — One decision per ADR
**Score: 4/10.** This ADR bundles **at least six separable decisions**: (1) durable DB state machine, (2) where it runs (BFF → now a dedicated server), (3) the execution/concurrency model (the entire subject of PR #509), (4) retry = new run, (5) per-target uniqueness + the 23505 creation contract, (6) pipeline-definition snapshotting. The execution model alone has its own 260-line proposal doc — that is a tell it deserves its own ADR.
**Fix:** Keep ADR-016 as "**orchestrate install/delete via a durable per-target state machine on a dedicated server.**" Split the execution model (Claim-Pull worker, lease, slotCap, multi-pod) into a **new ADR (ADR-016a or ADR-020) that supersedes the tick model**, with this PR's proposal as its body. The uniqueness-creation contract and the definition-snapshot model can be their own short ADRs or stay as decisions *if* they're stated atomically. One ADR, one reversible choice.

### Rubric 3 — Testable / verifiable consequences
**Score: 5/10.** Some negatives are vague ("worker outage 감지가 둔하다 ~30분+"). Good ADR consequences are checkable claims.
**Fix:** Make each consequence an assertion a test or a dashboard could confirm. Examples:
- *Vague:* "worker outage 감지가 execution timeout에 의존해 둔하다(~30분+)."
  *Testable:* "A worker that dies mid-job is detected no sooner than `executionTimeout` (default 30 min); there is no faster liveness signal. **Verify:** kill a worker holding a lease; assert the pipeline does not advance until the lease/timeout elapses."
- *Vague:* "BFF 발 제출 폭주를 운영상 bound한다."
  *Testable:* "Concurrent in-flight TF submissions from this service are bounded by `min(workerCount, runningPipelines)`, plus `≤ N-1` admission overshoot on slotCap. **Verify:** with M pods and slotCap=K, assert observed in-flight ≤ K + (M-1)."

### Rubric 4 — Completeness of alternatives considered
**Score: 7/10.** The Considered Options table (A–F) is genuinely good — real options, real reject reasons. But it is now **stale**: option B ("별도 오케스트레이터 마이크로서비스 — 보류") and option E were rejected *because* orchestration was to live in the BFF, and the new decision is exactly to run it on a **separate dedicated server.** The table now argues against the chosen direction.
**Fix:** Re-evaluate A vs B vs the new "dedicated server (not a full microservice, not in-BFF)" position. Either the chosen design *is* option B (then mark B adopted and explain the reversal) or it's a new option G "dedicated orchestration server sharing the codebase" — add it and re-state why B's "service-sized overhead" critique no longer applies. An options table that contradicts the decision is worse than none.

### Rubric 5 — Explicit reversibility / cost note
**Score: 3/10.** There is a cost signal ("본 ADR에서 가장 비싼 한 줄", L110) but no **reversibility** statement: how hard is it to undo? The PR proposal actually makes reversibility *better* (drops leader election, drops 2 tables) but the ADR never says so.
**Fix:** Add one line to Consequences: "**Reversibility:** moderate-low. Switching execution models (tick ↔ claim-pull) is a contained change to the worker loop + 3 pipeline columns; the DB state-machine and API contracts are unaffected. Reverting the 'dedicated server vs BFF' placement is a deploy-topology change, not a data change." Reviewers need to know the blast radius of being wrong.

### Rubric 6 — Title states the decision
**Score: 3/10 — and now factually wrong.** "Install/Delete Pipeline Orchestration **in BFF**" names a *location* that the new decision reverses. A good ADR title is the decision in a sentence.
**Fix:** Retitle to state the choice, not the venue: e.g. **"Run install/delete pipelines as a durable per-target state machine on a dedicated orchestration server."** If the execution model is split out (Rubric 2), that ADR's title is **"Drive the pipeline with claim-pull workers instead of a single reconciler tick."**

### Rubric 7 — Status accuracy / supersession hygiene
**Score: 2/10.** Status says "Proposed (개정 6판 후속)" while the body admits it describes a design the team has already moved off of, and a separate proposal (PR #509) is mid-flight to replace its core. The document is simultaneously "Proposed" and "partially obsolete," which is not a valid state.
**Fix:** Either (a) update the body to the current decision and set Status to `Proposed (revised 2026-06-27)` with a clean changelog, or (b) if it must stay frozen, set Status to `Superseded by ADR-020 (execution model)` and link forward. Do not leave a live ADR self-describing as stale.

### Rubric 8 — Consistent terminology & no dangling references
**Score: 4/10.** The doc references decision numbers that were deleted ("구 결정 8", "구 결정 7 일부", L155–156) and supporting docs that were removed (L11, L139 list ~10 deleted design files). It also uses `WAIT_EXTERNAL` as a state but never lists it among the states; uses both `next_check_at` (ADR) and `next_due_at` (proposal) for adjacent concepts.
**Fix:** Remove or resolve every dangling reference. If a doc/decision no longer exists, don't cite it. Reconcile state and column names against minimal-redesign.md so one term means one thing across the ADR + proposal + spec.

---

## Summary of format actions (priority order)

1. **Break the Decision wall** into the §A sub-section outline; split every multi-clause bullet; lift nested parentheticals into follow-on lines or the Background section.
2. **Add a TL;DR** runtime-loop summary at the top (model the minimal-redesign closing paragraph).
3. **Rewrite `FR-/NFR-` lines in plain language** (§B) — full-sentence user guarantee first, column names as evidence.
4. **Split the execution model into its own ADR** (one-decision-per-ADR) and mark it as superseding the tick model.
5. **Fix the title and Status** to state the *current* decision (dedicated server, not BFF) — also a correctness fix.
6. **Repair the Considered Options table** so it no longer argues against the chosen direction; add a reversibility/cost line.
7. **Remove dangling references** to deleted decisions/docs; reconcile state/column names across the three documents.
