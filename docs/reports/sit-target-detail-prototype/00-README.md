# SIT Target-Source Detail Prototype Migration

Spec set for adopting the `design/SIT Prototype v7 - standalone.html` `screen-4 (04 Infrastructure Detail)` visual design into the target-source detail page (`app/integration/target-sources/[targetSourceId]/`).

## Scope guard (read first)

This set is **frontend-only**. No BFF endpoint changes, no swagger updates, no domain-model expansion.

Two strong constraints apply to every wave:

1. **Preserve ProcessStatus stepper motion.** The shipped wave-front entry animation and step-transition motion live in:
   - `app/components/features/process-status/ProcessProgressBar.tsx`
   - `app/components/features/process-status/InstallationProcessProgressBar.tsx`
   - `app/components/features/process-status/motion/**`
   - `app/components/features/process-status/StepProgressBar.tsx` (deprecated alias)

   These four locations are off-limits in every wave. The current visual is preferred over the prototype's static stepper. Wave 0 does not add stepper-label tokens for the same reason — there is no consumer that would use them.

2. **Typography otherwise follows the HTML prototype.** Page title, card display titles, body base size, page-meta strip, breadcrumb, and tracking all align to `screen-4` of the prototype. Wave 0 introduces the tokens; later waves consume them.

## Source mockup

- File: `design/SIT Prototype v7 - standalone.html`
- Section: `<section id="screen-4" data-screen-label="04 Infrastructure Detail">`
- Steps modeled: 1–7 (1=`WAITING_TARGET_CONFIRMATION` … 7=`INSTALLATION_COMPLETE`)
- Visual lineage: Toss-flavored, distinct from the earlier prototype that seeded the current design system.

## Wave layout

| Wave | Title | Type | Depends on | Out of scope |
|---|---|---|---|---|
| 0 | DESIGN.md + theme.ts token additions | Code | — | Stepper motion files; consumer migration |
| 1 | Header & Page Meta | Code (UI) | Wave 0 | Stepper, GuideCard |
| 2 | Step 2 (WAITING_APPROVAL) stats/toolbar/pagination | Code (UI) | Wave 0 | Reason chip (Wave 3), banner timestamps (Wave 3) |
| 3 | Reason chip + Banner timestamps | Code (UI) | Wave 0, Wave 2 | New BFF fields |
| 4 | Step 5/6/7 layout split | Code (refactor) | Wave 0 | Logical DB modal (Wave 6), complete-step status (Wave 5) |
| 5 | Step 7 (INSTALLATION_COMPLETE) visual fill | Code (UI) | Wave 0, Wave 4 | Logical DB modal data (Wave 6) |
| 6 | Step 5 logical DB modal (UI shell only) | Code (UI) | Wave 0, Wave 4 | BFF persistence — `onSave` is `toast.info` |
| 7 | Step 3 scan-pill + Step 4 install pipeline polish | Code (UI) | Wave 0 | Stepper motion, backend semantics for `Integrated`/`Pending` |
| 8 | Provider toggle ADR (no code) | ADR | — | — |

Dependency graph:

```
Wave 0 (tokens)
  ├── Wave 1 (header/meta)
  ├── Wave 2 (step 2 strengthening)
  │     └── Wave 3 (reason chip + banner)
  ├── Wave 4 (step 5/6/7 split)
  │     ├── Wave 5 (complete-step visual)
  │     └── Wave 6 (logical DB modal)
  └── Wave 7 (step 3/4 polish)

Wave 8 (independent ADR — recorded decision)
```

## Out-of-scope acknowledgements

The prototype shows three concepts this migration deliberately does **not** ship:

1. **Provider toggle** (Azure↔GCP segmented control in the detail header) — `cloudProvider` is part of the target-source identity. Switching is a registration action, not a UI toggle. Wave 8 records the decision.
2. **Logical DB persistence** — the prototype's `logicalModal` saves selections; this migration ships a UI shell with `toast.info("BFF 연동 예정")` on save. See Wave 6.
3. **Per-DB Healthy/Unhealthy status field** — the prototype shows a dedicated `status` column. Wave 5 derives the badge from `connectionStatus` (`CONNECTED → Healthy`, `DISCONNECTED → Unhealthy`). When the BFF later adds `healthStatus`, the derive helper swaps.

## Pre-existing data already in BFF response

These confirm that several "prototype-only" items are actually backed by data that ships today:

- `excluded_resource_infos[].exclusion_reason` — populates Wave 3 reason chips. Type: `lib/approval-bff.ts:25,74`, test fixture: `app/integration/api/v1/__tests__/approved-integration-route.test.ts:55`.
- `approval-requests/latest.requested_at` / `requested_by` — populates Wave 3 Step 2 banner. Type: `app/lib/api/index.ts:510-528`.
- `approved_integration.approved_at` — populates Wave 3 Step 3 banner. Type: `app/lib/api/index.ts:361`.
- `ResourceScanStatus` enum (`NEW_SCAN | UNCHANGED`) — populates Wave 2 "스캔 이력" column.
- `ConfirmedResource.connectionStatus` (`CONNECTED | DISCONNECTED`) — derive source for Wave 5 health badge.

If any field is missing in a specific mock fixture, the relevant wave includes a "Mock fixture update" sub-step rather than a BFF change.

## How to execute a wave

Each `waveN-*.md` spec is self-contained. Run it with the `/wave-task` skill:

```
/wave-task docs/reports/sit-target-detail-prototype/wave1-page-meta.md
```

The skill drives Phase 0 (locate) → Phase 7 (auto-fix loop) → Phase 8 (merge wait). Specs encode the worktree command, required reading, implementation steps, scope guards, verification, and PR body.

## File index

- `00-README.md` — this file
- `wave0-design-tokens.md` — DESIGN.md frontmatter + `lib/theme.ts` token additions
- `wave1-page-meta.md` — Replace `ProjectIdentityCard` gradient banner with horizontal kv strip
- `wave2-waiting-approval.md` — Stats card + search/filter toolbar + client pagination
- `wave3-reason-chip.md` — `ReasonChipInline` + banner timestamps/approver in steps 2/3
- `wave4-step-separation.md` — Split `CloudTargetSourceLayout` switch for steps 5/6/7
- `wave5-complete-step.md` — Step 7 visual (Healthy/Unhealthy badge, action buttons, `—` logical DB columns)
- `wave6-logical-db-modal.md` — Step 5 logical DB modal UI shell (no persistence)
- `wave7-step3-step4-polish.md` — Step 3 `scan-pill` column + Step 4 install pipeline visual alignment

## Related ADRs

- `docs/adr/014-toss-typography-tokens.md` — Wave 0 sign-off (token shape, deprecation rule, exclusion of stepper-label tokens)
- `docs/adr/015-provider-toggle-decision.md` — Wave 8 (recorded decision: not provided in detail page)

## Acceptance for this README

This README is correct when:
- A new contributor can pick a wave name and find the spec without prior context.
- The dependency graph matches the actual `depends on` field of each wave spec.
- "Out-of-scope acknowledgements" matches every wave's `Do NOT touch` section.
- The "Preserve ProcessStatus stepper motion" guard is repeated in every UI wave's `Do NOT touch` section.
