# E1. Array index as `key`

Severity: 🟡 important

List reordering/deletion causes component remounts and input-value loss.

```tsx
// ❌ Bad
{items.map((item, index) => <Row key={index} {...item} />)}

// ✅ Good
{items.map((item) => <Row key={item.id} {...item} />)}
```

**ESLint**: `react/no-array-index-key: error`
