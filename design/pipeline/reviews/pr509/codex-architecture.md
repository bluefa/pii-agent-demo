## D2

**`slotCap` and API-call caps are over-promoted; the thesis is correct.**
Fix: Treat worker count, `slotCap`, `runningPipelineCap`, `slotRetry`, lease duration, and 429/503 backoff numbers as "safety mechanisms / tuning", not architectural decisions. The architecture is Claim-Pull ownership plus durable state, not the current values of its governors. The proposal already admits this by calling worker count a concurrency cap and `slotCap` a soft target, not a correctness invariant (`single-pipeline-tick-proposal.md:16`, `:123-:135`, `:243-:256`).
Lost: Less up-front sizing detail in the ADR. That is fine; sizing belongs in operations/runbook text.

**The ADR's BFF ownership is now stale under the dedicated-server decision.**
Fix: Rewrite ADR-016 title/context/decision/options from "orchestration lives in BFF" to "orchestration lives in a dedicated pipeline server; BFF/Admin creates and reads runs through its API." Stale lines include the title and context/decision claims that the BFF owns orchestration (`ADR-016...md:1`, `:16`, `:23`, `:41`, `:84`, `:109`). Re-evaluate every "BFF slotCap", "BFF crash", and "BFF visible" statement as pipeline-server behavior (`:29-:30`, `:99`, `:112`, `:127`).
Lost: The old argument that this is merely a BFF module with minimal operational footprint. A separate server is a real deployment boundary; own it explicitly.

**The load-bearing decisions should be ranked around correctness and ownership, not throttle knobs.**
Fix: Rank the decisions this way:
1. Dedicated pipeline server owns orchestration state and external-call progression.
2. Durable DB state machine: `pipeline` + ordered `task` rows are the source of truth; current task is derived from lowest non-terminal seq.
3. One active pipeline per target, enforced by DB uniqueness and duplicate-create returning the active run.
4. Claim-Pull execution: one worker claims one due pipeline, performs one synchronous external call, then reports.
5. Per-pipeline single writer across replicas via `FOR UPDATE SKIP LOCKED` claim plus ownership guard.
6. At-least-once external side effects are made safe by idempotent dispatch, finite call timeouts, and bounded lease/call-time invariants.
7. Minimal lifecycle semantics: two task kinds, small task/pipeline state machines, retry-as-fresh-run, direct cancel.
8. Explicit loss of high-grain audit/outbox history from the maximal model.
Lost: `slotCap` no longer gets to look like a peer of the state-machine and ownership decisions.

**Currently prominent items to demote: `slotCap`, API-call concurrency, `runningPipelineCap`, `slotRetry`, and exact lease/backoff values.**
Fix: Put them in a subsection named "Safety mechanisms / tuning". Keep only the invariants in the main decision: no hard QPS guarantee, downstream calls must be idempotent or safely retryable, every external call has a timeout, and lease duration must exceed max call timeout plus margin.
Lost: The ADR will stop answering capacity questions in the Decision section. That is a gain for stability; capacity knobs churn.

## D4

**The minimal reference implementation has 5 strict DTO-like data carriers, plus 5 domain enums.**
Fix: Count strict DTO-like/data-carrier types in `test-spring-min/src/main/java` as:
- `Pipeline` entity (`domain/Pipeline.java:26`, `:34`)
- `Task` entity (`domain/Task.java:31`, `:40`)
- `Recipe` record (`create/Recipe.java:11`)
- `Recipe.Step` record (`create/Recipe.java:13`)
- `TerraformPoll` response/value record (`im/TerraformPoll.java:8`)

Related domain concept enums, not DTOs, are:
- `TaskStatus`, `PipelineStatus`, `TaskKind`, `PipelineType`, `ErrorCode` (`domain/*Status.java`, `TaskKind.java`, `PipelineType.java`, `ErrorCode.java`)

`PipelineSettings` is an operational config holder, not a pipeline DTO. If counted broadly as a value holder, add 1, but do not use it as evidence of domain proliferation.
Lost: Nothing. This is the right level of type naming for a minimal state machine.

**There are no obvious redundant persisted DTOs; `TerraformPoll` is the only borderline value type.**
Fix: Keep `Pipeline` and `Task`; they are the two tables promised by the min spec (`minimal-redesign.md:80-:88`). Keep `Recipe.Step`; it is the pre-materialization recipe, not the stored task. Consider replacing `TerraformPoll(boolean finished, boolean succeeded)` with an enum (`RUNNING`, `SUCCEEDED`, `FAILED`) only if callers are already making boolean-state mistakes.
Lost: Replacing `TerraformPoll` with an enum loses a tiny bit of transport flexibility but gains clearer states. Keeping it loses almost nothing.

**The earlier maximal model's proliferation came from audit/attempt/snapshot/outbox concepts, not from Java records themselves.**
Fix: Keep the min spec's cuts: no `task_check`, no `task_attempt`, no `pipeline_event`, no `pipeline_def_snapshot` (`minimal-redesign.md:87-:88`; ADR maximal remnants at `ADR-016...md:7-:12`, `:61`, `:117`, `:125`). Those concepts create tables, DTOs, retention rules, correlation rules, and naming load.
Lost: Full attempt/check audit, guaranteed event delivery, and frozen recipe reproduction. Those are product capabilities; do not smuggle them back as "DTO cleanup".

**Claim-Pull itself should add columns/mechanics, not DTO proliferation.**
Fix: Model Claim-Pull as changes to `pipeline` (`next_due_at`, `claimed_by`, `claimed_until`) and worker methods (`claimOne`, `report`), not as a new family of claim/request/report DTOs. If a DTO is needed at all, one internal `ClaimedPipeline` projection is the budget.
Lost: Less abstraction around worker handoff. Good; the DB row is the handoff.

**DTO budget verdict: minimal, with one watch item.**
Fix: Budget for V1 should be: 2 entities, 5 enums, 2 recipe records, 1 external poll result, 0 public API request/response DTOs unless the dedicated server exposes HTTP endpoints. Watch item: if the dedicated server API is introduced, keep API DTOs separate from persistence entities but do not mirror every field both ways.
Lost: Some API polish if no public DTOs exist yet. Acceptable until there is an actual network boundary.

## D7

**`tf_slot_counter` is too much for a soft target.**
Fix: Simpler replacement: remove the counter table from V1 and either rely on Infra Manager/TerraformWorker admission as the hard cap or derive current TF in-flight count from tasks when needed. If a local smoothing guard is still wanted, make it explicitly best-effort and count rows; do not maintain a mutable one-row semaphore unless hard CAS is required.
Lost: Cheap O(1) admission and a ready path to hard server-side slots. You also lose earlier queue smoothing before IM, but not correctness.

**Lease/ownership-CAS is justified only if active-active multi-replica workers are a V1 requirement.**
Fix: If V1 is a single dedicated pipeline server, replace `claimed_by/claimed_until` with a local bounded executor and an in-memory in-flight set; persist only task status/due time. If active-active replicas are required, keep the lease and ownership CAS because it is the cost of committing the claim before a slow external call (`single-pipeline-tick-proposal.md:77`, `:180-:207`).
Lost: Without leases, you lose native multi-pod work sharing and bounded crash handoff by lease expiry. With leases, you keep those properties but pay three columns, a stale-result discard path, and duplicate-call reasoning.

**`next_due_at` on `pipeline` is an optimization, not a core model fact.**
Fix: Simpler replacement: keep due time on the current `Task` (`next_check_at` in the min impl) and claim via a join/current-task query, or tolerate scanning ~2000 running pipelines before optimizing. Move `next_due_at` to `pipeline` only after the claim query needs a single-table index (`single-pipeline-tick-proposal.md:87-:93`, `:150-:161`).
Lost: The simple dequeue query and a clean `(status, next_due_at, claimed_until)` index. You gain one less duplicated scheduling field.

**`slotRetry` exists only because the slot gate exists.**
Fix: Simpler replacement: delete `slotRetry` if `slotCap` is demoted/removed. If slot gating remains, use the normal worker idle sleep or existing polling cadence rather than a separate knob unless there is measured hot-loop pressure (`single-pipeline-tick-proposal.md:54`, `:171-:173`).
Lost: Faster refill after a slot opens. For Terraform jobs measured in minutes, a few seconds are not architecturally important.

**The two-transaction claim/report split is necessary for active-active Claim-Pull, but unnecessary for single-server V1.**
Fix: Do not hold a DB transaction open across the external call. For active-active workers, keep tx1 claim, call outside tx, tx2 report with ownership guard (`single-pipeline-tick-proposal.md:48-:60`, `:181-:188`). For a single dedicated server, simplify to local ownership plus one DB transaction around state transition/report.
Lost: The simplified single-server form loses multi-replica safety and crash reclaim while a call is in flight. The two-transaction form loses conceptual simplicity.

**`runningPipelineCap` is not doing architectural work once worker count and per-target uniqueness exist.**
Fix: Remove it from V1 unless there is a product requirement to reject or defer new runs when backlog is high. Worker count bounds external-call concurrency; per-target uniqueness bounds target contention.
Lost: A coarse backlog/admission brake. You can add it later as an operations guard.

**Reactive 429/503 backoff should stay, but do not make it a mini rate-limiter design.**
Fix: Keep only "respect Retry-After by moving due time" in V1. Endpoint token buckets or distributed rate limiters are follow-on work if IM/provider limits become real. The proposal already says hard QPS is out of scope (`single-pipeline-tick-proposal.md:112`).
Lost: No proactive QPS guarantee. That is already true; pretending otherwise is worse.

## Top 3 changes I would make

1. Rewrite ADR-016 for the dedicated pipeline server and delete stale BFF-as-orchestrator language.
2. Move `slotCap`, API concurrency, `runningPipelineCap`, `slotRetry`, and exact lease/backoff values into "Safety mechanisms / tuning"; keep only correctness invariants in Decision.
3. Pick one V1 deployment stance: single dedicated server with simpler local ownership, or active-active Claim-Pull with leases. Do not carry lease/CAS complexity unless active-active is actually required.
