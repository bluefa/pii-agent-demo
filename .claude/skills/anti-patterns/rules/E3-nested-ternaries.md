# E3. Nested ternaries (3+ levels)

Severity: 🟡 important

```tsx
// ❌ Bad
const color = isSuccess ? colors.success : isFail ? colors.error : colors.pending;

// ✅ Good — lookup map
const STATUS_STYLES = {
  success: colors.success,
  fail: colors.error,
  pending: colors.pending,
} as const;
const style = STATUS_STYLES[status];
```
