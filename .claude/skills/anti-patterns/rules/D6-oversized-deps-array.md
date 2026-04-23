# D6. Oversized `useCallback` dep arrays

Severity: 🟡 important

Ten-plus dependencies means memoization produces a new function on almost every render — consolidate state into `useReducer` to shrink the deps.

See also: **C1** — when dep count blows up, the underlying cause is usually scattered useState that a reducer would collapse.
