# ADR-015: Provider Toggle Is Not Offered on the Target-Source Detail Page

## Status

Proposed (2026-05-12)

**Relates to:** Wave 8 of `docs/reports/sit-target-detail-prototype/`. This ADR is the entire Wave 8 deliverable; no code change.

## Context

`design/SIT Prototype v7 - standalone.html` `screen-4` (Infrastructure Detail) shows a segmented control in the page header:

```html
<div class="seg-toggle" id="providerToggle" role="group" aria-label="Cloud Provider">
  <button class="seg-btn active" data-prov="azure" onclick="setProvider('azure')">Azure</button>
  <button class="seg-btn" data-prov="gcp" onclick="setProvider('gcp')">GCP</button>
</div>
```

The mockup's `setProvider()` script swaps the page's provider-specific text/meta/icons to demonstrate the UI for both Azure and GCP without leaving the page. This is a presenter affordance, not a product behavior.

The Wave 0–7 migration intentionally does **not** ship this toggle. This ADR records the reasoning so future contributors do not re-introduce it under the assumption that "the prototype had it."

## Why a separate ADR

A reviewer of any Wave 1 PR will notice the missing toggle. Without a recorded decision, the path of least resistance is to add the toggle "for parity with the prototype." That would be wrong: the toggle implies a product semantics that the data layer cannot honour.

This ADR is the cited reference whenever a reviewer asks "where did the toggle go?"

## Decision

**The detail page does not provide a Provider toggle.**

`cloudProvider` is part of `TargetSource` identity. Switching cloud providers on an existing target source is a data-model contradiction — the resource IDs, credentials, and installation state belong to one cloud. The action that "switches to GCP" is, in the product, *registering a new target source on GCP*, not toggling a UI control on the existing record.

The page header keeps the **read-only** Cloud Provider label inside the page-meta strip (Wave 1's `PageMeta` items). No segmented control next to "인프라 삭제."

### Options considered

| Option | Decision | Reason |
|---|---|---|
| A. Implement the toggle as a real switch (re-route to another target source) | Rejected | Requires either keeping per-provider parallel records (semantic burden) or implementing "convert this target source to another provider" (impossible — credentials and resource IDs are cloud-scoped). |
| B. Render the toggle but `disabled`, with a tooltip "Provider 변경은 새 TargetSource 등록에서 가능" | Rejected | Adds visible chrome that signals "this should be possible" while explicitly being not possible. Users expect disabled controls to be temporarily disabled, not permanently. |
| C. Render the toggle as a non-interactive label ("Cloud Provider: Azure") | Rejected | Duplicates what the page-meta strip already says (Wave 1). |
| D. Omit the toggle entirely; keep Cloud Provider in the meta strip | **Chosen** | The page-meta strip is already the place that names the provider. No false affordance. The product semantics match the UI. |

## Architectural Rules

### R1 — `screen-4` parity check excludes the provider toggle

The migration's PR template (when a reviewer compares a wave against the prototype) lists the toggle as an explicit "do not implement" item with this ADR as the reference. Future spec-driven waves that touch the page header reaffirm this in their `Do NOT touch` section.

### R2 — Provider switching is a registration concern, not a detail-page concern

If product later needs "user wants the equivalent service on GCP" UX, the entry point is the project-create / target-source-registration flow (`app/integration/target-sources/[targetSourceId]/_components/` is detail-only; registration lives outside this directory). That decision is its own ADR; this ADR is silent on registration UX.

### R3 — Reading the meta strip is the canonical "what provider is this?" answer

Wave 1 already exposes `Cloud Provider` as the first meta item with the provider name (Azure / GCP / AWS / IDC / SDU). That entry is the documented place to read the provider on the detail page. No second control duplicates that information.

## Consequences

### Positive

- The detail page has one place that names the provider (Wave 1 meta strip), not two.
- Reviewers comparing the migration PR sequence against the prototype have a one-line reference for the toggle's absence.
- No dead UI affordance to maintain.

### Negative

- Designers and PMs who only read the mockup may expect the toggle and need a verbal pointer to this ADR. Mitigation: Wave 1 PR description cites this ADR explicitly. The migration README also lists this ADR under "Out-of-scope acknowledgements."

### Re-triggers

The decision is revisited only if both of the following are true:

1. Product introduces a "convert target source to another cloud" workflow with a defined data-migration story.
2. The conversion is supposed to happen from the detail page rather than a registration screen.

If only (1) is true, the new workflow lives in registration and this ADR stays as written. Recording the trigger explicitly avoids future "we kind of need a toggle, right?" thinking.

## Open issues

None. The decision is binary and the alternatives are exhausted.
