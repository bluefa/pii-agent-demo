# C2. Server state in `useState`

Severity: 🔴 critical

API responses stored only in local useState → refetch on every mount, no caching.

→ Adopt React Query / SWR / Zustand (incrementally).
