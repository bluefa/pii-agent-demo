# G3. String-literal status comparisons (Primitive Obsession)

Severity: 🟡 important

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
