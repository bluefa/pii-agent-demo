# React Pattern Checker

> In `/team-dev`, the `code-reviewer` agent includes this lens.

Review React behavior and component structure for concrete merge risk. Prefer
the current `coding-standards`, `frontend-design`, and
`vercel-react-best-practices` guidance over this helper if they disagree.

## Review Items

1. State and effects
   - Hooks are not called conditionally or inside loops.
   - Custom hooks use the `use` prefix.
   - State is not duplicated when it can be derived safely.
   - UI event flows use existing hooks such as `useModal`, `useApiMutation`,
     `useApiAction`, polling hooks, or `useAbortableEffect` when they fit.

2. Component size and cohesion
   - Components over roughly 300 lines deserve review, but size alone is not a
     finding.
   - Flag extraction only when the current diff makes behavior hard to verify
     or likely to regress.

3. External state
   - Do not introduce Redux, Zustand, Jotai, Recoil, or similar state
     libraries without explicit architecture approval.
   - React Context is allowed when it matches existing local patterns.

4. Next.js behavior
   - Preserve Server Component vs Client Component boundaries.
   - Avoid unnecessary client-side code in server-only paths.

## Output

Use `P1`/`P2`/`P3` severity only when there is an actual behavioral,
architecture, or maintenance risk. Avoid preference-only comments.
