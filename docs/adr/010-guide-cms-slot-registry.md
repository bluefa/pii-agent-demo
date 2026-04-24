# ADR-010: Guide CMS — Frontend Slot Registry + Server Content Store

## Status

Proposed · 2026-04-25

## Context

`lib/constants/process-guides.ts` (525 lines) hard-codes all `GuideCard` content shown in the integration process pages. Content edits currently require a frontend deploy. Operations want to edit guide content without shipping code.

We need to design the data boundary between **what the frontend owns** (identity, placement, layout) and **what the server owns** (editable content). The design must cover:

1. Process-step guides today (AWS AUTO/MANUAL, AZURE, GCP).
2. AWS step 4 divergence (AUTO vs MANUAL installation flow) without duplicating shared content.
3. Future extensibility to non-step placements (side panels, tooltips, FAQs) without requiring a backend migration every time the UI grows a new surface.
4. Strict HTML safety (no XSS) while allowing a constrained editor.

### Alternatives considered

**A. Flat `GUIDE_NAMES` constant + `(provider, variant, step) → name` resolver.**
Name encodes placement (`AWS_AUTO_TARGET_CONFIRM`). Simple and type-safe, but fails when:
- AWS AUTO and AWS MANUAL share content → forces 2 copies of the same name (`AWS_AUTO_*`, `AWS_MANUAL_*`), creating drift risk.
- A future side-panel guide (not tied to `(provider, step)`) has no natural name shape.
- Sharing content across placements requires naming convention gymnastics (e.g. `COMMON_*` prefix), which encodes reuse implicitly.

**B. API-driven name list.** Server owns the catalog of valid guide names; frontend fetches on demand.
- Breaks compile-time safety (`GuideName` cannot be a union type).
- Resolver must be async → components need loading states just to decide what to render.
- A new UI surface still requires frontend code — the "dynamic catalog" saves nothing.
- User contract already states: "guide_name은 constant 형태로 다뤄져야 한다 — admin은 생성·삭제·변경 불가".

**C. Frontend slot registry + server content store (chosen).** Separate identity (`GuideName`, 22 fixed) from placement (`GuideSlot`, 28 entries, many-to-one to names). Server stores only `name → contents`.

**D. Duplicate content per placement.** Accepted in interim proposals (AWS AUTO step 1 and MANUAL step 1 as separate names with duplicated content). Rejected because operations must edit identical content in multiple places, inviting drift.

Codex (external reviewer) pushed back on proposal A for exactly the reasons in (C): flat naming cannot cleanly model many-to-one sharing or non-step placements.

## Decision

Adopt **Option C**.

### Frontend owns: identity + placement

```ts
// lib/constants/guide-registry.ts
export const GUIDE_NAMES = [
  'AWS_TARGET_CONFIRM', 'AWS_APPROVAL_PENDING', 'AWS_APPLYING',
  'AWS_AUTO_INSTALLING', 'AWS_MANUAL_INSTALLING',
  'AWS_CONNECTION_TEST', 'AWS_ADMIN_APPROVAL', 'AWS_COMPLETED',
  'AZURE_TARGET_CONFIRM', /* ...6 more */,
  'GCP_TARGET_CONFIRM',   /* ...6 more */,
] as const;   // 22 entries

export type GuideName = (typeof GUIDE_NAMES)[number];

export type GuidePlacement =
  | { kind: 'process-step'; provider; variant?; step; stepLabel }
  | { kind: 'side-panel'; surface }           // future
  | { kind: 'tooltip';   surface; field }     // future
  | { kind: 'faq';       section; order };    // future

export const GUIDE_SLOTS = {
  'process.aws.auto.1':   { guideName: 'AWS_TARGET_CONFIRM',   placement: {...}, component: 'GuideCard' },
  'process.aws.manual.1': { guideName: 'AWS_TARGET_CONFIRM',   placement: {...}, component: 'GuideCard' },  // same name, different slot
  'process.aws.auto.4':   { guideName: 'AWS_AUTO_INSTALLING',  placement: {...}, component: 'GuideCard' },  // fork here
  'process.aws.manual.4': { guideName: 'AWS_MANUAL_INSTALLING', placement: {...}, component: 'GuideCard' },
  /* ... 28 entries total */
} as const;
```

Resolution is synchronous:
```ts
function resolveSlot(key: GuideSlotKey): GuideSlot;
function findSlotsForGuide(name: GuideName): GuideSlot[];  // admin UI uses this to show "this guide appears in N places"
```

### Server owns: editable content only

```
GET /integration/api/v1/admin/guides/{name}  → { name, contents: { ko, en }, updatedAt }
PUT /integration/api/v1/admin/guides/{name}  → same shape (returns saved state)
```

Server validates `name ∈ GUIDE_NAMES` on every request. Storage keyed purely by name. No provider/step/label/slot metadata on the server side.

### HTML safety — 3-layer defense, no `dangerouslySetInnerHTML`

1. **Tiptap editor** limited to extensions matching the allow-list (h4, p, br, ul, ol, li, strong, em, code, a).
2. **`validateGuideHtml(html)`** runs on both the client (pre-save) and server (on PUT). Returns a typed AST or a list of errors (disallowed tag, disallowed attribute, invalid URL scheme, invalid nesting, parse error, empty content).
3. **`renderGuideAst(ast)`** builds a React tree via `React.createElement` from the validated AST. Invalid content falls through to an explicit error component instead of rendering.

If any layer rejects, the content does not render. We never pass raw HTML to `dangerouslySetInnerHTML`.

### Sharing model

- Multiple slots can point to the same `GuideName` (e.g. `process.aws.auto.1` and `process.aws.manual.1` both reference `AWS_TARGET_CONFIRM`). One edit updates every slot that references the name.
- Admin UI surfaces this via `findSlotsForGuide(name)` — when the editor loads a guide used in ≥2 slots, it displays the list of affected placements so the editor knows the edit propagates.
- Cross-provider sharing (`COMMON_*`) is **not used** in this iteration — provider-level content stays independent. If future content is genuinely identical across providers we will revisit.

### Scope

**In**: process-step guides for AWS (AUTO+MANUAL), AZURE, GCP. ko + en content.

**Out**: IDC/SDU (step structure unresolved), PREREQ_* guides, side-panel/tooltip/FAQ placements (schema supports them; UI does not render them yet), draft/publish workflow, edit history, non-engineer catalog CMS.

## Consequences

### Positive

- Type safety: `GuideName` is a 22-member union. Invalid identifiers fail at compile time in every call site (`<GuideCard>`, API routes, mock store, tests).
- Synchronous resolution: components render without loading states for placement lookup; only content fetching is async.
- Clear ownership boundary: frontend evolves UI topology freely; server stays a dumb content store.
- Many-to-one slots eliminate AWS AUTO/MANUAL content duplication (drift) while keeping intentional forks explicit (`AWS_AUTO_INSTALLING` vs `AWS_MANUAL_INSTALLING`).
- `GuidePlacement` discriminated union gives us a forward path to side-panel/tooltip/FAQ placements without reshaping the registry.
- HTML AST renderer eliminates XSS as a design concern — raw strings are never injected into the DOM.

### Negative / trade-offs

- Admin cannot add or remove guide names — that always requires a frontend PR. Acceptable: user requirement explicitly forbids admin-driven name changes.
- Adding a new placement `kind` (e.g. side-panel) is cheap at the schema level but requires new Admin UI to render it. We defer that UI work until there's a concrete need.
- Registry ↔ store drift must be policed by CI (a test asserts `new Set(GUIDE_NAMES) === new Set(store keys)`). Orphan content left behind by a removed registry entry is invisible to admins and needs an occasional cleanup script.
- `stepLabel` in the registry is currently Korean. When i18n (docs/reports/i18n-support-plan.md) lands, these must become label keys rather than literal strings.

### Impact on existing code

- `app/components/features/process-status/GuideCard.tsx` splits into `GuideCard` (pure, takes `content: string`) and `GuideCardContainer` (takes `slotKey` and handles data fetching). Five provider pages migrate from `<GuideCard currentStep={} provider={} installationMode={} />` to `<GuideCardContainer slotKey="process.aws.auto.3" />`.
- `lib/constants/process-guides.ts` retains `procedures` / `warnings` / `notes` / `prerequisiteGuides` for `ProcessGuideModal`. Only the `guide` field (now redundant with the new CMS) is removed.
- `app/api/_lib/problem.ts` gains two error codes: `GUIDE_NOT_FOUND`, `GUIDE_CONTENT_INVALID`.
- No change to BFF upstream contract yet — this iteration ships against mock store, with the swagger (`docs/swagger/guides.yaml`) defining the upstream contract for eventual backend implementation.

## References

- [Guide CMS spec](../reports/guide-cms/spec.md)
- [Guide CMS implementation plan](../reports/guide-cms/implementation-plan.md)
- [Swagger — guides.yaml](../swagger/guides.yaml)
- External reviewer (Codex) feedback on slot-registry vs flat-naming, 2026-04-24
- User requirement log: guide name as constant, admin cannot add/delete, 2026-04-23 → 04-25 session
- Related: ADR-007 (API client pattern), ADR-008 (error handling strategy)
- Related: `docs/api/boundaries.md` (CSR vs SSR pipelines — this feature lives in CSR pipeline)
- Future work: `docs/reports/i18n-support-plan.md` — registry labels will migrate to keys
