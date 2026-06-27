## Assessment

This is a materially better ADR than the maximal design: it states a clear V1 execution model, separates architectural decisions from tuning knobs, and explains why the dropped mechanisms are no longer justified. The biggest strength is the single-server + DB-state framing, which makes the reliability model understandable and testable. The biggest weakness is cross-document drift: the ADR says the spec/proposal are canonical, but those documents still mark themselves draft/unadopted, and the `last_requested_at` audit marker is not present in the canonical schema. The design is appropriately simple for V1, but the ADR needs a small consistency pass before it should be treated as decision-grade.

## Score

Overall: **80/100**.

Weighted result: correctness/internal consistency and completeness were weighted most heavily because an ADR is only useful if future implementers can trust it as the source of truth. Weighting used: correctness 30%, completeness 20%, clarity 15%, altitude 15%, simplicity 10%, ADR-format adherence 10%.

| Dimension | Score | Justification |
|---|---:|---|
| Correctness & internal consistency | 7/10 | Core model matches the minimal spec and single-server proposal, but there is visible drift around dependency status, `last_requested_at`, stored-vs-derived pipeline status, and external-call duration wording. |
| Completeness | 8/10 | Decision, context, options, and consequences are present; audit/alerting consequences need sharper V1 boundaries. |
| Clarity / readability | 8/10 | Plain and readable overall; a few terms are overloaded (`job poll`, `one worker per pipeline`, `derived`) in ways that can mislead implementers. |
| Altitude | 9/10 | Good separation between architectural decisions and safety/tuning knobs; avoids re-freezing QPS, slot, and circuit-breaker details. |
| Simplicity | 9/10 | The described V1 is close to the simplest restart-safe design that can tolerate slow external calls and multi-day waits. |
| ADR-format adherence | 8/10 | Has Nygard sections, options, consequences, and reversibility; title states the decision. One-ADR focus is acceptable, though it bundles schema, uniqueness, runtime, and lifecycle under the execution-model decision. |

## Fix items

No P0 blockers.

[P1] ADR lines 9-10, 173-176; minimal-redesign lines 3-4; single-pipeline-tick-proposal lines 3-5 -- the ADR calls these documents canonical / selected, but the referenced spec says "DRAFT proposal" and "Owner decision pending", and the execution proposal says "proposal, unadopted" -- either update the referenced documents' status headers or add an explicit ADR note saying this ADR adopts them despite stale proposal headers.

[P1] ADR lines 151-154; minimal-redesign lines 82-85; proposal lines 72, 97 -- the ADR relies on a `last_requested_at` task marker, but the canonical `task` schema does not include it and the proposal treats it as optional -- decide whether it is required V1 state; if yes, add it to the canonical schema, otherwise change the ADR to say logs/metrics are the V1 audit mechanism and the marker is deferred/optional.

[P1] ADR lines 24-25, 91-92, 142 -- the ADR correctly says InfraManager run is asynchronous, but later says "minutes-long job poll" and "minutes-scale external calls", which can imply workers block for the Terraform job duration -- rewrite to distinguish synchronous HTTP/API calls from asynchronous Terraform job execution, e.g. "slow API calls up to the per-call timeout occupy one worker; Terraform jobs may run for minutes and are polled across ticks."

[P2] ADR lines 45-46, 151-154, 156-161; minimal-redesign lines 119-120 -- "run history and alerting are first-class" overstates V1 after the ledger, outbox, worker-outage alerts, and queue-wait alerts are dropped/deferred -- specify exactly what V1 exposes: pipeline/task rows for visible run state/history, logs/metrics for operational audit, timeout/failure metrics for alerts, and which alert classes are deferred.

[P2] ADR lines 60-64; minimal-redesign line 82 -- the ADR says pipeline status is derived from tasks, while the canonical data model stores `pipeline.status` -- clarify whether `pipeline.status` is a stored projection updated transactionally from task status, or remove it from the schema and derive it at read time.

[P2] ADR lines 83-92 -- "one worker per pipeline" in the heading can be read as a permanent worker allocation per pipeline, not bounded-pool execution -- rename to "single server with a bounded worker pool; at most one worker per pipeline at a time."

[P3] ADR lines 96-99, 117-119 -- "duplicate submit is harmless" is directionally right for infrastructure convergence, but InfraManager still runs duplicate jobs and may deepen its queue -- phrase as "final infrastructure state is safe; duplicate dispatch may create extra downstream work, which V1 accepts."

[P3] ADR lines 128-130 -- the workflow-engine alternative is rejected as operationally too heavy, but the consequence of not using a workflow engine is not stated -- add one sentence that V1 owns retry/polling/visibility semantics itself.

## Complexity hotspots

Overall, the design is already minimal for the stated requirements. The remaining complexity hotspots are mostly justified; I would not cut them without weakening restart safety, visibility, or throughput.

Mechanism: separate `pipeline` and `task` tables with ordered task rows. Simpler alternative: one `pipeline_run` row with current phase/step fields or JSON recipe state. What is lost: per-task status/history, clear sequencing, and clean support for ~12 provider/type recipes. Verdict: justified.

Mechanism: bounded worker pool plus in-memory in-flight guard. Simpler alternative: a single serial scanner that performs calls inline. What is lost: throughput when calls are slow; one slow API call can hold the whole scan cadence. Verdict: justified because the problem explicitly includes unpredictable external-call latency.

Mechanism: stored `pipeline.status` if retained as a projection. Simpler alternative: derive pipeline status from task rows on every read/scan. What is lost: cheaper scanner queries, simpler active-pipeline uniqueness/indexing, and easier API reads. Verdict: acceptable if the ADR says it is a transactional projection; otherwise it is a consistency footgun.

Mechanism: per-task timing/retry fields (`ttl`, `polling_interval`, `execution_timeout`, `max_fail_count`). Simpler alternative: global operational config only, with recipes holding no copied knobs. What is lost: task/provider-specific behavior and in-flight insulation from config changes. Verdict: keep only values that vary by task kind/provider; avoid turning operational knobs back into architectural commitments.

Mechanism: `last_requested_at` marker. Simpler alternative: logs/metrics only. What is lost: cheap row-level evidence that a task was attempted before a timeout/crash. Verdict: include it only if product/support actually need this in the DB; otherwise the ADR should not present it as part of the audit answer.
