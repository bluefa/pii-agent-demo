# PR #509 Review — Dimension 1: Readability

**Target:** `docs/adr/ADR-016-install-delete-pipeline-orchestration.md`
**Reviewer lens:** first-time reader trying to learn *what was decided* and *why*.
**Verdict:** The ADR is **hard to read for the wrong reasons.** The decision is buried under (a) revision history woven into the decision text and (b) a wall of undefined abbreviations and inline parentheticals. None of this is about the idea being complex — the idea is simple. It is a presentation problem, and it is fixable.

---

## A. Decision history is obstructing the decision read

### The user's rule
Decision history is valuable as **background rationale** ("why was it decided this way") but it must **not obstruct reading the decision itself**. Background answers *why*; the Decision section must answer *what*, cleanly.

### Finding: history is currently inlined into the Decision, not separated from it

The Decision section is not "here is the decision." It is "here is the decision, annotated with the changelog of how we got here." The version markers are physically inside the decision bullets:

- L45 — `**TaskKind는 2종으로 제한**한다 — ... (개정 4판: 훅의 임의 조합·범용 실행 컨텍스트 일반화를 제거).`
- L58 — `**Pipeline 구성(Definition)은 ... 으로 정의**한다(결정 7) — ...`
- L68 — `**동일 target 중복 pipeline은 unique 제약으로 1건만 허용한다(결정 5).**`
- L155–156 — Revision History references "구 결정 8 큐", "구 결정 7 일부" — decisions that **no longer exist in the document**, so the reader is being told the delta against a version they can't see.

The reader must hold two timelines at once: *what the system does now* and *what it used to do across revisions 4/5/6*. That is the obstruction. A first-time reader does not care that TaskKind was once 3 kinds and the arbitrary-hook generalization was removed in "개정 4판" — they care that **today it is 2 kinds: `TERRAFORM_JOB` and `CONDITION_CHECK`.**

A second, worse obstruction: the **Status block (L7–12)** opens the document with a 6-line warning that the entire Decision/Consequences body is *stale* ("아래 Decision/Consequences는 maximal 설계를 기술한다 ... 본문의 maximal 서술은 다음 ADR 개정에서 minimal로 맞춘다"). So before reading a single decision the reader is told *don't trust what you're about to read.* That is the single biggest readability tax in the file — it poisons the whole body.

### Where the history *should* live

| Content | Today | Move to |
|---|---|---|
| "TaskKind was 3, now 2 (removed arbitrary hooks)" | inline in Decision L45 | **Background & Rationale** appendix (or footnote) |
| "(결정 5)", "(결정 7)", "(결정 8)" decision-number tags | inline in Decision | **delete** — they reference a numbering the reader can't see |
| "구 결정 8 큐 → unique 제약" deltas | Revision History L155 | **Background & Rationale**, phrased as "we considered a per-target serialization queue and rejected it in favor of a unique constraint" |
| "maximal vs minimal, body is stale" warning | Status block, top | see §C — this should not be a warning, the body should just be fixed |
| Dated changelog (2026-06-11 … 2026-06-21) | Revision History | **Keep** — but trim (see §C). A dated changelog at the *bottom* is correct ADR practice; it does not obstruct because nobody reads top-down into it. |

### Concrete restructure

Adopt a **two-zone** layout so the *what* is clean and the *why* is one click away:

```
## Decision            ← present-tense, no version tags, no "개정 N판", no parentheticals
                          about prior designs. States ONLY what the system does today.

## Background & Rationale   ← NEW section (or a <details> collapsed block / appendix).
                          "Why BFF, not a microservice." "Why retry = new run, not resume."
                          "Why 2 TaskKinds (an earlier draft had arbitrary hooks; cut for X)."
                          This is where every 'why was it decided this way' sentence goes.

## Revision History    ← dated changelog ONLY. Trim per-version internal jargon (§C).
```

Rule of thumb to apply mechanically: **if a sentence in the Decision section describes a *past* state of the design ("was", "removed in v4", "구 결정 N"), it does not belong in the Decision.** Move it down or cut it.

### Before / after — Decision bullet (L45)

**Before**
> **TaskKind는 2종으로 제한**한다 — `TERRAFORM_JOB` · `CONDITION_CHECK`(개정 4판: 훅의 임의 조합·범용 실행 컨텍스트 일반화를 제거). 새 task = 새 코드 class(대개 기존 kind 재사용; 새 흐름 shape일 때만 새 kind). (비-terraform 비동기 job kind는 v2 defer.)

**After — Decision section**
> **Task 종류는 2가지뿐이다:** `TERRAFORM_JOB`(Terraform 작업 실행)과 `CONDITION_CHECK`(조건 충족까지 폴링). 새 task는 새 코드 클래스로 추가하되, 대개 기존 종류를 재사용한다.

**After — Background & Rationale (moved)**
> 초기 설계는 임의 훅 조합을 받는 범용 실행 컨텍스트를 고려했으나, 표현력이 과했고 디버깅 추론을 어렵게 해 2종으로 좁혔다. 비-Terraform 비동기 job 종류는 V2로 미뤘다.

The *what* is now 2 lines a newcomer can read; the *why* is preserved verbatim, just relocated.

---

## B. Abbreviations — full expansion table

The ADR assumes the reader already speaks its private dialect. Below is every abbreviation/coined term in the file, expanded. The **"Hurts most"** column flags the ones a first-time reader hits early and cannot decode from context.

| Abbrev. | Expansion / meaning | First use | Hurts a newcomer most? |
|---|---|---|---|
| **BFF** | Backend-For-Frontend (the Next.js proxy server tier) | Title, L16 | ⚠️ **Yes** — it's in the *title* and never expanded. Also now *wrong* (see §D). |
| **IM** | Infra Manager (Terraform job API service) | L19, L24 | ⚠️ **Yes** — appears as "IM run API" with no prior expansion |
| **TF** | Terraform | L91 (and throughout the proposal) | ⚠️ **Yes** — `TF slot`, `TF job` used heavily |
| **D-T2** | Design-Tick decision #2: async fire (30s tick launches N async API calls) | L8 (proposal); ADR via Consequences | ⚠️ **Yes** — pure internal label, undecodable |
| **D-T4** | Design-Tick decision #4: two-writer split (call-thread observes, next tick transitions) | L8 (proposal) | ⚠️ **Yes** — central to the whole proposal, never expanded in the ADR |
| **D-T5** | Design-Tick decision #5: dispatch-before marker (record "attempted" before the call) | §7 proposal | ⚠️ Yes |
| **D-T7** | Design-Tick decision #7: reactive backpressure (429/503 → `next_due_at` backoff) | §3 proposal | ⚠️ Yes |
| **CAS** | Compare-And-Swap (atomic conditional update) | L42, L102 | ⚠️ **Yes** — load-bearing for the concurrency argument |
| **FR-1 … FR-8** | Functional Requirement #N | L123–129 | ⚠️ **Yes** — see Format review; opaque without the requirements list |
| **NFR-1 … NFR-4** | Non-Functional Requirement #N | L126–130 | ⚠️ **Yes** — same |
| **RLE** | Run-Length Encoding (repeated identical observations folded into a `poll_count`) | L34, L102, L117 | ⚠️ **Yes** — niche term, appears mid-constraint without warning |
| **TTL** | Time-To-Live (expiry deadline; here `WAIT_EXTERNAL TTL`) | L54, L126 | Moderate — common term, but `WAIT_EXTERNAL TTL` pairing is opaque |
| **slotCap** | the BFF-side submission-throttle limit on concurrent in-flight Terraform jobs | L29, L51 | ⚠️ **Yes** — central knob, defined only by implication |
| **workerPoolSize** | fixed TerraformWorker pool size (the real downstream hard cap) | L29, L51 | Moderate |
| **maxFailCount** | per-task retry budget before the task is marked FAILED | L52, L112 | Low — name is self-describing |
| **pubsub** | publish/subscribe queue (how IM hands jobs to TerraformWorker) | L24, L51 | Low |
| **k8s** | Kubernetes (pod) | L16 | Low |
| **23505** | PostgreSQL unique-violation SQLSTATE error code | L71–74 | ⚠️ **Yes** — a bare number; reader can't know it's "duplicate key" |
| **jsonb** | PostgreSQL binary JSON column type | L64–65 | Low |
| **QPS** | Queries Per Second (request rate) | proposal §4 | Moderate |
| **TaskKind** | the enum naming what a task does (`TERRAFORM_JOB`/`CONDITION_CHECK`) | L45 | Low — defined at first use |
| **WAIT_EXTERNAL** | the state a task sits in while waiting on an external system | L54, L87 | Moderate — a state name, but never listed among the states |
| **next_check_at / next_due_at** | column: when to next poll/process this task/pipeline | L84, L87 | Low |
| **CONFIRMED / INSTALLED** | ADR-006/009 process states the pipeline runs between | L141–142 | Low (cross-ref) |
| **TerraformWorker** | the k8s pod that actually executes Terraform | L16, L91 | Low — spelled out |

### Recommendation: glossary block **and** expand-on-first-use

Both, applied by tier:

1. **Expand inline on first use** for the handful that hurt most and are short: **BFF, IM, TF, CAS, TTL.** e.g. first occurrence becomes "Infra Manager(IM)" and thereafter "IM" is fine. This is cheap and removes the worst early stumbles.

2. **Add a short glossary block** near the top (right after Status, before Context) for the *coined* terms that can't be expanded in a phrase — these are the ones an inline expansion can't carry:

   ```
   ## 용어 (Glossary)
   - BFF — Backend-For-Frontend. Admin 콘솔 뒤의 프록시 서버 계층.
   - IM (Infra Manager) — Terraform job API 서비스. 실제 실행은 TerraformWorker(k8s pod).
   - slotCap — BFF가 IM에 동시에 던지는 in-flight Terraform job 제출 상한(throttle).
   - workerPoolSize — TerraformWorker 고정 풀 크기. 실제 다운스트림 hard cap.
   - CAS — Compare-And-Swap. 조건부 원자적 갱신.
   - RLE — Run-Length Encoding. 같은 관측 반복을 poll_count 한 값으로 접음.
   - WAIT_EXTERNAL — task가 외부 응답을 기다리는 상태.
   - D-T2/D-T4/D-T5/D-T7 — 옛 tick 설계 결정 번호. (배경 부록 참조; 본문에서는 풀어쓴다.)
   ```

3. **Kill the D-Tx labels in prose.** `D-T2`/`D-T4` etc. are the worst offenders because they are *opaque pointers into a deleted document* (the supporting design docs were removed per L11/L139). Either expand them every time ("the two-writer split where the call thread only observes and the next tick transitions") or, better, **describe the mechanism in words and drop the code.** A label is only a shortcut if the reader can resolve it; here they cannot.

4. **`FR-N`/`NFR-N` need their text inline.** A bullet that reads `FR-1 브라우저 세션 없는 durable 설치/삭제` is fine *because it carries its own description.* The problem (covered in the Format review) is that the requirement *definitions* live nowhere in the trimmed document, so the satisfaction claims float. At minimum, restate each requirement in one clause where it is claimed.

---

## C. The stale-body warning is itself a readability defect

L7–12 is a banner saying "everything below is the old maximal design; the real spec is minimal-redesign.md." Practically this means **the document lies to the reader and apologizes for it in advance.**

This is not a thing to *format better* — it is a thing to *resolve*: bring the Decision/Consequences text in line with the minimal spec (and this proposal) so the warning can be deleted. Until that happens, the most honest readability fix is to **move the maximal detail into a clearly-labeled "Historical (maximal) design" appendix** and let the top of the document state the *current* decision plainly. A reader should never have to mentally subtract "but this paragraph is outdated" from prose as they go.

Likewise the **Revision History (L144–162)** is over-detailed: entries like "v6 후속3 — 정밀도 정정(codex·opus 재리뷰 86~87/100): `pipeline.definition_version` 제거…" expose internal review scores and column-level deltas that mean nothing to a newcomer. Keep one line per dated version describing the *user-visible* change; push column-level deltas to the Background appendix or drop them.

---

## D. Cross-cutting: the "orchestration lives in BFF" framing is stale (flag)

This belongs to format/accuracy too, but it is a *readability* trap: a newcomer reads constraint #1 (L23) "오케스트레이션 주체는 BFF(사용자 결정)" and the title "...Orchestration in **BFF**" and will build their entire mental model on the wrong tier. The current decision is that the worker runs in a **separate dedicated Server, not the BFF.** Every "BFF" in Context/Decision/Constraints that means "the orchestrator" is now misleading. This must be corrected, not merely glossed — see the Format review (Rubric: title states the decision, and accuracy) for the concrete rewrite. Calling it out here because *of all the abbreviations, "BFF" is the one whose wrong expansion does the most damage to comprehension.*

---

## Summary of readability actions (priority order)

1. **Split Decision from history.** Create a `Background & Rationale` section; move every "was/removed-in-vN/구 결정 N" sentence there; delete the `(결정 5/7/8)` tags. *(Biggest win.)*
2. **Fix or quarantine the stale body** so the L7–12 "don't trust this" banner can go away (or becomes a small "Historical design" appendix link).
3. **Expand BFF/IM/TF/CAS/TTL on first use**; add a top glossary for coined terms (slotCap, RLE, WAIT_EXTERNAL, D-Tx).
4. **Replace D-T2/D-T4/D-T5/D-T7 in prose** with one-clause descriptions; keep the codes only in the glossary.
5. **Trim Revision History** to one user-facing line per version; drop review-score and column-delta noise.
6. **Correct "BFF orchestration" → dedicated Server** everywhere it means the orchestrator (also a correctness fix).
