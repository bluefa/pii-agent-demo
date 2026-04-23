# D2. `mountedRef.current` overuse

Severity: 🟡 important

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
