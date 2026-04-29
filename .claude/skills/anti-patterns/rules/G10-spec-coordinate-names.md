# G10. Spec / wave / phase coordinates as identifier names

Severity: 🟡 important

A "spec coordinate" is a label that points to where work lives in a delivery process — `Step4`, `Wave3`, `Phase2`, `S4G-W1b`, `Sprint12`. These are routing addresses for project management, not domain concepts. Burning them into a type, component, hook, or file name pins the code to a delivery cycle that:

1. **Is abstract on read.** `Step4ResourceRow` doesn't tell the reader what the row is — only that some spec called this region "Step 4." Step 4 of *what*?
2. **Rots the moment numbering shifts.** Renumber a flow ("Step 4 split into 4a/4b"), reorder waves, retire a sprint label — and every identifier carrying the old coordinate becomes a lie.
3. **Couples permanent code to ephemeral planning.** The spec is delivered and archived; the code stays. The name should describe the entity in domain terms that survive the spec.

The fix is always the same: replace the coordinate with what the entity *is*.

```ts
// ❌ Bad — spec coordinates baked into type / component names
export interface Step4ResourceRow { … }
export const Step4DbListTable = (...) => …;
export const Wave3MigrationHook = () => …;
export const Phase2ApprovalDialog = (...) => …;

// ✅ Good — names describe the domain entity
export interface InstallResourceRow { … }
export const InstallResourceTable = (...) => …;
export const useTargetSourceMigration = () => …;
export const ConnectionApprovalDialog = (...) => …;
```

```tsx
// ❌ Bad — spec key in component name
import { S4GW1bModal } from '@/app/components/features/process-status/install-task-pipeline/S4GW1bModal';

// ✅ Good
import { InstallTaskDetailModal } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal';
```

**Forbidden tokens in identifiers** (types, interfaces, components, hooks, functions, exported constants, file names) — coordinates that point at delivery work, not domain entities:

- `Step` followed by a number (and optional sub-letter) — `Step4`, `Step4a`, `Step12Modal`
- `Wave` followed by a number — `Wave3`, `Wave12Hook`
- `Phase` followed by a number — `Phase2`, `Phase2Dialog`
- `Sprint` followed by a number — `Sprint12`, `Sprint12Banner`
- Spec / issue / wave keys — `S4G-W1b`, `W1a`, `B6`, `T17`, `WAVE-12`, `PROJ-247` (any short alphanumeric code that resolves to a spec doc or issue tracker entry rather than a domain concept)

**Counter-examples — when "step / phase" IS legitimately part of the name**:

The token is fine when it describes the *domain* concept the entity represents — not the spec coordinate.

```ts
// ✅ OK — domain enum value, not a spec coordinate
type ProcessStatus = 'PENDING' | 'APPROVED' | 'INSTALLING' | 'COMPLETED';
const InstallingStep = (...) => …;          // "Installing" is the domain step name
const ApprovedStepBanner = (...) => …;      // "Approved" is the domain status

// ✅ OK — `step` describes a generic position in a pipeline (not a spec coordinate)
interface PipelineStep { key: string; label: string; status: StepStatus }
const advanceToNextStep = () => …;
```

Rule of thumb: if the token would still make sense after the spec is archived, it's a domain concept (keep it). If it only makes sense to someone holding the spec doc, it's a coordinate (rename).

**Where coordinates DO belong**:

- Commit messages (`feat: ... (S4G-W1b)`)
- PR titles and descriptions
- Spec file names under `docs/reports/` (e.g., `S4G-W1b-db-table-and-modal.md`)
- Branch names (`feat/sit-step4-gcp-w1b-db-table-and-modal`)
- Test scope descriptions (`describe('Step 4 INSTALLING transition', ...)`) — the test scope IS the step

These all live in the delivery process and are expected to age out with it. Code identifiers do not.

Related: **G4** (vague function names) and **G9** (history comments). G4 is about names that say nothing; G9 is about comments narrating delivery history; G10 is about names that encode delivery coordinates instead of domain meaning. All three share the same root: don't bake the *process of building this code* into the *artifact itself*.
