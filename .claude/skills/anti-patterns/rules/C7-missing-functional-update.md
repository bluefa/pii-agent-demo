# C7. Missing functional updates when prior state matters

Severity: 🟢 nice-to-have

```tsx
// ❌ Bad
setCount(count + 1);  // stale closure risk

// ✅ Good
setCount((prev) => prev + 1);
```
