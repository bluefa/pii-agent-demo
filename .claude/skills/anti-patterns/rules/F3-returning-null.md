# F3. Returning `null` instead of throwing

Severity: 🟡 important

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
