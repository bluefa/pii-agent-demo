# PR #509 Review — 04: Implementation Complexity (DTO / Type Proliferation)

> Scope: test the hypothesis that "too many DTOs" is a proxy for excess complexity, against the **adopted minimal** reference impl (`test-spring-min/`, 24 main `.java` files) and the Claim-Pull proposal (`single-pipeline-tick-proposal.md`).
> Verdict up front: **the hypothesis does NOT hold here.** `test-spring-min` is already lean. See §(c).

---

## (a) Type inventory

Every DTO-like type in `test-spring-min/src/main/java/com/bff/pipeline/`. "Call-site files" = number of distinct `.java` files (main + test) that reference the type as a whole word, excluding its own declaration. Kinds: **Entity** (JPA row), **Enum**, **Record** (value/transport), **Config**, **Exception**. (Services/repositories/scheduler are behavior, not DTOs — listed at the end for completeness but excluded from the DTO count.)

| # | Type | Kind | Purpose | Call-site files |
|---|------|------|---------|----------------:|
| 1 | `Pipeline` | Entity (table 1) | One run for one target; `active_target` generated column enforces 1-active-per-target | 10 |
| 2 | `Task` | Entity (table 2) | One ordered step; the row IS the whole task state (status, jobId, failCount, knobs, `@Version`) | 9 |
| 3 | `PipelineStatus` | Enum (4) | RUNNING / DONE / FAILED / CANCELLED + `isTerminal()` | 11 |
| 4 | `PipelineType` | Enum (2) | INSTALL / DELETE — selects the recipe | 9 |
| 5 | `TaskKind` | Enum (2) | TERRAFORM_JOB / CONDITION_CHECK — selects poll logic | 4 |
| 6 | `TaskStatus` | Enum (5) | READY / IN_PROGRESS / DONE / FAILED / CANCELLED + `isTerminal()` | 9 |
| 7 | `ErrorCode` | Enum (5) | Failure cause: JOB_FAILED / EXECUTION_TIMEOUT / TTL_EXPIRED / CHECK_ERROR / CALL_TIMEOUT | 5 |
| 8 | `TerraformPoll` | Record (2 booleans) | IM transport: poll result `(finished, succeeded)` + 3 factories | 6 |
| 9 | `Recipe` | Record | Ordered `List<Step>` chain for a type | 3 |
| 10 | `Recipe.Step` | Record (nested) | `(TaskKind kind, String operation)` + `terraform()`/`condition()` factories | 3 |
| 11 | `ImCall.CallTimeoutException` | Exception (nested) | Signals a single IM call exceeded `perCallTimeout` → CALL_TIMEOUT | 2 |
| 12 | `PipelineSettings` | Config holder | 7 global knobs + `defaults()`/`withX()` test seams | 9 |

**DTO-like total: 12 types** = 2 entities + 5 enums + 3 records + 1 nested exception + 1 config holder.

Behavior types (NOT DTOs, excluded from the count): `PipelineCreator`, `PipelineInserter`, `Recipes`, `PipelineReconciliation`, `Reconciler`, `ReconcileScheduler`, `TaskMachine`, `PipelineControl`, `PipelineConfig`, `ImClient` (interface/seam), `ImCall` (timeout runner), `PipelineRepository`, `TaskRepository`. (13 behavior types → 12 + 13 ≈ the 24-file main tree, minus `PipelineApplication`.)

Notable: **there are no request/response DTOs at all.** No `CreatePipelineRequest`, no `PipelineDto`, no `TaskView`, no API envelope, no mapper. Entities are passed directly; the only non-entity transport value is `TerraformPoll`. This is the opposite of the "maximal" smell the user remembers.

---

## (b) Redundant / single-use / pass-through / re-encoded — candidates

Walked every type for: (i) re-encodes a concept another type already carries, (ii) single construction site with no behavior, (iii) pure pass-through. Findings, weakest-to-strongest:

1. **`ErrorCode.CHECK_ERROR` vs `JOB_FAILED` vs `CALL_TIMEOUT` — partial overlap, but each is a real distinct cause.** `CHECK_ERROR` = a poll/check *call* returned an error verdict (read failure); `JOB_FAILED` = the *job itself* failed; `CALL_TIMEOUT` = the call exceeded `perCallTimeout`. In `TaskMachine.dispatch/poll` the generic `catch (RuntimeException)` maps to `CHECK_ERROR` even on the dispatch path — so `CHECK_ERROR` is doing double duty as "any non-timeout call exception." Defensible (the doc calls each "a real, distinct cause"), but **`CHECK_ERROR` is the one enum constant whose name no longer matches its actual catch site** (it fires on dispatch too, where nothing was "checked"). Not a removal — a **rename to `CALL_ERROR`** for honesty. Cost: 0 columns, 3 files.

2. **`Recipe` wrapping `List<Step>` — a one-field record around a list.** `Recipe(List<Step> steps)` carries nothing but the list and exists at exactly one read site (`PipelineInserter` calls `recipes.forType(type).steps()`). It is a nominal wrapper. **Could collapse** to `Recipes.forType(type)` returning `List<Recipe.Step>` directly (rename `Recipe.Step` → `RecipeStep`). Payoff: −1 type. **Caveat:** the wrapper is cheap, self-documenting, and the natural extension point if a recipe ever gains metadata (name, version). Marginal; list under "optional."

3. **`PipelineSettings.withTtl/withExecutionTimeout/withPollingInterval/withMaxFailCount/withPerCallTimeout` — 5 methods + `defaults()` exist ONLY for tests** (the doc says so: "no-Spring test seam"). Production binds via `@Value`. This is ~25 lines of production code whose sole consumer is the unit tests. Not a *type*, so it doesn't change the DTO count, but it is the clearest "code that exists for tests, living in main" in the module. **Leave it** (it's a deliberate, documented seam and removing it pushes builder noise into every test), but it is the honest answer to "what here is single-use."

4. **`Pipeline.activeTarget` — a derived, read-only column, not a field anyone sets.** It re-encodes `target`+`status` (= `target` while non-terminal else NULL). It is DB-generated, `insertable=false, updatable=false`, and exists purely so the unique constraint can fire. This is **a correct, load-bearing re-encoding** (it's how 1-active-per-target is enforced without app-level locking) — flagged only to show it was checked, not to cut.

**Genuinely redundant types: 0.** Every one of the 12 is constructed and read. The only true "single-use, exists-for-tests" artifact is the `PipelineSettings.withX()` family, which is methods, not a type.

---

## (c) Is "too many DTOs" true here? — Verdict

**No. `test-spring-min` is already lean: 12 DTO-like types, of which 11 are justified and 1 (`Recipe` wrapper) is optional-collapse.**

Evidence the proxy doesn't fire:

- **Zero request/response/view DTOs.** The classic proliferation pattern (Entity → Dto → Request → Response → View + MapStruct) is absent. The one transport value, `TerraformPoll`, models a genuine external-boundary fact (running vs succeeded) that the persisted `TaskStatus`+`ErrorCode` deliberately does *not* carry at the IM seam — it is not a re-encode.
- **Enums are minimal and each constant earns its place.** `TaskStatus` is 5 (the doc explicitly folds DISPATCHING into synchronous dispatch, and RUNNING+WAITING_EXTERNAL into IN_PROGRESS). `ErrorCode` is 5 distinct causes. There is no enum-as-string and no enum re-encoding another enum — exactly the discipline `memory/feedback_reduce_concept_not_representation.md` asks for.
- **Every type has ≥2 call-site files** except the two nested helpers (`Recipe.Step`, `CallTimeoutException` at 2–3), which is expected for nested types.
- **2 tables, 5 enums** — matches the adopted minimal contract. The author already did the cut the user is asking for; the maximal version (deleted, per memory) is where the DTO bloat lived (`task_check` ledger, `task_attempt`, outbox, RLE — each would have dragged its own row/record types).

So the user's instinct is right *as a general heuristic* but **mis-aimed at this artifact** — the DTO count here is a symptom of health, not bloat. The lever for further simplicity is not "fewer DTOs," it's "fewer concepts/tables," and that cut was already taken.

---

## (d) DTO delta under Claim-Pull + separate Server

### Claim-Pull execution model (§2–§7 of the proposal)

The proposal is explicit (§8, §3.2) that it is a **net DELETE of concepts**, and crucially **most deletions were never built in `test-spring-min`** (they were maximal-only). Against the *minimal* baseline:

**ADDS (types):**
- **0 new types from lease columns.** `next_due_at`, `claimed_by`, `claimed_until` are **3 columns on the existing `Pipeline` entity**, not a new type. They fold the per-task `nextCheckAt` up to the pipeline (the proposal says so in §3.2: "task별 `next_check_at`은 여기로 접힌다"). Net column change, zero type change.
- **`tf_slot_counter` — 1 new entity** (single row: `used int, cap int`) **only if** the TF slot gate is built as a DB counter. If `slotCap` stays the V1 "soft admission target / count-read" form (§4.3), it can be a `SELECT count(*)` against `Task` with no new table and **no new type**. So this is **+0 or +1** depending on whether hard-cap CAS is adopted (the proposal defers hard cap to "only if needed").

**REMOVES (types), vs the minimal baseline:**
- **`ReconcileScheduler`** (the `@Scheduled` tick) — replaced by the continuous worker loop. The proposal §6 says `@Scheduled` is unnecessary. **−1 behavior type** (not a DTO, but a concept gone).
- The proposal's headline deletions (`task_check`, `task_attempt`, outbox, RLE, two-writer split, leader election) **do not exist in `test-spring-min`** — so they are 0 *additional* savings here, but they confirm Claim-Pull does not reintroduce them. Importantly, Claim-Pull adds **no observation-ledger / attempt / report DTO**: the "report path" (§5/§7) is an inline `UPDATE task ... ; UPDATE pipeline ...` in tx2 — it produces **no `TaskReport`/`CallResult` record**. The result of the call is consumed in-thread (still `TerraformPoll` + thrown exceptions), exactly as today.

**Net DTO delta of Claim-Pull vs minimal: ≈ 0** (−0 DTOs, +0 or +1 entity for `tf_slot_counter`, +3 columns on `Pipeline`, −1 scheduler behavior type). The report path notably **does not** spawn the kind of result/attempt DTOs the maximal model had — this is the proposal's whole point, and it holds at the type level.

### Moving to a separate dedicated Server (the NEW decision)

This is the one change that **genuinely adds DTO surface**, and it is independent of Claim-Pull:

- Today the orchestrator is in-process with its caller: `PipelineCreator.create(target, type)` and `PipelineControl.cancel(id)` are **Java method calls passing entities/enums directly**. There is no wire boundary, hence zero request/response DTOs (see §c).
- A **dedicated Server** introduces a **transport boundary toward its clients** (whoever today calls `create`/`cancel` — the BFF) and, depending on topology, toward **InfraManager**. That implies, realistically:
  - **Inbound API DTOs**: `CreatePipelineRequest(target, type)`, `CancelRequest`/path-param, and a `PipelineView`/`PipelineStatusResponse` (you cannot serialize the JPA `Pipeline` with its `@Version`, generated column, and lazy state across a wire — you need a view). Estimate **+2 to +4 DTOs**.
  - **IM boundary**: `ImClient` is already the seam and `TerraformPoll` is already the transport value. If IM stays HTTP and the contract is unchanged, the **IM-side DTO surface does not grow** — `TerraformPoll` + the 3 method signatures already model it. A separate Server does **not** by itself add IM DTOs; only a *new* IM contract would. So **+0 toward InfraManager** under the stated assumptions (BFF is the only caller, downstream idempotent — §4.3).
- So: **the separate-Server decision adds ~2–4 client-facing DTOs; the IM boundary adds 0.** This is the real DTO growth in PR #509 — and it comes from the *deployment* decision, not from Claim-Pull. It is also **legitimate** growth: a network boundary *should* have explicit request/response types rather than leaking entities (an entity-over-wire would be the actual anti-pattern). The guidance is: keep them as thin records co-located at the controller, and **do not** let them metastasize into per-layer mappers.

---

## (e) Concrete cut list, ordered by payoff

Ordered by (impact ÷ effort). The honest headline: **there is very little to cut — the module is already at the floor.**

1. **(Highest payoff, but it's a guardrail, not a cut) When building the separate Server, cap new DTOs at the controller edge.** Add only `CreatePipelineRequest`, `CancelPipeline` (path param), and one `PipelineView` response. Do **not** add a service-layer DTO, a mapper class, or per-field re-encodings. Reuse `TerraformPoll` and `ImClient` unchanged for the IM seam. This prevents the exact proliferation the user fears from re-entering through the new boundary. **Effort: design discipline. Payoff: avoids +N DTOs.**

2. **Rename `ErrorCode.CHECK_ERROR` → `CALL_ERROR`.** It fires on the dispatch path too, where nothing is "checked"; the name misleads. Pure rename, 3 files, 0 columns. **Effort: trivial. Payoff: correctness of naming (directly addresses "concepts nobody could name").**

3. **(Optional) Collapse `Recipe` into `List<RecipeStep>`.** Drop the one-field `Recipe` wrapper; have `Recipes.forType()` return the list; rename `Recipe.Step` → `RecipeStep`. **−1 type.** Skip if you expect recipes to gain metadata (name/version) — then the wrapper pays for itself. **Effort: small. Payoff: −1 type, marginal.**

4. **(Optional, not a type cut) Move `PipelineSettings.withX()` + `defaults()` test seams out of main.** ~25 lines whose only consumer is tests. Either accept them as a documented seam (current, fine) or relocate to a test fixture/builder. **Effort: small. Payoff: clarity, 0 type delta.**

**Do NOT cut:** `TerraformPoll` (real IM-boundary value, not a re-encode), `ImCall` / `CallTimeoutException` (the per-call timeout is load-bearing for the worker model and survives into Claim-Pull verbatim), any enum constant except the `CHECK_ERROR` rename, `Pipeline.activeTarget` (load-bearing uniqueness mechanism), the entities, or the repositories.

**Bottom line for the author:** DTO count is *not* your complexity signal here — you already paid that down when you adopted minimal and deleted the maximal ledger/attempt/outbox types. The next real complexity decisions are (i) `tf_slot_counter` as table-vs-count-read, and (ii) governing the client-facing DTO surface the *separate Server* introduces. Claim-Pull itself is DTO-neutral.
