# D5. Overuse of `useMemo` / `useCallback`

Severity: 🟢 nice-to-have

Unnecessary for primitives and trivial functions. The deps-maintenance tax exceeds the benefit.

- Use when: expensive compute, a memoized child consumer, an effect dependency
- Don't use for: `useMemo(() => x + 1, [x])`
