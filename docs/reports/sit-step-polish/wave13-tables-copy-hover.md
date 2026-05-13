# Wave 13 — Tables copy-on-hover (3 cross-cutting tables)

## Context

The audit (`docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`)
flags resource-ID copy-on-hover as **P1 / G2**: the prototype attaches a
hover-revealed `.copy-btn` to every mono identifier cell across approval,
approved, and confirmed tables, but the current implementation only ships
the pattern on `PageMeta`. This wave wires the Wave 9 `CopyButton` into
three cross-cutting tables so the row-hover affordance matches the
prototype on every step that mounts these tables.

| Table | Mounted on | Mono columns to wire |
|---|---|---|
| `WaitingApprovalTable.tsx` | Step 2 (WAITING_APPROVAL) | Resource ID, Region, Resource Name |
| `ApprovedIntegrationTable.tsx` | Step 3 (APPLYING_APPROVED) | Resource ID |
| `ConfirmedIntegrationTable.tsx` | Steps 5/6/7 (both variants) | Resource ID |

`InstallResourceTable.tsx` is **NOT** in scope — Wave 10 owns it.
`PageMeta.tsx` already carries the pattern (Wave 1) and is read-only here.

Per audit §4 D5, the row-hover contract is:

```tsx
<tr className={cn(tableStyles.row, 'group')}>
  <td>
    <span className="inline-flex items-center gap-1">
      <span>{resource.resourceId}</span>
      <CopyButton
        value={resource.resourceId}
        label={`${resource.resourceId} 복사`}
        className="opacity-0 group-hover:opacity-100"
      />
    </span>
  </td>
</tr>
```

The `'group'` class on the `<tr>` is what wires the parent-hover signal
that `CopyButton`'s `opacity-0 group-hover:opacity-100` consumes. Without
it the button is permanently invisible.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
test -f app/components/ui/CopyButton.tsx && echo "✓ Wave 9 merged"
```

Wave 9 **must** be merged to `origin/main` before Wave 13 starts.
`CopyButton` is imported from `@/app/components/ui/CopyButton`; without
Wave 9 the import resolves nowhere.

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step-polish-wave13-tables-copy-hover --prefix feat
cd /Users/study/pii-agent-demo-sit-step-polish-wave13-tables-copy-hover
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — search `.copy-btn`. The
   pattern is identical across approval / approved / confirmed rows: a
   14×14 SVG button, `opacity: 0 → 1` on `tr:hover`, turns green on
   `.copied`.

2. `docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`
   §4 D5 + punch list G2 — the audit prescription.

3. `docs/reports/sit-step-polish/wave9-foundation.md` — confirms the
   `CopyButton` API (`value` / `label?` / `className?`). The hover-reveal
   is driven entirely by the consumer-supplied `className`; `CopyButton`
   itself does not default to hidden.

4. `app/components/ui/PageMeta.tsx` — read `PageMetaRow` for the
   group-hover-opacity reference pattern. Wave 13 mirrors it on `<tr>`
   rather than `<dd>`.

5. Target files (read each for current mono cells, className
   composition, and test coverage):
   - `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable.tsx`

6. Existing test files to extend (do not replace):
   - `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable.test.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable.test.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable.test.tsx`

## Step 3: Implementation

### 3-1. `WaitingApprovalTable.tsx` — three mono columns

Current state (lines 70–110): the table renders `Resource ID`, `Region`,
and `Resource Name` as `font-mono` cells with the `textColors.secondary`
treatment. The `#`, `DB Type`, `연동 대상 여부`, `스캔 이력`, and
`제외 사유` columns are NOT mono identifiers — they stay untouched.

Change shape — add the import, add `'group'` to the `<tr>`, rewrite the
three mono cells. Other columns (`#`, `DB Type`, `연동 대상 여부`,
`스캔 이력`, `제외 사유`) stay untouched. Resource ID always has a
value; Region and Resource Name need a ternary that falls back to
`PLACEHOLDER` when empty (no copy button on a `—` cell).

```tsx
import { CopyButton } from '@/app/components/ui/CopyButton';

const MONO_CELL = cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary);

<tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
  {/* ... # / DB Type cells unchanged ... */}

  {/* Resource ID — mono, always populated */}
  <td className={MONO_CELL}>
    <span className="inline-flex items-center gap-1">
      <span>{resource.resourceId}</span>
      <CopyButton
        value={resource.resourceId}
        label={`${resource.resourceId} 복사`}
        className="opacity-0 group-hover:opacity-100"
      />
    </span>
  </td>

  {/* Region — copy only when non-empty */}
  <td className={MONO_CELL}>
    {resource.region ? (
      <span className="inline-flex items-center gap-1">
        <span>{resource.region}</span>
        <CopyButton
          value={resource.region}
          label={`${resource.region} 복사`}
          className="opacity-0 group-hover:opacity-100"
        />
      </span>
    ) : PLACEHOLDER}
  </td>

  {/* Resource Name — same shape as Region (swap field) */}
  <td className={MONO_CELL}>
    {resource.resourceName ? (
      <span className="inline-flex items-center gap-1">
        <span>{resource.resourceName}</span>
        <CopyButton
          value={resource.resourceName}
          label={`${resource.resourceName} 복사`}
          className="opacity-0 group-hover:opacity-100"
        />
      </span>
    ) : PLACEHOLDER}
  </td>

  {/* ... 연동 대상 여부 / 스캔 이력 / 제외 사유 unchanged ... */}
</tr>
```

`MONO_CELL` is a local `const` inside the component — it deduplicates the
three identical className expressions, not a public helper.

**Why these three columns:** Resource ID, Region, Resource Name are
mono identifiers per the prototype. `#` (index), `연동 대상 여부`
(boolean), `스캔 이력` (status), `제외 사유` (`ReasonChipInline`) are
not copy targets.

### 3-2. `ApprovedIntegrationTable.tsx` — Resource ID only

Current state (lines 43–60): the table renders `리소스 ID` (mono),
`유형`, `DB 타입`, `Credential`, `연동 이력`. Of these, only Resource ID
is a mono identifier. `Credential` shows the credential **name** (which
upstream BFF returns as a human label), not a mono ID — leave untouched.

Change shape — add the import, add `'group'` to the `<tr>`, rewrite the
Resource ID cell. All other columns untouched.

```tsx
import { CopyButton } from '@/app/components/ui/CopyButton';

<tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
  <td className={cn(tableStyles.cell, 'font-mono text-xs', textColors.secondary)}>
    <span className="inline-flex items-center gap-1">
      <span>{resource.resourceId}</span>
      <CopyButton
        value={resource.resourceId}
        label={`${resource.resourceId} 복사`}
        className="opacity-0 group-hover:opacity-100"
      />
    </span>
  </td>
  {/* ... 유형 / DB 타입 / Credential / 연동 이력 unchanged ... */}
</tr>
```

### 3-3. `ConfirmedIntegrationTable.tsx` — Resource ID in BOTH variants

Current state: two variants — `pre-install` (default) and `complete`.
Both surface Resource ID as a mono cell via `monoCellClass`. Credential
is again the credential name (not a mono ID).

Apply the same edit pattern to both branches of the `variant` switch:
add the import, add `'group'` to each `<tr>`, rewrite the
`<td className={monoCellClass}>{resource.resourceId}</td>` cell:

```tsx
import { CopyButton } from '@/app/components/ui/CopyButton';

// applies inside both `variant === 'complete'` and the default (pre-install) branch
<tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
  {/* ... preceding columns vary by variant; unchanged ... */}
  <td className={monoCellClass}>
    <span className="inline-flex items-center gap-1">
      <span>{resource.resourceId}</span>
      <CopyButton
        value={resource.resourceId}
        label={`${resource.resourceId} 복사`}
        className="opacity-0 group-hover:opacity-100"
      />
    </span>
  </td>
  {/* ... following columns unchanged ... */}
</tr>
```

**Why two inline edits, not a shared helper:** the two variants ship
distinct column orderings on purpose (Wave 5). A `<MonoIdCell>` helper
would shave a few lines per call site but adds indirection that two
consumers do not justify. If a future fourth consumer appears, extract
then.

### 3-4. Tests — extend existing `.test.tsx` files

For each of the three tables, add to its existing test file. Do not
replace existing tests; append.

**`WaitingApprovalTable.test.tsx`** — add two cases:

```tsx
it('mounts a hover-revealed CopyButton on each mono identifier per row', () => {
  render(
    <WaitingApprovalTable
      resources={[{
        resourceId: 'res-1', resourceType: 'POSTGRES',
        region: 'us-east-1', resourceName: 'orders-db', selected: true,
      }]}
    />,
  );
  const buttons = screen.getAllByRole('button', { name: /복사$/ });
  expect(buttons).toHaveLength(3); // resourceId + region + resourceName
  expect(screen.getByRole('button', { name: 'res-1 복사' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'us-east-1 복사' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'orders-db 복사' })).toBeInTheDocument();
  buttons.forEach((b) => {
    expect(b.className).toContain('opacity-0');
    expect(b.className).toContain('group-hover:opacity-100');
  });
});

it('omits CopyButton when region or resourceName is empty', () => {
  render(
    <WaitingApprovalTable
      resources={[{
        resourceId: 'res-2', resourceType: 'MYSQL',
        region: '', resourceName: '', selected: true,
      }]}
    />,
  );
  // only Resource ID button mounts; empty cells render the '—' placeholder.
  expect(screen.getAllByRole('button', { name: /복사$/ })).toHaveLength(1);
});
```

**`ApprovedIntegrationTable.test.tsx`** — add one case. Build fixtures
that satisfy the full `ApprovedResource` shape via `satisfies` (no `as`
casts):

```tsx
const approvedFixture = (overrides: Partial<ApprovedResource>): ApprovedResource =>
  ({
    resourceId: 'app-1',
    type: 'DB',
    credentialId: 'cred-1',
    region: 'ap-northeast-2',
    resourceName: 'app-1-name',
    ...overrides,
  }) satisfies ApprovedResource;

it('renders a hover-revealed CopyButton on each Resource ID cell', () => {
  render(
    <ApprovedIntegrationTable
      approved={[
        approvedFixture({ resourceId: 'app-1' }),
        approvedFixture({ resourceId: 'app-2' }),
      ]}
    />,
  );
  const buttons = screen.getAllByRole('button', { name: /복사$/ });
  expect(buttons).toHaveLength(2);
  buttons.forEach((b) => {
    expect(b.className).toContain('opacity-0');
    expect(b.className).toContain('group-hover:opacity-100');
  });
});
```

If `ApprovedResource` carries additional required fields beyond those
above, extend the builder rather than reverting to `as` — `satisfies`
will surface any missing key at typecheck time.

**`ConfirmedIntegrationTable.test.tsx`** — add one case covering both
variants. Same fixture-builder pattern, no `as` casts:

```tsx
const confirmedFixture = (overrides: Partial<ConfirmedResource>): ConfirmedResource =>
  ({
    resourceId: 'conf-x',
    type: 'DB',
    credentialId: 'cred-x',
    region: 'ap-northeast-2',
    resourceName: 'conf-x-name',
    connectionStatus: 'CONNECTED',
    ...overrides,
  }) satisfies ConfirmedResource;

it.each<[ConfirmedIntegrationTableVariant]>([
  ['pre-install'],
  ['complete'],
])('renders a hover-revealed CopyButton in %s variant', (variant) => {
  render(
    <ConfirmedIntegrationTable
      confirmed={[confirmedFixture({ resourceId: 'conf-x' })]}
      variant={variant}
    />,
  );
  const button = screen.getByRole('button', { name: 'conf-x 복사' });
  expect(button.className).toContain('opacity-0');
  expect(button.className).toContain('group-hover:opacity-100');
});
```

Clipboard-write behavior is already covered by Wave 9's
`CopyButton.test.tsx`; the wave-13 tests assert only "mount + hover
className", not "clipboard fires". Don't duplicate.

## Step 4: Do NOT touch

- **ADR-014 R3 four files** (stepper): `ProcessProgressBar.tsx`,
  `InstallationProcessProgressBar.tsx`, `StepProgressBar.tsx`,
  `motion/`.
- **Step components** — `WaitingApprovalStep`, `ApplyingApprovedStep`,
  `CloudInstallingStep`, `WaitingConnectionTestStep`,
  `ConnectionVerifiedStep`, `InstallationCompleteStep`. Waves 10 / 11 / 12
  own them.
- **`InstallResourceTable.tsx`** — Wave 10 owns it.
- **`app/components/ui/CopyButton.tsx`** — Wave 9 ships it; Wave 13 only
  imports.
- **`app/components/ui/PageMeta.tsx`** — read-only reference.
- **`lib/theme.ts`** — no new token, no existing token rename.
- **BFF / swagger / `lib/types`** — no schema change.
- **Wave 9 not merged** — abort the wave; do not vendor `CopyButton`
  locally.
- **No `<MonoIdCell>` / `<CopyableMono>` helper** — three call sites
  don't justify it.

## Step 5: Verify

Define a shell alias for the three table paths to keep the commands readable:

```bash
TABLES_DIR="app/integration/target-sources/[targetSourceId]/_components"
TARGETS=(
  "$TABLES_DIR/layout/WaitingApprovalTable.tsx"
  "$TABLES_DIR/layout/WaitingApprovalTable.test.tsx"
  "$TABLES_DIR/approved/ApprovedIntegrationTable.tsx"
  "$TABLES_DIR/approved/ApprovedIntegrationTable.test.tsx"
  "$TABLES_DIR/confirmed/ConfirmedIntegrationTable.tsx"
  "$TABLES_DIR/confirmed/ConfirmedIntegrationTable.test.tsx"
)

npx tsc --noEmit
npm run lint -- "${TARGETS[@]}"
npm test --run \
  "$TABLES_DIR/layout/WaitingApprovalTable.test.tsx" \
  "$TABLES_DIR/approved/ApprovedIntegrationTable.test.tsx" \
  "$TABLES_DIR/confirmed/ConfirmedIntegrationTable.test.tsx"
```

Browser smoke:
- `WAITING_APPROVAL` row hover: Resource ID, Region, Resource Name reveal
  copy buttons. Click any — icon flips to checkmark for 1.5 s, value on
  the clipboard.
- `APPLYING_APPROVED` row hover: only the Resource ID column reveals a
  copy button.
- `WAITING_CONNECTION_TEST` / `CONNECTION_VERIFIED` / `INSTALLATION_COMPLETE`
  row hover: Resource ID column reveals a copy button; the variant's
  other columns (Status, logical-DB placeholders) are unchanged.
- Empty `region` / `resourceName` fixture: `—` placeholder, no button,
  no console warning.

Stepper guard:
```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  app/components/features/process-status/InstallationProcessProgressBar.tsx \
  app/components/features/process-status/StepProgressBar.tsx \
  app/components/features/process-status/motion/ \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

Out-of-scope file guard:
```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/install-task-pipeline/InstallResourceTable.tsx \
  app/components/ui/CopyButton.tsx \
  app/components/ui/PageMeta.tsx \
  lib/theme.ts \
  | (read -r line && echo "✗ out-of-scope file modified: $line" || echo "✓ out-of-scope files untouched")
```

## Step 6: Commit + push + PR

```bash
git add "${TARGETS[@]}"

git commit -m "$(cat <<'EOF'
feat(step-polish): copy-on-hover for resource-id mono cells across 3 tables (wave13)

Audit G2 follow-up. Wires the Wave 9 CopyButton into the approval,
approved, and confirmed tables so every mono identifier cell carries
the prototype's hover-revealed copy affordance.

- WaitingApprovalTable: Resource ID + Region + Resource Name; empty
  region / resourceName keep the '—' placeholder with no button.
- ApprovedIntegrationTable: Resource ID only (Credential is a name).
- ConfirmedIntegrationTable: Resource ID in both 'pre-install' and
  'complete' variants.

Row wiring is `<tr className={cn(tableStyles.row, 'group')}>` plus
`<CopyButton className="opacity-0 group-hover:opacity-100" />` on each
mono cell, mirroring PageMetaRow.

InstallResourceTable is out of scope (Wave 10). No helper extracted —
three call sites don't justify a MonoIdCell abstraction yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git push -u origin feat/sit-step-polish-wave13-tables-copy-hover
```

PR body:
```
## Summary

Wave 13 of the step-polish set. Closes audit finding P1/G2 (missing
copy-on-hover affordance for resource-id mono cells) by wiring the
Wave 9 CopyButton into the three cross-cutting tables on the
target-source detail page.

## Changes

- `WaitingApprovalTable.tsx` — Resource ID, Region, Resource Name each
  get a hover-revealed CopyButton. Empty values keep the `—` placeholder
  with no button.
- `ApprovedIntegrationTable.tsx` — Resource ID column.
- `ConfirmedIntegrationTable.tsx` — Resource ID column, in both
  `pre-install` and `complete` variants.
- Every `<tr>` gains `group` so the button's `group-hover:opacity-100`
  activates. Pattern mirrors `PageMetaRow`.
- Test files extended (no replacement).

## Deliberately excluded

- `InstallResourceTable.tsx` — Wave 10 owns it.
- Credential cells — credential names, not mono IDs.
- No `<MonoIdCell>` helper extracted.
- No change to `CopyButton`, `PageMeta`, `lib/theme.ts`, or step
  components.
- ProcessStatus stepper (ADR-014 R3 freeze).

## Test plan
- [x] Each table renders the expected copy-button count per row
- [x] Each button has `opacity-0 group-hover:opacity-100` className
- [x] Empty region / resourceName cells show `—` with no button
- [x] Both ConfirmedIntegrationTable variants mount the copy button
- [x] Stepper four-file guard passes
- [x] InstallResourceTable / CopyButton / PageMeta / theme.ts not in diff
```

## Step 7: Self-review checklist

- [ ] Every `<tr>` carrying a CopyButton has `'group'` in its className.
- [ ] Every CopyButton consumer passes
      `opacity-0 group-hover:opacity-100` via `className`.
- [ ] CopyButton imports use the `@/` absolute path.
- [ ] No copy button on a placeholder (`—`) cell — see the `region` /
      `resourceName` ternaries in `WaitingApprovalTable`.
- [ ] Credential cells did **not** receive a copy button (they render
      credential names, not mono IDs).
- [ ] No new helper component or hook.
- [ ] `lib/theme.ts`, `CopyButton.tsx`, `PageMeta.tsx`, and step
      components are not in the diff.
- [ ] `aria-label` reads `"<value> 복사"` (matches PageMeta convention).
- [ ] No `any`, no relative imports, no raw hex.
- [ ] Stepper four-file guard passes.
- [ ] `tsc --noEmit` 0 errors; lint 0 new warnings; existing tests still pass.

## Acceptance for this wave

Wave 13 is correct when:
- Hovering any row in `WaitingApprovalTable` reveals copy buttons on
  Resource ID, Region, and Resource Name (non-empty values only);
  clicking each copies the value and flips the icon to a checkmark for
  1.5 s.
- Hovering any row in `ApprovedIntegrationTable` reveals the Resource
  ID copy button.
- Hovering any row in `ConfirmedIntegrationTable` (either variant)
  reveals the Resource ID copy button.
- `InstallResourceTable.tsx`, `CopyButton.tsx`, `PageMeta.tsx`,
  `lib/theme.ts`, and the stepper four-file guard are all untouched.
- Audit punch-list G2 is closed for the three in-scope tables; G2 for
  `InstallResourceTable` remains under Wave 10.
