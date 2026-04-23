# G7. Vague parameter names (`fn`, `cb`, `data`, `val`)

Severity: 🟡 important

Naming a callback/function parameter `fn` / `cb` / `handler` erases intent at the call site — the reader can't tell *what* the function fetches or does without opening the body. The type signature shows shape, not meaning. The cost is highest in reusable hooks and utilities, where many unrelated callers have to decode the same vague name.

```ts
// ❌ Bad — name tells you nothing; you must read the body
const run = useCallback(
  async (fn: (id: number) => Promise<T>, setInFlight: (v: boolean) => void) => {
    setInFlight(true);
    const data = await fn(targetSourceId);
    setStatus(data);
  },
  [targetSourceId],
);

// ✅ Good — name declares the role ("fetches status")
const run = useCallback(
  async (fetcher: (id: number) => Promise<T>, setInFlight: (v: boolean) => void) => {
    setInFlight(true);
    const data = await fetcher(targetSourceId);
    setStatus(data);
  },
  [targetSourceId],
);
```

Pick by role:
- fetch-shaped → `fetcher` (SWR / React Query convention)
- event reaction → not `handler`, but `onApprove` / `onSelect` — name the action
- value transform → `mapper`, `transform`, `selector`
- predicate → `validator`, `predicate`, `isEligible`
- payload → not `data` / `val`, but `response` / `row` / `record` — name the entity

Rule of thumb: if the parameter name alone doesn't let a reader guess what the caller is passing, rename it.
