# D1. Objects/arrays as direct `useEffect` dependencies

Severity: 🟡 important

A parent sending a fresh reference each render → effect loops forever.

```tsx
// ❌ Bad
useEffect(() => { …; }, [isOpen, missingResources]);  // new array every render

// ✅ Good
const ids = useMemo(() => missingResources.map((r) => r.id).join(','), [missingResources]);
useEffect(() => { …; }, [isOpen, ids]);
```
