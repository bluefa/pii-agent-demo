---
name: anti-patterns
description: Frontend Clean Code anti-pattern catalog. Auto-applied during code writing and review.
---

# PII Agent Frontend Anti-Pattern Catalog

40 anti-patterns identified through a full codebase audit. Consumed alongside `/coding-standards`.

## When to invoke

- Automatic: before writing, modifying, or reviewing code
- Manual: when prioritizing refactor work

## Category summary

| # | Category | Count |
|---|----------|-------|
| A | Type Safety | 5 |
| B | Component Structure | 6 |
| C | State Management | 8 |
| D | Effects & Hooks | 6 |
| E | Rendering | 5 |
| F | Error Handling | 4 |
| G | Naming & Constants | 6 |

Concrete evidence (file:line) from the current codebase → `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`

Severity: 🔴 critical (block merge) · 🟡 important · 🟢 nice-to-have

---

## A. Type Safety

### A1. Non-null assertion (`!`) 🔴

`!` asserts "the type system is wrong". If it's wrong at runtime → crash.

```tsx
// ❌ Bad
const item = groups.get(type)!.push(resource);  // undefined.push() when key missing
const role = auth.user!.role;
const reason = r.exclusion!.reason;

// ✅ Good
const item = groups.get(type);
if (!item) return;
item.push(resource);

if (!auth.user) throw new Error('unauthenticated');
const role = auth.user.role;
```

**ESLint**: `@typescript-eslint/no-non-null-assertion: error`

### A2. Type assertion (`as`, especially `as unknown as X`) 🔴

Lies to the type checker. External inputs (API responses, `JSON.parse`) need runtime validation.

```tsx
// ❌ Bad
return undefined as T;
const data = await res.json() as ApiResponse;

// ✅ Good
return undefined;  // change return type to `T | undefined`
const raw = await res.json();
const data = ApiResponseSchema.parse(raw);  // zod / valibot
```

### A3. Destructuring API responses without a type guard 🟡

Silent failure when the backend schema changes.

```tsx
// ❌ Bad
const res = await fetch(url);
const { id, name } = await res.json();  // undefined if fields missing

// ✅ Good — dedicated validation helper
const normalize = (v: unknown): User => {
  if (!isRecord(v) || typeof v.id !== 'string') throw new Error('bad payload');
  return { id: v.id, name: v.name ?? '' };
};
```

### A4. `@ts-ignore` / `@ts-expect-error` 🟡

If truly unavoidable, use `@ts-expect-error` with a one-line reason and an issue link.

### A5. `any` (project rule) 🔴

Use `unknown` + a type guard, or a concrete type.

---

## B. Component Structure

### B1. God component (300+ LOC) 🔴

A single file mixing the main component + inner subcomponents + business logic.

- When the file exceeds 300 LOC, split into a folder (`ComponentName/index.ts` + `sub/*`)
- Inner modal components go to `./modals/*.tsx`
- Even under 300 LOC, split when concerns are tangled

### B2. 10+ props 🟡

Ten-plus props means runaway coupling — the child ends up knowing the parent's internal state.

```tsx
// ❌ Bad
<ResourceTable
  externalSelectedIds={...} onSelectionChange={...}
  credentials={...} onCredentialChange={...}
  expandedVmId={...} onVmConfigToggle={...} onVmConfigSave={...}
  onEditModeChange={...} onRequestApproval={...}
  /* +10 more */
/>

// ✅ Good — split via Context
<TableSelectionProvider>
  <TableEditModeProvider>
    <ResourceTable />
  </TableEditModeProvider>
</TableSelectionProvider>
```

### B3. Per-provider component duplication (Shotgun Surgery) 🟡

Don't ship 3-4 nearly identical components for AWS/GCP/Azure/IDC.

```
❌ AwsInstallationInline.tsx (419 LOC)
❌ GcpInstallationInline.tsx (similar)
❌ AzureInstallationInline.tsx (similar)

✅ <InstallationInline provider={...} config={...} />
   + providers/{aws,gcp,azure}/config.ts  (only the deltas)
```

### B4. Boolean prop flag explosion 🟢

```tsx
// ❌ Bad
<Button primary small disabled rounded />

// ✅ Good
<Button variant="primary" size="sm" disabled />
```

### B5. Functions with 4+ parameters 🟢

Bundle them into an object. Component props already do this — apply the same rule to plain functions.

### B6. A function doing get + validate + save 🟡

Split each concern into pure functions. `handleSave` calling `validate()` then `onSave()` is fine only once `validate` is extracted and independently testable.

---

## C. State Management

### C1. Scattered form state (10+ `useState`) 🔴

A single form's fields/errors/mode managed as separate useStates → use `useReducer` or React Hook Form.

```tsx
// ❌ Bad
const [name, setName] = useState('');
const [host, setHost] = useState('');
const [port, setPort] = useState(0);
const [ips, setIps] = useState([]);
const [errors, setErrors] = useState({});
const [mode, setMode] = useState('create');
// +4 more...

// ✅ Good
const [state, dispatch] = useReducer(formReducer, initialState);
```

### C2. Server state in `useState` 🔴

API responses stored only in local useState → refetch on every mount, no caching.

→ Adopt React Query / SWR / Zustand (incrementally).

### C3. Scattered modal state 🟡

```tsx
// ❌ Bad
const [rejectModalOpen, setRejectModalOpen] = useState(false);
const [detailModalOpen, setDetailModalOpen] = useState(false);
const [approveModalOpen, setApproveModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);
const [approveTarget, setApproveTarget] = useState(null);

// ✅ Good — discriminated union
type ModalState =
  | { type: 'none' }
  | { type: 'reject'; item: Item }
  | { type: 'detail'; item: Item }
  | { type: 'approve'; target: Target };
const [modal, setModal] = useState<ModalState>({ type: 'none' });
```

### C4. Separate booleans for loading & error 🟡

`loading && error` becomes a representable impossible state → use a state machine.

```tsx
// ❌ Bad
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

// ✅ Good
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### C5. Derived state stored as state 🟡

Values computable from props/state shouldn't live in useState — sync bugs follow.

```tsx
// ❌ Bad
const [fullName, setFullName] = useState(`${user.firstName} ${user.lastName}`);

// ✅ Good
const fullName = `${user.firstName} ${user.lastName}`;  // compute on render
// or useMemo(…, [user.firstName, user.lastName])
```

### C6. 3+ consecutive `setState` calls in one handler 🟢

Three or more setState calls in one event → bundle into an object or use `useReducer`.

### C7. Missing functional updates when prior state matters 🟢

```tsx
// ❌ Bad
setCount(count + 1);  // stale closure risk

// ✅ Good
setCount((prev) => prev + 1);
```

### C8. Missing lazy initializer in `useState` 🟢

Expensive initial values need a lazy initializer.

```tsx
// ❌ Bad — JSON.parse on every render
const [state, setState] = useState(JSON.parse(localStorage.getItem('x') ?? '{}'));

// ✅ Good
const [state, setState] = useState(() => JSON.parse(localStorage.getItem('x') ?? '{}'));
```

---

## D. Effects & Hooks

### D1. Objects/arrays as direct `useEffect` dependencies 🟡

A parent sending a fresh reference each render → effect loops forever.

```tsx
// ❌ Bad
useEffect(() => { …; }, [isOpen, missingResources]);  // new array every render

// ✅ Good
const ids = useMemo(() => missingResources.map((r) => r.id).join(','), [missingResources]);
useEffect(() => { …; }, [isOpen, ids]);
```

### D2. `mountedRef.current` overuse 🟡

Replacing cleanup with a ref.

```tsx
// ❌ Bad
const mountedRef = useRef(true);
useEffect(() => () => { mountedRef.current = false; }, []);
if (mountedRef.current) setState(data);

// ✅ Good
useEffect(() => {
  let cancelled = false;
  (async () => {
    const data = await fetch();
    if (!cancelled) setState(data);
  })();
  return () => { cancelled = true; };
}, []);
```

### D3. `useEffect` replacing an event handler 🟡

For "user action → side effect," run the side effect directly in the handler. Effects are for "sync with an external system."

### D4. Duplicated polling logic 🟡

Two polling hooks with the same skeleton → extract a shared `usePollingBase`.

### D5. Overuse of `useMemo` / `useCallback` 🟢

Unnecessary for primitives and trivial functions. The deps-maintenance tax exceeds the benefit.

- Use when: expensive compute, a memoized child consumer, an effect dependency
- Don't use for: `useMemo(() => x + 1, [x])`

### D6. Oversized `useCallback` dep arrays 🟡

Ten-plus dependencies means memoization produces a new function on almost every render — consolidate state into `useReducer` to shrink the deps.

---

## E. Rendering

### E1. Array index as `key` 🟡

List reordering/deletion causes component remounts and input-value loss.

```tsx
// ❌ Bad
{items.map((item, index) => <Row key={index} {...item} />)}

// ✅ Good
{items.map((item) => <Row key={item.id} {...item} />)}
```

**ESLint**: `react/no-array-index-key: error`

### E2. Inline style objects 🟡

```tsx
// ❌ Bad — new object every render
<div style={{ width: `${percent}%` }} />

// ✅ Good — CSS variable
<div style={{ '--w': `${percent}%` } as CSSProperties} className="w-[var(--w)]" />
// or Tailwind arbitrary value
<div className={`w-[${percent}%]`} />
```

### E3. Nested ternaries (3+ levels) 🟡

```tsx
// ❌ Bad
const color = isSuccess ? colors.success : isFail ? colors.error : colors.pending;

// ✅ Good — lookup map
const STATUS_STYLES = {
  success: colors.success,
  fail: colors.error,
  pending: colors.pending,
} as const;
const style = STATUS_STYLES[status];
```

### E4. Long `&&` chains in conditional rendering 🟡

Four or more conditions chained inside JSX → split into section components.

### E5. Building `className` with template literals 🟢

→ use the `cn()` helper (project standard).

---

## F. Error Handling

### F1. Native `alert()` 🔴

Untestable, breaks UI consistency, can't represent per-case messages.

```tsx
// ❌ Bad
alert(err.message);

// ✅ Good — global toast or error state
const [error, setError] = useState<Error | null>(null);
// or useToast().error(err.message);
```

### F2. `try/catch` silent swallow 🟡

```tsx
// ❌ Bad
try { await fetch(); } catch {}
try { await fetch(); } catch { console.log('fail'); }

// ✅ Good
try {
  await fetch();
} catch (err) {
  logger.error('fetch failed', { err });
  setError(err instanceof Error ? err : new Error(String(err)));
}
```

### F3. Returning `null` instead of throwing 🟡

Callers can't tell "no data" from "error."

```tsx
// ❌ Bad
const fetchStatus = async () => {
  try { return await api.get(); } catch { return null; }
};

// ✅ Good — throw or Result tuple
const fetchStatus = async () => {
  return await api.get();  // caller handles with try/catch
};
// or
const fetchStatus = async (): Promise<Result<Data>> => { … };
```

### F4. Writing `try/catch` by hand (project rule) 🟡

→ use `useApiMutation()` or `fetchJson` (ADR-008). Errors are normalized to `AppError`.

---

## G. Naming & Constants

### G1. Magic numbers 🟡

```tsx
// ❌ Bad
setInterval(poll, 10_000);
setTimeout(() => setCopied(false), 1500);

// ✅ Good
// lib/constants/timings.ts
export const TIMINGS = {
  PROCESS_STATUS_POLL_MS: 10_000,
  COPY_FEEDBACK_MS: 1500,
  TOAST_HIDE_MS: 2000,
} as const;
```

### G2. Duplicated constants 🟡

The same constant (`CREDENTIAL_PREVIEW_COUNT = 3`, `COLLAPSE_THRESHOLD = 5`) defined in multiple files means every change risks a skipped site.

→ centralize in `lib/constants/ui.ts`.

### G3. String-literal status comparisons (Primitive Obsession) 🟡

```tsx
// ❌ Bad
if (status === 'VALID') …
if (item.status === 'APPROVED' || item.status === 'PENDING') …

// ✅ Good — `as const` object
export const ResourceStatus = {
  VALID: 'VALID',
  INVALID: 'INVALID',
  PENDING: 'PENDING',
} as const;
export type ResourceStatus = typeof ResourceStatus[keyof typeof ResourceStatus];

if (status === ResourceStatus.VALID) …
```

### G4. Non-verb or vague function names 🟢

```tsx
// ❌ Bad
const fetch = async () => …;   // fetch what?
const poll = async () => …;    // poll what?
const handle = () => …;        // handle what?

// ✅ Good
const fetchTestConnectionHistory = async () => …;
const pollProcessStatus = async () => …;
const handleApproveClick = () => …;
```

### G5. Booleans without an `is/has/should/can` prefix 🟢

```ts
// ❌ Bad
interface Props {
  confirmed: boolean;
  success: boolean;
  firewallOpened: boolean;
}

// ✅ Good
interface Props {
  isConfirmed: boolean;
  hasSucceeded: boolean;
  isFirewallOpen: boolean;
}
```

### G6. Hardcoded error messages 🟢

Strings like "조회에 실패했습니다" duplicated across files → i18n and typo-fix cost explodes.

→ centralize in `lib/constants/messages.ts`.

---

## Auto-enforceable via lint

| Anti-pattern | ESLint rule |
|--------------|-------------|
| A1 `!` | `@typescript-eslint/no-non-null-assertion` |
| A2 `as` | `@typescript-eslint/consistent-type-assertions` |
| A4 `@ts-ignore` | `@typescript-eslint/ban-ts-comment` |
| A5 `any` | `@typescript-eslint/no-explicit-any` |
| F1 `alert` | `no-alert` |
| E1 index key | `react/no-array-index-key` |
| relative import | `no-restricted-imports` |

---

## API boundary anti-patterns (separate)

Confusion about BFF / CSR / SSR API boundaries is covered in a dedicated document → `docs/api/boundaries.md`

Core rules:
1. **CSR components** import only from `@/app/lib/api/*` (never `@/lib/api-client/*`)
2. **Server Components** import only from `@/lib/bff/*`
3. **Next.js Route Handlers** use only `@/lib/api-client/*`
4. Never mix two boundaries in a single file

---

## Usage guide

### When writing code
- Skim the categories for matching patterns and self-check
- Lint-enforced rules block automatically

### When reviewing code
- Reviewers cite items by number (e.g., "AP-A1 — non-null assertion")
- 🔴 items block merge

### When prioritizing refactors
1. Start with 🔴 (critical) items
2. When the same anti-pattern appears N places, fix them in one PR (avoid Shotgun Surgery)

### Classic anti-pattern mapping
| Classic name | This doc |
|--------------|----------|
| God Object | B1, C1 |
| Primitive Obsession | G3 |
| Shotgun Surgery | B3, G1, G2 |
| Long Parameter List | B2, B5 |
| Data Clumps | C1, C3 |
| Feature Envy | (API boundary) |
| Duplicate Code | D4, B3, G2, G6 |
