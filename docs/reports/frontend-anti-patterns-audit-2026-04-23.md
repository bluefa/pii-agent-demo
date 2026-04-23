# Frontend Anti-Patterns Audit — 2026-04-23

A codebase-wide audit of frontend code. Pairs with `.claude/skills/anti-patterns/SKILL.md` — the skill holds timeless rules, this report holds the point-in-time evidence that drives the refactor backlog.

Each finding is an actionable unit: one PR (or a small group of related PRs) per item.

## Scope

- `app/` (excluding `app/api/`, tests)
- `lib/` frontend files (excluding `lib/bff/upstream`, `lib/swagger/`, `lib/mock-*.ts`, tests)

## Severity legend

- 🔴 critical — blocks merge on new code, prioritize fixing existing
- 🟡 important — fix during normal refactor cycles
- 🟢 nice-to-have — opportunistic fixes

---

## A. Type Safety

### A1 — Non-null assertion (`!`) · 🔴 · 15 sites

- `lib/api-client/mock/sdu.ts:92,95,108,124,140,156,179` — repeated `auth.user!.role`, `proj.project!.serviceCode`
- `lib/api-client/mock/projects.ts:739-741` — `r.exclusion!.reason`, `.excludedAt`, `.excludedBy`
- `lib/api-client/mock/azure.ts:83,93` — `auth.project!.serviceCode`, `result.data!.scanApp`
- `app/components/features/resource-table/ResourceTypeGroup.tsx:35` — `grouped.get(region)!.push(resource)` (crashes if key missing)
- `app/components/features/resource-table/AwsResourceTableBody.tsx:15` — same pattern on `groups.get(type)!`
- `app/components/features/resource-table/ResourceRow.tsx:83` — `resource.vmDatabaseConfig!.databaseType`
- `app/components/features/process-status/ProcessGuideStepCard.tsx:170,192` — `step.prerequisiteGuides!`, `step.prerequisites!`

### A2 — `as` type assertion · 🟡 · 3 sites

- `lib/fetch-json.ts:155` — `return undefined as T`
- `lib/api-client/bff-client.ts:101` — `await res.json() as ConfirmedIntegrationResponsePayload`
- `lib/api-client/bff-client.ts:115` — `await res.json() as ResourceCatalogResponsePayload`

### A3 — Destructuring API responses without a guard · 🟡 · 3 sites

- `lib/api-client/idc.ts:8-12,18-21`
- `app/lib/api/gcp.ts:6-9`

---

## B. Component Structure

### B1 — God component (300+ LOC) · 🔴

| File | LOC | Issues |
|------|-----|--------|
| `app/components/features/process-status/ConnectionTestPanel.tsx` | 667 | 15 useStates + 4 inline modals |
| `app/components/features/dashboard/SystemsTable.tsx` | 491 | Inline `INTEGRATION_COLORS`, long row renderer |
| `app/components/features/idc/IdcResourceInputPanel.tsx` | 441 | 10 useStates, complex form validation |
| `app/components/features/process-status/aws/AwsInstallationInline.tsx` | 419 | Polling + state split + progress calc |
| `app/components/features/ProcessStatusCard.tsx` | 351 | Tab + modal + polling + conditional rendering |

### B2 — 10+ props · 🟡

- `app/components/features/ResourceTable.tsx:22-37` — 19 props
- `app/components/features/resource-table/ResourceRow.tsx:57-69` — 11 props

### B3 — Per-provider component duplication · 🟡

- `AwsInstallationInline.tsx:95-150` ≈ `GcpInstallationInline.tsx:26-56` ≈ `AzureInstallationInline.tsx:44-150`
- `AwsInfoCard` vs `GcpInfoCard` vs `AzureInfoCard` (each redeclares `CREDENTIAL_PREVIEW_COUNT = 3`)

### B6 — Function doing too much · 🟡

- `app/components/features/idc/IdcResourceInputPanel.tsx:131-157` — `handleSave` calls `validate()` inside
- `app/components/features/process-status/ConnectionTestPanel.tsx:64-79` — loops credential updates inside `handleSave`

---

## C. State Management

### C1 — Scattered form state · 🔴

- `app/components/features/idc/IdcResourceInputPanel.tsx:33-41` — 10 useStates
- `app/components/features/queue-board/QueueBoard.tsx:29-41` — 13 useStates
- `app/components/features/AdminDashboard.tsx:36-54` — 12 useStates
- `app/components/features/process-status/ConnectionTestPanel.tsx:522-529` — 5 useStates for one modal

### C2 — Server state in `useState` · 🔴

- `app/components/features/AdminDashboard.tsx:30-54`
- `app/projects/[projectId]/gcp/GcpProjectPage.tsx:88-105`
- `app/projects/[projectId]/sdu/SduProjectPage.tsx:49-63`
- `app/components/features/process-status/ConnectionTestPanel.tsx:49-60` — refetch on every mount

### C3 — Scattered modal state · 🟡

- `QueueBoard` — `rejectModalOpen` / `detailModalOpen` / `approveModalOpen` as three booleans
- `ConnectionTestPanel` — `credModalOpen` + `reviewMode` + three data slices

### C4 — Separate loading/error booleans · 🟡

- `app/components/features/AdminDashboard.tsx:33,35,48` — `loading` / `actionLoading` / `approvalLoading`
- `app/components/features/queue-board/QueueBoard.tsx:34-39`

### C5 — Derived state stored as state · 🟢

- `app/components/features/AwsInfoCard.tsx:124` — `showAllCredentials` initialized but not synced to prop changes

---

## D. Effects & Hooks

### D1 — Object/array directly in effect deps · 🟡

- `app/components/features/process-status/ConnectionTestPanel.tsx:49-60` — `missingResources` is a new array each render from the parent

### D2 — `mountedRef` overuse · 🟡

- `app/hooks/useScanPolling.ts:71-229` — four refs (`mountedRef`, `pollingRef`, `prevScanStatusRef`, `onScanCompleteRef`)
- `app/hooks/useTestConnectionPolling.ts:32-140` — same pattern

### D4 — Duplicated polling logic · 🟡

- `app/hooks/useScanPolling.ts:245` LOC + `app/hooks/useTestConnectionPolling.ts:163` LOC — near-identical structure. Also note `useScanPolling.ts:179-199` duplicates `121-132` within the same hook (init vs. `startPolling`)

### D6 — Huge `useCallback` dep arrays · 🟡

- `app/components/features/idc/IdcResourceInputPanel.tsx:157` — `handleSave` deps: `[name, inputFormat, ips, host, port, databaseType, serviceId, credentialId, validate, onSave]` (10)

---

## E. Rendering

### E1 — Array index as key · 🟡

- `app/components/features/ConnectionDetailModal.tsx:102`
- `app/components/features/idc/IdcPendingResourceList.tsx:39`
- `app/components/features/idc/IdcResourceInputPanel.tsx:242`

### E2 — Inline style objects · 🟡 · 10 sites

- `app/components/features/process-status/ConnectionTestPanel.tsx:405`
- `app/components/features/process-status/azure/AzureInstallationInline.tsx:242`
- `app/components/features/process-status/aws/AwsInstallationInline.tsx:196,330`
- `app/components/features/scan/ScanRunningState.tsx:45`
- `app/components/features/dashboard/DashboardHeader.tsx:38,45,57,61,71,80`
- `app/components/features/dashboard/SystemsTable.tsx:58,71,83,87`

### E3 — Nested ternaries (3+ levels) · 🟡

- `app/components/features/process-status/ConnectionTestPanel.tsx:355-362` — four consecutive ternary chains
- `app/components/features/process-status/ProcessGuideStepCard.tsx:113-114`
- `app/components/features/admin/ApprovalDetailModal.tsx:134-139`

### E4 — Long `&&` / conditional chains · 🟡

- `app/components/features/process-status/ProcessGuideStepCard.tsx:155-230` — four sections inside one expanded block

### E5 — Raw color classes (theme.ts rule violation) · 🟡

- `app/components/features/TerraformStatusModal.tsx:14-93` — `bg-green-100`, `text-green-700`, etc.
- `app/components/features/dashboard/SystemsTable.tsx:43-50` — `INTEGRATION_COLORS` hex literals for six providers

---

## F. Error Handling

### F1 — Native `alert()` · 🔴 · 12 sites

- `app/hooks/useApiMutation.ts:83`
- `app/hooks/useAsync.ts:40`
- `app/components/features/AdminDashboard.tsx:109,114,126,140,153`
- `app/components/features/CredentialListTab.tsx:25`
- `app/components/features/process-status/ConnectionTestPanel.tsx:75`
- `app/projects/[projectId]/aws/AwsProjectPage.tsx:116`
- `app/projects/[projectId]/idc/IdcProjectPage.tsx:79,120`

### F2 — Silent catch · 🟡

- `app/components/features/process-status/ConnectionTestPanel.tsx:59-62` — `catch { setData(null); }`
- `app/projects/[projectId]/sdu/SduProjectPage.tsx:94` — `catch { /* ignored */ }`

### F3 — Returning null on error · 🟡

- `app/hooks/useScanPolling.ts:85-114` — `fetchStatus()` returns null on error
- `app/hooks/useTestConnectionPolling.ts:45-62` — same

---

## G. Naming & Constants

### G1 — Magic numbers (timeouts / intervals) · 🟡 · 8 sites

- `app/components/layout/TopNav.tsx:89` — `2000` (toast hide)
- `app/components/features/AzureInfoCard.tsx:65` — `1500` (copy feedback)
- `app/components/features/ProcessStatusCard.tsx:151` — `10_000` (process status polling)
- `app/components/features/sdu/IamUserManageModal.tsx:22` — `1500`
- `app/components/features/process-status/ConnectionTestPanel.tsx:515` — `500`
- `app/components/features/process-status/ProcessGuideModal.tsx:22`
- `app/components/features/queue-board/QueueBoardHeader.tsx:36`

### G2 — Duplicate constants · 🟡

- `CREDENTIAL_PREVIEW_COUNT = 3` — `AwsInfoCard.tsx:17`, `GcpInfoCard.tsx:20`, `AzureInfoCard.tsx:20`
- `COLLAPSE_THRESHOLD = 5` — `resource-table/ResourceTypeGroup.tsx:11`, `GroupedResourceTableBody.tsx:12`, `InstancePanel.tsx:8`

### G3 — String-literal status comparisons · 🟡 · 8 sites

- `app/components/features/GcpInfoCard.tsx:78-79,152` — `info.status === 'VALID' | 'INVALID'`
- `app/components/features/process-status/ConnectionTestPanel.tsx:210-211` — `.filter(r => r.status === 'FAIL' | 'SUCCESS')`
- `app/components/features/AzureInfoCard.tsx:101,109`
- `app/components/features/AwsInfoCard.tsx:127`
- `app/components/features/queue-board/CompletedTasksTable.tsx:58-59`

### G4 — Vague function names · 🟢

- `app/components/features/process-status/ConnectionTestPanel.tsx:265` — `const fetch = async () => {}`
- `app/components/features/ProcessStatusCard.tsx:136` — `const poll = async () => {}`

### G5 — Boolean without `is/has` prefix · 🟢

- `lib/types.ts:303` — `connectionTestComplete`
- `lib/types.ts:354` — `success`
- `lib/types.ts:389` — `confirmed`
- `lib/types/idc.ts:14,51,58,66` — `firewallOpened`, `firewallPrepared`, etc.

### G6 — Hardcoded error messages · 🟢

- `app/components/features/process-status/gcp/GcpInstallationInline.tsx:34,48`
- `lib/api-client/idc.ts:10,19,30,41,50,66,83,99` — repeated "IDC 설치 상태 조회에 실패했습니다."

---

## H. UI Composition (Icons & Assets)

### H1 — Inline SVG scattered across feature components · 🔴 · 195 tags across 83 files

Raw `<svg><path d="..." /></svg>` pasted into feature components. Sampling:

- `app/components/features/process-status/GuideCard.tsx:35-44` — `lightbulbIcon` const
- `app/components/features/process-status/ConnectionTestPanel.tsx:92,96,225,229,293,365` — six inline SVGs in one file (warning/info/error/success/expand)
- `app/components/features/process-status/StepProgressBar.tsx` — multiple
- `app/components/features/process-status/MissingCredentialsTab.tsx`
- `app/components/features/process-status/azure/AzureInstallationInline.tsx`
- `app/components/features/TerraformStatusModal.tsx`
- `app/components/features/ConnectionDetailModal.tsx`
- `app/components/features/ResourceTable.tsx`
- `app/components/features/StepIndicator.tsx`
- `app/components/features/idc/IdcResourceTable.tsx`
- `app/components/features/sdu/SduInstallationProgress.tsx`
- `app/components/ui/CollapsibleSection.tsx`, `Table.tsx`, `Tooltip.tsx`, `LoadingSpinner.tsx`, `Modal.tsx`, `PageHeader.tsx`
- `app/components/layout/TopNav.tsx`
- `app/projects/[projectId]/**` (multiple pages)
- `app/integration/admin/dashboard/page.tsx`

Full set: `grep -rl '<svg' app/ | wc -l` → 83.

### H2 — Visual-based icon names · 🟡

Names describe shape, not intent:

- `app/components/features/process-status/GuideCard.tsx:35` — `lightbulbIcon` (intent = a tip/guide cue)
- `app/components/ui/CloudProviderIcon.tsx:25,32,39` — `AwsIcon`, `AzureIcon`, `GcpIcon` (brand icons are OK — these stay visual by design; noted for completeness)
- Inline SVGs in `ConnectionTestPanel.tsx:92,96,225,229` follow a warning/info/error/success status pattern but are never extracted or named — the shape is repeated six times with slight className changes.

### H3 — No shared icon barrel · 🟡

Existing ad-hoc icon files live in `app/components/ui/` as peers of Button/Badge/Modal:

- `CloudProviderIcon.tsx`, `ServiceIcon.tsx`, `AwsServiceIcon.tsx`, `AzureServiceIcon.tsx`, `GcpServiceIcon.tsx`, `DatabaseIcon.tsx`

There is no `app/components/ui/icons/index.ts` barrel and no shared `IconProps` contract. Each of the existing files invents its own prop shape.

**Proposed target structure**:

```
app/components/ui/icons/
├── index.ts                 # barrel with named re-exports, sorted
├── types.ts                 # IconProps { className?, 'aria-label'? }
├── GuideIcon.tsx            # was: lightbulbIcon (intent-named)
├── StatusWarningIcon.tsx    # extract from ConnectionTestPanel:92
├── StatusInfoIcon.tsx       # extract from ConnectionTestPanel:96
├── StatusErrorIcon.tsx      # extract from ConnectionTestPanel:225
├── StatusSuccessIcon.tsx    # extract from ConnectionTestPanel:229
├── ExpandIcon.tsx           # rotate-180 chevron pattern (CollapsibleSection, etc.)
├── CloseIcon.tsx
├── brand/                   # brand icons — visual naming is correct here
│   ├── AwsIcon.tsx
│   ├── AzureIcon.tsx
│   └── GcpIcon.tsx
└── ...
```

Migration expected to touch all 83 files but the per-site change is mechanical (replace `<svg>...</svg>` → `<GuideIcon className="..." />`).

---

## Misc

### Relative-path imports (project rule violation) · 🟡

- `app/integration/api/v1/gcp/target-sources/[targetSourceId]/check-installation/route.ts:6`
- `app/integration/api/v1/gcp/target-sources/[targetSourceId]/installation-status/route.ts:6`

---

## Suggested refactor waves

A possible sequencing:

**Wave 1 — Automated & shallow (one PR)**
- Add ESLint rules (A1, A4, A5, F1, E1, relative imports)
- The rule additions flag all existing violations; fix the smallest-scope files to get green

**Wave 2 — Dedup & constants (one PR)**
- Create `lib/constants/{timings,ui,messages,statuses}.ts`
- Replace G1, G2, G3, G6 in one sweep

**Wave 3 — Form refactor (one PR per component)**
- C1 `IdcResourceInputPanel` → `useReducer`
- C1 `QueueBoard`, `AdminDashboard`, `ConnectionTestPanel` (modal state → discriminated union, C3)

**Wave 4 — Polling consolidation (one PR)**
- D4 — extract `usePollingBase`, migrate `useScanPolling` and `useTestConnectionPolling`

**Wave 5 — God-component splits (one PR per component)**
- B1 — split `ConnectionTestPanel`, `SystemsTable`, `AwsInstallationInline`
- B3 — unify AWS/GCP/Azure inline components

**Wave 6 — API boundary cleanup (see `docs/api/boundaries.md`)**
- Parallel `lib/api-client/*` and `lib/bff/*` structures; clarify or collapse

**Wave 7 — Type-safety tightening**
- A1 — replace `!` with guards (mock files first, then components)
- A2/A3 — introduce zod validators at the route-handler boundary

**Wave 8 — Icon module extraction (H1/H2/H3)**
- Create `app/components/ui/icons/` with a unified `IconProps` contract and a barrel
- First pass: extract the repeated status glyphs (warning/info/error/success) currently re-pasted across `ConnectionTestPanel`, `StepProgressBar`, etc.
- Second pass: replace 83-file `<svg>` sites with named imports. The edit is mechanical but wide — can be split per directory (`process-status/`, `resource-table/`, etc.)

Total backlog: 43 anti-patterns, ~345 occurrences (150 from the original audit + 195 inline SVG sites).
