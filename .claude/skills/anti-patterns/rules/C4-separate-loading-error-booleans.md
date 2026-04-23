# C4. Separate booleans for loading & error

Severity: 🟡 important

`loading && error` becomes a representable impossible state → use a state machine.

```tsx
// ❌ Bad
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

// ✅ Good
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```
