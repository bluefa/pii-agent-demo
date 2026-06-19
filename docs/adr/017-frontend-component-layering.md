# ADR-017: Frontend Component Layering and the Presentational Contract

## Status

Accepted (2026-06-20). Incorporates an OpenAI Codex cross-review — five findings addressed: IDC grounding (resolved by merging #497), the wire/domain boundary scope, a staged error-state contract, enforcement precision, and the file-granularity rule.

Composes with — does **not** supersede:

- [ADR-008](./008-error-handling-strategy.md) — CSR error handling (the 2-layer `fetchJson` → component model). This ADR places ADR-008's "Layer 2" decision in the **container** and makes "reduce to a state" mandatory.
- [ADR-011](./011-typed-bff-client-consolidation.md) — Typed BFF Client. Server/route I/O uses `@/lib/bff/client`; CSR uses `@/app/lib/api/*`. This ADR does **not** move that boundary (see §1, §4).
- [ADR-013](./013-i18n-architecture.md) — error text is rendered from `code`, not raw `message` (see the staged error-state in §3).

## Context

The frontend renders entirely from API responses whose contract changes often and is owned upstream. Two problems recur:

1. **Churn cost** — when a response shape moves, edits fan out across many components.
2. **Un-localizable failure** — a blank screen could be the backend, the data transform, or the component, and there is no way to tell which.

A concrete incident exposed both. On IDC Step 1 ("연동 대상 DB 입력"), after a response-schema change, **"이전정보 불러오기" → "연동 요청" silently did nothing**. Two failures were stacked:

- **No boundary validation.** The read adapter (`app/lib/api/idc.ts` `toIdcResourceView`) coalesces missing/changed fields with `?? fallback`, so a drifted response did not fail on load — it produced a domain object full of plausible defaults. Load "succeeded" with corrupted data.
- **A swallowed error.** The submit handler (`IdcStep1TargetInput.tsx` `handleSubmit`) had an empty `catch {}` whose comment claimed "surfaced by the mutation layer" — but no mutation layer was wired. The resulting `400` produced no toast, no error state; the modal just sat open.

The IDC v15 flow referenced throughout merged to `main` in **#497**, so every file path below is current. The codebase already follows a container/presentational + adapter split (`CandidateResourceSection` → `CandidateResourceTable`, the `app/lib/api/*` adapters, `*-derive.ts` pure helpers, the `AsyncState` union), but **inconsistently**: inline adapter calls inside components, a wire enum (`IdcDatabaseTypeWire`) leaking into `IdcTargetFormModal`, and the empty catch above. Nothing documents the standard, so new code drifts. This ADR codifies the contract and how it is protected.

## Decision

### 1. The layers — only the container and presentational are React components

| # | Layer | File example | Component? | Runtime | Wire? |
|---|-------|--------------|:---:|:---:|:---:|
| ① | Wire types (DTO) | `lib/bff/types/idc.ts` | no | — | is the wire |
| ② | **Adapter** — pure wire↔domain transform | `toIdcResourceView` / `toIdcResourceInput` (`app/lib/api/idc.ts`) | no | **agnostic (SSR + CSR)** | yes |
| ③ | **Client / fetch** (I/O) | `lib/bff/client` (server/route) · `app/lib/api/*` (CSR) | no | **runtime-specific** | yes |
| ④ | Domain types (View Model) | `lib/types/*`, co-located | no | agnostic | no |
| ⑤ | Pure logic / derive | `scan-pill-derive.ts`, `approval-payload.ts` | no | agnostic | no |
| ⑥ | Hooks | `useApiMutation.ts`, `useScanPolling.ts` | no | client | indirect |
| ⑦ | **Container** | `IdcStep1TargetInput.tsx` | **yes** | per file | indirect (via ②③/⑥) |
| ⑧ | **Presentational** | `IdcTargetListTable.tsx`, modals, cells | **yes** | per file | **no** |

> **The adapter (②) is a pure transform — runtime-agnostic.** The same wire↔domain mapping, and the view model it produces, is **shared by SSR and CSR**. Only the **client (③)** is runtime-bound: `@/lib/bff/client` for server/route I/O (which owns the upstream BFF and Swagger-v1 route contract, per ADR-011 and `docs/api/boundaries.md`), and `@/app/lib/api/*` for CSR (a view-model adapter over route responses). `app/lib/api/*` is therefore **not** the single wire↔domain site — it is the CSR-side boundary; the server/route path has its own.

### 2. The Presentational Contract (Layer ⑧)

A presentational component:

- **is one addressable UI unit per file** — a named, reusable, or independently testable component (table / modal / card / badge). This is a strong default chosen for **discoverability**: glob/grep locate a UI by name, small files are cheap to read in full, and file↔component stays 1:1 (this matters in an agent-driven repo). *Exception:* a strictly-private, single-use fragment with no independent state, reuse, or test value MAY be co-located inline (with a comment) to avoid file-churn for trivial pieces.
- **receives domain (view-model) types** as props and **emits domain-shaped callbacks** (keyed on domain ids), never wire/DTO;
- **does not** call `fetch`, a client (③), or a data hook (⑥);
- **does not `try/catch` API exceptions**;
- **renders the state** it is handed (`empty` / `error` / …) — never an exception;
- uses **design tokens** for visuals (so may ⑦ — the confined thing is *raw values*, not tokens; see _Rejected_).

### 3. Container responsibilities (Layer ⑦)

A container:

- obtains data via the adapter (②) + a client (③), or a hook (⑥) — it is the **only** component type that triggers I/O;
- per **ADR-008 Layer 2**, **catches → classifies → reduces** the exception to a state. **Reducing to a state is mandatory; an empty or comment-only `catch` is forbidden** — a caught error must become a rendered state, a toast, or a re-throw;
- composes presentational children and owns **layout** (arranging children).

> **Error path is the adapter's mirror.** Success flows `response → adapter → domain → UI`; failure flows `exception → (classify / reduce) → error-state → UI`. The exception→state reduction *is* the error-path adapter. The presentational layer sees a domain error-state, never a wire exception.

#### 3a. State model — what a container reduces to

Every async outcome is reduced to one canonical state, and a presentational component renders each:

```
loading | ready | empty | error | forbidden
```

- `loading` / `ready` / `error` are today's `AsyncState` (`_components/shared/async-state.ts`).
- `empty` (a successful response with zero rows) and `forbidden` (an authorization failure, tied to ADR-008 `FORBIDDEN`) are **reserved canonical slots**.
- The concrete shared components that render `empty` / `error` / `forbidden` are **not designed here** — they are scattered today (`ScanEmptyState`, `InfrastructureEmptyState`, `common/ErrorState`, `ScanErrorState`, `async-state-views`, plus inline blocks). Their consolidation is a separate decision (**→ ADR-018**), anchored on `async-state-views.tsx`.

#### 3b. Error-state contract — staged

Defined in two phases so it is forward-compatible with ADR-013 without inventing a `code` taxonomy that does not yet exist:

- **Phase 1 (now, accepted interim):** error-state carries a required `message`. Presentational components render it. Matches the current `AsyncState` (`{ status: 'error'; message }`) and `useApiMutation`.
- **Phase 2 (committed end-state; blocked on the ADR-013 `code` taxonomy):** error-state additionally carries `code` (+ `params`, `retriable`, `requestId`); rendering moves to `t(\`errors.${code}\`)` and `message` is demoted to diagnostics-only, per ADR-008/013.

Naming both phases here closes the i18n gap **by schedule** rather than blessing message-rendering permanently.

### 4. Boundaries are bidirectional and validated

- Read: `wire → adapter → domain`. Write: `domain → adapter → wire`. The adapter (②) is the wire↔domain transform; it is pure and runtime-agnostic, so SSR and CSR share it.
- I/O is performed by the client (③), which is runtime-specific (see §1). **Upstream-contract** validation belongs at the server/route + `lib/bff` boundary (ADR-011 defers it); the **CSR adapter** validates route responses into the view model. Do not duplicate the same validation across both.
- The adapter validates at its boundary (parse-don't-validate): input `unknown` → domain **or** a structured `ContractError`. Drift fails **loud here**, not silently via `?? fallback`.
- On a validation failure the adapter may **report the error shape** — field, expected, got, endpoint — **PII-scrubbed**. Never report raw values (this is a PII product). The frontend boundary is often the only detector of a `2xx`-with-wrong-shape drift (a "contract canary").

### 5. Composition rules

- Containers compose **hierarchically** — a container may render child containers (e.g. `IdcProjectPage` → `IdcStep1TargetInput`).
- **Data flows down** via props; **events flow up** via callbacks.
- **Sibling containers are independent** — no lateral calls or reads of each other's state. Shared state **lifts** to a common parent or a store.
- Prefer **fetch-high / render-low**: few containers near the top, many presentational leaves below (avoids fetch waterfalls and duplicate calls).

### Considered and rejected

- **Confining design tokens to ⑧.** Tokens are the design equivalent of *domain types*, not of *wire types*. The thing to confine is *raw values* (hex, magic px), already enforced (CLAUDE.md #4 + the raw-color hook). Banning tokens from containers fights their purpose and the container's legitimate ownership of layout. Rejected; only **raw values** are confined, everywhere.
- **Dropping the one-file-per-UI default** (Codex Minor). Rejected for this agent-driven repo: per-file UI units maximize discoverability for humans *and* agents. The file-churn concern is handled by the trivial-private-fragment exception in §2, not by abandoning the default.

## Enforcement / Protection Policy

Rows are **net-new** unless marked **(exists)**. Two distinct protection surfaces, kept separate:

- **Claude edit-time** — `.claude/hooks/post-edit-grep.sh` (PostToolUse `Edit|Write`, blocks the edit immediately; no CI involvement).
- **lint / CI** — `eslint.config.mjs`, run by `scripts/verify.sh` (via the `stop-verify.sh` hook and CI).

| Rule | Surface / mechanism | Level |
|------|---------------------|:---:|
| Raw Tailwind color in `.tsx` | edit-hook — `post-edit-grep.sh` **(exists, CRITICAL #4)** | block |
| `@/lib/bff/*` import in `app/components/**`, `**/_components/**` | lint — `no-restricted-imports` **(exists)** | block |
| Empty / comment-only `catch` | edit-hook blocker **and** lint `no-empty {allowEmptyCatch:false}` | block |
| Wire **types** in presentational files (`@/lib/bff/types/*`, `*Wire` / `*Dto`) | lint — new `no-restricted-imports` glob (modeled on the three existing blocks) | block |
| Client (③) imported by a pure presentational ⑧ file | edit-hook warn | warn |
| Role / layer discipline; fetch-high/render-low; lift-state-up; file-granularity | skills — `/coding-standards`, `/frontend-design`, `/vercel-react-best-practices` (authoring); `/code-review`, `/anti-patterns` (review) | review |

**Rollout (sequenced; after this ADR and after the cleanup follow-ups land — enabling strict rules before cleanup would red the build, e.g. the `IdcDatabaseTypeWire` leak fails the new presentational-import rule):**

1. `post-edit-grep.sh`: add the empty-catch blocker — lowest-risk, prevents the IDC bug class, **edit-time only (no CI impact).**
2. `eslint.config.mjs`: add `no-empty {allowEmptyCatch:false}`; add the presentational wire-type `no-restricted-imports` glob.
3. `post-edit-grep.sh`: add the client-in-presentational warn.
4. Wire the skills above to this ADR.

Each step is an isolated diff; the edit-hook protection is independent of the lint/CI changes.

## Consequences

**Positive**

- API churn is localized to ②; ④–⑧ stay stable across renames/reshapes.
- Faults become **attributable**: boundary validation separates contract drift (backend) from logic (component); a green validation discharges the "drift" class.
- ⑧ is reusable and visually consistent; its tests are pure render tests.
- Most rules are machine-checkable (block on edit / lint), so the standard does not depend on memory.

**Costs**

- More files / indirection; the **layout vs chrome** boundary is a judgment call.
- Strict import rules require a cleanup pass before they can be enabled.

**Migration (follow-ups, in order)**

1. IDC `handleSubmit` → route through `useApiMutation` (closes the empty catch; surfaces the error).
2. Close the `IdcDatabaseTypeWire` leak — derive at the boundary via `idcDbTypeWireFromLabel` so the wire enum leaves ⑧.
3. Add boundary **validation** to the IDC read/write adapters (parse-don't-validate) so drift fails loud at load.
4. Optionally extract inline adapter calls (e.g. `catalogToCandidates` in `CandidateResourceSection`) into a `useCandidates` hook.
5. Standardize the scattered state-view components (Empty / Error / Permission) — **→ ADR-018**.
6. Land the enforcement rules (per the rollout above) and wire the skills.

## Related files / ADRs

- ADRs: [008](./008-error-handling-strategy.md), [011](./011-typed-bff-client-consolidation.md), [013](./013-i18n-architecture.md); follow-up [ADR-018](./018-state-view-components.md).
- Incident & examples: `app/lib/api/idc.ts`; `app/integration/target-sources/[targetSourceId]/_components/idc/steps/IdcStep1TargetInput.tsx`; `.../idc/IdcTargetListTable.tsx`; `.../idc/modals/IdcTargetFormModal.tsx`; `.../candidate/CandidateResourceSection.tsx`.
- Enforcement: `eslint.config.mjs`; `.claude/hooks/post-edit-grep.sh`; `.claude/skills/{coding-standards,frontend-design,code-review,anti-patterns,vercel-react-best-practices}`.
