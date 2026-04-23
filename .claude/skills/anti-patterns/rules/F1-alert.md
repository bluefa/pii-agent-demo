# F1. Native `alert()`

Severity: 🔴 critical

Untestable, breaks UI consistency, can't represent per-case messages.

```tsx
// ❌ Bad
alert(err.message);

// ✅ Good — global toast or error state
const [error, setError] = useState<Error | null>(null);
// or useToast().error(err.message);
```

**ESLint**: `no-alert`
