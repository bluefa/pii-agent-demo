# A3. Destructuring API responses without a type guard

Severity: 🟡 important

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
