# Target-Source Detail ↔ Design v15 Alignment — Implementation Plan

> Goal: align the target-source detail page (4 cloud types × 7 process steps) to
> `design/SIT Prototype Athena v15.html`, with mock data so **every (cloud × step)
> is viewable**, service codes declared as `azure / aws / idc / gcp`, and only the
> (near-zero) genuinely-missing APIs stubbed. Grounded in three code/design sweeps
> (design v15, current rendering, mock+API). Worktree `feat/target-source-v15`,
> base `main@762dc7c` (post-#504).

## What the exploration established

**Current architecture (already in place):**
- `ProjectDetail` switches on `cloudProvider` → `{Aws,Azure,Gcp}ProjectPage` →
  shared `CloudTargetSourceLayout` (7 step components + provider **slots**); IDC →
  `IdcTargetSourceLayout` (7 dedicated IDC steps). Slots (`InstallationStatusSlot`,
  `ConfirmedResourcesSlot`, `ConnectionTestSlot`) isolate provider differences.
  ADR-012 guards: the cloud layout sees only `processStatus` (R1).
- So **the app already renders all 7 steps for all 4 clouds.** This is *delta
  alignment to v15*, not a rebuild.

**Mock + API (`lib/mock-data.ts`, `lib/bff/mock/*`, `lib/mock-{aws,azure,gcp,idc}.ts`):**
- Service codes seeded `SERVICE-A/B/C` at `lib/mock-data.ts:129-146`.
- Coverage today: AWS 6/7, Azure 1/7, GCP 1/7, IDC 7/7 → **13 of 28 (cloud×step)
  combinations have no seeded project to view.**
- **APIs already fully cover all 7 steps × 4 clouds** (30+ mocked functions:
  getConfirmResources / createApprovalRequest / getApprovedIntegration /
  get{Aws,Azure,Gcp,Idc}InstallationStatus / triggerTestConnection /
  confirmInstallation / getConfirmedIntegration, …). **No new step API is required.**

**Design v15 (line refs captured per screen):**
- 4 clouds via a top-right `Azure | GCP | AWS | IDC` toggle; identity bar changes
  (Azure=Subscription ID, AWS=Account ID, GCP=Project ID, IDC=Datacenter).
- 7 steps. Steps 2/3/6 are near-identical read tables; **Step 4 (install) differs
  radically per cloud** (Azure Private Link 3-task · AWS auto/manual + Terraform
  card · GCP VPC-peering 3-task · IDC firewall 2-task); Step 1 (cloud scan vs IDC
  manual), Step 5 (test), Step 7 (logical-DB counts + health) also differ.
- Azure is the most complex Step 4 (service-side + BDC-side + Private Link).

## Scope decision (so the user has ~nothing to decide)

- **APIs ≈ 0 new.** Per the mock sweep, every step's data is already served. The
  "create APIs if missing" reduces to a coverage audit; a stub is added *only* if a
  v15 screen renders data the current response lacks. Any such stub is listed
  explicitly. Expectation: 0–1, matching the user's "그 숫자가 많지 않다."
- **Service codes = `azure / aws / idc / gcp`** (per the user's instruction). Decided.
- **Design fidelity is the core risk and the explicit user concern.** Every UI
  alignment is gated by a `/design-extract` of the v15 screen → a token-mapped spec
  → reconciled against the current component. No screen is "eyeballed."

## Non-goals (this pass)

- Real backend; pixel-perfect animation timing; AWS China/Global split (note as
  follow-up); admin/dashboard/list screens; IDC behavioral changes (IDC steps were
  just refactored in #504 — only design deltas here).

## Phases

### Phase 0 — Foundation: viewability (concrete, unblocks everything)

- **0a. Service-code rename.** `SERVICE-A/B/C` → `azure, aws, gcp` (+ add `idc`) at
  `lib/mock-data.ts:129-146`; update every reference: user permissions
  (`:100-115`), each `project.serviceCode`, `lib/bff/mock/services.ts` auth,
  `getProjects(serviceCode)` filter. Each cloud's projects map to its own code.
- **0b. Seed the 13 missing projects** so all 28 (cloud×step) render: AWS step 3;
  Azure steps 2,3,5,6,7; GCP steps 2,3,4,5,6,7. Reuse `createStatusForProcessStatus`
  and provider-correct resource shapes (Azure: subscription + Azure resourceId +
  PrivateEndpoint; AWS: account + ARN + VPC endpoint; GCP: projectId + service
  account). PII-safe placeholders only.
- **Verify:** in mock mode (`USE_MOCK_DATA=true`), each of the 28 target sources
  routes to the correct step; `tsc`/`lint`/`vitest` green. A short index of the 28
  targetSourceIds (cloud × step) is produced for the user to click through.

### Phase 1 — Design extraction (the anti-"ignore design" gate)

- Run `/design-extract` on each **distinct** v15 screen (not all 28 — see
  self-review §2). Output a token-mapped spec per distinct screen under
  `docs/ux/v15-target-source/` (Korean allowed): layout blocks in order, exact
  Korean copy, theme.ts token mapping for every color/space/typography, table
  columns, badges/pills, buttons, modals, and the per-cloud Step-4 variants.
- These specs are the **acceptance criteria** for Phase 2. This phase is the
  guarantee that design elements are not dropped.

### Phase 2 — Per-screen delta alignment (waves, spec-driven)

Decomposed along the real seams:
- **2a. Shared cloud steps 1–7** (`CloudTargetSourceLayout` step components +
  `ConfirmedResourcesSlot`/`ConnectionTestSlot`) → v15 cloud screens. One pass
  covers AWS/Azure/GCP common structure (tables, stats grid, banners, status
  pills, copy buttons, exclusion-reason chips, step 7 logical-DB counts + health).
- **2b. Provider Step-4 install slots + identity bar** → v15 per-cloud install:
  Azure Private Link 3-task, AWS auto/manual toggle + Terraform card, GCP VPC
  3-task; identity bar per cloud. (`InstallationStatusSlot` already branches here.)
- **2c. IDC steps 1–7** → v15 IDC screens (Source-IP column from step 2, firewall
  task/modal, manual approval-request buttons, simpler step-7 table).
- Each screen: spec (Phase 1) → apply the **delta** to the existing component →
  verify against the spec. Run as a wave; one subagent per distinct screen with the
  spec as the contract (file-disjoint by component).

### Phase 3 — API coverage audit (minimal)

- For each aligned screen, confirm the existing endpoint returns the fields it
  renders. Stub *only* a genuinely-missing read (expected ≈0). List any stub; no
  contract invention.

## Verification

- **Phase 0:** 28 combos navigable to the right step; tsc/lint/test green.
- **Phase 1:** one spec file per distinct v15 screen.
- **Phase 2:** each screen matches its spec — tokens via `@/lib/theme` (no raw
  colors, CLAUDE.md #4), copy verbatim, columns/badges/buttons present, per-cloud
  Step-4 variant correct; tsc/lint green; pre-existing tests pass.
- **Whole:** a mock-mode walkthrough of all 28; `git diff` shows ≈0 change under
  the API contract layer beyond any listed stub.

---

## Self-review (critique of this plan, before execution)

**1. Biggest risk — Phase 2 looks like 28 screens of work.** It is not. The cloud
layout is *shared*: aligning the 7 cloud step components covers AWS/Azure/GCP at
once; only Step 4 (install) + the identity bar are per-cloud. IDC is a separate 7.
So the **distinct** screen count is ≈ 7 (cloud common) + 4 (Step-4 install
variants: Azure/AWS-auto/AWS-manual/GCP) + 7 (IDC) ≈ **16–18 distinct screens**,
several of which (steps 2/3/6) are the same table re-skinned. Phase 1 extracts the
*distinct* set, not 28.

**2. "Match as-is" is ambiguous → define the fidelity bar.** Target = **structural
+ token + copy parity**: same blocks in the same order, theme.ts tokens matching
v15's palette/spacing, verbatim Korean copy, all columns/badges/buttons/modals
present. **Out:** pixel-exact animation curves, hover micro-interactions, the AWS
China/Global split. This keeps "우선 그대로 한번 맞춰보자" bounded.

**3. Delta, not rebuild — verify the premise.** The app was built against earlier
SIT prototypes (v8–v14 in `design/`); v15 is the newest. Phase 2 must first **diff
current vs v15 per screen** and apply only the deltas, or it will churn working UI.
If a screen already matches, it is a no-op with a recorded "matches v15" note.
*Action:* Phase 1 specs include a "current vs v15 delta" line per screen so Phase 2
is scoped to real differences.

**4. Phase 0 ordering is right, but watch the seed blast radius.** Renaming service
codes touches auth (`services.ts`) and `getProjects` filtering; a missed reference
= empty project lists. *Action:* grep every `'SERVICE-` occurrence first; change
all in one commit; verify a mock-mode project list renders before seeding.

**5. Over-engineering guard.** Do **not** add new layout abstractions, new slots, or
new API shapes "to be safe." The ADR-012 slot system already exists; alignment
reuses it. New code only where a v15 element has no current equivalent.

**6. Where the user's "few decisions" actually live.** Only one could need a call:
if a v15 screen renders a field the mock response genuinely lacks (Phase 3 stub).
Plan proceeds without asking and lists any such stub for after-the-fact review —
per "api를 직접 생성할 부분만 생성해… 그 숫자가 많지 않다."

**7. Sequencing.** Phase 0 → Phase 1 (extract distinct screens) → Phase 2 (waves) →
Phase 3 (audit). Phase 0 is independently shippable (mock viewability) and should
land first so the user can click through all 28 while Phase 2 proceeds.

**Revised distinct-screen estimate driving effort:** ~16 specs (Phase 1), ~16
delta-alignments (Phase 2), 13 seed records + 1 rename (Phase 0), ~0–1 API stub.
